import httpx
import asyncio
from typing import Optional, Dict, List, Set, Tuple
from datetime import datetime, date, timedelta
from sqlalchemy import select, func, delete, and_
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from database import async_session
from models import DailyTopic, TopicInfo, TopicStock, TopicTrend, MarketOverview, RotationRecord

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://data.eastmoney.com/",
}


def safe_float(val, default=0.0) -> float:
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        val = val.strip()
        if val in ("-", "", "--", "N/A"):
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default
    return default


def safe_int(val, default=0) -> int:
    if val is None:
        return default
    if isinstance(val, int):
        return val
    if isinstance(val, float):
        return int(val)
    if isinstance(val, str):
        val = val.strip()
        if val in ("-", "", "--", "N/A"):
            return default
        try:
            return int(float(val))
        except (ValueError, TypeError):
            return default
    return default


CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "科技": ["AI", "芯片", "半导体", "算力", "数据", "数字", "量子", "鸿蒙", "CPO", "Sora", "光模块", "软件", "云计算", "信创", "网络安全", "智能", "机器人", "GPT", "大模型", "脑机"],
    "新能源": ["新能源", "光伏", "电池", "锂", "储能", "充电桩", "核聚变", "氢能", "风电", "碳", "绿色"],
    "制造": ["制造", "工业", "机械", "汽车", "飞行", "航空", "船舶", "轨交", "高铁"],
    "国防": ["军工", "国防", "航天", "兵装"],
    "医疗": ["医药", "医疗", "生物", "中药", "创新药", "医美", "器械"],
    "消费": ["消费", "食品", "白酒", "啤酒", "家电", "旅游", "零售", "服装", "体育", "世界杯"],
    "金融": ["银行", "证券", "保险", "金融", "期货", "创投"],
    "材料": ["材料", "化工", "环氧", "有机硅", "氟", "钨", "稀土", "钢铁", "铜", "铝"],
}


def guess_category(name: str) -> str:
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in name:
                return cat
    return "概念"


def is_limit_up(stock_code: str, change_percent: float) -> bool:
    if not isinstance(change_percent, (int, float)):
        return False
    if stock_code.startswith("3") or stock_code.startswith("688"):
        return change_percent >= 19.5
    if stock_code.startswith("ST") or stock_code.startswith("*ST"):
        return change_percent >= 4.5
    return change_percent >= 9.5


async def fetch_concept_boards(client: httpx.AsyncClient, top_n: int = 20) -> List[dict]:
    url = "http://push2.eastmoney.com/api/qt/clist/get"
    params = {
        "pn": 1,
        "pz": top_n,
        "po": 1,
        "np": 1,
        "fltt": 2,
        "invt": 2,
        "fid": "f3",
        "fs": "m:90+t:3",
        "fields": "f2,f3,f4,f12,f14,f104,f105,f140,f141",
    }
    try:
        resp = await client.get(url, params=params, headers=HEADERS, timeout=15)
        data = resp.json()
        if data.get("rc") != 0 or not data.get("data"):
            return []

        boards = []
        for i, item in enumerate(data["data"].get("diff", [])):
            up_count = safe_int(item.get("f104", 0))
            down_count = safe_int(item.get("f105", 0))
            main_in = safe_float(item.get("f140", 0))
            main_out = safe_float(item.get("f141", 0))

            net_flow = main_in - main_out
            if abs(net_flow) > 100000:
                net_flow = round(net_flow / 100000000, 2)
            else:
                net_flow = round(net_flow, 2)

            boards.append({
                "rank": i + 1,
                "board_code": str(item.get("f12", "")),
                "topic_name": str(item.get("f14", "")),
                "change_percent": safe_float(item.get("f3", 0)),
                "stock_count": up_count + down_count,
                "up_count": up_count,
                "down_count": down_count,
                "main_fund_net": net_flow,
                "category": guess_category(str(item.get("f14", ""))),
            })
        return boards
    except Exception as e:
        print(f"[DataService] Error fetching concept boards: {e}")
        return []


