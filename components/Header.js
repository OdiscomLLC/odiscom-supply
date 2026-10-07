import Link from 'next/link'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="bg-slate-950 text-slate-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2 text-xs">
          <span className="font-semibold uppercase tracking-[0.18em]">B2B telecom infrastructure sourcing</span>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">Government • ISP • Contractor • Integrator</span>
            <a href="mailto:sales@odiscom.com" className="font-semibold text-white hover:text-blue-200">sales@odiscom.com</a>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex min-w-fit items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-950 to-blue-700 text-sm font-black tracking-tight text-white shadow-sm">OS</div>
          <div>
            <div className="text-lg font-black tracking-tight text-slate-950">ODISCOM SUPPLY</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Telecom Infrastructure</div>
          </div>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-6 text-sm font-semibold text-slate-700 lg:flex">
          <Link href="/shop" className="hover:text-blue-700">Products</Link>
          <Link href="/material-upload" className="hover:text-blue-700">Upload BOM</Link>
          <Link href="/quote" className="hover:text-blue-700">Request Quote</Link>
          <Link href="/account" className="hover:text-blue-700">Buyer Account</Link>
          <Link href="/supplier/login" className="hover:text-blue-700">Supplier Portal</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/shop" className="hidden rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-50 sm:inline-flex">Search catalog</Link>
          <Link href="/quote" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Get project pricing</Link>
        </div>
      </div>
      <div className="border-t border-slate-100 lg:hidden">
        <nav className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-6 py-3 text-xs font-semibold text-slate-700">
          <Link href="/shop" className="whitespace-nowrap">Products</Link>
          <Link href="/material-upload" className="whitespace-nowrap">Upload BOM</Link>
          <Link href="/quote" className="whitespace-nowrap">Request Quote</Link>
          <Link href="/account" className="whitespace-nowrap">Account</Link>
        </nav>
      </div>
    </header>
  )
}
