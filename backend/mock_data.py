import random
import json
from datetime import datetime, timedelta

random.seed(42)

TOPIC_POOL = [
    {"name": "半导体芯片", "category": "科技", "description": "半导体芯片产业链，包括设计、制造、封测等环节", "related": ["AI大模型", "算力", "消费电子"]},
    {"name": "AI大模型", "category": "科技", "description": "人工智能大语言模型相关概念，涵盖训练、推理、应用等", "related": ["算力", "数据要素", "Sora概念"]},
    {"name": "机器人", "category": "制造", "description": "工业机器人、服务机器人及核心零部件", "related": ["人形机器人", "AI大模型", "半导体芯片"]},
    {"name": "新能源汽车", "category": "新能源", "description": "新能源汽车整车及产业链上下游", "related": ["固态电池", "光伏", "铜缆高速连接"]},
    {"name": "光伏", "category": "新能源", "description": "光伏产业链，硅料、硅片、电池片、组件等", "related": ["新能源汽车", "固态电池"]},
    {"name": "军工", "category": "国防", "description": "国防军工相关产业链", "related": ["半导体芯片", "低空经济"]},
    {"name": "医药", "category": "医疗", "description": "医药生物产业链，创新药、医疗器械等", "related": ["消费电子"]},
    {"name": "消费电子", "category": "消费", "description": "消费电子产品及产业链，手机、VR/AR等", "related": ["半导体芯片", "AI大模型", "鸿蒙概念"]},
    {"name": "数字经济", "category": "科技", "description": "数字经济相关概念，数字化转型、数据要素等", "related": ["数据要素", "AI大模型"]},
    {"name": "量子计算", "category": "科技", "description": "量子计算技术及相关产业链", "related": ["半导体芯片", "AI大模型"]},
    {"name": "低空经济", "category": "新兴", "description": "低空经济相关概念，eVTOL、无人机等", "related": ["飞行汽车", "军工"]},
    {"name": "固态电池", "category": "新能源", "description": "固态电池技术及产业链", "related": ["新能源汽车", "光伏"]},
    {"name": "人形机器人", "category": "制造", "description": "人形机器人整机及核心零部件", "related": ["机器人", "AI大模型", "半导体芯片"]},
    {"name": "算力", "category": "科技", "description": "AI算力基础设施，服务器、光模块等", "related": ["AI大模型", "CPO", "半导体芯片"]},
    {"name": "数据要素", "category": "科技", "description": "数据要素市场化相关概念", "related": ["数字经济", "AI大模型"]},
    {"name": "鸿蒙概念", "category": "科技", "description": "华为鸿蒙生态相关产业链", "related": ["消费电子", "半导体芯片"]},
    {"name": "CPO", "category": "科技", "description": "共封装光学技术，光模块与交换芯片共封装", "related": ["算力", "铜缆高速连接"]},
    {"name": "铜缆高速连接", "category": "科技", "description": "高速铜缆连接技术及相关产业链", "related": ["CPO", "算力"]},
    {"name": "Sora概念", "category": "科技", "description": "OpenAI Sora视频生成模型相关概念", "related": ["AI大模型", "算力"]},
    {"name": "飞行汽车", "category": "新兴", "description": "飞行汽车/eVTOL相关概念", "related": ["低空经济", "新能源汽车"]},
    {"name": "脑机接口", "category": "新兴", "description": "脑机接口技术及相关产业链", "related": ["AI大模型", "医药"]},
    {"name": "核聚变", "category": "新能源", "description": "可控核聚变技术及产业链", "related": ["光伏", "量子计算"]},
]