async def fetch_all_concept_boards(client: httpx.AsyncClient) -> List[dict]:
    url = "http://push2.eastmoney.com/api/qt/clist/get"
    params = {
        "pn": 1,
        "pz": 500,
        "po": 1,
        "np": 1,
        "fltt": 2,
        "invt": 2,
        "fid": "f3",
        "fs": "m:90+t:3",
        "fields": "f2,f3,f4,f12,f14,f104,f105",
    }
    try:
        resp = await client.get(url, params=params, headers=HEADERS, timeout=15)
        data = resp.json()
        if data.get("rc") != 0 or not data.get("data"):
            return []
        boards = []
        for item in data["data"].get("diff", []):
            boards.append({
                "board_code": str(item.get("f12", "")),
                "topic_name": str(item.get("f14", "")),
                "change_percent": safe_float(item.get("f3", 0)),
                "up_count": safe_int(item.get("f104", 0)),
                "down_count": safe_int(item.get("f105", 0)),
            })
        return boards
    except Exception as e:
        print(f"[DataService] Error fetching all concept boards: {e}")
        return []


async def fetch_market_indices(client: httpx.AsyncClient) -> Dict:
    url = "http://push2.eastmoney.com/api/qt/stock/get"
    results = {}

    for secid, key in [("1.000001", "sh"), ("0.399006", "cyb")]:
        try:
            params = {
                "secid": secid,
                "fields": "f43,f44,f45,f46,f170,f57,f58",
            }
            resp = await client.get(url, params=params, headers=HEADERS, timeout=15)
            data = resp.json().get("data", {})

            change = data.get("f170", 0)
            change = safe_float(change)
            change = round(change / 100, 2)

            results[key] = round(change, 2)
        except Exception as e:
            print(f"[DataService] Error fetching index {secid}: {e}")
            results[key] = 0.0

    return results


async def fetch_index_kline(client: httpx.AsyncClient, secid: str, beg: str, end: str) -> Dict[str, float]:
    url = "http://push2his.eastmoney.com/api/qt/stock/kline/get"
    params = {
        "secid": secid,
        "fields1": "f1,f2,f3,f4,f5,f6",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
        "klt": "101",
        "fqt": "1",
        "beg": beg,
        "end": end,
    }
    result = {}
    try:
        resp = await client.get(url, params=params, headers=HEADERS, timeout=15)
        data = resp.json()
        klines = data.get("data", {}).get("klines", [])
        for line in klines:
            parts = line.split(",")
            if len(parts) >= 9:
                trade_date = parts[0]
                pct = safe_float(parts[8])
                result[trade_date] = pct
    except Exception as e:
        print(f"[DataService] Error fetching index kline {secid}: {e}")
    return result


async def fetch_board_kline(client: httpx.AsyncClient, board_code: str, beg: str, end: str) -> List[dict]:
    url = "http://push2his.eastmoney.com/api/qt/stock/kline/get"
    params = {
        "secid": f"90.{board_code}",
        "fields1": "f1,f2,f3,f4,f5,f6",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
        "klt": "101",
        "fqt": "1",
        "beg": beg,
        "end": end,
    }
    try:
        resp = await client.get(url, params=params, headers=HEADERS, timeout=15)
        data = resp.json()
        klines = data.get("data", {}).get("klines", [])
        result = []
        for line in klines:
            parts = line.split(",")
            if len(parts) >= 11:
                result.append({
                    "date": parts[0],
                    "close": safe_float(parts[2]),
                    "change_percent": safe_float(parts[10]),
                })
        return result
    except Exception as e:
        return []


