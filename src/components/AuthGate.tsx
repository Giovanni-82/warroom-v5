'use client'
import { useState, useEffect } from 'react'

const PASS = process.env.NEXT_PUBLIC_WARROOM_PASS || 'warroom2030'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false)
  const [input, setInput] = useState('')
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('wr_auth') === '1') setOk(true)
  }, [])

  if (ok) return <>{children}</>

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-10 w-full max-w-sm text-center">
        <div className="text-3xl mb-2">🎯</div>
        <h1 className="text-xl font-bold text-white mb-1">WarRoom v5.0</h1>
        <p className="text-gray-400 text-sm mb-6">Operazione Milione 2030</p>
        <input
          type="password"
          placeholder="Password"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              if (input === PASS) { sessionStorage.setItem('wr_auth', '1'); setOk(true) }
              else setErr(true)
            }
          }}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-center tracking-widest mb-3 focus:outline-none focus:border-yellow-500"
        />
        {err && <p className="text-red-400 text-xs mb-3">Password errata</p>}
        <button
          onClick={() => {
            if (input === PASS) { sessionStorage.setItem('wr_auth', '1'); setOk(true) }
            else setErr(true)
          }}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition"
        >
          ACCEDI
        </button>
      </div>
    </div>
  )
}
