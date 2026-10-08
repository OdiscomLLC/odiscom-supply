import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { supabase } from '../lib/supabase'

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function ManufacturersPage() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('products').select('manufacturer,category,name,status').eq('status','active')
      setProducts(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const manufacturers = useMemo(() => {
    const map = new Map()
    for (const product of products) {
      const name = (product.manufacturer || '').trim()
      if (!name) continue
      if (!map.has(name)) map.set(name, { name, products: 0, categories: new Set() })
      const item = map.get(name)
      item.products += 1
      if (product.category) item.categories.add(product.category)
    }
    return [...map.values()]
      .map((item) => ({ ...item, categories: [...item.categories].sort() }))
      .filter((item) => !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.categories.join(' ').toLowerCase().includes(search.toLowerCase()))
      .sort((a,b) => a.name.localeCompare(b.name))
  }, [products, search])

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-6 py-14">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">Manufacturer directory</div>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Browse the manufacturers represented in the active Odiscom Supply catalog</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">Use manufacturer pages to narrow sourcing, identify supported product families, and build project requests around approved or preferred brands.</p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search manufacturer or product category..." className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white" />
          </div>
          {loading ? <div className="rounded-3xl bg-white p-10 text-slate-600 shadow-sm">Loading manufacturers...</div> :
          manufacturers.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">No active manufacturers matched your search.</div> :
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {manufacturers.map((m)=>(
              <Link key={m.name} href={`/manufacturer/${slugify(m.name)}?name=${encodeURIComponent(m.name)}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Manufacturer</div>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{m.name}</h2>
                <div className="mt-4 text-sm font-semibold text-slate-600">{m.products} active catalog item{m.products===1?'':'s'}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {m.categories.slice(0,4).map((cat)=><span key={cat} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{cat}</span>)}
                </div>
                <div className="mt-6 text-sm font-black text-blue-700">View manufacturer →</div>
              </Link>
            ))}
          </div>}
        </section>
      </main>
      <Footer />
    </>
  )
}
