from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from typing import Optional

from database import get_db
from models import DailyTopic, TopicInfo, TopicStock, UserFavorite
from schemas import (
    DailyTopicResponse,
    TopicInfoResponse,
    TopicStockResponse,
    UserFavoriteResponse,
    ApiResponse,
    FavoriteRequest,
)

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("/daily")
async def get_daily_topics(
    date: Optional[str] = Query(None, description="日期 YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    if date is None:
        result = await db.execute(select(func.max(DailyTopic.trade_date)))
        date = result.scalar()
        if date is None:
            return ApiResponse(code=0, data=[], message="ok")

    result = await db.execute(
        select(DailyTopic).where(DailyTopic.trade_date == date).order_by(DailyTopic.rank)
    )
    topics = result.scalars().all()
    return ApiResponse(
        code=0,
        data=[DailyTopicResponse.model_validate(t).model_dump() for t in topics],
        message="ok",
    )


@router.get("/daily/range")
async def get_topics_range(
    start: str = Query(..., description="开始日期"),
    end: str = Query(..., description="结束日期"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DailyTopic)
        .where(DailyTopic.trade_date >= start, DailyTopic.trade_date <= end)
        .order_by(DailyTopic.trade_date, DailyTopic.rank)
    )
    topics = result.scalars().all()
    return ApiResponse(
        code=0,
        data=[DailyTopicResponse.model_validate(t).model_dump() for t in topics],
        message="ok",
    )


@router.post("/favorite")
async def add_favorite(
    req: FavoriteRequest,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(UserFavorite).where(UserFavorite.topic_name == req.topic_name)
    )
    if existing.scalar_one_or_none():
        return ApiResponse(code=0, data=None, message="已收藏")
    fav = UserFavorite(topic_name=req.topic_name)
    db.add(fav)
    await db.commit()
    return ApiResponse(code=0, data=None, message="收藏成功")


@router.delete("/favorite/{topic_name}")
async def remove_favorite(
    topic_name: str,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(UserFavorite).where(UserFavorite.topic_name == topic_name))
    await db.commit()
    return ApiResponse(code=0, data=None, message="取消收藏成功")


@router.get("/favorites")
async def get_favorites(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserFavorite).order_by(UserFavorite.created_at.desc()))
    favs = result.scalars().all()
    return ApiResponse(
        code=0,
        data=[UserFavoriteResponse.model_validate(f).model_dump() for f in favs],
        message="ok",
    )


@router.get("/limit-board")
async def get_limit_board(
    date: Optional[str] = Query(None, description="日期 YYYY-MM-DD"),
    sort: str = Query("limit_days", description="排序: limit_days | heat"),
    db: AsyncSession = Depends(get_db),
):
    if date is None:
        result = await db.execute(select(func.max(TopicStock.trade_date)))
        date = result.scalar()
        if date is None:
            return ApiResponse(code=0, data=[], message="ok")

    result = await db.execute(
        select(TopicStock)
        .where(TopicStock.trade_date == date, TopicStock.consecutive_limit_days >= 1)
        .order_by(TopicStock.consecutive_limit_days.desc(), TopicStock.change_percent.desc())
    )
    stocks = result.scalars().all()

    board_data = []
    for s in stocks:
        topic_result = await db.execute(
            select(TopicInfo).where(TopicInfo.id == s.topic_id)
        )
        topic_info = topic_result.scalar_one_or_none()
        topic_name = topic_info.topic_name if topic_info else ""

        heat = s.consecutive_limit_days * 10 + (5 if s.is_leader else 0) + max(0, s.change_percent)

        board_data.append({
            "stock_code": s.stock_code,
            "stock_name": s.stock_name,
            "change_percent": s.change_percent,
            "consecutive_limit_days": s.consecutive_limit_days,
            "is_leader": s.is_leader,
            "topic_name": topic_name,
            "heat": round(heat, 1),
        })

    if sort == "heat":
        board_data.sort(key=lambda x: x["heat"], reverse=True)

    return ApiResponse(code=0, data=board_data, message="ok")


@router.get("/{topic_name}")
async def get_topic_detail(
    topic_name: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TopicInfo).where(TopicInfo.topic_name == topic_name)
    )
    info = result.scalar_one_or_none()
    if info is None:
        return ApiResponse(code=1, data=None, message="主题不存在")

    latest_result = await db.execute(
        select(DailyTopic)
        .where(DailyTopic.topic_name == topic_name)
        .order_by(DailyTopic.trade_date.desc())
        .limit(1)
    )
    latest = latest_result.scalar_one_or_none()

    return ApiResponse(
        code=0,
        data={
            "info": TopicInfoResponse.model_validate(info).model_dump(),
            "latest_daily": DailyTopicResponse.model_validate(latest).model_dump() if latest else None,
        },
        message="ok",
    )


@router.get("/{topic_name}/stocks")
async def get_topic_stocks(
    topic_name: str,
    date: Optional[str] = Query(None, description="日期 YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    info_result = await db.execute(
        select(TopicInfo).where(TopicInfo.topic_name == topic_name)
    )
    info = info_result.scalar_one_or_none()
    if info is None:
        return ApiResponse(code=1, data=[], message="主题不存在")

    query = select(TopicStock).where(TopicStock.topic_id == info.id)
    if date:
        query = query.where(TopicStock.trade_date == date)
    else:
        max_date_result = await db.execute(
            select(func.max(TopicStock.trade_date)).where(TopicStock.topic_id == info.id)
        )
        max_date = max_date_result.scalar()
        if max_date:
            query = query.where(TopicStock.trade_date == max_date)

    query = query.order_by(TopicStock.change_percent.desc())
    result = await db.execute(query)
    stocks = result.scalars().all()
    return ApiResponse(
        code=0,
        data=[TopicStockResponse.model_validate(s).model_dump() for s in stocks],
        message="ok",
    )
