# 🎯 WARROOM v5.0 — ISTRUZIONI DEPLOY

## PREREQUISITI
- Node.js 18+
- Account Vercel (gratuito)
- Supabase project: ydqajokmwvrfqruvckni (già esistente)
- API keys: Polygon.io, Finnhub

---

## STEP 1 — SETUP DATABASE SUPABASE

1. Vai su supabase.com → SQL Editor
2. Incolla il contenuto di `supabase/schema.sql`
3. Clicca RUN

---

## STEP 2 — INSTALL DIPENDENZE

```bash
cd warroom-v5
npm install
```

---

## STEP 3 — VARIABILI D'AMBIENTE

```bash
cp .env.example .env.local
# Compila .env.local con i tuoi valori reali
```

Valori da recuperare:
- NEXT_PUBLIC_SUPABASE_URL → Supabase Settings → API → Project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY → Supabase Settings → API → anon public
- SUPABASE_SERVICE_ROLE_KEY → Supabase Settings → API → service_role
- POLYGON_API_KEY → polygon.io dashboard
- FINNHUB_API_KEY → finnhub.io dashboard

---

## STEP 4 — TEST LOCALE

```bash
npm run dev
# Apri http://localhost:3000
# Password: WARROOM2030 (o quella nel .env)
```

---

## STEP 5 — DEPLOY SU VERCEL

```bash
# Installa Vercel CLI se non ce l'hai
npm i -g vercel

# Deploy
vercel

# Prima volta: segui le istruzioni interactive
# Poi imposta le env vars su Vercel dashboard
```

Oppure via GitHub:
1. Push su GitHub
2. Importa progetto su vercel.com
3. Aggiungi tutte le env vars nelle Settings → Environment Variables

---

## PAGINE DISPONIBILI

| Pagina | URL | Funzione |
|---|---|---|
| Dashboard | / | P&L, protocollo, regole apprese |
| Sweep | /sweep | Scansione 6 canali notturna |
| Pipeline | /pipeline | Kanban 4 colonne candidati |
| PostMarket | /postmarket | Monitor after-hours e pre-market live |
| Analisi | /analisi | Upload screenshot TradingView |
| Swing | /swing | Posizioni swing aperte |
| Registro | /registro | Storico tutti i trade |
| Camera | /camera | Analisi post-sessione best gainers |
| Database | /database | Universo ~10.000 ticker |

---

## OPERAZIONI MANUALI SUGGERITE

### Ogni sera (22:00 IT):
1. Vai su /sweep → clicca "Avvia Sweep"
2. Rivedi i candidati → sposta i migliori in Pipeline
3. Vai su /postmarket → aggiungi ticker interessanti dalla watchlist

### Ogni mattina (pre-market):
1. /postmarket → switch su "PreMarket" → aggiorna
2. /pipeline → carica screenshot TradingView via /analisi
3. Ottieni verdetti AI → aggiorna status in Pipeline

### Durante sessione (15:25-16:30 IT):
1. /pipeline → monitora Agganciati
2. Decisione finale Comandante → sposta in Cecchinati

### Post sessione:
1. /registro → inserisci trade fatto e non fatto
2. /camera → inserisci tutti i +10% → analizza con AI
3. Codifica nuove regole → appaiono in Dashboard

---

## TROUBLESHOOTING

**Risposta AI troncata:** Fixed in v5. Sistema di chunk automatico con paginazione.
**Timeout analisi immagini:** Impostato a 60s. Se ancora lento, riduci a 5 immagini.
**Errore Polygon:** Verifica POLYGON_API_KEY nel .env. Piano gratuito: 5 call/min.
**Database vuoto:** Vai su /database → "Aggiorna Database" per scaricare i 10.000 ticker.
