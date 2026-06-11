import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { RelationNode, RelationEdge } from '@/types'

interface RelationGraphProps {
  nodes: RelationNode[]
  edges: RelationEdge[]
}

const categoryColorMap: Record<string, string> = {
  '科技': '#ef4444',
  '制造': '#f97316',
  '新能源': '#eab308',
  '国防': '#3b82f6',
  '医疗': '#22c55e',
  '消费': '#8b5cf6',
  '新兴': '#ec4899',
}

const edgeTypeConfig: Record<string, { color: string; width: number; style: string }> = {
  category: { color: '#3b82f6', width: 2, style: 'solid' },
  proximity: { color: '#64748b', width: 1, style: 'dashed' },
  rotation: { color: '#ef4444', width: 3, style: 'solid' },
  related: { color: '#8b5cf6', width: 1.5, style: 'dotted' },
}

export default function RelationGraph({ nodes, edges }: RelationGraphProps) {
  const categories = Array.from(new Set(nodes.map((n) => n.category))).map((c) => ({
    name: c,
  }))

  const categoryIndexMap = new Map(categories.map((c, i) => [c.name, i]))

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    legend: {
      data: categories.map((c) => c.name),
      textStyle: { color: '#94a3b8', fontSize: 10 },
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        animation: true,
        draggable: true,
        roam: true,
        categories,
        data: nodes.map((n) => ({
          name: n.name,
          value: n.size,
          category: categoryIndexMap.get(n.category) ?? 0,
          symbolSize: Math.max(20, Math.min(60, n.size * 3)),
          label: {
            show: true,
            color: '#e2e8f0',
            fontSize: 10,
          },
          itemStyle: {
            color: categoryColorMap[n.category] || '#64748b',
          },
        })),
        links: edges.map((e) => {
          const config = edgeTypeConfig[e.type] || edgeTypeConfig.proximity
          return {
            source: e.source,
            target: e.target,
            value: e.weight,
            lineStyle: {
              width: config.width * e.weight,
              color: config.color,
              opacity: 0.6,
              type: config.style as 'solid' | 'dashed' | 'dotted',
            },
          }
        }),
        force: {
          repulsion: 200,
          gravity: 0.1,
          edgeLength: [80, 200],
          layoutAnimation: true,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 3 },
        },
        lineStyle: { opacity: 0.6, curveness: 0.1 },
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: '350px', width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  )
}