STOCK_POOL = {
    "半导体芯片": [
        ("688981", "中芯国际"), ("002371", "北方华创"), ("688012", "中微公司"),
        ("603501", "韦尔股份"), ("688396", "华润微"), ("300661", "圣邦股份"),
        ("688521", "芯原股份"), ("300782", "卓胜微"), ("688256", "寒武纪"),
        ("002049", "紫光国微"),
    ],
    "AI大模型": [
        ("688787", "海天瑞声"), ("688041", "海光信息"), ("300454", "深信服"),
        ("688047", "龙芯中科"), ("300496", "中科创达"), ("688083", "中望软件"),
        ("300033", "同花顺"), ("688111", "金山办公"), ("002230", "科大讯飞"),
        ("688396", "华润微"),
    ],
    "机器人": [
        ("300124", "汇川技术"), ("688169", "石头科技"), ("002747", "埃斯顿"),
        ("300015", "爱尔眼科"), ("688017", "绿的谐波"), ("300503", "昊志机电"),
        ("002527", "新时达"), ("300607", "拓斯达"), ("688165", "埃夫特"),
        ("300159", "新研股份"),
    ],
    "新能源汽车": [
        ("300750", "宁德时代"), ("002594", "比亚迪"), ("300014", "亿纬锂能"),
        ("002460", "赣锋锂业"), ("002466", "天齐锂业"), ("300207", "欣旺达"),
        ("002812", "恩捷股份"), ("300568", "星源材质"), ("002812", "恩捷股份"),
        ("601012", "隆基绿能"),
    ],
    "光伏": [
        ("601012", "隆基绿能"), ("002459", "晶澳科技"), ("688599", "天合光能"),
        ("300274", "阳光电源"), ("688580", "爱旭股份"), ("601865", "福莱特"),
        ("002129", "TCL中环"), ("688303", "大全能源"), ("300861", "美畅股份"),
        ("601865", "福莱特"),
    ],
    "军工": [
        ("600760", "中航沈飞"), ("600893", "航发动力"), ("002179", "中航光电"),
        ("600862", "中航高科"), ("300034", "钢研高纳"), ("600990", "四创电子"),
        ("002465", "海格通信"), ("300699", "光威复材"), ("600967", "内蒙一机"),
        ("300424", "航新科技"),
    ],
    "医药": [
        ("300760", "迈瑞医疗"), ("600276", "恒瑞医药"), ("300122", "智飞生物"),
        ("603259", "药明康德"), ("300347", "泰格医药"), ("002007", "华兰生物"),
        ("300015", "爱尔眼科"), ("000538", "云南白药"), ("600085", "同仁堂"),
        ("300725", "药石科技"),
    ],
    "消费电子": [
        ("002475", "立讯精密"), ("300433", "蓝思科技"), ("002241", "歌尔股份"),
        ("600183", "生益科技"), ("002056", "横店东磁"), ("300136", "信维通信"),
        ("002156", "通富微电"), ("300431", "暴风集团"), ("688002", "睿创微纳"),
        ("603160", "汇顶科技"),
    ],
    "数字经济": [
        ("300033", "同花顺"), ("688111", "金山办公"), ("002230", "科大讯飞"),
        ("300454", "深信服"), ("688036", "传音控股"), ("300496", "中科创达"),
        ("688083", "中望软件"), ("603019", "中科曙光"), ("688041", "海光信息"),
        ("300682", "朗新集团"),
    ],
    "量子计算": [
        ("688027", "国盾量子"), ("002222", "福晶科技"), ("688561", "奇安信"),
        ("300302", "同有科技"), ("688041", "海光信息"), ("603019", "中科曙光"),
        ("300454", "深信服"), ("688521", "芯原股份"), ("300033", "同花顺"),
        ("002230", "科大讯飞"),
    ],
    "低空经济": [
        ("002097", "山河智能"), ("688070", "纵横股份"), ("300034", "钢研高纳"),
        ("600893", "航发动力"), ("002097", "山河智能"), ("688298", "东方生物"),
        ("300424", "航新科技"), ("600990", "四创电子"), ("002465", "海格通信"),
        ("300699", "光威复材"),
    ],
    "固态电池": [
        ("300750", "宁德时代"), ("300014", "亿纬锂能"), ("002594", "比亚迪"),
        ("300207", "欣旺达"), ("002812", "恩捷股份"), ("300568", "星源材质"),
        ("002460", "赣锋锂业"), ("300438", "鹏辉能源"), ("300068", "南都电源"),
        ("002074", "国轩高科"),
    ],
    "人形机器人": [
        ("688169", "石头科技"), ("300124", "汇川技术"), ("688017", "绿的谐波"),
        ("002747", "埃斯顿"), ("300503", "昊志机电"), ("688165", "埃夫特"),
        ("002527", "新时达"), ("300607", "拓斯达"), ("688047", "龙芯中科"),
        ("300159", "新研股份"),
    ],
    "算力": [
        ("603019", "中科曙光"), ("688041", "海光信息"), ("002230", "科大讯飞"),
        ("688256", "寒武纪"), ("300454", "深信服"), ("688396", "华润微"),
        ("688111", "金山办公"), ("300033", "同花顺"), ("688521", "芯原股份"),
        ("688787", "海天瑞声"),
    ],
    "数据要素": [
        ("300033", "同花顺"), ("688111", "金山办公"), ("300454", "深信服"),
        ("688036", "传音控股"), ("300496", "中科创达"), ("688083", "中望软件"),
        ("300682", "朗新集团"), ("002230", "科大讯飞"), ("688041", "海光信息"),
        ("603019", "中科曙光"),
    ],
    "鸿蒙概念": [
        ("002475", "立讯精密"), ("300496", "中科创达"), ("002230", "科大讯飞"),
        ("300433", "蓝思科技"), ("002241", "歌尔股份"), ("603160", "汇顶科技"),
        ("688111", "金山办公"), ("300033", "同花顺"), ("688083", "中望软件"),
        ("002056", "横店东磁"),
    ],
    "CPO": [
        ("300308", "中际旭创"), ("002281", "光迅科技"), ("688205", "腾景科技"),
        ("300628", "亿联网络"), ("603160", "汇顶科技"), ("688047", "龙芯中科"),
        ("002475", "立讯精密"), ("300502", "新易盛"), ("688396", "华润微"),
        ("688580", "爱旭股份"),
    ],
    "铜缆高速连接": [
        ("002475", "立讯精密"), ("300308", "中际旭创"), ("002281", "光迅科技"),
        ("300502", "新易盛"), ("688205", "腾景科技"), ("300628", "亿联网络"),
        ("600183", "生益科技"), ("002156", "通富微电"), ("300136", "信维通信"),
        ("603160", "汇顶科技"),
    ],
    "Sora概念": [
        ("688787", "海天瑞声"), ("002230", "科大讯飞"), ("300033", "同花顺"),
        ("688111", "金山办公"), ("300454", "深信服"), ("688041", "海光信息"),
        ("688256", "寒武纪"), ("603019", "中科曙光"), ("300496", "中科创达"),
        ("688521", "芯原股份"),
    ],
    "飞行汽车": [
        ("002097", "山河智能"), ("688070", "纵横股份"), ("600893", "航发动力"),
        ("300034", "钢研高纳"), ("002465", "海格通信"), ("600990", "四创电子"),
        ("300424", "航新科技"), ("600760", "中航沈飞"), ("600862", "中航高科"),
        ("300699", "光威复材"),
    ],
    "脑机接口": [
        ("688027", "国盾量子"), ("300760", "迈瑞医疗"), ("002230", "科大讯飞"),
        ("688041", "海光信息"), ("300015", "爱尔眼科"), ("688787", "海天瑞声"),
        ("300454", "深信服"), ("688256", "寒武纪"), ("603019", "中科曙光"),
        ("300033", "同花顺"),
    ],
    "核聚变": [
        ("601012", "隆基绿能"), ("600893", "航发动力"), ("002129", "TCL中环"),
        ("688027", "国盾量子"), ("300274", "阳光电源"), ("688303", "大全能源"),
        ("002460", "赣锋锂业"), ("300750", "宁德时代"), ("601865", "福莱特"),
        ("002459", "晶澳科技"),
    ],
}