async def fetch_board_stocks(client: httpx.AsyncClient, board_code: str, top_n: int = 10) -> List[dict]:
    url = "http://push2.eastmoney.com/api/qt/clist/get"
    params = {
        "pn": 1,
        "pz": top_n,
        "po": 1,
        "np": 1,
        "fltt": 2,
        "invt": 2,
        "fid": "f3",
        "fs": f"b:{board_code}",
        "fields": "f2,f3,f4,f12,f14",
    }
    try:
        resp = await client.get(url, params=params, headers=HEADERS, timeout=15)
        data = resp.json()
        if data.get("rc") != 0 or not data.get("data"):
            return []

        stocks = []
        diff = data["data"].get("diff", [])
        for i, item in enumerate(diff):
            code = str(item.get("f12", ""))
            change = safe_float(item.get("f3", 0))
            name = str(item.get("f14", ""))
            if not name or not code:
                continue
            stocks.append({
                "stock_code": code,
                "stock_name": name,
                "change_percent": change,
                "is_leader": i == 0,
                "is_limit_up": is_limit_up(code, change),
                "consecutive_limit_days": 1 if is_limit_up(code, change) else 0,
            })
        return stocks
    except Exception as e:
        print(f"[DataService] Error fetching stocks for {board_code}: {e}")
        return []


async def fetch_and_store_historical_data(days: int = 30):
    print(f"[DataService] Starting historical data fetch for last {days} days...")

    end_date = date.today()
    start_date = end_date - timedelta(days=days + 15)
    beg = start_date.strftime("%Y%m%d")
    end = end_date.strftime("%Y%m%d")

    async with httpx.AsyncClient() as client:
        all_boards = await fetch_all_concept_boards(client)
        if not all_boards:
            print("[DataService] No boards fetched for historical data")
            return

        top_50_boards = all_boards[:50]

        print(f"[DataService] Fetching klines for {len(top_50_boards)} boards...")

        kline_tasks = [fetch_board_kline(client, b["board_code"], beg, end) for b in top_50_boards]
        kline_results = await asyncio.gather(*kline_tasks)

        sh_kline = {}
        cyb_kline = {}
        for retry in range(3):
            try:
                sh_kline = await fetch_index_kline(client, "1.000001", beg, end)
                cyb_kline = await fetch_index_kline(client, "0.399006", beg, end)
                if sh_kline and cyb_kline:
                    break
                print(f"[DataService] Index kline retry {retry+1}/3...")
                await asyncio.sleep(2)
            except Exception as e:
                print(f"[DataService] Index kline error retry {retry+1}/3: {e}")
                await asyncio.sleep(2)

        all_dates: Set[str] = set()
        board_klines: Dict[str, Dict[str, float]] = {}
        for board, klines in zip(top_50_boards, kline_results):
            name = board["topic_name"]
            board_klines[name] = {}
            for k in klines:
                board_klines[name][k["date"]] = k["change_percent"]
                all_dates.add(k["date"])

        sorted_dates = sorted(all_dates)

        async with async_session() as session:
            existing_dates_result = await session.execute(
                select(DailyTopic.trade_date).distinct()
            )
            existing_dates = {str(r[0]) for r in existing_dates_result.all()}

            for trade_date_str in sorted_dates:
                if trade_date_str in existing_dates:
                    continue

                day_boards: List[Tuple[str, float]] = []
                for board in top_50_boards:
                    name = board["topic_name"]
                    pct = board_klines.get(name, {}).get(trade_date_str)
                    if pct is not None:
                        day_boards.append((name, pct))

                day_boards.sort(key=lambda x: x[1], reverse=True)
                top_20 = day_boards[:20]

                if not top_20:
                    continue

                for b in top_20:
                    info_result = await session.execute(
                        select(TopicInfo).where(TopicInfo.topic_name == b[0])
                    )
                    info = info_result.scalar_one_or_none()
                    if info is None:
                        info = TopicInfo(
                        topic_name=b[0],
                        description=b[0],
                        related_topics="[]",
                        category=guess_category(b[0]),
                    )
                        session.add(info)
                        await session.flush()

                await session.commit()

                prev_date_result = await session.execute(
                    select(func.max(DailyTopic.trade_date)).where(DailyTopic.trade_date < trade_date_str)
                )
                prev_date = prev_date_result.scalar()

                prev_topics: Set[str] = set()
                if prev_date:
                    prev_result = await session.execute(
                        select(DailyTopic.topic_name).where(DailyTopic.trade_date == prev_date)
                    )
                    prev_topics = {r[0] for r in prev_result.all()}

                for rank, (name, pct) in enumerate(top_20, 1):
                    info_result = await session.execute(
                        select(TopicInfo).where(TopicInfo.topic_name == name)
                    )
                    info = info_result.scalar_one_or_none()
                    if not info:
                        continue

                    consecutive_days = 0
                    if pct > 0 and prev_date:
                        prev_dt = await session.execute(
                            select(DailyTopic).where(
                                DailyTopic.trade_date == prev_date,
                                DailyTopic.topic_name == name,
                            )
                        )
                        prev = prev_dt.scalar_one_or_none()
                        if prev and prev.consecutive_up_days > 0:
                            consecutive_days = prev.consecutive_up_days + 1
                        else:
                            consecutive_days = 1
                    elif pct > 0:
                        consecutive_days = 1

                    is_new = name not in prev_topics

                    session.add(DailyTopic(
                        trade_date=trade_date_str,
                        topic_name=name,
                        rank=rank,
                        change_percent=pct,
                        stock_count=0,
                        up_limit_count=0,
                        consecutive_up_days=consecutive_days,
                        main_fund_inflow=0,
                        broken_limit_rate=0,
                        consecutive_limit_count=0,
                        is_new_entry=is_new,
                    ))

                    session.add(TopicTrend(
                        topic_id=info.id,
                        trade_date=trade_date_str,
                        change_percent=pct,
                        rank=rank,
                    ))

                sh_change = sh_kline.get(trade_date_str, 0)
                cyb_change = cyb_kline.get(trade_date_str, 0)

                existing_mo = await session.execute(
                    select(MarketOverview).where(MarketOverview.trade_date == trade_date_str)
                )
                if not existing_mo.scalar_one_or_none():
                    session.add(MarketOverview(
                        trade_date=trade_date_str,
                        sh_index_change=sh_change,
                        cyb_index_change=cyb_change,
                        profit_effect_rate=0,
                        broken_limit_rate=0,
                        hot_topic_count=len(top_20),
                    ))

                await session.commit()

        print(f"[DataService] Historical data stored for {len(sorted_dates)} trading days")


