from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DailyTopicBase(BaseModel):
    trade_date: str
    topic_name: str
    rank: int
    change_percent: float
    stock_count: int
    up_limit_count: int
    consecutive_up_days: int = 0
    main_fund_inflow: float = 0.0
    broken_limit_rate: float = 0.0
    consecutive_limit_count: int = 0
    is_new_entry: bool = False


class DailyTopicResponse(DailyTopicBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TopicInfoBase(BaseModel):
    topic_name: str
    description: str = ""
    related_topics: str = "[]"
    category: str = ""


class TopicInfoResponse(TopicInfoBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TopicTrendBase(BaseModel):
    topic_id: int
    trade_date: str
    change_percent: float
    rank: int


class TopicTrendResponse(TopicTrendBase):
    id: int

    model_config = {"from_attributes": True}


class TopicStockBase(BaseModel):
    topic_id: int
    trade_date: str
    stock_code: str
    stock_name: str
    change_percent: float
    consecutive_limit_days: int = 0
    is_leader: bool = False


class TopicStockResponse(TopicStockBase):
    id: int

    model_config = {"from_attributes": True}


class MarketOverviewBase(BaseModel):
    trade_date: str
    sh_index_change: float
    cyb_index_change: float
    profit_effect_rate: float = 0.0
    broken_limit_rate: float = 0.0
    hot_topic_count: int = 0


class MarketOverviewResponse(MarketOverviewBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RotationRecordBase(BaseModel):
    source_topic_id: int
    target_topic_id: int
    trade_date: str
    rotation_strength: float = 0.0
    time_lag_days: int = 1


class RotationRecordResponse(RotationRecordBase):
    id: int

    model_config = {"from_attributes": True}


class UserFavoriteBase(BaseModel):
    topic_name: str


class UserFavoriteResponse(UserFavoriteBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ApiResponse(BaseModel):
    code: int = 0
    data: Optional[object] = None
    message: str = "ok"


class TopicStrengthResponse(BaseModel):
    topic_name: str
    strength_score: float
    consecutive_days: int
    rank_trend: list[float]
    fund_inflow_trend: list[float]
    overall_trend: str


class RotationAnalysisResponse(BaseModel):
    main_line_topic: Optional[str] = None
    main_line_days: int = 0
    rotation_speed: float = 0.0
    current_phase: str = ""
    active_topics: list[str] = []
    fading_topics: list[str] = []


class RelationGraphNode(BaseModel):
    id: str
    name: str
    category: str
    size: float = 1.0


class RelationGraphEdge(BaseModel):
    source: str
    target: str
    weight: float = 1.0
    type: str = "rotation"


class RelationGraphResponse(BaseModel):
    nodes: list[RelationGraphNode]
    edges: list[RelationGraphEdge]


class HistoryMatchResponse(BaseModel):
    matched_date: str
    similarity: float
    next_day_hot_topics: list[str]
    next_day_market_change: float


class PredictResponse(BaseModel):
    predicted_topics: list[str]
    confidence: float
    reasoning: str
    pattern_match: Optional[str] = None


class HeatmapItem(BaseModel):
    date: str
    topics: list[dict]


class FavoriteRequest(BaseModel):
    topic_name: str
