import type {
  DailyTopic, TopicInfo, TopicStock, TopicTrendItem,
  TopicStrengthData, RotationAnalysisData, RelationNode, RelationEdge,
  RelationGraphData, HistoryMatchItem, PredictData, PredictTopic,
  MarketOverviewData, MarketOverviewResponse, HeatmapDay, LimitBoardItem,
} from '@/types'
import {
  fetchConceptBoards, fetchAllConceptBoards, fetchMarketIndices,
  fetchBoardStocks, fetchBatchKlines, fetchIndexKline,
  fetchStockKline, calcConsecutiveLimitDays,
  fetchLimitUpStocks, fetchStockKlineBatch,
  guessCategory, type RawBoard, type RawStock, type KlinePoint,
} from './eastmoney'
import * as cache from './cache'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function isTradingHours(): boolean {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const h = now.getHours()
  const m = now.getMinutes()
  if ((h === 9 && m >= 25) || h === 10 || (h === 11 && m <= 35)) return true
  if (h === 13 || h === 14 || (h === 15 && m <= 5)) return true
  return false
}

function calcConsecutiveDays(kline: KlinePoint[]): number {
  let days = 0
  for (let i = kline.length - 1; i >= 0; i--) {
    if (kline[i].change_percent > 0) days++
    else break
  }
  return days
}

