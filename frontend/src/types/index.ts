export interface DailyTopic {
  id: number
  trade_date: string
  topic_name: string
  rank: number
  change_percent: number
  stock_count: number
  up_limit_count: number
  consecutive_up_days: number
  main_fund_inflow: number
  broken_limit_rate: number
  consecutive_limit_count: number
  is_new_entry: boolean
}

export interface TopicInfo {
  id: number
  topic_name: string
  description: string
  related_topics: string
  category: string
}

export interface TopicTrendItem {
  id: number
  topic_id: number
  trade_date: string
  change_percent: number
  rank: number
  main_fund_inflow?: number
  stock_count?: number
  up_limit_count?: number
  consecutive_up_days?: number
}

export interface TopicStock {
  id: number
  topic_id: number
  trade_date: string
  stock_code: string
  stock_name: string
  change_percent: number
  consecutive_limit_days: number
  is_leader: boolean
}

export interface MarketOverviewData {
  id: number
  trade_date: string
  sh_index_change: number
  cyb_index_change: number
  profit_effect_rate: number
  broken_limit_rate: number
  hot_topic_count: number
}

export interface MarketOverviewResponse {
  overview: MarketOverviewData
  top_topics: string[]
}

export interface LimitBoardItem {
  stock_code: string
  stock_name: string
  change_percent: number
  consecutive_limit_days: number
  is_leader: boolean
  topic_name: string
  heat: number
}

export interface TopicStrengthData {
  topic_name: string
  strength_score: number
  consecutive_days: number
  rank_trend: number[]
  fund_inflow_trend: number[]
  overall_trend: string
  score_breakdown: {
    change_score: number
    rank_score: number
    consec_score: number
    fund_score: number
    trend_score: number
    limit_score: number
    heat_score: number
  }
  reasons: string[]
}

export interface RotationAnalysisData {
  main_line_topic: string | null
  main_line_days: number
  rotation_speed: number
  current_phase: string
  active_topics: string[]
  fading_topics: string[]
}

export interface RelationNode {
  id: string
  name: string
  category: string
  size: number
}

export interface RelationEdge {
  source: string
  target: string
  weight: number
  type: string
}

export interface RelationGraphData {
  nodes: RelationNode[]
  edges: RelationEdge[]
}

export interface HistoryMatchItem {
  matched_date: string
  similarity: number
  next_day_hot_topics: string[]
  next_day_market_change: number
}

export interface PredictData {
  predicted_topics: string[]
  confidence: number
  reasoning: string
  pattern_match: string | null
}

export interface HeatmapDay {
  date: string
  topics: Array<{
    name: string
    rank: number
    change_percent: number
    category: string
    consecutive_up_days: number
    is_new_entry: boolean
  }>
}

export interface UserFavorite {
  id: number
  topic_name: string
  created_at: string | null
}
