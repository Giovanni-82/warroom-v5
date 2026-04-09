import { NextRequest, NextResponse } from 'next/server'
import { getPostmarketData, getPremarketData, getRVOL } from '@/lib/polygon'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const type = searchParams.get('type') || 'postmarket' // postmarket | premarket
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  try {
    if (type === 'premarket') {
      const data = await getPremarketData(symbol)
      const rvol = await getRVOL(symbol)
      return NextResponse.json({ ...data, rvol })
    } else {
      const data = await getPostmarketData(symbol)
      return NextResponse.json(data)
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Batch: più ticker in una sola chiamata
export async function POST(req: NextRequest) {
  const { symbols, type } = await req.json()
  if (!symbols?.length) return NextResponse.json([])
  const results = await Promise.allSettled(
    symbols.slice(0, 50).map(async (sym: string) => {
      if (type === 'premarket') return getPremarketData(sym)
      return getPostmarketData(sym)
    })
  )
  const data = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => (r as any).value)
    .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))
  return NextResponse.json(data)
}