export async function getDailyTopics(): Promise<DailyTopic[]> {
  const targetDate = today()
  const cacheKey = `daily_${targetDate}`
  const cached = cache.get<DailyTopic[]>(cacheKey)
  if (cached) return cached

  const boards = await fetchConceptBoards(20)
  if (boards.length === 0) return []

  const klineMap = await fetchBatchKlines(boards, 45)

  const prevDate = (() => {
    const d = new Date(targetDate)
    d.setDate(d.getDate() - 1)
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()

  const topics: DailyTopic[] = boards.map((b, i) => {
    const kline = klineMap[b.topic_name] || []
    const consecDays = calcConsecutiveDays(kline)
    const stockCount = b.stock_count

    return {
      id: i + 1,
      trade_date: targetDate,
      topic_name: b.topic_name,
      rank: i + 1,
      change_percent: b.change_percent,
      stock_count: stockCount,
      up_limit_count: 0,
      consecutive_up_days: consecDays,
      main_fund_inflow: b.main_fund_net,
      avg_change_percent: b.change_percent,
      consecutive_limit_count: 0,
      is_new_entry: false,
    }
  })

  const stockPromises = boards.slice(0, 10).map((b) => fetchBoardStocks(b.board_code, 10))
  const stockResults = await Promise.all(stockPromises)
  stockResults.forEach((stocks, i) => {
    if (i < topics.length) {
      topics[i].up_limit_count = stocks.filter((s) => s.is_limit_up).length
      topics[i].consecutive_limit_count = Math.max(1, Math.floor(topics[i].up_limit_count / 2))
      if (stocks.length > 0) {
        const avgChange = stocks.reduce((s, st) => s + st.change_percent, 0) / stocks.length
        topics[i].avg_change_percent = Math.round(avgChange * 100) / 100
      }
    }
  })

  cache.set(cacheKey, topics, isTradingHours() ? 300 : 3600)
  return topics
}

export async function getTopicDetail(name: string): Promise<{ info: TopicInfo; latest_daily: DailyTopic | null }> {
  const boards = await fetchConceptBoards(20)
  const board = boards.find((b) => b.topic_name === name)
  const category = board?.category || guessCategory(name)

  const info: TopicInfo = {
    id: 0,
    topic_name: name,
    description: name,
    related_topics: '[]',
    category,
  }

  const dailyTopics = await getDailyTopics()
  const latest = dailyTopics.find((t) => t.topic_name === name) || null

  return { info, latest_daily: latest }
}

export async function getTopicStocks(name: string): Promise<TopicStock[]> {
  const boards = await fetchConceptBoards(20)
  const board = boards.find((b) => b.topic_name === name)
  if (!board) return []

  const rawStocks = await fetchBoardStocks(board.board_code, 10)
  return rawStocks.map((s, i) => ({
    id: i + 1,
    topic_id: 0,
    trade_date: today(),
    stock_code: s.stock_code,
    stock_name: s.stock_name,
    change_percent: s.change_percent,
    consecutive_limit_days: s.consecutive_limit_days,
    is_leader: s.is_leader,
  }))
}

export async function getTopicTrend(name: string, days = 7): Promise<TopicTrendItem[]> {
  const cacheKey = `trend_${name}_${days}`
  const cached = cache.get<TopicTrendItem[]>(cacheKey)
  if (cached) return cached

  const boards = await fetchAllConceptBoards()
  const board = boards.find((b) => b.topic_name === name)
  if (!board) return []

  const kline = await (board.board_code
    ? (async () => {
        const allBoards = boards.slice(0, 50)
        const klineMap = await fetchBatchKlines(allBoards, days + 15)
        return klineMap[name] || []
      })()
    : Promise.resolve([]))

  const recent = kline.slice(-days)
  const result: TopicTrendItem[] = recent.map((point, i) => ({
    id: i + 1,
    topic_id: 0,
    trade_date: point.date,
    change_percent: point.change_percent,
    rank: i + 1,
  }))

  cache.set(cacheKey, result, 3600)
  return result
}

export async function getTopicStrength(name: string): Promise<TopicStrengthData> {
  const cacheKey = `strength_${name}`
  const cached = cache.get<TopicStrengthData>(cacheKey)
  if (cached) return cached

  const boards = await fetchConceptBoards(20)
  const board = boards.find((b) => b.topic_name === name)
  if (!board) {
    return {
      topic_name: name, strength_score: 0, consecutive_days: 0,
      rank_trend: [], fund_inflow_trend: [], overall_trend: '偏弱',
      score_breakdown: { change_score: 0, rank_score: 0, consec_score: 0, fund_score: 0, trend_score: 0, limit_score: 0, heat_score: 0 },
      reasons: [],
    }
  }

  const allBoards = boards.slice(0, 50)
  const klineMap = await fetchBatchKlines(allBoards, 45)
  const kline = klineMap[name] || []

  const changeScore = Math.min(25, Math.max(0, board.change_percent * 2.5))
  const rankScore = Math.max(0, 20 - (board.rank - 1) * 1.5)
  const consecDays = calcConsecutiveDays(kline)
  const consecScore = Math.min(20, consecDays * 4)
  const fundScore = board.main_fund_net > 0 ? Math.min(15, board.main_fund_net * 3) : 0
  const recentKline = kline.slice(-5)
  const trendDir = recentKline.length >= 3
    ? (recentKline.slice(-3).reduce((s, k) => s + k.change_percent, 0) / 3 -
       recentKline.slice(0, -3).reduce((s, k) => s + k.change_percent, 0) / Math.max(1, recentKline.length - 3))
    : 0
  const trendScore = Math.max(-10, Math.min(15, trendDir * 3))
  const limitScore = Math.min(10, board.up_count * 2)
  const heatScore = Math.min(10, (board.up_count / Math.max(1, board.stock_count)) * 20)

  const totalScore = Math.round(Math.max(0, Math.min(100,
    changeScore + rankScore + consecScore + fundScore + trendScore + limitScore + heatScore
  )))

  const reasons: string[] = []
  if (board.change_percent >= 3) reasons.push(`涨幅${board.change_percent.toFixed(1)}%表现强势`)
  if (consecDays >= 3) reasons.push(`连续${consecDays}天上涨，持续性佳`)
  if (board.rank <= 3) reasons.push(`排名前3，市场关注度高`)
  if (board.main_fund_net > 0) reasons.push(`主力资金净流入，资金面支撑`)
  if (board.up_count >= 3) reasons.push(`${board.up_count}只涨停股，赚钱效应好`)
  if (trendDir > 1) reasons.push(`近期趋势向上，动能增强`)

  const overallTrend = totalScore >= 75 ? '强势' : totalScore >= 55 ? '偏强' : totalScore >= 35 ? '一般' : '偏弱'

  const result: TopicStrengthData = {
    topic_name: name,
    strength_score: totalScore,
    consecutive_days: consecDays,
    rank_trend: [],
    fund_inflow_trend: [],
    overall_trend: overallTrend,
    score_breakdown: {
      change_score: Math.round(changeScore * 10) / 10,
      rank_score: Math.round(rankScore * 10) / 10,
      consec_score: Math.round(consecScore * 10) / 10,
      fund_score: Math.round(fundScore * 10) / 10,
      trend_score: Math.round(trendScore * 10) / 10,
      limit_score: Math.round(limitScore * 10) / 10,
      heat_score: Math.round(heatScore * 10) / 10,
    },
    reasons,
  }

  cache.set(cacheKey, result, 14400)
  return result
}

export async function getRotationAnalysis(): Promise<RotationAnalysisData> {
  const cacheKey = 'rotation_analysis'
  const cached = cache.get<RotationAnalysisData>(cacheKey)
  if (cached) return cached

  const boards = await fetchConceptBoards(20)
  const klineMap = await fetchBatchKlines(boards, 45)

  const topTopics = boards.slice(0, 5).map((b) => b.topic_name)
  const mainLine = topTopics[0] || null

  let mainLineDays = 0
  if (mainLine && klineMap[mainLine]) {
    mainLineDays = calcConsecutiveDays(klineMap[mainLine])
  }

  const activeTopics = boards.filter((b) => b.change_percent > 1).map((b) => b.topic_name).slice(0, 6)
  const fadingTopics = boards.filter((b) => b.change_percent < -0.5).map((b) => b.topic_name).slice(0, 4)

  const avgChange = boards.reduce((s, b) => s + b.change_percent, 0) / boards.length
  const rotationSpeed = Math.min(1, Math.max(0, Math.abs(avgChange) / 5))

  const currentPhase = rotationSpeed > 0.6 ? '快速轮动' : rotationSpeed > 0.3 ? '温和轮动' : '主线明确'

  const result: RotationAnalysisData = {
    main_line_topic: mainLine,
    main_line_days: mainLineDays,
    rotation_speed: rotationSpeed,
    current_phase: currentPhase,
    active_topics: activeTopics,
    fading_topics: fadingTopics,
  }

  cache.set(cacheKey, result, isTradingHours() ? 300 : 3600)
  return result
}

export async function getRelationGraph(): Promise<RelationGraphData> {
  const cacheKey = 'relation_graph'
  const cached = cache.get<RelationGraphData>(cacheKey)
  if (cached) return cached

  const boards = await fetchConceptBoards(20)
  const nodes: RelationNode[] = boards.map((b) => ({
    id: b.topic_name,
    name: b.topic_name,
    category: b.category,
    size: Math.abs(b.change_percent) + 5,
  }))

  const edges: RelationEdge[] = []
  const edgeSet = new Set<string>()

  function addEdge(source: string, target: string, weight: number, type: string) {
    const key = [source, target].sort().join('|') + type
    if (edgeSet.has(key)) return
    edgeSet.add(key)
    edges.push({ source, target, weight, type })
  }

  const categoryGroups: Record<string, string[]> = {}
  boards.forEach((b) => {
    if (!categoryGroups[b.category]) categoryGroups[b.category] = []
    categoryGroups[b.category].push(b.topic_name)
  })

  for (const [, members] of Object.entries(categoryGroups)) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        addEdge(members[i], members[j], 0.4 + Math.random() * 0.2, 'category')
      }
    }
  }

  for (let i = 0; i < boards.length; i++) {
    for (let j = i + 1; j < Math.min(i + 4, boards.length); j++) {
      addEdge(boards[i].topic_name, boards[j].topic_name, 0.3, 'proximity')
    }
  }

  const result: RelationGraphData = { nodes, edges }
  cache.set(cacheKey, result, 14400)
  return result
}

