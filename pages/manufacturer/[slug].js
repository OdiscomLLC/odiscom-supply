import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { supabase } from '../../lib/supabase'
import { useProjectCart } from '../../lib/projectCart'

export default function ManufacturerDetail() {
  const router = useRouter()
  const name = typeof router.query.name === 'string' ? router.query.name : ''
  const [products,setProducts] = useState([])
  const [loading,setLoading] = useState(true)
  const { addItem } = useProjectCart()

  useEffect(()=>{
    if(!router.isReady || !name) return
    async function load() {
      const { data } = await supabase.from('products').select('*').eq('status','active').eq('manufacturer',name).order('category').order('name')
      setProducts(data || [])
      setLoading(false)
    }
    load()
  },[router.isReady,name])

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-6 py-14">
            <Link href="/manufacturers" className="text-sm font-bold text-blue-300">← All manufacturers</Link>
            <div className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-blue-300">Manufacturer profile</div>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">{name || 'Manufacturer'}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">Active Odiscom Supply catalog items for this manufacturer. Availability, authorization, lead time, country of origin, and project pricing are confirmed at quote time.</p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-6 py-10">
          {loading ? <div className="rounded-3xl bg-white p-10 text-slate-600 shadow-sm">Loading products...</div> :
          products.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><div className="text-xl font-black">No active products found</div><p className="mt-2 text-sm text-slate-600">You can still request sourcing for this manufacturer.</p><Link href={`/quote?item=${encodeURIComponent(name)}`} className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">Request manufacturer sourcing</Link></div> :
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {products.map((p)=>(
              <article key={p.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">{p.category || 'Telecom Supply'}</div>
                <h2 className="mt-2 text-xl font-black text-slate-950">{p.name}</h2>
                <div className="mt-2 font-mono text-xs text-slate-500">{p.sku || 'No SKU assigned'}</div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{p.description || 'Request project pricing, availability, and lead time.'}</p>
                <div className="mt-5 flex gap-2">
                  <button onClick={()=>addItem({name:p.name,sku:p.sku,category:p.category,manufacturer:p.manufacturer,unit:p.unit,quantity:1,source:'manufacturer'})} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">Add to project</button>
                  <Link href={`/product/${encodeURIComponent(p.slug || p.id)}`} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-900">View</Link>
                </div>
              </article>
            ))}
          </div>}
        </section>
      </main>
      <Footer />
    </>
  )
}
