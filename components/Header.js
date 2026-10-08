import { useState } from 'react'
import Link from 'next/link'
import { useProjectCart } from '../lib/projectCart'

const primaryLinks = [
  ['/shop', 'Products'],
  ['/manufacturers', 'Manufacturers'],
  ['/material-upload', 'Upload BOM'],
  ['/account', 'Buyer Account'],
]

export default function Header() {
  const { lineCount } = useProjectCart()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-[11px] sm:px-6 sm:text-xs">
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate font-semibold uppercase tracking-[0.16em] text-slate-200">B2B telecom infrastructure sourcing</span>
            <span className="hidden h-3 w-px bg-white/15 md:block" />
            <span className="hidden text-slate-400 md:inline">Government • ISP • Contractor • Integrator</span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Link href="/supplier/login" className="hidden font-semibold hover:text-white sm:inline">Supplier portal</Link>
            <a href="mailto:sales@odiscom.com" className="font-semibold text-white hover:text-blue-200">sales@odiscom.com</a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-fit items-center gap-3" onClick={() => setMobileOpen(false)}>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-950 to-blue-700 text-sm font-black tracking-tight text-white shadow-sm">OS</div>
          <div className="hidden sm:block">
            <div className="text-lg font-black tracking-tight text-slate-950">ODISCOM SUPPLY</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Telecom Infrastructure</div>
          </div>
        </Link>

        <nav className="ml-3 hidden flex-1 items-center justify-center gap-7 text-sm font-semibold text-slate-700 lg:flex">
          {primaryLinks.map(([href, label]) => (
            <Link key={href} href={href} className="transition hover:text-blue-700">{label}</Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {lineCount > 1 && (
            <Link href="/compare" className="hidden rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 xl:inline-flex">
              Compare
            </Link>
          )}
          <Link href="/project-cart" className="relative inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50">
            <span className="hidden sm:inline">Project Cart</span>
            <span className="sm:hidden">Cart</span>
            {lineCount > 0 && <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white">{lineCount}</span>}
          </Link>
          <Link href="/quote" className="hidden min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 sm:inline-flex">Request pricing</Link>
          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 text-xl font-bold text-slate-800 transition hover:bg-slate-50 lg:hidden"
          >
            {mobileOpen ? '×' : '☰'}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-1 px-4 py-4 sm:px-6">
            {primaryLinks.map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 hover:text-blue-700">{label}</Link>
            ))}
            {lineCount > 1 && <Link href="/compare" onClick={() => setMobileOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 hover:text-blue-700">Compare project items</Link>}
            <Link href="/quote" onClick={() => setMobileOpen(false)} className="mt-2 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white">Request pricing</Link>
          </div>
        </div>
      )}
    </header>
  )
}
