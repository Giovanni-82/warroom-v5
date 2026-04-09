import type { Metadata } from 'next'
import './globals.css'
import { NavBar } from '@/components/NavBar'
import { ClockBar } from '@/components/ClockBar'
import { AuthGate } from '@/components/AuthGate'

export const metadata: Metadata = {
  title: 'WarRoom v5.0 — Operazione Milione 2030',
  description: 'Cecchini v2.4 — Fronte 3',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <AuthGate>
          <ClockBar />
          <NavBar />
          <main className="max-w-screen-2xl mx-auto px-4 py-4">
            {children}
          </main>
        </AuthGate>
      </body>
    </html>
  )
}