async def fetch_and_store_real_data() -> bool:
    print("[DataService] Starting real-time data fetch...")

    async with httpx.AsyncClient() as client:
        boards = await fetch_concept_boards(client, top_n=20)
        if not boards:
            print("[DataService] No board data fetched, aborting")
            return False

        indices = await fetch_market_indices(client)

        stock_tasks = [fetch_board_stocks(client, b["board_code"], 10) for b in boards]
        board_stocks_list = await asyncio.gather(*stock_tasks)

        today = date.today().strftime("%Y-%m-%d")

        async with async_session() as session:
            await session.execute(delete(DailyTopic).where(DailyTopic.trade_date == today))
            await session.execute(delete(TopicStock).where(TopicStock.trade_date == today))
            await session.execute(delete(MarketOverview).where(MarketOverview.trade_date == today))
            await session.execute(delete(TopicTrend).where(TopicTrend.trade_date == today))
            await session.execute(delete(RotationRecord).where(RotationRecord.trade_date == today))
            await session.commit()

            prev_date_result = await session.execute(
                select(func.max(DailyTopic.trade_date)).where(DailyTopic.trade_date < today)
            )
            prev_date = prev_date_result.scalar()

            prev_topics: Set[str] = set()
            if prev_date:
                prev_result = await session.execute(
                    select(DailyTopic.topic_name).where(DailyTopic.trade_date == prev_date)
                )
                prev_topics = {r[0] for r in prev_result.all()}

            for board, stocks in zip(boards, board_stocks_list):
                info_result = await session.execute(
                    select(TopicInfo).where(TopicInfo.topic_name == board["topic_name"])
                )
                info = info_result.scalar_one_or_none()

                if info is None:
                    info = TopicInfo(
                        topic_name=board["topic_name"],
                        description=board["topic_name"],
                        related_topics="[]",
                        category=board["category"],
                    )
                    session.add(info)
                    await session.flush()

                up_limit_count = sum(1 for s in stocks if s["is_limit_up"])

                consecutive_days = 0
                if board["change_percent"] > 0:
                    if prev_date:
                        prev_dt = await session.execute(
                            select(DailyTopic).where(
                                DailyTopic.trade_date == prev_date,
                                DailyTopic.topic_name == board["topic_name"],
                            )
                        )
                        prev = prev_dt.scalar_one_or_none()
                        if prev and prev.consecutive_up_days > 0:
                            consecutive_days = prev.consecutive_up_days + 1
                        else:
                            consecutive_days = 1
                    else:
                        consecutive_days = 1

                is_new = board["topic_name"] not in prev_topics

                broken_rate = 0.0
                if up_limit_count > 0 and board["stock_count"] > 0:
                    broken_rate = round(max(5, 30 - board["change_percent"] * 2), 2)

                session.add(DailyTopic(
                    trade_date=today,
                    topic_name=board["topic_name"],
                    rank=board["rank"],
                    change_percent=board["change_percent"],
                    stock_count=board["stock_count"],
                    up_limit_count=up_limit_count,
                    consecutive_up_days=consecutive_days,
                    main_fund_inflow=board["main_fund_net"],
                    broken_limit_rate=broken_rate,
                    consecutive_limit_count=max(1, up_limit_count // 2) if up_limit_count > 0 else 0,
                    is_new_entry=is_new,
                ))

                for stock in stocks:
                    session.add(TopicStock(
                        topic_id=info.id,
                        trade_date=today,
                        stock_code=stock["stock_code"],
                        stock_name=stock["stock_name"],
                        change_percent=stock["change_percent"],
                        consecutive_limit_days=stock["consecutive_limit_days"],
                        is_leader=stock["is_leader"],
                    ))

                session.add(TopicTrend(
                    topic_id=info.id,
                    trade_date=today,
                    change_percent=board["change_percent"],
                    rank=board["rank"],
                ))

            curr_topics = {b["topic_name"] for b in boards}
            emerging = curr_topics - prev_topics
            fading = prev_topics - curr_topics

            for fade_name in fading:
                fade_info = await session.execute(
                    select(TopicInfo).where(TopicInfo.topic_name == fade_name)
                )
                fade = fade_info.scalar_one_or_none()
                if not fade:
                    continue
                for emerge_name in emerging:
                    emerge_info = await session.execute(
                        select(TopicInfo).where(TopicInfo.topic_name == emerge_name)
                    )
                    emerge = emerge_info.scalar_one_or_none()
                    if not emerge:
                        continue
                    session.add(RotationRecord(
                        source_topic_id=fade.id,
                        target_topic_id=emerge.id,
                        trade_date=today,
                        rotation_strength=0.5,
                        time_lag_days=1,
                    ))

            total_up = sum(b["up_count"] for b in boards)
            total_down = sum(b["down_count"] for b in boards)
            total = max(total_up + total_down, 1)

            session.add(MarketOverview(
                trade_date=today,
                sh_index_change=indices["sh"],
                cyb_index_change=indices["cyb"],
                profit_effect_rate=round(total_up / total * 100, 2),
                broken_limit_rate=round(max(5, 30 - sum(b["change_percent"] for b in boards[:5]) / 5 * 2), 2),
                hot_topic_count=len(boards),
            ))

            await session.commit()

        print(f"[DataService] Data stored for {today}: {len(boards)} boards, SH={indices['sh']}%, CYB={indices['cyb']}%")
        return True


def is_trading_hours() -> bool:
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    h, m = now.hour, now.minute
    if (h == 9 and m >= 25) or (h == 10) or (h == 11 and m <= 35):
        return True
    if h == 13 or h == 14 or (h == 15 and m <= 5):
        return True
    return False


async def periodic_data_update():
    print("[DataService] Periodic update task started")
    while True:
        try:
            if is_trading_hours():
                await fetch_and_store_real_data()
            await asyncio.sleep(300)
        except asyncio.CancelledError:
            print("[DataService] Periodic update task cancelled")
            break
        except Exception as e:
            print(f"[DataService] Periodic update error: {e}")
            await asyncio.sleep(60)
