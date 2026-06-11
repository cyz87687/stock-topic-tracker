from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, UniqueConstraint, JSON, Text
from sqlalchemy.sql import func
from database import Base


class DailyTopic(Base):
    __tablename__ = "daily_topics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_date = Column(String(10), nullable=False, index=True)
    topic_name = Column(String(50), nullable=False, index=True)
    rank = Column(Integer, nullable=False)
    change_percent = Column(Float, nullable=False)
    stock_count = Column(Integer, nullable=False)
    up_limit_count = Column(Integer, nullable=False)
    consecutive_up_days = Column(Integer, default=0)
    main_fund_inflow = Column(Float, default=0.0)
    broken_limit_rate = Column(Float, default=0.0)
    consecutive_limit_count = Column(Integer, default=0)
    is_new_entry = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("trade_date", "topic_name", name="uq_daily_topic_date_name"),)


class TopicInfo(Base):
    __tablename__ = "topic_infos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic_name = Column(String(50), nullable=False, unique=True)
    description = Column(Text, default="")
    related_topics = Column(Text, default="[]")
    category = Column(String(30), default="")
    created_at = Column(DateTime, server_default=func.now())


class TopicTrend(Base):
    __tablename__ = "topic_trends"

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic_id = Column(Integer, ForeignKey("topic_infos.id"), nullable=False)
    trade_date = Column(String(10), nullable=False)
    change_percent = Column(Float, nullable=False)
    rank = Column(Integer, nullable=False)

    __table_args__ = (UniqueConstraint("topic_id", "trade_date", name="uq_topic_trend_id_date"),)


class TopicStock(Base):
    __tablename__ = "topic_stocks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic_id = Column(Integer, ForeignKey("topic_infos.id"), nullable=False)
    trade_date = Column(String(10), nullable=False)
    stock_code = Column(String(10), nullable=False)
    stock_name = Column(String(20), nullable=False)
    change_percent = Column(Float, nullable=False)
    consecutive_limit_days = Column(Integer, default=0)
    is_leader = Column(Boolean, default=False)


class MarketOverview(Base):
    __tablename__ = "market_overviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_date = Column(String(10), nullable=False, unique=True)
    sh_index_change = Column(Float, nullable=False)
    cyb_index_change = Column(Float, nullable=False)
    profit_effect_rate = Column(Float, default=0.0)
    broken_limit_rate = Column(Float, default=0.0)
    hot_topic_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())


class RotationRecord(Base):
    __tablename__ = "rotation_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_topic_id = Column(Integer, ForeignKey("topic_infos.id"), nullable=False)
    target_topic_id = Column(Integer, ForeignKey("topic_infos.id"), nullable=False)
    trade_date = Column(String(10), nullable=False)
    rotation_strength = Column(Float, default=0.0)
    time_lag_days = Column(Integer, default=1)


class UserFavorite(Base):
    __tablename__ = "user_favorites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic_name = Column(String(50), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())
