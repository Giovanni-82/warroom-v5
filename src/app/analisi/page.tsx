'use client'
import { useState, useRef } from 'react'

export default function AnalisiPage() {
  const [images, setImages] = useState<string[]>([])
  const [mode, setMode] = useState<'SCREENER' | 'GRAFICI'>('SCREENER')
  const [context, setContext] = useState('')
  const [chunks, setChunks] = useState<string[]>([])
  const [currentChunk, setCurrentChunk] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const newImages: string[] = []
    for (const file of Array.from(files).slice(0, 10 - images.length)) {
      const b64 = await toBase64(file)
      newImages.push(b64)
    }
    setImages(prev => [...prev, ...newImages].slice(0, 10))
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.onerror = rej
      r.readAsDataURL(file)
    })
  }

  async function analyze() {
    if (images.length === 0) return
    setLoading(true)
    setChunks([])
    setCurrentChunk(0)
    setError('')
    try {
      const b64Images = images.map(img => img.replace(/^data:image\/\w+;base64,/, ''))
      const r = await fetch('/api/analysis/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: b64Images, mode, context })
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setChunks(d.chunks || [d.text])
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(i => i.type.startsWith('image/'))
    for (const item of imageItems.slice(0, 10 - images.length)) {
      const file = item.getAsFile()
      if (file) {
        toBase64(file).then(b64 => setImages(prev => [...prev, b64].slice(0, 10)))
      }
    }
  }

  return (
    <div onPaste={handlePaste} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">🖼️ Analisi Screenshot</h1>
        <div className="flex gap-2">
          {(['SCREENER', 'GRAFICI'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${mode === m ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {m === 'SCREENER' ? '📊 Screener' : '📈 Grafici'}
            </button>
          ))}
        </div>
      </div>

      {/* Upload zone */}
      <div
        className="border-2 border-dashed border-gray-600 hover:border-yellow-500 rounded-2xl p-8 text-center cursor-pointer transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
      >
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
        <div className="text-4xl mb-3">📸</div>
        <p className="text-gray-300 font-medium">Clicca, trascina o incolla (CTRL+V) gli screenshot</p>
        <p className="text-gray-500 text-sm mt-1">Max 10 immagini · PNG/JPG · TradingView</p>
        {images.length > 0 && (
          <p className="text-yellow-400 text-sm mt-2 font-bold">{images.length}/10 immagini caricate</p>
        )}
      </div>

      {/* Preview immagini */}
      {images.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              <img src={img} alt={`screenshot ${i + 1}`} className="h-24 w-auto rounded-lg border border-gray-700 object-cover" />
              <button
                onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full text-xs hidden group-hover:flex items-center justify-center"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Contesto opzionale */}
      <div>
        <label className="text-gray-400 text-sm block mb-1">Contesto aggiuntivo (opzionale)</label>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Es: ticker FGNX premarket, gap 45%, float 6.5M, catalyst M&A 8-K ieri sera..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 h-24 resize-none"
        />
      </div>

      {/* Bottone analisi */}
      <button
        onClick={analyze}
        disabled={loading || images.length === 0}
        className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold py-4 rounded-xl text-lg transition"
      >
        {loading ? '⏳ Analisi in corso (max 60s)...' : `🤖 Analizza ${images.length} screenshot — Modalità ${mode}`}
      </button>

      {/* Risultati con paginazione chunk */}
      {error && (
        <div className="bg-red-950 border border-red-700 rounded-xl p-4 text-red-300 text-sm">{error}</div>
      )}

      {chunks.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold">🏛️ CLAUDE — Analisi</h2>
            {chunks.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentChunk(c => Math.max(0, c - 1))}
                  disabled={currentChunk === 0}
                  className="bg-gray-700 text-white px-3 py-1 rounded text-sm disabled:opacity-30 hover:bg-gray-600 transition"
                >
                  ← Prec
                </button>
                <span className="text-gray-400 text-sm">{currentChunk + 1} / {chunks.length}</span>
                <button
                  onClick={() => setCurrentChunk(c => Math.min(chunks.length - 1, c + 1))}
                  disabled={currentChunk === chunks.length - 1}
                  className="bg-gray-700 text-white px-3 py-1 rounded text-sm disabled:opacity-30 hover:bg-gray-600 transition"
                >
                  Succ →
                </button>
              </div>
            )}
          </div>

          {/* Chunk corrente */}
          <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap bg-gray-800 rounded-xl p-4">
            {chunks[currentChunk]}
          </div>

          {/* Indicatori chunk */}
          {chunks.length > 1 && (
            <div className="flex gap-1 mt-3 justify-center">
              {chunks.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentChunk(i)}
                  className={`w-2 h-2 rounded-full transition ${i === currentChunk ? 'bg-yellow-400' : 'bg-gray-600 hover:bg-gray-500'}`}
                />
              ))}
            </div>
          )}

          {/* Bottone mostra tutto */}
          {chunks.length > 1 && (
            <button
              onClick={() => setCurrentChunk(-1)}
              className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition w-full text-center"
            >
              {currentChunk === -1 ? 'Mostra a chunk' : '↕ Mostra tutto'}
            </button>
          )}
          {currentChunk === -1 && (
            <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap bg-gray-800 rounded-xl p-4 mt-3">
              {chunks.join('\n\n')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
