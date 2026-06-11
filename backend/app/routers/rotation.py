import json
import time
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from database import get_db
from models import DailyTopic, TopicInfo, TopicTrend, RotationRecord, MarketOverview
from schemas import (
    ApiResponse,
    RotationAnalysisResponse,
    RelationGraphResponse,
    RelationGraphNode,
    RelationGraphEdge,
    HistoryMatchResponse,
    PredictResponse,
)

router = APIRouter(prefix="/api/rotation", tags=["rotation"])


class CacheManager:
    def __init__(self, ttl: int = 14400):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._ttl = ttl

    def get(self, key: str) -> Optional[Any]:
        if key in self._store:
            entry = self._store[key]
            if time.time() - entry["ts"] < self._ttl:
                return entry["data"]
            del self._store[key]
        return None

    def set(self, key: str, data: Any):
        self._store[key] = {"data": data, "ts": time.time()}

    def clear(self, key: Optional[str] = None):
        if key:
            self._store.pop(key, None)
        else:
            self._store.clear()

    def status(self) -> Dict:
        now = time.time()
        return {
            "keys": list(self._store.keys()),
            "ages": {k: round(now - v["ts"], 0) for k, v in self._store.items()},
            "ttl": self._ttl,
        }

_cache = CacheManager(ttl=14400)


@router.get("/analysis")
async def get_rotation_analysis(
    db: AsyncSession = Depends(get_db),
):
    cached = _cache.get("analysis")
    if cached is not None:
        return cached
    max_date_result = await db.execute(select(func.max(DailyTopic.trade_date)))
    latest_date = max_date_result.scalar()
    if not latest_date:
        return ApiResponse(code=1, data=None, message="无数据")

    prev_date_result = await db.execute(
        select(func.max(DailyTopic.trade_date)).where(DailyTopic.trade_date < latest_date)
    )
    prev_date = prev_date_result.scalar()

    curr_result = await db.execute(
        select(DailyTopic).where(DailyTopic.trade_date == latest_date).order_by(DailyTopic.rank)
    )
    curr_topics = curr_result.scalars().all()

    main_line_topic = None
    main_line_days = 0
    if curr_topics:
        top_topic = curr_topics[0]
        main_line_topic = top_topic.topic_name
        main_line_days = top_topic.consecutive_up_days

    active_topics = [t.topic_name for t in curr_topics[:10]]

    fading_topics = []
    prev_topics = []
    if prev_date:
        prev_result = await db.execute(
            select(DailyTopic).where(DailyTopic.trade_date == prev_date).order_by(DailyTopic.rank)
        )
        prev_topics = prev_result.scalars().all()
        prev_names = {t.topic_name for t in prev_topics}
        curr_names = {t.topic_name for t in curr_topics}
        fading_topics = list(prev_names - curr_names)[:5]

    rotation_speed = 0.0
    if prev_date and prev_topics:
        prev_names = {t.topic_name for t in prev_topics}
        curr_names = {t.topic_name for t in curr_topics}
        total = len(prev_names | curr_names)
        if total > 0:
            rotation_speed = round(len(prev_names ^ curr_names) / total, 2)

    if rotation_speed > 0.6:
        current_phase = "快速轮动"
    elif rotation_speed > 0.3:
        current_phase = "温和轮动"
    else:
        current_phase = "主线明确"

    result = ApiResponse(
        code=0,
        data=RotationAnalysisResponse(
            main_line_topic=main_line_topic,
            main_line_days=main_line_days,
            rotation_speed=rotation_speed,
            current_phase=current_phase,
            active_topics=active_topics,
            fading_topics=fading_topics,
        ).model_dump(),
        message="ok",
    )
    _cache.set("analysis", result)
    return result


