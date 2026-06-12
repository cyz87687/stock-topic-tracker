import { useState, useEffect, useCallback, useMemo } from 'react'
import { getRotationAnalysis, getRelationGraph, getHistoryMatch, getPredictions, getHeatmap, refreshCache } from '@/api'
import type { RotationAnalysisData, RelationNode, RelationEdge, HistoryMatchItem, PredictData, HeatmapDay } from '@/types'
import RelationGraph from '@/components/RelationGraph'
import StrengthIndicator from '@/components/StrengthIndicator'
import { RefreshCw, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import clsx from 'clsx'

export default function RotationAnalysisPage() {
  const [analysis, setAnalysis] = useState<RotationAnalysisData | null>(null)
  const [nodes, setNodes] = useState<RelationNode[]>([])
  const [edges, setEdges] = useState<RelationEdge[]>([])
  const [history, setHistory] = useState<HistoryMatchItem[]>([])
  const [predict, setPredict] = useState<PredictData | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [a, g, h, p, hm] = await Promise.all([
        getRotationAnalysis(),
        getRelationGraph(),
        getHistoryMatch(),
        getPredictions(),
        getHeatmap(),
      ])
      setAnalysis(a)
      setNodes(g.nodes)
      setEdges(g.edges)
      setHistory(h)
      setPredict(p)
      setHeatmap(hm)
    } catch {
      // error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      refreshCache()
      await fetchData(false)
    } catch {
      await fetchData(false)
    } finally {
      setRefreshing(false)
    }
  }

  const heatmapSeriesData: Array<[string, string, number]> = useMemo(() => {
    const data: Array<[string, string, number]> = []
    heatmap.forEach((day) => {
      day.topics.forEach((t) => {
        data.push([day.date.slice(5), t.name, t.change_percent])
      })
    })
    return data
  }, [heatmap])

  const dateSet = useMemo(() => {
    const s = new Set<string>()
    heatmap.forEach((day) => s.add(day.date.slice(5)))
    return [...s]
  }, [heatmap])

  const topicSet = useMemo(() => {
    const s = new Set<string>()
    heatmap.forEach((day) => day.topics.forEach((t) => s.add(t.name)))
    return [...s].slice(0, 10)
  }, [heatmap])

  const heatmapOption: EChartsOption = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: { top: 10, left: 80, right: 10, bottom: 30, containLabel: false },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params: unknown) => {
        const p = params as { data: [string, string, number] }
        return `${p.data[1]}<br/>${p.data[0]}: ${p.data[2].toFixed(2)}%`
      },
    },
    xAxis: {
      type: 'category',
      data: dateSet,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b', fontSize: 8, rotate: 45 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: topicSet,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b', fontSize: 9 },
      axisTick: { show: false },
    },
    visualMap: {
      min: -5,
      max: 10,
      show: false,
      inRange: { color: ['#1e293b', '#7f1d1d', '#ef4444'] },
    },
    series: [
      {
        type: 'heatmap',
        data: heatmapSeriesData,
        itemStyle: { borderRadius: 2 },
        emphasis: { itemStyle: { shadowBlur: 5, shadowColor: 'rgba(0,0,0,0.5)' } },
      },
    ],
  }), [heatmapSeriesData, dateSet, topicSet])

  const mainLineStrength = useMemo(() => {
    if (!analysis) return 50
    const days = analysis.main_line_days
    const speed = analysis.rotation_speed
    return Math.min(100, Math.max(10, days * 15 + (speed < 0.3 ? 30 : speed < 0.6 ? 15 : 5)))
  }, [analysis])

  if (loading) {
    return (
      <div className="px-4 pt-3 pb-4 space-y-3 tab-bar-safe-area">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-40 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="px-4 pt-3 pb-4 space-y-3 tab-bar-safe-area">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">轮动分析</h2>
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

      {analysis && (
        <div className="card p-3.5">
          <h3 className="text-sm font-semibold text-white mb-3">轮动分析</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">当前主线</span>
              <span className="text-sm font-bold text-up">{analysis.main_line_topic || '-'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400">主线强度</span>
              <div className="mt-1">
                <StrengthIndicator score={mainLineStrength} size="sm" />
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                主线持续{analysis.main_line_days}天 · 评分基于持续天数与轮动速度
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">轮动阶段</span>
              <span className={clsx(
                'text-sm font-medium',
                analysis.current_phase === '快速轮动' ? 'text-up' :
                analysis.current_phase === '温和轮动' ? 'text-medium' : 'text-up'
              )}>
                {analysis.current_phase}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">轮动速度</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-up/70 rounded-full transition-all duration-500"
                    style={{ width: `${analysis.rotation_speed * 100}%` }} />
                </div>
                <span className="text-sm font-medium text-slate-300">
                  {(analysis.rotation_speed * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            {analysis.active_topics.length > 0 && (
              <div>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <TrendingUp size={10} className="text-up" /> 活跃题材
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {analysis.active_topics.slice(0, 6).map((t) => (
                    <span key={t} className="badge bg-up/10 text-up">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {analysis.fading_topics.length > 0 && (
              <div>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <TrendingDown size={10} className="text-down" /> 退潮题材
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {analysis.fading_topics.map((t) => (
                    <span key={t} className="badge bg-down/10 text-down">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {nodes.length > 0 && (
        <div className="card p-3.5">
          <h3 className="text-sm font-semibold text-white mb-2">题材关联图</h3>
          <RelationGraph nodes={nodes} edges={edges} />
        </div>
      )}

      {heatmap.length > 0 && (
        <div className="card p-3.5">
          <h3 className="text-sm font-semibold text-white mb-2">题材热力图</h3>
          <ReactECharts
            option={heatmapOption}
            style={{ height: '280px', width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      )}

      {history.length > 0 && (
        <div className="card p-3.5">
          <h3 className="text-sm font-semibold text-white mb-3">历史相似行情</h3>
          <div className="space-y-2.5">
            {history.map((h, i) => (
              <div key={i} className="bg-bg-primary/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">{h.matched_date}</span>
                  <span className="text-sm font-bold text-up">{(h.similarity * 100).toFixed(0)}%</span>
                </div>
                <p className="text-xs text-slate-300 mb-1">
                  次日热点：{h.next_day_hot_topics.length > 0 ? h.next_day_hot_topics.join('、') : '无数据'}
                </p>
                <p className="text-[10px] text-slate-500">
                  次日大盘：{h.next_day_market_change > 0 ? '+' : ''}{h.next_day_market_change.toFixed(2)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {predict && (
        <div className="card p-3.5">
          <h3 className="text-sm font-semibold text-white mb-3">明日预测</h3>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-slate-400">整体置信度</span>
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-up rounded-full transition-all duration-500"
                style={{ width: `${predict.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-up font-medium">{(predict.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="space-y-2">
            {predict.predicted_details.map((topic, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 bg-bg-primary/50 rounded-lg">
                <span className={clsx(
                  'text-xs font-bold w-5 text-center flex-shrink-0',
                  i === 0 ? 'text-up' : i === 1 ? 'text-medium' : 'text-slate-400'
                )}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{topic.name}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-10 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full',
                            topic.probability >= 0.7 ? 'bg-up' :
                            topic.probability >= 0.4 ? 'bg-orange-400' :
                            'bg-slate-500'
                          )}
                          style={{ width: `${topic.probability * 100}%` }}
                        />
                      </div>
                      <span className={clsx(
                        'text-[10px] font-bold',
                        topic.probability >= 0.7 ? 'text-up' :
                        topic.probability >= 0.4 ? 'text-orange-400' :
                        'text-slate-400'
                      )}>
                        {(topic.probability * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{topic.reason}</p>
                </div>
              </div>
            ))}
          </div>
          {predict.reasoning && (
            <div className="mt-3 px-2 py-1.5 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-1 mb-1">
                <HelpCircle size={10} className="text-slate-500" />
                <span className="text-[10px] text-slate-500">预测说明</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">{predict.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