TOPIC_PERSISTENCE = {
    "AI大模型": 0.85,
    "半导体芯片": 0.7,
    "算力": 0.75,
    "人形机器人": 0.8,
    "机器人": 0.65,
    "新能源汽车": 0.6,
    "光伏": 0.5,
    "军工": 0.55,
    "医药": 0.4,
    "消费电子": 0.55,
    "数字经济": 0.5,
    "量子计算": 0.35,
    "低空经济": 0.7,
    "固态电池": 0.6,
    "数据要素": 0.45,
    "鸿蒙概念": 0.5,
    "CPO": 0.65,
    "铜缆高速连接": 0.6,
    "Sora概念": 0.4,
    "飞行汽车": 0.55,
    "脑机接口": 0.3,
    "核聚变": 0.25,
}

MAIN_LINE_TOPICS = ["AI大模型", "算力", "人形机器人", "低空经济"]


def _generate_trading_days(n_days: int) -> list[str]:
    today = datetime.now()
    days = []
    current = today
    while len(days) < n_days:
        if current.weekday() < 5:
            days.append(current.strftime("%Y-%m-%d"))
        current -= timedelta(days=1)
    days.reverse()
    return days


def _select_topics_for_day(day_index: int, total_days: int) -> list[dict]:
    num_topics = random.randint(15, 20)
    weights = []
    for t in TOPIC_POOL:
        persistence = TOPIC_PERSISTENCE.get(t["name"], 0.4)
        if t["name"] in MAIN_LINE_TOPICS:
            persistence = min(persistence + 0.15, 0.95)
        cycle_phase = (day_index % 7) / 7.0
        w = persistence * (0.7 + 0.3 * (1 - abs(cycle_phase - 0.5) * 2))
        weights.append(w)

    total_w = sum(weights)
    probs = [w / total_w for w in weights]

    chosen_indices = set()
    attempts = 0
    while len(chosen_indices) < num_topics and attempts < 100:
        idx = random.choices(range(len(TOPIC_POOL)), weights=probs, k=1)[0]
        chosen_indices.add(idx)
        attempts += 1

    chosen = [TOPIC_POOL[i] for i in chosen_indices]
    return chosen