@router.get("/relation-graph")
async def get_relation_graph(
    db: AsyncSession = Depends(get_db),
):
    cached = _cache.get("relation_graph")
    if cached is not None:
        return cached
    max_date_result = await db.execute(select(func.max(DailyTopic.trade_date)))
    latest_date = max_date_result.scalar()

    if latest_date:
        recent_result = await db.execute(
            select(DailyTopic).where(DailyTopic.trade_date == latest_date).order_by(DailyTopic.rank)
        )
        recent_topics = recent_result.scalars().all()
    else:
        recent_topics = []

    topic_names = [t.topic_name for t in recent_topics]

    info_result = await db.execute(
        select(TopicInfo).where(TopicInfo.topic_name.in_(topic_names))
    )
    info_map = {i.topic_name: i for i in info_result.scalars().all()}

    nodes = []
    for t in recent_topics:
        size = max(1.0, 20.0 - t.rank)
        info = info_map.get(t.topic_name)
        category = info.category if info else "其他"
        nodes.append(RelationGraphNode(id=t.topic_name, name=t.topic_name, category=category, size=size))

    edges = []

    cat_groups: Dict[str, List[RelationGraphNode]] = {}
    for n in nodes:
        cat = n.category
        if cat not in cat_groups:
            cat_groups[cat] = []
        cat_groups[cat].append(n)

    for cat, group in cat_groups.items():
        for i, n1 in enumerate(group):
            for n2 in group[i + 1:]:
                weight = 0.6 if cat in ("科技", "新能源") else 0.4
                edges.append(RelationGraphEdge(
                    source=n1.id, target=n2.id, weight=weight, type="category"
                ))

    for i in range(len(recent_topics) - 1):
        t1 = recent_topics[i]
        t2 = recent_topics[i + 1]
        info1 = info_map.get(t1.topic_name)
        info2 = info_map.get(t2.topic_name)
        if info1 and info2 and info1.category != info2.category:
            edges.append(RelationGraphEdge(
                source=t1.topic_name, target=t2.topic_name, weight=0.3, type="proximity"
            ))

    if latest_date:
        rot_result = await db.execute(
            select(RotationRecord).where(RotationRecord.trade_date == latest_date)
        )
        rotations = rot_result.scalars().all()
        if rotations:
            src_ids = [r.source_topic_id for r in rotations]
            tgt_ids = [r.target_topic_id for r in rotations]
            all_ids = list(set(src_ids + tgt_ids))
            rot_info_result = await db.execute(
                select(TopicInfo).where(TopicInfo.id.in_(all_ids))
            )
            rot_info_map = {i.id: i for i in rot_info_result.scalars().all()}
            for r in rotations:
                src = rot_info_map.get(r.source_topic_id)
                tgt = rot_info_map.get(r.target_topic_id)
                if src and tgt:
                    edges.append(RelationGraphEdge(
                        source=src.topic_name, target=tgt.topic_name,
                        weight=r.rotation_strength, type="rotation"
                    ))

    result = ApiResponse(
        code=0,
        data=RelationGraphResponse(nodes=nodes, edges=edges).model_dump(),
        message="ok",
    )
    _cache.set("relation_graph", result)
    return result


@router.get("/history-match")
async def history_match(
    db: AsyncSession = Depends(get_db),
):
    cached = _cache.get("history_match")
    if cached is not None:
        return cached
    max_date_result = await db.execute(select(func.max(DailyTopic.trade_date)))
    latest_date = max_date_result.scalar()
    if not latest_date:
        return ApiResponse(code=1, data=[], message="无数据")

    curr_result = await db.execute(
        select(DailyTopic).where(DailyTopic.trade_date == latest_date).order_by(DailyTopic.rank)
    )
    curr_topics = curr_result.scalars().all()
    curr_set = {t.topic_name for t in curr_topics[:10]}
    curr_rank_map = {t.topic_name: t.rank for t in curr_topics[:10]}
    curr_change_map = {t.topic_name: t.change_percent for t in curr_topics[:10]}

    all_dates_result = await db.execute(
        select(DailyTopic.trade_date)
        .where(DailyTopic.trade_date < latest_date)
        .distinct()
        .order_by(desc(DailyTopic.trade_date))
        .limit(60)
    )
    all_dates = [r[0] for r in all_dates_result.all()]

    all_historical = await db.execute(
        select(DailyTopic)
        .where(DailyTopic.trade_date.in_(all_dates))
        .order_by(DailyTopic.trade_date, DailyTopic.rank)
    )
    historical_topics = all_historical.scalars().all()

    topics_by_date = {}
    for t in historical_topics:
        d = str(t.trade_date)
        if d not in topics_by_date:
            topics_by_date[d] = []
        topics_by_date[d].append(t)

    matches = []
    for date in all_dates:
        date_str = str(date)
        date_topics = topics_by_date.get(date_str, [])[:10]
        date_set = {t.topic_name for t in date_topics}
        date_rank_map = {t.topic_name: t.rank for t in date_topics}
        date_change_map = {t.topic_name: t.change_percent for t in date_topics}

        intersection = curr_set & date_set
        if len(intersection) < 3:
            continue

        overlap_score = len(intersection) / min(len(curr_set), len(date_set))

        rank_corr = 0.0
        for name in intersection:
            rank_diff = abs(curr_rank_map.get(name, 10) - date_rank_map.get(name, 10))
            rank_corr += max(0, 1.0 - rank_diff / 10.0)
        rank_corr = rank_corr / len(intersection) if intersection else 0

        change_corr = 0.0
        for name in intersection:
            c1 = curr_change_map.get(name, 0)
            c2 = date_change_map.get(name, 0)
            if abs(c1) + abs(c2) > 0:
                change_corr += 1.0 - min(abs(c1 - c2) / (abs(c1) + abs(c2) + 0.01), 1.0)
        change_corr = change_corr / len(intersection) if intersection else 0

        similarity = round(overlap_score * 0.4 + rank_corr * 0.3 + change_corr * 0.3, 2)

        if similarity > 0.3:
            next_date_result = await db.execute(
                select(func.min(DailyTopic.trade_date)).where(DailyTopic.trade_date > date)
            )
            next_date = next_date_result.scalar()

            next_hot = []
            next_market_change = 0.0
            if next_date:
                next_str = str(next_date)
                next_topics = topics_by_date.get(next_str, [])[:5]
                next_hot = [t.topic_name for t in next_topics]

                mkt_result = await db.execute(
                    select(MarketOverview).where(MarketOverview.trade_date == next_date)
                )
                mkt = mkt_result.scalar_one_or_none()
                if mkt:
                    next_market_change = mkt.sh_index_change

            matches.append(HistoryMatchResponse(
                matched_date=date,
                similarity=round(similarity, 2),
                next_day_hot_topics=next_hot,
                next_day_market_change=next_market_change,
            ))

    matches.sort(key=lambda x: x.similarity, reverse=True)
    result = ApiResponse(code=0, data=[m.model_dump() for m in matches[:5]], message="ok")
    _cache.set("history_match", result)
    return result


