import { useEffect, useState } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

function money(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Not priced'
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ProductPage() {
  const router = useRouter()
  const { slug } = router.query
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    async function loadProduct() {
      const { data } = await supabase.from('products').select('*').or(`slug.eq.${slug},id.eq.${slug}`).single()
      setProduct(data)
      setLoading(false)
    }
    loadProduct()
  }, [slug])

  if (loading) {
    return <><Header /><main className="min-h-screen bg-slate-50 p-10 text-slate-600">Loading product...</main><Footer /></>
  }

  if (!product) {
    return <><Header /><main className="min-h-screen bg-slate-50 p-10 text-slate-600">Product not found.</main><Footer /></>
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
          <div className="absolute inset-0 opacity-20"><div className="absolute -left-24 top-8 h-80 w-80 rounded-full bg-blue-500 blur-3xl" /><div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-cyan-400 blur-3xl" /></div>
          <div className="relative mx-auto max-w-7xl px-6 py-16">
            <Link href="/shop" className="text-sm font-semibold text-blue-200">← Back to catalog</Link>
            <div className="mt-5 max-w-4xl">
              <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">{product.category || 'Telecom Supply'}</div>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl">{product.name}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-200">{product.description || 'Request pricing, lead time, freight, and availability from Odiscom Supply.'}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex h-96 items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50">
                {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="text-3xl font-bold text-slate-300">Odiscom Supply</div>}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-950">Product Details</h2>
              <p className="mt-2 text-sm text-slate-600">Use this product as part of a project quote, BOM, or telecom supply sourcing request.</p>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {[
                  ['SKU', product.sku || '-'],
                  ['Category', product.category || '-'],
                  ['Manufacturer', product.manufacturer || '-'],
                  ['Unit', product.unit || 'each'],
                  ['Lead Time', product.lead_time || 'Confirmed at quote'],
                  ['Status', product.status || 'active'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
                    <div className="mt-2 font-semibold text-slate-900">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-950">Common sourcing notes</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {['Quantity breaks may apply', 'Freight and lead time quoted by project', 'Alternates can be sourced'].map((item) => <div key={item} className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">{item}</div>)}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="sticky top-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Project pricing</div>
              <div className="mt-3 text-3xl font-bold text-slate-950">Request Quote</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">Final pricing is reviewed based on quantity, freight, lead time, sourcing options, and project requirements.</p>
              <div className="mt-6 space-y-3">
                {product.spec_sheet_url && <a href={product.spec_sheet_url} target="_blank" className="block rounded-xl bg-slate-100 px-5 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-slate-200">View Spec Sheet</a>}
                <Link href={`/quote?item=${encodeURIComponent(product.name)}&category=${encodeURIComponent(product.category || '')}&sku=${encodeURIComponent(product.sku || '')}`} className="block rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700">Add to Quote Request</Link>
                <Link href="/material-upload" className="block rounded-xl border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-slate-50">Upload BOM Instead</Link>
              </div>
              <div className="mt-6 rounded-2xl bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white"><div className="font-bold">Need a private-label or bulk program?</div><p className="mt-2 text-sm text-slate-300">Ask about branded reels, custom cable sourcing, and deployment supply packages.</p></div>
            </div>
          </aside>
        </section>
      </main>
      <Footer />
    </>
  )
}
