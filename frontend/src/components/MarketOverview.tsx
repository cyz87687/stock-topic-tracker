import type { MarketOverviewData } from '@/types'
import { formatPercent, getChangeColor } from '@/utils/helpers'

interface MarketOverviewProps {
  data: MarketOverviewData
}

export default function MarketOverview({ data }: MarketOverviewProps) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">{data.trade_date}</span>
        <span className="text-xs text-slate-500">市场概览</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-primary/50 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 mb-1">上证指数</div>
          <div className={`text-base font-bold ${getChangeColor(data.sh_index_change)}`}>
            {formatPercent(data.sh_index_change)}
          </div>
        </div>
        <div className="bg-bg-primary/50 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 mb-1">创业板指</div>
          <div className={`text-base font-bold ${getChangeColor(data.cyb_index_change)}`}>
            {formatPercent(data.cyb_index_change)}
          </div>
        </div>
        <div className="bg-bg-primary/50 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 mb-1">赚钱效应</div>
          <div className="flex items-center gap-2">
            <div className="text-base font-bold text-up">
              {data.profit_effect_rate.toFixed(1)}%
            </div>
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-down to-up rounded-full transition-all duration-500"
                style={{ width: `${data.profit_effect_rate}%` }}
              />
            </div>
          </div>
        </div>
        <div className="bg-bg-primary/50 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500 mb-1">题材均幅</div>
          <div className="flex items-center gap-2">
            <div className={`text-base font-bold ${getChangeColor(data.avg_change_percent)}`}>
              {formatPercent(data.avg_change_percent)}
            </div>
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${data.avg_change_percent >= 0 ? 'bg-up/70' : 'bg-down/70'}`}
                style={{ width: `${Math.min(Math.abs(data.avg_change_percent) * 10, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-slate-700/50 flex items-center justify-between">
        <span className="text-xs text-slate-500">今日热点题材</span>
        <span className="text-sm font-bold text-up">{data.hot_topic_count}</span>
      </div>
    </div>
  )
}
