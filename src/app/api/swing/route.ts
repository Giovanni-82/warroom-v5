import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()

export async function GET() {
  const { data, error } = await db()
    .from('swing_positions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db()
    .from('swing_positions')
    .insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  const { data, error } = await db()
    .from('swing_positions')
    .update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
