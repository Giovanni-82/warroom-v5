import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const { data, error } = await db()
    .from('pipeline')
    .select('*')
    .eq('session_date', date)
    .order('formula_score', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db()
    .from('pipeline')
    .insert({ ...body, session_date: body.session_date || new Date().toISOString().split('T')[0] })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  const { data, error } = await db()
    .from('pipeline')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await db().from('pipeline').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