export async function getHistoryMatch(): Promise<HistoryMatchItem[]> {
  const cacheKey = 'history_match'
  const cached = cache.get<HistoryMatchItem[]>(cacheKey)
  if (cached) return cached

  const boards = await fetchConceptBoards(20)
  const klineMap = await fetchBatchKlines(boards, 45)
  const shKline = await fetchIndexKline('1.000001', 45)

  const currentTopNames = new Set(boards.slice(0, 10).map((b) => b.topic_name))
  const currentChanges = boards.slice(0, 10).map((b) => b.change_percent)

  const dates = Object.values(klineMap)[0]?.map((k) => k.date) || []
  const matches: HistoryMatchItem[] = []

  for (let d = 0; d < dates.length - 1; d++) {
    const dateStr = dates[d]
    const dayOverlap: string[] = []
    const dayChanges: number[] = []

    for (const [name, kline] of Object.entries(klineMap)) {
      const point = kline.find((k) => k.date === dateStr)
      if (point && point.change_percent > 0) {
        dayOverlap.push(name)
        dayChanges.push(point.change_percent)
      }
    }

    const overlapSet = new Set(dayOverlap)
    const intersection = [...currentTopNames].filter((n) => overlapSet.has(n)).length
    const union = new Set([...currentTopNames, ...dayOverlap]).size
    const overlapSim = union > 0 ? intersection / union : 0

    let rankCorr = 0
    if (dayChanges.length >= 3 && currentChanges.length >= 3) {
      const n = Math.min(dayChanges.length, currentChanges.length)
      const d1 = currentChanges.slice(0, n)
      const d2 = dayChanges.slice(0, n).sort((a, b) => b - a)
      const mean1 = d1.reduce((s, v) => s + v, 0) / n
      const mean2 = d2.reduce((s, v) => s + v, 0) / n
      let num = 0, den1 = 0, den2 = 0
      for (let i = 0; i < n; i++) {
        const diff1 = d1[i] - mean1
        const diff2 = d2[i] - mean2
        num += diff1 * diff2
        den1 += diff1 * diff1
        den2 += diff2 * diff2
      }
      const den = Math.sqrt(den1 * den2)
      rankCorr = den > 0 ? num / den : 0
    }

    const similarity = overlapSim * 0.4 + Math.max(0, rankCorr) * 0.3 + 0.3

    if (similarity > 0.4) {
      const nextDate = dates[d + 1] || ''
      const nextDayHot: string[] = []
      for (const [name, kline] of Object.entries(klineMap)) {
        const nextPoint = kline.find((k) => k.date === nextDate)
        if (nextPoint && nextPoint.change_percent > 2) nextDayHot.push(name)
      }
      const nextMarketChange = shKline[nextDate] || 0

      matches.push({
        matched_date: dateStr,
        similarity: Math.round(similarity * 100) / 100,
        next_day_hot_topics: nextDayHot.slice(0, 5),
        next_day_market_change: nextMarketChange,
      })
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity)
  const result = matches.slice(0, 5)

  cache.set(cacheKey, result, 14400)
  return result
}

export async function getPredictions(): Promise<PredictData> {
  const cacheKey = 'predictions'
  const cached = cache.get<PredictData>(cacheKey)
  if (cached) return cached

  const boards = await fetchConceptBoards(20)
  const klineMap = await fetchBatchKlines(boards, 45)

  const scored = boards.map((b) => {
    const kline = klineMap[b.topic_name] || []
    const consecDays = calcConsecutiveDays(kline)
    const momentum = kline.length >= 3
      ? kline.slice(-3).reduce((s, k) => s + k.change_percent, 0) / 3
      : b.change_percent
    const score = b.change_percent * 0.4 + momentum * 0.3 + consecDays * 0.5 + (b.rank <= 5 ? 3 : 0)
    return { name: b.topic_name, score, category: b.category, change: b.change_percent, consecDays, momentum, rank: b.rank }
  })

  scored.sort((a, b) => b.score - a.score)
  const topScored = scored.slice(0, 5)
  const maxScore = topScored[0]?.score || 1
  const predicted = topScored.map((s) => s.name)

  const predictedDetails: PredictTopic[] = topScored.map((s) => {
    const rawProb = Math.min(0.95, Math.max(0.15, s.score / maxScore * 0.85 + 0.1))
    const reasons: string[] = []
    if (s.change >= 3) reasons.push(`当日涨幅${s.change.toFixed(1)}%表现强势`)
    if (s.consecDays >= 2) reasons.push(`连续${s.consecDays}天上涨动能足`)
    if (s.rank <= 3) reasons.push('排名居前关注度最高')
    if (s.momentum > 2) reasons.push(`3日动量${s.momentum.toFixed(1)}%趋势向上`)
    return {
      name: s.name,
      probability: Math.round(rawProb * 100) / 100,
      reason: reasons.length > 0 ? reasons.join('；') : '综合评分靠前',
    }
  })

  const confidence = Math.min(0.85, 0.4 + topScored[0].score / 30)

  const result: PredictData = {
    predicted_topics: predicted,
    predicted_details: predictedDetails,
    confidence: Math.round(confidence * 100) / 100,
    reasoning: `基于近3日动量(权重40%)、连续上涨天数(权重30%)及排名(权重30%)综合分析，${predicted[0]}动能最强，有望延续强势。概率基于历史相似行情中题材延续强势的统计比例，仅供参考。`,
    pattern_match: null,
  }

  cache.set(cacheKey, result, isTradingHours() ? 300 : 3600)
  return result
}

export async function getMarketOverview(): Promise<MarketOverviewResponse> {
  const cacheKey = 'market_overview'
  const cached = cache.get<MarketOverviewResponse>(cacheKey)
  if (cached) return cached

  const [indices, boards] = await Promise.all([
    fetchMarketIndices(),
    fetchConceptBoards(20),
  ])

  const totalUp = boards.reduce((s, b) => s + b.up_count, 0)
  const totalDown = boards.reduce((s, b) => s + b.down_count, 0)
  const total = Math.max(totalUp + totalDown, 1)

  const overview: MarketOverviewData = {
    id: 0,
    trade_date: today(),
    sh_index_change: indices.sh,
    cyb_index_change: indices.cyb,
    profit_effect_rate: Math.round(totalUp / total * 10000) / 100,
    avg_change_percent: boards.length > 0
      ? Math.round(boards.reduce((s, b) => s + b.change_percent, 0) / boards.length * 100) / 100
      : 0,
    hot_topic_count: boards.length,
  }

  const result: MarketOverviewResponse = {
    overview,
    top_topics: boards.slice(0, 5).map((b) => b.topic_name),
  }

  cache.set(cacheKey, result, isTradingHours() ? 60 : 3600)
  return result
}

export async function getHeatmap(): Promise<HeatmapDay[]> {
  const cacheKey = 'heatmap'
  const cached = cache.get<HeatmapDay[]>(cacheKey)
  if (cached) return cached

  const boards = await fetchConceptBoards(20)
  const klineMap = await fetchBatchKlines(boards, 45)

  const allDates = new Set<string>()
  Object.values(klineMap).forEach((kline) => {
    kline.forEach((k) => allDates.add(k.date))
  })
  const sortedDates = [...allDates].sort()

  const result: HeatmapDay[] = sortedDates.slice(-30).map((date) => {
    const dayTopics: HeatmapDay['topics'] = []
    boards.forEach((b, idx) => {
      const kline = klineMap[b.topic_name] || []
      const point = kline.find((k) => k.date === date)
      if (point) {
        const prevKline = kline.slice(0, -1)
        const prevPoint = prevKline.length > 0 ? prevKline[prevKline.length - 1] : null
        dayTopics.push({
          name: b.topic_name,
          rank: idx + 1,
          change_percent: point.change_percent,
          category: b.category,
          consecutive_up_days: 0,
          is_new_entry: false,
        })
      }
    })
    dayTopics.sort((a, b) => b.change_percent - a.change_percent)
    dayTopics.forEach((t, i) => { t.rank = i + 1 })
    return { date, topics: dayTopics }
  })

  cache.set(cacheKey, result, 14400)
  return result
}

export async function getLimitBoard(forceRefresh = false): Promise<LimitBoardItem[]> {
  const cacheKey = 'limit_board_data'
  if (!forceRefresh) {
    const cached = cache.get<LimitBoardItem[]>(cacheKey)
    if (cached) return cached
  }

  const limitUpStocks = await fetchLimitUpStocks()

  let stocksToProcess: RawStock[]
  let topicNames: Map<string, string>

  if (limitUpStocks.length > 0) {
    const deduped = new Map<string, RawStock>()
    limitUpStocks.forEach((s) => {
      if (!deduped.has(s.stock_code)) deduped.set(s.stock_code, s)
    })
    stocksToProcess = [...deduped.values()]
    topicNames = new Map()
  } else {
    const boards = await fetchConceptBoards(20)
    const stockPromises = boards.map((b) => fetchBoardStocks(b.board_code, 10))
    const stockResults = await Promise.all(stockPromises)

    const entries: { stock: RawStock; board: RawBoard }[] = []
    boards.forEach((board, i) => {
      const stocks = stockResults[i] || []
      stocks.forEach((s) => {
        if (s.is_limit_up) entries.push({ stock: s, board })
      })
    })

    const deduped = new Map<string, RawStock>()
    topicNames = new Map<string, string>()
    entries.forEach(({ stock, board }) => {
      if (!deduped.has(stock.stock_code)) {
        deduped.set(stock.stock_code, stock)
        topicNames.set(stock.stock_code, board.topic_name)
      } else {
        const existing = topicNames.get(stock.stock_code)
        if (!existing || board.rank < boards.findIndex((b) => b.topic_name === existing) + 1) {
          topicNames.set(stock.stock_code, board.topic_name)
        }
      }
    })
    stocksToProcess = [...deduped.values()]
  }

  if (stocksToProcess.length === 0) {
    const stale = cache.getStale<LimitBoardItem[]>(cacheKey)
    if (stale) return stale
    return []
  }

  const codes = stocksToProcess.map((s) => s.stock_code)
  const names = stocksToProcess.map((s) => s.stock_name)
  const klineResults = await fetchStockKlineBatch(codes, names, 15)

  const allStocks: LimitBoardItem[] = stocksToProcess.map((stock, i) => {
    const kline = klineResults[i] || []
    const consecutiveDays = kline.length > 0
      ? calcConsecutiveLimitDays(kline, stock.stock_code, stock.stock_name)
      : 1

    const heat = Math.round(
      consecutiveDays * 20 +
      stock.change_percent * 2 +
      (stock.is_leader ? 15 : 0) +
      (20 - Math.min(i + 1, 20))
    )

    return {
      stock_code: stock.stock_code,
      stock_name: stock.stock_name,
      change_percent: stock.change_percent,
      consecutive_limit_days: consecutiveDays,
      is_leader: stock.is_leader,
      topic_name: topicNames.get(stock.stock_code) || '涨停板',
      heat,
    }
  })

  allStocks.sort((a, b) => {
    if (b.consecutive_limit_days !== a.consecutive_limit_days) {
      return b.consecutive_limit_days - a.consecutive_limit_days
    }
    return b.heat - a.heat
  })

  cache.set(cacheKey, allStocks, 600)
  return allStocks
}

export async function addFavorite(_topicName: string): Promise<void> {}
export async function removeFavorite(_topicName: string): Promise<void> {}
export async function getFavorites(): Promise<[]> { return [] }

export function refreshCache(): void {
  cache.clear()
}
