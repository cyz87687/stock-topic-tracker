import * as cache from './cache'

const IS_DEV = import.meta.env.DEV

function emUrl(path: string): string {
  if (IS_DEV) return `/em${path}`
  return `https://push2.eastmoney.com${path}`
}

function emHisUrl(path: string): string {
  if (IS_DEV) return `/emhis${path}`
  return `https://push2his.eastmoney.com${path}`
}

function jsonp<T>(url: string, params: Record<string, string | number>): Promise<T> {
  return new Promise((resolve, reject) => {
    const cbName = `__stk_cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const script = document.createElement('script')
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('JSONP timeout'))
    }, 15000)

    function cleanup() {
      clearTimeout(timeout)
      delete (window as unknown as Record<string, unknown>)[cbName]
      if (script.parentNode) script.parentNode.removeChild(script)
    }

    ;(window as unknown as Record<string, unknown>)[cbName] = (data: T) => {
      cleanup()
      resolve(data)
    }

    const qs = new URLSearchParams()
    qs.set('cb', cbName)
    for (const [k, v] of Object.entries(params)) {
      qs.set(k, String(v))
    }
    script.src = `${url}?${qs.toString()}`
    script.onerror = () => {
      cleanup()
      reject(new Error('JSONP load error'))
    }
    document.head.appendChild(script)
  })
}

function safeFloat(val: unknown, def = 0): number {
  if (val == null) return def
  if (typeof val === 'number') return val
  const s = String(val).trim()
  if (s === '-' || s === '' || s === '--' || s === 'N/A') return def
  const n = parseFloat(s)
  return isNaN(n) ? def : n
}

function safeInt(val: unknown, def = 0): number {
  return Math.round(safeFloat(val, def))
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '科技': ['AI', '芯片', '半导体', '算力', '数据', '数字', '量子', '鸿蒙', 'CPO', 'Sora', '光模块', '软件', '云计算', '信创', '网络安全', '智能', '机器人', 'GPT', '大模型', '脑机'],
  '新能源': ['新能源', '光伏', '电池', '锂', '储能', '充电桩', '核聚变', '氢能', '风电', '碳', '绿色'],
  '制造': ['制造', '工业', '机械', '汽车', '飞行', '航空', '船舶', '轨交', '高铁'],
  '国防': ['军工', '国防', '航天', '兵装'],
  '医疗': ['医药', '医疗', '生物', '中药', '创新药', '医美', '器械'],
  '消费': ['消费', '食品', '白酒', '啤酒', '家电', '旅游', '零售', '服装', '体育', '世界杯'],
  '金融': ['银行', '证券', '保险', '金融', '期货', '创投'],
  '材料': ['材料', '化工', '环氧', '有机硅', '氟', '钨', '稀土', '钢铁', '铜', '铝'],
}

export function guessCategory(name: string): string {
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (name.includes(kw)) return cat
    }
  }
  return '概念'
}

function isLimitUp(code: string, change: number, name?: string): boolean {
  if (typeof change !== 'number') return false
  if (name && (name.includes('ST') || name.includes('*ST'))) return change >= 4.5
  if (code.startsWith('3') || code.startsWith('688')) return change >= 19.5
  return change >= 9.5
}

function getSecId(code: string): string {
  if (code.startsWith('6')) return `1.${code}`
  return `0.${code}`
}

export function calcConsecutiveLimitDays(kline: KlinePoint[], code: string, name?: string): number {
  let days = 0
  for (let i = kline.length - 1; i >= 0; i--) {
    if (isLimitUp(code, kline[i].change_percent, name)) {
      days++
    } else {
      break
    }
  }
  return days
}

export async function fetchStockKline(code: string, name: string, days = 15): Promise<KlinePoint[]> {
  const cacheKey = `stock_kline_${code}`
  const cached = cache.get<KlinePoint[]>(cacheKey)
  if (cached) return cached

  const secid = getSecId(code)
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days + 10)
  const beg = start.toISOString().slice(0, 10).replace(/-/g, '')
  const endStr = end.toISOString().slice(0, 10).replace(/-/g, '')

  const url = emHisUrl('/api/qt/stock/kline/get')
  const params: Record<string, string | number> = {
    secid,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: 101, fqt: 0, beg, end: endStr,
  }

  try {
    const data = await jsonp<{ data?: { klines?: string[] } }>(url, params)
    const klines = data.data?.klines || []
    const result: KlinePoint[] = []
    for (const line of klines) {
      const parts = line.split(',')
      if (parts.length >= 11) {
        result.push({
          date: parts[0],
          close: safeFloat(parts[2], 0),
          change_percent: safeFloat(parts[8], 0),
        })
      }
    }
    cache.set(cacheKey, result, 1800)
    return result
  } catch (e) {
    console.error('[EM] fetchStockKline error:', code, e)
    return []
  }
}

export interface RawBoard {
  rank: number
  board_code: string
  topic_name: string
  change_percent: number
  stock_count: number
  up_count: number
  down_count: number
  main_fund_net: number
  category: string
}

export async function fetchConceptBoards(topN = 20): Promise<RawBoard[]> {
  const cacheKey = `boards_${topN}`
  const cached = cache.get<RawBoard[]>(cacheKey)
  if (cached) return cached

  const url = emUrl('/api/qt/clist/get')
  const params: Record<string, string | number> = {
    pn: 1, pz: topN, po: 1, np: 1, fltt: 2, invt: 2, fid: 'f3',
    fs: 'm:90+t:3',
    fields: 'f2,f3,f4,f12,f14,f104,f105,f140,f141',
  }

  try {
    const data = await jsonp<{ rc: number; data?: { diff: Record<string, unknown>[] } }>(url, params)
    if (data.rc !== 0 || !data.data) return []

    const boards: RawBoard[] = []
    const diff = data.data.diff || []
    for (let i = 0; i < diff.length; i++) {
      const item = diff[i]
      const upCount = safeInt(item.f104, 0)
      const downCount = safeInt(item.f105, 0)
      const mainIn = safeFloat(item.f140, 0)
      const mainOut = safeFloat(item.f141, 0)
      let netFlow = mainIn - mainOut
      if (Math.abs(netFlow) > 100000) netFlow = Math.round(netFlow / 100000000 * 100) / 100
      else netFlow = Math.round(netFlow * 100) / 100

      const name = String(item.f14 || '')
      boards.push({
        rank: i + 1,
        board_code: String(item.f12 || ''),
        topic_name: name,
        change_percent: safeFloat(item.f3, 0),
        stock_count: upCount + downCount,
        up_count: upCount,
        down_count: downCount,
        main_fund_net: netFlow,
        category: guessCategory(name),
      })
    }
    cache.set(cacheKey, boards, 300)
    return boards
  } catch (e) {
    console.error('[EM] fetchConceptBoards error:', e)
    return []
  }
}

export async function fetchAllConceptBoards(): Promise<RawBoard[]> {
  const cacheKey = 'boards_all'
  const cached = cache.get<RawBoard[]>(cacheKey)
  if (cached) return cached

  const url = emUrl('/api/qt/clist/get')
  const params: Record<string, string | number> = {
    pn: 1, pz: 500, po: 1, np: 1, fltt: 2, invt: 2, fid: 'f3',
    fs: 'm:90+t:3',
    fields: 'f2,f3,f4,f12,f14,f104,f105',
  }

  try {
    const data = await jsonp<{ rc: number; data?: { diff: Record<string, unknown>[] } }>(url, params)
    if (data.rc !== 0 || !data.data) return []

    const boards: RawBoard[] = []
    const diff = data.data.diff || []
    for (let i = 0; i < diff.length; i++) {
      const item = diff[i]
      const name = String(item.f14 || '')
      boards.push({
        rank: i + 1,
        board_code: String(item.f12 || ''),
        topic_name: name,
        change_percent: safeFloat(item.f3, 0),
        stock_count: safeInt(item.f104, 0) + safeInt(item.f105, 0),
        up_count: safeInt(item.f104, 0),
        down_count: safeInt(item.f105, 0),
        main_fund_net: 0,
        category: guessCategory(name),
      })
    }
    cache.set(cacheKey, boards, 300)
    return boards
  } catch (e) {
    console.error('[EM] fetchAllConceptBoards error:', e)
    return []
  }
}

export async function fetchMarketIndices(): Promise<{ sh: number; cyb: number }> {
  const cacheKey = 'indices'
  const cached = cache.get<{ sh: number; cyb: number }>(cacheKey)
  if (cached) return cached

  const url = emUrl('/api/qt/stock/get')
  const results: { sh: number; cyb: number } = { sh: 0, cyb: 0 }

  for (const [secid, key] of [['1.000001', 'sh'], ['0.399006', 'cyb']] as const) {
    try {
      const data = await jsonp<{ data?: Record<string, unknown> }>(url, {
        secid,
        fields: 'f43,f44,f45,f46,f170,f57,f58',
      })
      const change = safeFloat(data.data?.f170, 0) / 100
      results[key] = Math.round(change * 100) / 100
    } catch {
      results[key] = 0
    }
  }

  cache.set(cacheKey, results, 60)
  return results
}

export interface KlinePoint {
  date: string
  close: number
  change_percent: number
}

export async function fetchBoardKline(boardCode: string, days = 45): Promise<KlinePoint[]> {
  const cacheKey = `kline_${boardCode}`
  const cached = cache.get<KlinePoint[]>(cacheKey)
  if (cached) return cached

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days + 15)
  const beg = start.toISOString().slice(0, 10).replace(/-/g, '')
  const endStr = end.toISOString().slice(0, 10).replace(/-/g, '')

  const url = emHisUrl('/api/qt/stock/kline/get')
  const params: Record<string, string | number> = {
    secid: `90.${boardCode}`,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: 101, fqt: 1, beg, end: endStr,
  }

  try {
    const data = await jsonp<{ data?: { klines?: string[] } }>(url, params)
    const klines = data.data?.klines || []
    const result: KlinePoint[] = []
    for (const line of klines) {
      const parts = line.split(',')
      if (parts.length >= 11) {
        result.push({
          date: parts[0],
          close: safeFloat(parts[2], 0),
          change_percent: safeFloat(parts[8], 0),
        })
      }
    }
    cache.set(cacheKey, result, 3600)
    return result
  } catch (e) {
    console.error('[EM] fetchBoardKline error:', boardCode, e)
    return []
  }
}

export async function fetchIndexKline(secid: string, days = 45): Promise<Record<string, number>> {
  const cacheKey = `idx_kline_${secid}`
  const cached = cache.get<Record<string, number>>(cacheKey)
  if (cached) return cached

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days + 15)
  const beg = start.toISOString().slice(0, 10).replace(/-/g, '')
  const endStr = end.toISOString().slice(0, 10).replace(/-/g, '')

  const url = emHisUrl('/api/qt/stock/kline/get')
  const params: Record<string, string | number> = {
    secid,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: 101, fqt: 1, beg, end: endStr,
  }

  const result: Record<string, number> = {}
  try {
    const data = await jsonp<{ data?: { klines?: string[] } }>(url, params)
    const klines = data.data?.klines || []
    for (const line of klines) {
      const parts = line.split(',')
      if (parts.length >= 9) {
        result[parts[0]] = safeFloat(parts[8], 0)
      }
    }
    cache.set(cacheKey, result, 3600)
  } catch (e) {
    console.error('[EM] fetchIndexKline error:', secid, e)
  }
  return result
}

export interface RawStock {
  stock_code: string
  stock_name: string
  change_percent: number
  is_leader: boolean
  is_limit_up: boolean
  consecutive_limit_days: number
}

export async function fetchLimitUpStocks(): Promise<RawStock[]> {
  const cacheKey = 'limit_up_stocks'
  const cached = cache.get<RawStock[]>(cacheKey)
  if (cached) return cached

  const url = emUrl('/api/qt/clist/get')
  const params: Record<string, string | number> = {
    pn: 1, pz: 200, po: 1, np: 1, fltt: 2, invt: 2, fid: 'f3',
    fs: 'm:0+t:6,m:0+t:80,m:1+t:2',
    fields: 'f2,f3,f4,f12,f14',
  }

  try {
    const data = await jsonp<{ rc: number; data?: { diff: Record<string, unknown>[] } }>(url, params)
    if (data.rc !== 0 || !data.data) return []

    const stocks: RawStock[] = []
    const diff = data.data.diff || []
    for (let i = 0; i < diff.length; i++) {
      const item = diff[i]
      const code = String(item.f12 || '')
      const change = safeFloat(item.f3, 0)
      const name = String(item.f14 || '')
      if (!name || !code) continue
      if (!isLimitUp(code, change, name)) continue
      stocks.push({
        stock_code: code,
        stock_name: name,
        change_percent: change,
        is_leader: i === 0,
        is_limit_up: true,
        consecutive_limit_days: 1,
      })
    }
    cache.set(cacheKey, stocks, 120)
    return stocks
  } catch (e) {
    console.error('[EM] fetchLimitUpStocks error:', e)
    return []
  }
}

export async function fetchStockKlineBatch(codes: string[], names: string[], days = 15): Promise<KlinePoint[][]> {
  const results: KlinePoint[][] = []
  const batchSize = 8
  for (let i = 0; i < codes.length; i += batchSize) {
    const batchCodes = codes.slice(i, i + batchSize)
    const batchNames = names.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batchCodes.map((code, j) => fetchStockKline(code, batchNames[j], days))
    )
    results.push(...batchResults)
  }
  return results
}

export async function fetchBoardStocks(boardCode: string, topN = 10): Promise<RawStock[]> {
  const cacheKey = `stocks_${boardCode}`
  const cached = cache.get<RawStock[]>(cacheKey)
  if (cached) return cached

  const url = emUrl('/api/qt/clist/get')
  const params: Record<string, string | number> = {
    pn: 1, pz: topN, po: 1, np: 1, fltt: 2, invt: 2, fid: 'f3',
    fs: `b:${boardCode}`,
    fields: 'f2,f3,f4,f12,f14',
  }

  try {
    const data = await jsonp<{ rc: number; data?: { diff: Record<string, unknown>[] } }>(url, params)
    if (data.rc !== 0 || !data.data) return []

    const stocks: RawStock[] = []
    const diff = data.data.diff || []
    for (let i = 0; i < diff.length; i++) {
      const item = diff[i]
      const code = String(item.f12 || '')
      const change = safeFloat(item.f3, 0)
      const name = String(item.f14 || '')
      if (!name || !code) continue
      stocks.push({
        stock_code: code,
        stock_name: name,
        change_percent: change,
        is_leader: i === 0,
        is_limit_up: isLimitUp(code, change, name),
        consecutive_limit_days: isLimitUp(code, change, name) ? 1 : 0,
      })
    }
    cache.set(cacheKey, stocks, 300)
    return stocks
  } catch (e) {
    console.error('[EM] fetchBoardStocks error:', boardCode, e)
    return []
  }
}

export async function fetchBatchKlines(
  boards: RawBoard[],
  days = 45
): Promise<Record<string, KlinePoint[]>> {
  const cacheKey = `batch_klines_${boards.length}_${days}`
  const cached = cache.get<Record<string, KlinePoint[]>>(cacheKey)
  if (cached) return cached

  const result: Record<string, KlinePoint[]> = {}
  const batchSize = 6
  for (let i = 0; i < boards.length; i += batchSize) {
    const batch = boards.slice(i, i + batchSize)
    const promises = batch.map((b) => fetchBoardKline(b.board_code, days))
    const klines = await Promise.all(promises)
    batch.forEach((b, j) => {
      result[b.topic_name] = klines[j]
    })
  }

  cache.set(cacheKey, result, 3600)
  return result
}
