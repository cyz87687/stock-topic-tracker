export function getChangeColor(percent: number): string {
  if (percent > 0) return 'text-up'
  if (percent < 0) return 'text-down'
  return 'text-slate-400'
}

export function getStrengthLevel(percent: number): { label: string; color: string } {
  if (percent >= 5) return { label: '强势', color: 'text-up' }
  if (percent >= 3) return { label: '较强', color: 'text-medium' }
  if (percent >= 1) return { label: '中性', color: 'text-neutral' }
  if (percent > 0) return { label: '偏弱', color: 'text-slate-400' }
  if (percent > -1) return { label: '弱势', color: 'text-weak' }
  return { label: '极弱', color: 'text-down' }
}

export function formatPercent(value: number): string {
  if (value > 0) return `+${value.toFixed(2)}%`
  if (value < 0) return `${value.toFixed(2)}%`
  return '0.00%'
}

export function formatAmount(value: number): string {
  const abs = Math.abs(value)
  const sign = value >= 0 ? '' : '-'
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(2)}亿`
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(2)}万`
  return `${sign}${abs.toFixed(2)}`
}
