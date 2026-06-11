import clsx from 'clsx'

interface StrengthIndicatorProps {
  score: number
  size?: 'sm' | 'md'
}

export default function StrengthIndicator({ score, size = 'md' }: StrengthIndicatorProps) {
  const clamped = Math.max(0, Math.min(100, score))

  let label: string
  let colorClass: string
  let barColor: string

  if (clamped >= 75) {
    label = '强势'
    colorClass = 'text-strong'
    barColor = '#ef4444'
  } else if (clamped >= 50) {
    label = '较强'
    colorClass = 'text-medium'
    barColor = '#f97316'
  } else if (clamped >= 25) {
    label = '中性'
    colorClass = 'text-neutral'
    barColor = '#eab308'
  } else {
    label = '弱势'
    colorClass = 'text-weak'
    barColor = '#9ca3af'
  }

  const isSmall = size === 'sm'

  return (
    <div className="flex items-center gap-2">
      <div className={clsx('font-bold', colorClass, isSmall ? 'text-xs' : 'text-sm')}>
        {label}
      </div>
      <div className={clsx('flex-1 bg-slate-700/50 rounded-full overflow-hidden', isSmall ? 'h-1.5' : 'h-2')}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${clamped}%`, backgroundColor: barColor }}
        />
      </div>
      <div className={clsx('text-slate-400', isSmall ? 'text-[10px]' : 'text-xs')}>
        {clamped}
      </div>
    </div>
  )
}
