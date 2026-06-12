import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Flame, ArrowDown } from 'lucide-react'
import { getLimitBoard, refreshCache } from '@/api'
import type { LimitBoardItem } from '@/types'
import { formatPercent, getChangeColor } from '@/utils/helpers'
import clsx from 'clsx'

type SortKey = 'limit_days' | 'heat'

export default function LimitBoard() {
  const [stocks, setStocks] = useState<LimitBoardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('limit_days')
  const [sortAnimating, setSortAnimating] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getLimitBoard()
      setStocks(data)
    } catch {
      setStocks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      refreshCache()
      await fetchData()
    } catch { await fetchData() }
    finally { setRefreshing(false) }
  }

  const handleSortChange = (key: SortKey) => {
    if (key === sortKey) return
    setSortAnimating(true)
    setSortKey(key)
    setTimeout(() => setSortAnimating(false), 300)
  }

  const sortedStocks = useMemo(() => {
    const sorted = [...stocks]
    if (sortKey === 'heat') {
      sorted.sort((a, b) => {
        if (b.heat !== a.heat) return b.heat - a.heat
        return b.consecutive_limit_days - a.consecutive_limit_days
      })
    } else {
      sorted.sort((a, b) => {
        if (b.consecutive_limit_days !== a.consecutive_limit_days) {
          return b.consecutive_limit_days - a.consecutive_limit_days
        }
        return b.heat - a.heat
      })
    }
    return sorted
  }, [stocks, sortKey])

  return (
    <div className="px-4 pt-3 pb-4 space-y-3 tab-bar-safe-area">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Flame size={18} className="text-up" />
          连板榜
        </h2>
        <button onClick={handleRefresh} disabled={refreshing}
          className={clsx('p-2 rounded-lg transition-all', refreshing ? 'bg-up/20 text-up' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700')}>
          <RefreshCw size={16} className={clsx(refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="flex gap-1.5">
        <button onClick={() => handleSortChange('limit_days')}
          className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1',
            sortKey === 'limit_days' ? 'bg-up/20 text-up scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
          按连板天数
          {sortKey === 'limit_days' && <ArrowDown size={10} />}
        </button>
        <button onClick={() => handleSortChange('heat')}
          className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1',
            sortKey === 'heat' ? 'bg-up/20 text-up scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
          按市场热度
          {sortKey === 'heat' && <ArrowDown size={10} />}
        </button>
      </div>

      <div className="text-xs text-slate-500 px-1">
        {sortKey === 'limit_days'
          ? '连板天数 = 连续涨停交易日数，反映个股短期强势程度'
          : '市场热度 = 连板天数×20 + 涨幅×2 + 龙头加成 + 排名加成'}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-up/10 rounded-lg">
            <RefreshCw size={14} className="text-up animate-spin" />
            <span className="text-xs text-up">正在加载连板数据，计算连板天数中...</span>
          </div>
          {Array.from({length: 5}).map((_, i) => (
            <div key={i} className="card p-3"><div className="flex items-center gap-3">
              <div className="skeleton w-8 h-8 rounded" />
              <div className="flex-1 space-y-2"><div className="skeleton h-4 w-32 rounded" /><div className="skeleton h-3 w-20 rounded" /></div>
            </div></div>
          ))}
        </div>
      ) : stocks.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-500">
          <Flame size={32} className="mb-3 opacity-50" />
          <p className="text-sm">今日暂无连板股</p>
        </div>
      ) : (
        <div className={clsx('space-y-2 transition-opacity duration-300', sortAnimating ? 'opacity-50' : 'opacity-100')}>
          {sortedStocks.map((stock, i) => (
            <div key={stock.stock_code} className="card p-3 animate-fade-in" style={{animationDelay: `${i * 30}ms`}}>
              <div className="flex items-center gap-3">
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                  stock.consecutive_limit_days >= 5 ? 'bg-up text-white' :
                  stock.consecutive_limit_days >= 3 ? 'bg-up/70 text-white' :
                  'bg-up/30 text-up'
                )}>
                  {stock.consecutive_limit_days}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{stock.stock_name}</span>
                    <span className="text-[10px] text-slate-500">{stock.stock_code}</span>
                    {stock.is_leader && <span className="text-[10px] px-1.5 py-0.5 bg-up/20 text-up rounded">龙头</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={clsx('text-xs font-medium', getChangeColor(stock.change_percent))}>
                      {formatPercent(stock.change_percent)}
                    </span>
                    <span className="text-[10px] text-slate-500">{stock.topic_name}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={clsx('text-xs font-bold',
                    stock.consecutive_limit_days >= 5 ? 'text-up' :
                    stock.consecutive_limit_days >= 3 ? 'text-orange-400' :
                    'text-slate-400'
                  )}>
                    {stock.consecutive_limit_days}连板
                  </div>
                  <div className="text-[10px] text-orange-400">热度 {stock.heat}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
