import { NextRequest, NextResponse } from 'next/server'

// ============================================================
// AUTO-UPDATE — Claude può aggiornare il codice direttamente
// Richiede GITHUB_TOKEN nelle env vars di Vercel
// Uso: POST /api/auto-update con { files: [{path, content}], message }
// ============================================================

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!
const GITHUB_REPO = process.env.GITHUB_REPO || 'Giovanni-82/warroom-v5'
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'
const UPDATE_SECRET = process.env.CRON_SECRET || 'warroom-cron-2030'

interface FileUpdate {
  path: string    // es. "src/app/formula/page.tsx"
  content: string // contenuto del file (verrà encodato in base64)
}

async function getFileSHA(path: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
      { headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' } }
    )
    if (!r.ok) return null
    const d = await r.json()
    return d.sha || null
  } catch { return null }
}

async function updateFile(path: string, content: string, message: string): Promise<boolean> {
  try {
    const sha = await getFileSHA(path)
    const body: any = {
      message, branch: GITHUB_BRANCH,
      content: Buffer.from(content).toString('base64')
    }
    if (sha) body.sha = sha // necessario per aggiornare file esistente
    const r = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
      {
        method: 'PUT',
        headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    )
    return r.ok
  } catch { return false }
}

export async function POST(req: NextRequest) {
  // Verifica autorizzazione
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') || req.headers.get('x-update-secret')
  if (secret !== UPDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_TOKEN non configurato. Aggiungi il token nelle env vars di Vercel.' }, { status: 500 })
  }

  const { files, message }: { files: FileUpdate[]; message: string } = await req.json()
  if (!files?.length || !message) {
    return NextResponse.json({ error: 'files e message richiesti' }, { status: 400 })
  }

  const results: { path: string; success: boolean }[] = []
  for (const file of files) {
    const success = await updateFile(file.path, file.content, message)
    results.push({ path: file.path, success })
    await new Promise(r => setTimeout(r, 500)) // evita rate limit GitHub
  }

  const allSuccess = results.every(r => r.success)
  return NextResponse.json({
    ok: allSuccess,
    message: allSuccess ? `✅ ${results.length} file aggiornati su GitHub. Vercel deploya automaticamente.` : '⚠️ Alcuni file non aggiornati',
    results,
    deploy_url: `https://vercel.com/giovanni-82s-projects/warroom20261004`
  })
}

// GET — verifica che il sistema sia configurato
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('secret') !== UPDATE_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    ok: true,
    github_token: !!GITHUB_TOKEN,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
    status: GITHUB_TOKEN ? '✅ Sistema di auto-update configurato' : '❌ GITHUB_TOKEN mancante — aggiungi nelle env vars Vercel'
  })
}
