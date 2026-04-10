'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface Message {
  id: string
  role: 'user' | 'claude'
  content: string
  created_at: string
}

export function WarRoomChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    loadMessages()
    const channel = supabase.channel('warroom-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'warroom_chat' }, (p) => {
        setMessages(prev => [...prev, p.new as Message])
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    const { data } = await supabase.from('warroom_chat').select('*').order('created_at', { ascending: true }).limit(50)
    setMessages(data || [])
    setUnread(0)
  }

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setLoading(true)

    // Salva messaggio utente
    await supabase.from('warroom_chat').insert({ role: 'user', content: userMsg })

    // Chiama Claude API
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg, history: messages.slice(-10) }) })
    const d = await r.json()
    if (d.reply) {
      await supabase.from('warroom_chat').insert({ role: 'claude', content: d.reply })
    }
    setLoading(false)
  }

  return (
    <>
      {/* Bottone fisso */}
      <button onClick={() => { setOpen(!open); setUnread(0) }}
        className="fixed bottom-6 right-6 z-50 bg-yellow-500 hover:bg-yellow-400 text-black w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all">
        {open ? '✕' : '🏛️'}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{unread}</span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[500px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-3">
            <span className="text-xl">🏛️</span>
            <div>
              <div className="text-white font-bold text-sm">Claude — WarRoom</div>
              <div className="text-gray-400 text-xs">Analista Cecchini v2.4 • sempre operativo</div>
            </div>
            <div className="ml-auto w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>

          {/* Messaggi */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm pt-8">
                <div className="text-3xl mb-2">🎯</div>
                <p>Chiedi qualsiasi cosa sul trading,<br/>sui candidati o sulla sessione.</p>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-100'}`}>
                  {m.role === 'claude' && <span className="text-yellow-400 font-bold text-xs block mb-1">🏛️ Claude</span>}
                  <div className="leading-relaxed whitespace-pre-wrap">{m.content}</div>
                  <div className={`text-xs mt-1 ${m.role === 'user' ? 'text-yellow-800' : 'text-gray-500'}`}>
                    {new Date(m.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl px-3 py-2 text-sm">
                  <span className="text-yellow-400 font-bold text-xs block mb-1">🏛️ Claude</span>
                  <span className="text-gray-400 animate-pulse">⏳ sto analizzando...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggerimenti rapidi */}
          <div className="px-3 py-2 border-t border-gray-800 flex gap-2 overflow-x-auto">
            {['Candidati oggi', 'Analizza FGNX', 'Come va la gara?', 'Regola Zero'].map(s => (
              <button key={s} onClick={() => setInput(s)}
                className="whitespace-nowrap bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full transition">
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-700 flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Chiedi a Claude..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500" />
            <button onClick={send} disabled={loading || !input.trim()}
              className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-4 py-2 rounded-xl transition text-sm">
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  )
}
