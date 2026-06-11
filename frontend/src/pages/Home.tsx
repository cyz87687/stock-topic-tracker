import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { getDailyTopics, getMarketOverview, refreshCache } from '@/api'
import type { DailyTopic, MarketOverviewData } from '@/types'
import MarketOverview from '@/components/MarketOverview'
import TopicCard from '@/components/TopicCard'
import clsx from 'clsx'

type SortKey = 'change' | 'upLimit' | 'profitEffect'

const sortMap: Record<SortKey, string> = {
  change: '涨幅',
  upLimit: '涨停家数',
  profitEffect: '赚钱效应',
}

export default function Home() {
  const currentDate = useStore((s) => s.currentDate)
  const setDate = useStore((s) => s.setDate)

  const [topics, setTopics] = useState<DailyTopic[]>([])
  const [market, setMarket] = useState<MarketOverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('change')
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [topicData, marketData] = await Promise.all([
        getDailyTopics(currentDate),
        getMarketOverview(currentDate),
      ])
      setTopics(topicData)
      setMarket(marketData.overview)
    } catch {
      setTopics([])
      setMarket(null)
    } finally {
      setLoading(false)
    }
  }, [currentDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [])

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

  const handlePrevDay = () => setDate(shiftDate(currentDate, -1))
  const handleNextDay = () => setDate(shiftDate(currentDate, 1))

  const handleTopicClick = (name: string) => {
    window.location.hash = `/topic/${encodeURIComponent(name)}`
  }

  const calcProfitEffect = (t: DailyTopic): number => {
    if (t.stock_count <= 0) return 0
    const limitRatio = t.up_limit_count / t.stock_count
    const consecBonus = t.consecutive_up_days * 2
    const fundBonus = t.main_fund_inflow > 0 ? Math.min(t.main_fund_inflow / 10, 5) : 0
    return limitRatio * 100 + consecBonus + fundBonus
  }

  const sortedTopics = [...topics].sort((a, b) => {
    if (sortKey === 'change') return b.change_percent - a.change_percent
    if (sortKey === 'upLimit') return b.up_limit_count - a.up_limit_count
    return calcProfitEffect(b) - calcProfitEffect(a)
  })

  return (
    <div className="px-4 pt-3 pb-4 space-y-3 tab-bar-safe-area">
      {market && <MarketOverview data={market} />}

      <div className="flex items-center justify-between">
        <button onClick={handlePrevDay} className="btn-ghost p-1.5 rounded-lg">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium text-slate-300">{currentDate}</span>
        <button onClick={handleNextDay} className="btn-ghost p-1.5 rounded-lg">
          <ChevronRight size={18} />
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={clsx(
            'ml-2 p-1.5 rounded-lg transition-all',
            refreshing
              ? 'bg-up/20 text-up'
              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
          )}
          title="刷新数据"
        >
          <RefreshCw size={16} className={clsx(refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="flex gap-1.5">
        {(Object.entries(sortMap) as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              sortKey === key
                ? 'bg-up/20 text-up'
                : 'bg-slate-800 text-slate-400 hover:text-slate-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {refreshing && (
        <div className="flex items-center gap-2 px-3 py-2 bg-up/10 rounded-lg">
          <RefreshCw size={14} className="text-up animate-spin" />
          <span className="text-xs text-up">正在刷新数据...</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-3.5">
              <div className="flex items-start gap-3">
                <div className="skeleton w-8 h-8 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-24 rounded" />
                  <div className="skeleton h-6 w-20 rounded" />
                  <div className="skeleton h-3 w-40 rounded" />
                  <div className="skeleton h-1.5 w-full rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <RefreshCw size={32} className="mb-3 opacity-50" />
          <p className="text-sm">暂无数据</p>
          <button
            onClick={handleRefresh}
            className="mt-2 px-4 py-1.5 bg-up/20 text-up text-xs rounded-full hover:bg-up/30 transition-colors"
          >
            点击刷新
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedTopics.map((topic, i) => (
            <TopicCard key={topic.id} topic={topic} onClick={handleTopicClick} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function shiftDate(dateStr: string, offset: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}