def _generate_topic_daily_data(topic: dict, rank: int, day_index: int, total_days: int) -> dict:
    is_main = topic["name"] in MAIN_LINE_TOPICS
    base_change = random.uniform(1.5, 8.0) if is_main else random.uniform(-2.0, 6.0)
    if rank <= 5:
        base_change += random.uniform(1.0, 4.0)
    elif rank <= 10:
        base_change += random.uniform(-0.5, 2.0)

    stock_count = random.randint(15, 60)
    up_limit_count = max(0, int(base_change * random.uniform(0.5, 2.0)))
    consecutive_up_days = random.randint(1, 7) if is_main else random.randint(0, 3)
    main_fund_inflow = round(random.uniform(5, 80) if base_change > 0 else random.uniform(-30, 10), 2)
    broken_limit_rate = round(random.uniform(10, 50), 2)
    consecutive_limit_count = random.randint(1, 5) if is_main else random.randint(0, 2)
    is_new_entry = random.random() < 0.15

    return {
        "rank": rank,
        "change_percent": round(base_change, 2),
        "stock_count": stock_count,
        "up_limit_count": up_limit_count,
        "consecutive_up_days": consecutive_up_days,
        "main_fund_inflow": main_fund_inflow,
        "broken_limit_rate": broken_limit_rate,
        "consecutive_limit_count": consecutive_limit_count,
        "is_new_entry": is_new_entry,
    }


def _generate_stocks_for_topic(topic_name: str, trade_date: str, topic_change: float) -> list[dict]:
    pool = STOCK_POOL.get(topic_name, STOCK_POOL["半导体芯片"])
    num_stocks = random.randint(5, min(10, len(pool)))
    chosen = random.sample(pool, num_stocks)

    stocks = []
    leader_idx = random.randint(0, min(2, num_stocks - 1))
    for i, (code, name) in enumerate(chosen):
        is_leader = i == leader_idx
        if is_leader:
            change = round(topic_change * random.uniform(1.2, 2.0), 2)
            consec = random.randint(2, 6)
        else:
            change = round(topic_change * random.uniform(0.3, 1.3) + random.uniform(-2, 2), 2)
            consec = random.randint(0, 2)

        stocks.append({
            "stock_code": code,
            "stock_name": name,
            "change_percent": change,
            "consecutive_limit_days": consec,
            "is_leader": is_leader,
            "trade_date": trade_date,
        })
    return stocks


