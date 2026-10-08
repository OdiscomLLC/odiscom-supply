import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'

const categories = [
  ['Fiber Cable', 'OSP, indoor/outdoor, armored, drop, ribbon, and project reel lengths', 'OSP Fiber Cable', 'FO'],
  ['Conduit & Pathway', 'HDPE conduit, innerduct, microduct, fittings, and accessories', 'Conduit & Innerduct', 'HD'],
  ['Splicing & Closures', 'Closures, trays, splitters, terminals, patching, and protection', 'Splice Closures', 'SP'],
  ['Handholes & Vaults', 'Underground enclosures, lids, vaults, and installation accessories', 'Handholes & Vaults', 'HH'],
  ['Wireless & Tower', 'Mounts, steel, jumpers, hangers, weatherproofing, and site hardware', 'Tower Steel & Mounts', 'RF'],
  ['Grounding & Power', 'Grounding, surge protection, cabinets, power, and electrical site materials', 'Grounding & Power', 'GP'],
  ['Tools & Test', 'Fusion splicers, OTDRs, meters, prep tools, and field equipment', 'Fusion Splicing Tools', 'TT'],
  ['Reel Handling', 'Fiber reel trailers, reel stands, pulling accessories, and deployment equipment', 'Fiber Reel Trailers', 'RH'],
]

const buyingModes = [
  ['Catalog sourcing', 'Search common telecom materials and request project-specific pricing.'],
  ['BOM procurement', 'Upload spreadsheets, plan takeoffs, or material lists for complete sourcing.'],
  ['Government supply', 'Build compliant material packages for public-sector and federal opportunities.'],
  ['Project fulfillment', 'Coordinate quantities, alternates, lead times, freight, and staged delivery.'],
]

const proof = [
  ['One RFQ', 'Source across multiple telecom categories without splitting the project across vendors.'],
  ['Project pricing', 'Pricing is reviewed around quantity, freight, lead time, availability, and approved alternates.'],
  ['Human review', 'Complex BOMs and infrastructure packages are reviewed before a quote is issued.'],
]

export default function Home() {
  return (
    <>
      <Header />
      <main className="bg-slate-50">
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0">
            <div className="absolute -left-24 top-8 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" />
            <div className="absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          </div>
          <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-28">
            <div>
              <div className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-blue-200">
                Telecom procurement for real project requirements
              </div>
              <h1 className="max-w-5xl text-4xl font-black leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
                Source the material package. Not just the part number.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200 md:text-xl">
                Source fiber, wireless, tower, OSP, power, grounding, tools, and construction hardware around the actual job—quantity, approved manufacturers, alternates, freight, lead time, and delivery requirements included.
              </p>

              <div className="mt-8 max-w-3xl text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Search the catalog or start with a complete material list</div>
              <form action="/shop" method="get" className="mt-3 flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 shadow-2xl backdrop-blur sm:flex-row">
                <input
                  name="search"
                  placeholder="Search by part number, manufacturer, or category..."
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white px-4 py-3.5 text-sm text-slate-950 outline-none ring-0 placeholder:text-slate-400"
                />
                <button className="rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-blue-500">Search products</button>
              </form>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/material-upload" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100">Upload BOM / Material List</Link>
                <Link href="/quote" className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Start a quote request</Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-slate-300">
                <span>✓ Bulk quantities</span>
                <span>✓ Approved alternates</span>
                <span>✓ Lead-time review</span>
                <span>✓ Freight coordination</span>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur">
              <div className="rounded-3xl bg-white p-6 text-slate-950">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Project desk</div>
                    <div className="mt-1 text-2xl font-black">From BOM to award</div>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">B2B workflow</div>
                </div>
                <div className="mt-6 space-y-3">
                  {[
                    ['01', 'Send the requirement', 'Search products, upload a BOM, or submit a solicitation material list.'],
                    ['02', 'Source and compare', 'We review suppliers, alternates, availability, freight, and lead time.'],
                    ['03', 'Issue project pricing', 'Receive a structured quote with assumptions and selected sourcing.'],
                    ['04', 'Convert to fulfillment', 'Accepted quotes move into order and delivery coordination.'],
                  ].map(([number, title, body]) => (
                    <div key={number} className="grid grid-cols-[48px_1fr] gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">{number}</div>
                      <div>
                        <div className="font-bold">{title}</div>
                        <div className="mt-1 text-sm leading-5 text-slate-600">{body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-px bg-slate-200 sm:grid-cols-3">
            {proof.map(([title, body]) => (
              <div key={title} className="bg-white px-6 py-7">
                <div className="text-xl font-black text-slate-950">{title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Product families</div>
              <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Built around the materials telecom projects actually consume</h2>
            </div>
            <Link href="/shop" className="text-sm font-bold text-blue-700 hover:text-blue-800">Browse full catalog →</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {categories.map(([title, body, search, icon]) => (
              <Link key={title} href={`/shop?category=${encodeURIComponent(search)}`} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl">
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-slate-100 text-sm font-black tracking-tight text-blue-700 ring-1 ring-blue-100 transition group-hover:from-blue-600 group-hover:to-blue-700 group-hover:text-white">{icon}</div>
                <h3 className="text-lg font-black text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                <div className="mt-5 text-sm font-bold text-blue-700">View category</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="max-w-3xl">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Four ways to buy</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Use the workflow that matches the project</h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {buyingModes.map(([title, body], index) => (
                <div key={title} className="rounded-3xl border border-slate-200 bg-slate-50 p-6 transition hover:border-blue-200 hover:bg-white hover:shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white">0{index + 1}</div>
                  <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-700 to-slate-950 p-8 text-white shadow-xl md:p-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">Have the material list already?</div>
                <h2 className="mt-3 text-3xl font-black md:text-4xl">Send the BOM. We’ll build the sourcing package.</h2>
                <p className="mt-4 max-w-2xl text-slate-200">Upload a spreadsheet, PDF, plan takeoff, or material list and move directly into a structured project quote workflow.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/material-upload" className="rounded-xl bg-white px-6 py-3.5 text-center text-sm font-bold text-slate-950">Upload BOM</Link>
                <Link href="/quote" className="rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-center text-sm font-bold text-white">Request pricing</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
