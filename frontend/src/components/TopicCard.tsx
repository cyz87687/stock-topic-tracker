import type { DailyTopic } from '@/types'
import { formatPercent, getChangeColor } from '@/utils/helpers'
import clsx from 'clsx'

interface TopicCardProps {
  topic: DailyTopic
  onClick: (name: string) => void
  index: number
}

const medals = ['🥇', '🥈', '🥉']

export default function TopicCard({ topic, onClick, index }: TopicCardProps) {
  const changeColor = getChangeColor(topic.change_percent)
  const barWidth = Math.min(Math.abs(topic.change_percent) * 10, 100)

  return (
    <div
      onClick={() => onClick(topic.topic_name)}
      className="card-hover p-3.5 cursor-pointer animate-fade-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 text-center">
          {index < 3 ? (
            <span className="text-lg">{medals[index]}</span>
          ) : (
            <span className="text-sm font-bold text-slate-500">{topic.rank}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-white truncate">{topic.topic_name}</span>
            {topic.is_new_entry && <span className="badge-new">新</span>}
          </div>

          <div className="flex items-baseline gap-3 mb-2">
            <span className={clsx('text-lg font-bold', changeColor)}>
              {formatPercent(topic.change_percent)}
            </span>
            {topic.consecutive_up_days > 0 && (
              <span className="text-xs text-orange-400">
                连红{topic.consecutive_up_days}天
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
            <span>
              涨停 <span className="text-up font-medium">{topic.up_limit_count}</span>/{topic.stock_count}
            </span>
            {topic.consecutive_limit_count > 0 && (
              <span>
                连板 <span className="text-orange-400 font-medium">{topic.consecutive_limit_count}</span>
              </span>
            )}
            <span>
              均幅 <span className={clsx('font-medium', getChangeColor(topic.avg_change_percent))}>
                {formatPercent(topic.avg_change_percent)}
              </span>
            </span>
          </div>

          <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                topic.change_percent > 0 ? 'bg-up' : topic.change_percent < 0 ? 'bg-down' : 'bg-slate-500'
              )}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
