import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { getDailyTopics, getTopicTrend, getTopicStrength, refreshCache } from '@/api'
import { formatPercent, getChangeColor, getStrengthLevel } from '@/utils/helpers'
import type { DailyTopic, TopicTrendItem, TopicStrengthData } from '@/types'
import TrendChart from '@/components/TrendChart'
import StrengthIndicator from '@/components/StrengthIndicator'
import { RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

export default function StrengthAnalysis() {
  const currentDate = useStore((s) => s.currentDate)
  const [topics, setTopics] = useState<DailyTopic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [trend, setTrend] = useState<TopicTrendItem[]>([])
  const [strength, setStrength] = useState<TopicStrengthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTopics = useCallback(async () => {
    try {
      const data = await getDailyTopics(currentDate)
      setTopics(data)
      if (data.length > 0 && !selectedTopic) {
        setSelectedTopic(data[0].topic_name)
      }
    } catch {
      setTopics([])
    }
  }, [currentDate, selectedTopic])

  const fetchDetail = useCallback(async (showLoading = true) => {
    if (!selectedTopic) return
    if (showLoading) setLoading(true)
    try {
      const [t, s] = await Promise.all([
        getTopicTrend(selectedTopic, 30),
        getTopicStrength(selectedTopic),
      ])
      setTrend(t)
      setStrength(s)
    } catch {
      // error
    } finally {
      setLoading(false)
    }
  }, [selectedTopic])

  useEffect(() => {
    fetchTopics()
  }, [fetchTopics])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      refreshCache()
      await Promise.all([fetchTopics(), fetchDetail(false)])
    } catch {
      await Promise.all([fetchTopics(), fetchDetail(false)])
    } finally {
      setRefreshing(false)
    }
  }

  const barOption: EChartsOption = {
    backgroundColor: 'transparent',
    grid: { top: 10, left: 5, right: 10, bottom: 5, containLabel: true },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params
        const d = p as { name: string; value: number; marker: string }
        return `${d.name}<br/>${d.marker} ${d.value.toFixed(2)}%`
      },
    },
    xAxis: {
      type: 'category',
      data: topics.slice(0, 10).map((t) => t.topic_name),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b', fontSize: 9, rotate: 30 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
      axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => `${v.toFixed(0)}%` },
    },
    series: [
      {
        type: 'bar',
        data: topics.slice(0, 10).map((t) => ({
          value: t.change_percent,
          itemStyle: {
            color: t.change_percent >= 0 ? '#ef4444' : '#22c55e',
            borderRadius: [3, 3, 0, 0],
          },
        })),
        barWidth: '50%',
      },
    ],
  }

  const trendData = trend.map((t) => ({ date: t.trade_date, value: t.change_percent }))

  const trendDirection = (() => {
    if (trendData.length < 3) return 'insufficient'
    const recent3 = trendData.slice(-3)
    const avg = recent3.reduce((s, d) => s + d.value, 0) / 3
    const older = trendData.slice(0, -3)
    if (older.length === 0) return 'insufficient'
    const olderAvg = older.reduce((s, d) => s + d.value, 0) / older.length
    if (avg > olderAvg + 1) return 'up'
    if (avg < olderAvg - 1) return 'down'
    return 'flat'
  })()

  return (
    <div className="px-4 pt-3 pb-4 space-y-3 tab-bar-safe-area">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">强弱分析</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={clsx(
            'p-2 rounded-lg transition-all',
            refreshing
              ? 'bg-up/20 text-up'
              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
          )}
        >
          <RefreshCw size={16} className={clsx(refreshing && 'animate-spin')} />
        </button>
      </div>

      {refreshing && (
        <div className="flex items-center gap-2 px-3 py-2 bg-up/10 rounded-lg">
          <RefreshCw size={14} className="text-up animate-spin" />
          <span className="text-xs text-up">正在刷新数据...</span>
        </div>
      )}

      <div className="card p-3.5">
        <h2 className="text-sm font-semibold text-white mb-3">题材涨幅对比</h2>
        <ReactECharts
          option={barOption}
          style={{ height: '250px', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      </div>

      <div className="card p-3.5">
        <h2 className="text-sm font-semibold text-white mb-3">题材强弱排行</h2>
        <div className="space-y-2.5">
          {topics.slice(0, 10).map((topic) => {
            const level = getStrengthLevel(topic.change_percent)
            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopic(topic.topic_name)}
                className={clsx(
                  'w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left',
                  selectedTopic === topic.topic_name ? 'bg-bg-hover' : 'hover:bg-bg-hover/30'
                )}
              >
                <span className="text-xs text-slate-500 w-5">{topic.rank}</span>
                <span className="text-sm text-white flex-1 truncate">{topic.topic_name}</span>
                <span className={clsx('text-xs font-medium', level.color)}>{level.label}</span>
                <span className={clsx('text-sm font-bold', getChangeColor(topic.change_percent))}>
                  {formatPercent(topic.change_percent)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {selectedTopic && strength && (
        <>
          <div className="card p-3.5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">{selectedTopic}</h2>
              <div className="flex items-center gap-2">
                {trendDirection !== 'insufficient' && (
                  <span className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    trendDirection === 'up' ? 'bg-up/10 text-up' :
                    trendDirection === 'down' ? 'bg-down/10 text-down' :
                    'bg-slate-700 text-slate-400'
                  )}>
                    {trendDirection === 'up' ? '趋势↑' : trendDirection === 'down' ? '趋势↓' : '横盘→'}
                  </span>
                )}
                <span className={clsx(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  strength.overall_trend === '强势' ? 'bg-up/20 text-up' :
                  strength.overall_trend === '偏强' ? 'bg-medium/20 text-medium' :
                  strength.overall_trend === '一般' ? 'bg-neutral/20 text-neutral' :
                  'bg-weak/20 text-weak'
                )}>
                  {strength.overall_trend}
                </span>
              </div>
            </div>
            <StrengthIndicator score={strength.strength_score} />
            {strength.score_breakdown && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[10px] text-slate-500 mb-1">得分明细（满分100）</div>
                {[
                  { label: '涨幅', score: strength.score_breakdown.change_score, max: 25 },
                  { label: '排名', score: strength.score_breakdown.rank_score, max: 20 },
                  { label: '连续性', score: strength.score_breakdown.consec_score, max: 20 },
                  { label: '资金', score: strength.score_breakdown.fund_score, max: 15 },
                  { label: '趋势', score: strength.score_breakdown.trend_score, max: 15 },
                  { label: '涨停', score: strength.score_breakdown.limit_score, max: 10 },
                  { label: '热度', score: strength.score_breakdown.heat_score, max: 10 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-8">{item.label}</span>
                    <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-up/70 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(0, item.score / item.max * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 w-8 text-right">{item.score}/{item.max}</span>
                  </div>
                ))}
              </div>
            )}
            {strength.reasons && strength.reasons.length > 0 && (
              <div className="mt-2 px-2 py-1.5 bg-bg-primary/50 rounded-lg">
                <div className="text-[10px] text-slate-500 mb-1">强势原因</div>
                {strength.reasons.map((r, i) => (
                  <p key={i} className="text-xs text-slate-300">• {r}</p>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-bg-primary/50 rounded-lg p-2">
                <div className="text-[10px] text-slate-500">连续上榜</div>
                <div className="text-sm font-bold text-white">{strength.consecutive_days}天</div>
              </div>
              <div className="bg-bg-primary/50 rounded-lg p-2">
                <div className="text-[10px] text-slate-500">排名趋势</div>
                <div className="text-sm font-bold text-white">
                  {strength.rank_trend.length > 1
                    ? strength.rank_trend[0] > strength.rank_trend[strength.rank_trend.length - 1] ? '↑ 上升' : '↓ 下降'
                    : '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-3.5">
            <h2 className="text-sm font-semibold text-white mb-2">30日趋势</h2>
            {trendData.length > 0 ? (
              <TrendChart data={trendData} title="" height={200} />
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                暂无趋势数据
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
