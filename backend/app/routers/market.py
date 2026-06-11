from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db
from models import DailyTopic, MarketOverview, TopicInfo
from schemas import ApiResponse, MarketOverviewResponse

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/overview")
async def get_market_overview(
    date: str = Query(None, description="日期 YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    if date is None:
        result = await db.execute(select(func.max(MarketOverview.trade_date)))
        date = result.scalar()
        if date is None:
            return ApiResponse(code=1, data=None, message="无数据")

    result = await db.execute(
        select(MarketOverview).where(MarketOverview.trade_date == date)
    )
    overview = result.scalar_one_or_none()
    if overview is None:
        return ApiResponse(code=1, data=None, message="无数据")

    topics_result = await db.execute(
        select(DailyTopic).where(DailyTopic.trade_date == date).order_by(DailyTopic.rank).limit(10)
    )
    top_topics = topics_result.scalars().all()

    return ApiResponse(
        code=0,
        data={
            "overview": MarketOverviewResponse.model_validate(overview).model_dump(),
            "top_topics": [t.topic_name for t in top_topics],
        },
        message="ok",
    )


@router.get("/heatmap")
async def get_heatmap(
    db: AsyncSession = Depends(get_db),
):
    dates_result = await db.execute(
        select(DailyTopic.trade_date).distinct().order_by(DailyTopic.trade_date.desc()).limit(30)
    )
    dates = [r[0] for r in dates_result.all()]
    dates.reverse()

    heatmap = []
    for date in dates:
        topics_result = await db.execute(
            select(DailyTopic).where(DailyTopic.trade_date == date).order_by(DailyTopic.rank).limit(15)
        )
        topics = topics_result.scalars().all()

        topic_items = []
        for t in topics:
            info_result = await db.execute(
                select(TopicInfo).where(TopicInfo.topic_name == t.topic_name)
            )
            info = info_result.scalar_one_or_none()
            category = info.category if info else "其他"

            topic_items.append({
                "name": t.topic_name,
                "rank": t.rank,
                "change_percent": t.change_percent,
                "category": category,
                "consecutive_up_days": t.consecutive_up_days,
                "is_new_entry": t.is_new_entry,
            })

        heatmap.append({
            "date": date,
            "topics": topic_items,
        })

    return ApiResponse(code=0, data=heatmap, message="ok")
