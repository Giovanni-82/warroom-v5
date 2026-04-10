'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: '🏠 Dashboard' },
  { href: '/sweep', label: '🔍 Sweep' },
  { href: '/pipeline', label: '🎯 Pipeline' },
  { href: '/formula', label: '🧲 Formula Magica' },
  { href: '/postmarket', label: '📈 PostMarket' },
  { href: '/analisi', label: '🖼️ Analisi' },
  { href: '/classifiche', label: '🏆 Classifiche' },
  { href: '/swing', label: '📊 Swing' },
  { href: '/registro', label: '📋 Registro' },
  { href: '/camera', label: '🔬 Camera' },
  { href: '/database', label: '🗄️ Database' },
]

export function NavBar() {
  const path = usePathname()
  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-4 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href}
            className={`px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${path === l.href ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}`}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