def generate_all_mock_data() -> dict:
    trading_days = _generate_trading_days(30)
    topic_infos = []
    daily_topics = []
    topic_trends = []
    topic_stocks = []
    market_overviews = []
    rotation_records = []

    topic_id_map = {}
    for i, t in enumerate(TOPIC_POOL, start=1):
        topic_id_map[t["name"]] = i
        topic_infos.append({
            "id": i,
            "topic_name": t["name"],
            "description": t["description"],
            "related_topics": json.dumps(t["related"], ensure_ascii=False),
            "category": t["category"],
        })

    topic_day_presence = {t["name"]: [] for t in TOPIC_POOL}

    for day_idx, trade_date in enumerate(trading_days):
        chosen_topics = _select_topics_for_day(day_idx, len(trading_days))
        random.shuffle(chosen_topics)

        for t in chosen_topics:
            topic_day_presence[t["name"]].append(day_idx)

        sorted_topics = sorted(chosen_topics, key=lambda x: TOPIC_PERSISTENCE.get(x["name"], 0.4), reverse=True)

        for rank, topic in enumerate(sorted_topics, start=1):
            daily_data = _generate_topic_daily_data(topic, rank, day_idx, len(trading_days))
            daily_topics.append({
                "trade_date": trade_date,
                "topic_name": topic["name"],
                **daily_data,
            })

            tid = topic_id_map[topic["name"]]
            topic_trends.append({
                "topic_id": tid,
                "trade_date": trade_date,
                "change_percent": daily_data["change_percent"],
                "rank": rank,
            })

            stocks = _generate_stocks_for_topic(topic["name"], trade_date, daily_data["change_percent"])
            for s in stocks:
                s["topic_id"] = tid
                topic_stocks.append(s)

        sh_change = round(random.uniform(-2.5, 2.5), 2)
        cyb_change = round(sh_change + random.uniform(-3, 3), 2)
        market_overviews.append({
            "trade_date": trade_date,
            "sh_index_change": sh_change,
            "cyb_index_change": cyb_change,
            "profit_effect_rate": round(random.uniform(30, 70), 2),
            "broken_limit_rate": round(random.uniform(15, 45), 2),
            "hot_topic_count": len(sorted_topics),
        })

        if day_idx > 0:
            prev_topics = {dt["topic_name"] for dt in daily_topics if dt["trade_date"] == trading_days[day_idx - 1]}
            curr_topics = {t["name"] for t in chosen_topics}

            fading = prev_topics - curr_topics
            emerging = curr_topics - prev_topics

            for src_name in fading:
                for tgt_name in emerging:
                    if random.random() < 0.3:
                        src_info = next((t for t in TOPIC_POOL if t["name"] == src_name), None)
                        tgt_info = next((t for t in TOPIC_POOL if t["name"] == tgt_name), None)
                        if src_info and tgt_info and tgt_name in src_info.get("related", []):
                            rotation_records.append({
                                "source_topic_id": topic_id_map[src_name],
                                "target_topic_id": topic_id_map[tgt_name],
                                "trade_date": trade_date,
                                "rotation_strength": round(random.uniform(0.3, 1.0), 2),
                                "time_lag_days": 1,
                            })

            for src_name in prev_topics & curr_topics:
                for tgt_name in emerging:
                    if random.random() < 0.15:
                        src_info = next((t for t in TOPIC_POOL if t["name"] == src_name), None)
                        if src_info and tgt_name in src_info.get("related", []):
                            rotation_records.append({
                                "source_topic_id": topic_id_map[src_name],
                                "target_topic_id": topic_id_map[tgt_name],
                                "trade_date": trade_date,
                                "rotation_strength": round(random.uniform(0.2, 0.8), 2),
                                "time_lag_days": random.randint(1, 3),
                            })

    return {
        "topic_infos": topic_infos,
        "daily_topics": daily_topics,
        "topic_trends": topic_trends,
        "topic_stocks": topic_stocks,
        "market_overviews": market_overviews,
        "rotation_records": rotation_records,
    }