@router.get("/predict")
async def predict_topics(
    db: AsyncSession = Depends(get_db),
):
    cached = _cache.get("predict")
    if cached is not None:
        return cached
    max_date_result = await db.execute(select(func.max(DailyTopic.trade_date)))
    latest_date = max_date_result.scalar()
    if not latest_date:
        return ApiResponse(code=1, data=None, message="无数据")

    curr_result = await db.execute(
        select(DailyTopic).where(DailyTopic.trade_date == latest_date).order_by(DailyTopic.rank)
    )
    curr_topics = curr_result.scalars().all()

    curr_names_set = {t.topic_name for t in curr_topics[:3]}

    topic_names = [t.topic_name for t in curr_topics[:5]]
    info_result = await db.execute(
        select(TopicInfo).where(TopicInfo.topic_name.in_(topic_names))
    )
    info_map = {i.topic_name: i for i in info_result.scalars().all()}

    predicted = []
    for t in curr_topics[:5]:
        info = info_map.get(t.topic_name)
        if info and info.related_topics:
            try:
                related = json.loads(info.related_topics)
                for r in related:
                    if r not in predicted and r not in curr_names_set:
                        predicted.append(r)
            except (json.JSONDecodeError, TypeError):
                pass

    trend_result = await db.execute(
        select(DailyTopic)
        .where(DailyTopic.trade_date == latest_date, DailyTopic.consecutive_up_days >= 2)
        .order_by(DailyTopic.consecutive_up_days.desc())
        .limit(3)
    )
    strong_topics = trend_result.scalars().all()
    for st in strong_topics:
        if st.topic_name not in predicted:
            predicted.insert(0, st.topic_name)

    predicted = predicted[:8]

    confidence = 0.0
    if len(curr_topics) > 0:
        avg_consec = sum(t.consecutive_up_days for t in curr_topics[:10]) / min(10, len(curr_topics))
        confidence = round(min(0.3 + avg_consec * 0.1, 0.75), 2)

    reasoning_parts = []
    if strong_topics:
        names = "、".join([t.topic_name for t in strong_topics])
        reasoning_parts.append(f"当前强势主线 {names} 有望延续")
    if predicted:
        reasoning_parts.append(f"关联题材可能轮动到 {'、'.join(predicted[:3])}")

    reasoning = "；".join(reasoning_parts) if reasoning_parts else "数据不足，无法预测"

    pattern_match = None
    curr_set = {t.topic_name for t in curr_topics[:10]}
    all_dates_result = await db.execute(
        select(DailyTopic.trade_date)
        .where(DailyTopic.trade_date < latest_date)
        .distinct()
        .order_by(desc(DailyTopic.trade_date))
        .limit(30)
    )
    date_list = [r[0] for r in all_dates_result.all()]

    if date_list:
        all_hist = await db.execute(
            select(DailyTopic)
            .where(DailyTopic.trade_date.in_(date_list))
            .order_by(DailyTopic.trade_date, DailyTopic.rank)
        )
        hist_topics = all_hist.scalars().all()
        hist_by_date = {}
        for t in hist_topics:
            d = str(t.trade_date)
            if d not in hist_by_date:
                hist_by_date[d] = []
            hist_by_date[d].append(t)

        for date in date_list:
            date_str = str(date)
            date_topics = hist_by_date.get(date_str, [])[:10]
            date_set = {t.topic_name for t in date_topics}
            intersection = curr_set & date_set
            union = curr_set | date_set
            similarity = len(intersection) / len(union) if union else 0
            if similarity > 0.5:
                pattern_match = date
                break

    result = ApiResponse(
        code=0,
        data=PredictResponse(
            predicted_topics=predicted,
            confidence=confidence,
            reasoning=reasoning,
            pattern_match=pattern_match,
        ).model_dump(),
        message="ok",
    )
    _cache.set("predict", result)
    return result


@router.get("/cache-status")
async def cache_status():
    return ApiResponse(code=0, data=_cache.status(), message="ok")
