import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const all = searchParams.get('all') === '1'
  let query = db().from('trades').select('*').order('created_at', { ascending: false })
  if (!all && date) query = query.eq('session_date', date)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Calcola P&L cumulativo
  let cumulative = -172 // P&L di partenza (dopo S8)
  const enriched = (data || []).reverse().map(t => {
    if (t.trade_done && t.result_eur) cumulative += t.result_eur
    return { ...t, cumulative_pnl: cumulative }
  }).reverse()
  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db()
    .from('trades')
    .insert({ ...body, session_date: body.session_date || new Date().toISOString().split('T')[0] })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  const { data, error } = await db()
    .from('trades')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Summary P&L
export async function PUT(req: NextRequest) {
  const { data, error } = await db().rpc('vw_pnl_summary' as any)
  if (error) {
    // Fallback: calcolo manuale
    const { data: trades } = await db().from('trades').select('result_eur,trade_done,result_pct')
    const done = (trades || []).filter(t => t.trade_done)
    const wins = done.filter(t => t.result_eur > 0)
    const losses = done.filter(t => t.result_eur < 0)
    const total_pnl = done.reduce((s, t) => s + (t.result_eur || 0), 0) - 172
    return NextResponse.json({
      total_pnl_eur: total_pnl,
      wins: wins.length,
      losses: losses.length,
      total_done: done.length,
      win_rate: done.length > 0 ? ((wins.length / done.length) * 100).toFixed(1) : '0',
      avg_win: wins.length > 0 ? (wins.reduce((s, t) => s + t.result_pct, 0) / wins.length).toFixed(2) : '0',
      avg_loss: losses.length > 0 ? (losses.reduce((s, t) => s + t.result_pct, 0) / losses.length).toFixed(2) : '0',
      to_million: 1000000 - 58000 - total_pnl
    })
  }
  return NextResponse.json(data)
}
