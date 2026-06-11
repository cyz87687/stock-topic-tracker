from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db
from models import DailyTopic, TopicInfo, TopicTrend
from schemas import ApiResponse, TopicTrendResponse, TopicStrengthResponse

router = APIRouter(prefix="/api/trends", tags=["trends"])


@router.get("/{topic_name}")
async def get_topic_trend(
    topic_name: str,
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    info_result = await db.execute(
        select(TopicInfo).where(TopicInfo.topic_name == topic_name)
    )
    info = info_result.scalar_one_or_none()
    if info is None:
        return ApiResponse(code=1, data=[], message="主题不存在")

    result = await db.execute(
        select(TopicTrend)
        .where(TopicTrend.topic_id == info.id)
        .order_by(TopicTrend.trade_date.desc())
        .limit(days)
    )
    trends = result.scalars().all()
    trends_list = list(reversed(trends))

    daily_result = await db.execute(
        select(DailyTopic)
        .where(DailyTopic.topic_name == topic_name)
        .order_by(DailyTopic.trade_date.desc())
        .limit(days)
    )
    daily_topics = list(reversed(daily_result.scalars().all()))

    combined = []
    for t in trends_list:
        item = TopicTrendResponse.model_validate(t).model_dump()
        for d in daily_topics:
            if d.trade_date == t.trade_date:
                item["main_fund_inflow"] = d.main_fund_inflow
                item["stock_count"] = d.stock_count
                item["up_limit_count"] = d.up_limit_count
                item["consecutive_up_days"] = d.consecutive_up_days
                break
        combined.append(item)

    return ApiResponse(code=0, data=combined, message="ok")


@router.get("/{topic_name}/strength")
async def get_topic_strength(
    topic_name: str,
    db: AsyncSession = Depends(get_db),
):
    info_result = await db.execute(select(TopicInfo).where(TopicInfo.topic_name == topic_name))
    info = info_result.scalar_one_or_none()
    if info is None:
        return ApiResponse(code=1, data=None, message="主题不存在")

    result = await db.execute(
        select(DailyTopic).where(DailyTopic.topic_name == topic_name)
        .order_by(DailyTopic.trade_date.desc()).limit(10)
    )
    recent = list(reversed(result.scalars().all()))
    if not recent:
        return ApiResponse(code=0, data=None, message="无数据")

    latest = recent[-1]

    change = latest.change_percent
    if change >= 7: change_score = 25
    elif change >= 5: change_score = 20
    elif change >= 3: change_score = 15
    elif change >= 1: change_score = 8
    elif change >= 0: change_score = 3
    elif change >= -1: change_score = 1
    else: change_score = 0

    rank = latest.rank
    if rank <= 3: rank_score = 20
    elif rank <= 5: rank_score = 16
    elif rank <= 10: rank_score = 10
    elif rank <= 15: rank_score = 5
    else: rank_score = 2

    consec = latest.consecutive_up_days
    if consec >= 5: consec_score = 20
    elif consec >= 3: consec_score = 15
    elif consec >= 2: consec_score = 10
    elif consec >= 1: consec_score = 5
    else: consec_score = 0

    fund = latest.main_fund_inflow
    if fund >= 20: fund_score = 15
    elif fund >= 10: fund_score = 12
    elif fund >= 5: fund_score = 8
    elif fund >= 0: fund_score = 3
    else: fund_score = 0

    trend_score = 5
    if len(recent) >= 5:
        changes = [r.change_percent for r in recent]
        first_half = sum(changes[:len(changes)//2]) / (len(changes)//2)
        second_half = sum(changes[len(changes)//2:]) / (len(changes) - len(changes)//2)
        if second_half > first_half + 2: trend_score = 15
        elif second_half > first_half: trend_score = 10
        elif second_half < first_half - 2: trend_score = -10
        elif second_half < first_half: trend_score = 0

    limit_score = 0
    if latest.stock_count > 0:
        limit_ratio = latest.up_limit_count / latest.stock_count
        if limit_ratio >= 0.3: limit_score = 10
        elif limit_ratio >= 0.2: limit_score = 7
        elif limit_ratio >= 0.1: limit_score = 4
        elif latest.up_limit_count > 0: limit_score = 2

    heat_score = 0
    if rank <= 5 and change >= 5: heat_score = 10
    elif rank <= 10 and change >= 3: heat_score = 6
    elif change >= 2: heat_score = 3

    total = max(0, min(100, change_score + rank_score + consec_score + fund_score + trend_score + limit_score + heat_score))

    if total >= 80: overall_trend = "强势"
    elif total >= 60: overall_trend = "偏强"
    elif total >= 35: overall_trend = "一般"
    else: overall_trend = "偏弱"

    reasons = []
    if change_score >= 15: reasons.append(f"当日涨幅{change:.2f}%表现强劲")
    if rank_score >= 16: reasons.append(f"排名前{rank}位")
    if consec_score >= 10: reasons.append(f"连续{consec}天上涨")
    if fund_score >= 8: reasons.append("主力资金大幅流入")
    if trend_score >= 10: reasons.append("趋势向上加速")
    elif trend_score <= 0: reasons.append("趋势有所走弱")
    if limit_score >= 7: reasons.append(f"涨停{latest.up_limit_count}只占比高")
    if not reasons: reasons.append("整体表现平淡")

    return ApiResponse(code=0, data={
        "topic_name": topic_name,
        "strength_score": total,
        "consecutive_days": consec,
        "rank_trend": [float(r.rank) for r in recent],
        "fund_inflow_trend": [r.main_fund_inflow for r in recent],
        "overall_trend": overall_trend,
        "score_breakdown": {
            "change_score": change_score,
            "rank_score": rank_score,
            "consec_score": consec_score,
            "fund_score": fund_score,
            "trend_score": trend_score,
            "limit_score": limit_score,
            "heat_score": heat_score,
        },
        "reasons": reasons,
    }, message="ok")
