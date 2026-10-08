import Link from 'next/link'

const LinkList = ({ title, children }) => (
  <div>
    <div className="text-sm font-black uppercase tracking-[0.18em] text-white">{title}</div>
    <div className="mt-4 grid gap-3 text-sm text-slate-400">{children}</div>
  </div>
)

export default function Footer() {
  return (
    <footer className="mt-16 bg-slate-950 text-slate-300">
      <div className="border-b border-white/10 bg-white/[0.03]">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Project-first sourcing', 'Quote the material package, not just a single SKU.'],
            ['Human-reviewed quotes', 'Availability, alternates, freight, and lead time are reviewed before issue.'],
            ['Government-ready workflow', 'Built for professional and public-sector procurement requirements.'],
            ['Nationwide fulfillment', 'Coordinate project material sourcing and delivery across the U.S.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-sm font-black text-white">{title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">{body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-2 lg:grid-cols-[1.3fr_.8fr_.8fr_.8fr]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-sm font-black text-white">OS</div>
            <div>
              <div className="text-xl font-black tracking-tight text-white">ODISCOM SUPPLY</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Telecom Infrastructure</div>
            </div>
          </div>
          <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">
            B2B sourcing for fiber broadband, wireless, tower, OSP, power, grounding, construction hardware, tools, and complete project material packages.
          </p>
          <a href="mailto:sales@odiscom.com" className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">sales@odiscom.com</a>
        </div>

        <LinkList title="Source">
          <Link href="/shop" className="hover:text-white">Browse products</Link>
          <Link href="/manufacturers" className="hover:text-white">Manufacturers</Link>
          <Link href="/material-upload" className="hover:text-white">Upload a BOM</Link>
          <Link href="/project-cart" className="hover:text-white">Project cart</Link>
        </LinkList>

        <LinkList title="Buy">
          <Link href="/quote" className="hover:text-white">Request project pricing</Link>
          <Link href="/account" className="hover:text-white">Buyer account</Link>
          <Link href="/compare" className="hover:text-white">Compare project items</Link>
          <span className="text-slate-500">PO • Invoice • Terms</span>
        </LinkList>

        <LinkList title="Partner">
          <Link href="/supplier/login" className="hover:text-white">Supplier portal</Link>
          <span>Government procurement</span>
          <span>ISP & contractor sourcing</span>
          <span>Nationwide project support</span>
        </LinkList>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>© 2026 Odiscom Supply LLC. All rights reserved.</span>
          <span>Professional infrastructure procurement • Project pricing • Human review</span>
        </div>
      </div>
    </footer>
  )
}
