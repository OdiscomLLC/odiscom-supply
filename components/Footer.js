import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="mt-16 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="text-xl font-black tracking-tight text-white">ODISCOM SUPPLY</div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
            B2B sourcing for fiber broadband, wireless, tower, OSP, power, grounding, construction hardware, tools, and project material packages.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            {['Project pricing', 'BOM sourcing', 'Bulk quantities', 'Approved alternates', 'Lead-time review'].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{item}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-white">Buy</div>
          <div className="mt-4 grid gap-3 text-sm">
            <Link href="/shop" className="hover:text-white">Browse products</Link>
            <Link href="/quote" className="hover:text-white">Request a quote</Link>
            <Link href="/material-upload" className="hover:text-white">Upload a BOM</Link>
            <Link href="/account" className="hover:text-white">Buyer account</Link>
          </div>
        </div>
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-white">Partner</div>
          <div className="mt-4 grid gap-3 text-sm">
            <Link href="/supplier/login" className="hover:text-white">Supplier portal</Link>
            <a href="mailto:sales@odiscom.com" className="hover:text-white">sales@odiscom.com</a>
            <span>Nationwide project sourcing</span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>© 2026 Odiscom Supply LLC. All rights reserved.</span>
          <span>Built for professional infrastructure procurement.</span>
        </div>
      </div>
    </footer>
  )
}
