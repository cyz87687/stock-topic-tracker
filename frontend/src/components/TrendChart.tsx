import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

interface TrendChartProps {
  data: Array<{ date: string; value: number }>
  title: string
  color?: string
  height?: number
}

export default function TrendChart({ data, title, color = '#ef4444', height = 220 }: TrendChartProps) {
  const option: EChartsOption = {
    backgroundColor: 'transparent',
    title: {
      text: title,
      textStyle: { color: '#94a3b8', fontSize: 13, fontWeight: 500 },
      left: 0,
      top: 0,
    },
    grid: {
      top: 35,
      left: 5,
      right: 10,
      bottom: 5,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params
        const d = p as { axisValue: string; value: number; marker: string }
        return `${d.axisValue}<br/>${d.marker} ${d.value.toFixed(2)}%`
      },
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.date.slice(5)),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
      axisLabel: {
        color: '#64748b',
        fontSize: 10,
        formatter: (v: number) => `${v.toFixed(1)}%`,
      },
    },
    series: [
      {
        type: 'line',
        data: data.map((d) => d.value),
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + '40' },
              { offset: 1, color: color + '05' },
            ],
          },
        },
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: `${height}px`, width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  )
}
