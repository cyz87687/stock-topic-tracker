import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, TrendingUp } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { getTopicDetail, getTopicStocks, getTopicTrend, getTopicStrength } from '@/api'
import { formatPercent, getChangeColor } from '@/utils/helpers'
import type { TopicInfo, TopicStock, TopicTrendItem, TopicStrengthData } from '@/types'
import TrendChart from '@/components/TrendChart'
import StrengthIndicator from '@/components/StrengthIndicator'
import clsx from 'clsx'

export default function TopicDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const topicName = decodeURIComponent(name || '')
  const { favorites, toggleFavorite } = useStore()
  const isFav = favorites.includes(topicName)

  const [detail, setDetail] = useState<TopicInfo | null>(null)
  const [stocks, setStocks] = useState<TopicStock[]>([])
  const [trend, setTrend] = useState<TopicTrendItem[]>([])
  const [strength, setStrength] = useState<TopicStrengthData | null>(null)
  const [trendDays, setTrendDays] = useState<7 | 30>(7)
  const [loading, setLoading] = useState(true)
  const [sortStocks, setSortStocks] = useState<'change' | 'limit'>('change')

  const fetchData = useCallback(async () => {
    if (!topicName) return
    setLoading(true)
    try {
      const [d, s, t, st] = await Promise.all([
        getTopicDetail(topicName),
        getTopicStocks(topicName),
        getTopicTrend(topicName, trendDays),
        getTopicStrength(topicName),
      ])
      setDetail(d.info)
      setStocks(s)
      setTrend(t)
      setStrength(st)
    } catch {
      // error
    } finally {
      setLoading(false)
    }
  }, [topicName, trendDays])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const sortedStocks = [...stocks].sort((a, b) => {
    if (sortStocks === 'change') return b.change_percent - a.change_percent
    return b.consecutive_limit_days - a.consecutive_limit_days
  })

  const trendData = trend.map((t) => ({
    date: t.trade_date,
    value: t.change_percent,
  }))

  let relatedTopics: string[] = []
  if (detail?.related_topics) {
    try {
      relatedTopics = JSON.parse(detail.related_topics)
    } catch {
      relatedTopics = []
    }
  }

  if (loading) {
    return (
      <div className="px-4 pt-3 pb-4 tab-bar-safe-area">
        <div className="space-y-4">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-40 w-full rounded-xl" />
          <div className="skeleton h-60 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-3 pb-4 space-y-3 tab-bar-safe-area">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1.5 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-white truncate flex-1 text-center px-2">
          {topicName}
        </h1>
        <button
          onClick={() => toggleFavorite(topicName)}
          className={clsx('p-1.5 rounded-lg transition-colors', isFav ? 'text-yellow-400' : 'text-slate-500')}
        >
          <Star size={20} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>

      {detail && (
        <div className="card p-3.5">
          <p className="text-xs text-slate-400 mb-2">{detail.description}</p>
          <div className="flex items-center gap-2 mb-3">
            <span className="badge bg-slate-700 text-slate-300">{detail.category}</span>
          </div>
          {strength && <StrengthIndicator score={strength.strength_score} />}
        </div>
      )}

      <div className="card p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setTrendDays(7)}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              trendDays === 7 ? 'bg-up/20 text-up' : 'text-slate-400'
            )}
          >
            7日趋势
          </button>
          <button
            onClick={() => setTrendDays(30)}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              trendDays === 30 ? 'bg-up/20 text-up' : 'text-slate-400'
            )}
          >
            30日趋势
          </button>
        </div>
        <TrendChart data={trendData} title="涨幅走势" />
      </div>

      <div className="card p-3.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">成分股</h3>
          <div className="flex gap-1.5">
            <button
              onClick={() => setSortStocks('change')}
              className={clsx(
                'px-2 py-0.5 rounded text-[10px] transition-colors',
                sortStocks === 'change' ? 'bg-up/20 text-up' : 'text-slate-500'
              )}
            >
              按涨幅
            </button>
            <button
              onClick={() => setSortStocks('limit')}
              className={clsx(
                'px-2 py-0.5 rounded text-[10px] transition-colors',
                sortStocks === 'limit' ? 'bg-up/20 text-up' : 'text-slate-500'
              )}
            >
              按连板
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          {sortedStocks.map((stock) => (
            <div
              key={stock.id}
              className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-bg-hover/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {stock.is_leader && (
                  <TrendingUp size={12} className="text-up" />
                )}
                <div>
                  <span className="text-sm text-white font-medium">{stock.stock_name}</span>
                  <span className="text-[10px] text-slate-500 ml-1.5">{stock.stock_code}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {stock.consecutive_limit_days > 0 && (
                  <span className="text-[10px] text-orange-400">
                    {stock.consecutive_limit_days}连板
                  </span>
                )}
                <span className={clsx('text-sm font-bold', getChangeColor(stock.change_percent))}>
                  {formatPercent(stock.change_percent)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {relatedTopics.length > 0 && (
        <div className="card p-3.5">
          <h3 className="text-sm font-semibold text-white mb-2">关联题材</h3>
          <div className="flex flex-wrap gap-2">
            {relatedTopics.map((rt) => (
              <button
                key={rt}
                onClick={() => navigate(`/topic/${encodeURIComponent(rt)}`)}
                className="px-3 py-1 bg-bg-hover rounded-full text-xs text-slate-300 hover:text-up transition-colors"
              >
                {rt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
