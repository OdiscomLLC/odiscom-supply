import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { supabase } from '../lib/supabase'
import { broadbandCatalog } from '../data/broadbandCatalog'
import { expandCatalogItem } from '../data/catalogOptions'
import { useProjectCart } from '../lib/projectCart'

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function productHref(product) {
  if (product.catalogOnly) return `/quote?item=${encodeURIComponent(product.name)}&category=${encodeURIComponent(product.category || '')}`
  return `/product/${encodeURIComponent(product.slug || product.id)}`
}

function catalogProductsFromStaticList() {
  return broadbandCatalog.flatMap((group) => group.items.flatMap((name) => expandCatalogItem(group.category, name).map((expanded) => ({
    id: `catalog-${slugify(group.category)}-${slugify(expanded.name)}`,
    name: expanded.name,
    sku: expanded.length ? expanded.length : 'Catalog request',
    slug: slugify(expanded.name),
    category: group.category,
    manufacturer: 'Open manufacturer sourcing',
    description: expanded.lengthLabel || 'Request project pricing, availability, lead time, freight, and approved alternates from Odiscom Supply.',
    unit: expanded.unit,
    length: expanded.length,
    status: 'active',
    catalogOnly: true,
  }))))
}

function ProductCard({ product }) {
  const { addItem } = useProjectCart()
  const [added, setAdded] = useState(false)

  function addToProject() {
    addItem({ name: product.name, sku: product.sku, category: product.category, manufacturer: product.manufacturer, unit: product.unit, quantity: 1, source: product.catalogOnly ? 'request-catalog' : 'product' })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-100 via-white to-blue-50">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Odiscom Supply</div>
              <div className="mt-2 text-sm font-bold text-slate-400">Telecom infrastructure sourcing</div>
            </div>
          </div>
        )}
        <div className="absolute left-4 top-4 rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-[11px] font-bold text-slate-700 shadow-sm">{product.category || 'Telecom Supply'}</div>
        <div className="absolute bottom-4 left-4 rounded-full bg-slate-950/90 px-3 py-1 text-[11px] font-bold text-white">
          {product.catalogOnly ? 'Project quote' : 'Catalog product'}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{product.manufacturer || 'Project sourcing'}</div>
        <h2 className="mt-2 text-xl font-black leading-snug text-slate-950">{product.name}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {product.length && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{product.length}</span>}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{product.unit || 'each'}</span>
        </div>
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{product.description || 'Request pricing, lead time, quantity breaks, and availability from Odiscom Supply.'}</p>

        <div className="mt-auto pt-6">
          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 text-xs">
            <div>
              <div className="font-bold uppercase tracking-[0.14em] text-slate-400">Part / SKU</div>
              <div className="mt-1 truncate font-mono text-slate-700">{product.sku || 'Quote item'}</div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.14em] text-slate-400">Pricing</div>
              <div className="mt-1 font-bold text-slate-900">Project based</div>
            </div>
          </div>
          <button type="button" onClick={addToProject} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-700">
            {added ? 'Added to project' : 'Add to project cart'}
          </button>
          <Link href={productHref(product)} className="mt-2 block rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-800 transition hover:bg-slate-50">
            {product.catalogOnly ? 'Quote this item now' : 'View product'}
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function Shop() {
  const router = useRouter()
  const [databaseProducts, setDatabaseProducts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [viewMode, setViewMode] = useState('all')

  useEffect(() => {
    if (!router.isReady) return
    if (typeof router.query.search === 'string') setSearch(router.query.search)
    if (typeof router.query.category === 'string') setCategory(router.query.category)
  }, [router.isReady, router.query.search, router.query.category])

  useEffect(() => {
    async function loadProducts() {
      const { data, error: loadError } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true })

      if (loadError) setError('Saved product records are unavailable. Request-catalog items remain available for quote requests.')
      setDatabaseProducts(data || [])
      setLoading(false)
    }
    loadProducts()
  }, [])

  const staticProducts = useMemo(() => catalogProductsFromStaticList(), [])

  const products = useMemo(() => {
    const liveNames = new Set(databaseProducts.map((product) => `${product.category || ''}::${product.name || ''}`.toLowerCase()))
    const staticOnly = staticProducts.filter((product) => !liveNames.has(`${product.category || ''}::${product.name || ''}`.toLowerCase()))
    if (viewMode === 'live') return databaseProducts
    if (viewMode === 'catalog') return staticProducts
    return [...databaseProducts, ...staticOnly]
  }, [databaseProducts, staticProducts, viewMode])

  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(), [products])

  useEffect(() => {
    if (category !== 'all' && categories.length && !categories.includes(category)) setCategory('all')
  }, [categories, category])

  const filteredProducts = useMemo(() => products.filter((product) => {
    const query = search.toLowerCase().trim()
    const matchesSearch = !query || [product.name, product.sku, product.manufacturer, product.description, product.category, product.length]
      .filter(Boolean).join(' ').toLowerCase().includes(query)
    const matchesCategory = category === 'all' || product.category === category
    return matchesSearch && matchesCategory
  }), [products, search, category])

  const clearFilters = () => {
    setSearch('')
    setCategory('all')
    setViewMode('all')
    router.replace('/shop', undefined, { shallow: true })
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        {error && <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-center text-sm font-semibold text-amber-800" role="alert">{error}</div>}

        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-6 py-14">
            <div className="max-w-4xl">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">Telecom material catalog</div>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Search parts, assemblies, and project material families</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
                Use the catalog to identify what you need, then request pricing by quantity, lead time, freight, availability, and acceptable alternates.
              </p>
            </div>
          </div>
        </section>

        <section className="-mt-1 border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-6">
            <div className="grid gap-3 lg:grid-cols-[1fr_280px_220px_auto]">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search manufacturer, part number, fiber count, conduit size..." className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white">
                <option value="all">All categories</option>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select value={viewMode} onChange={(e) => setViewMode(e.target.value)} className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white">
                <option value="all">All sourcing items</option>
                <option value="live">Saved products</option>
                <option value="catalog">Request catalog</option>
              </select>
              <button type="button" onClick={clearFilters} className="rounded-2xl border border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Clear</button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => setCategory('all')} className={`rounded-full px-4 py-2 text-xs font-bold ${category === 'all' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700'}`}>All</button>
              {categories.slice(0, 12).map((cat) => (
                <button type="button" key={cat} onClick={() => setCategory(cat)} className={`rounded-full px-4 py-2 text-xs font-bold ${category === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">{category === 'all' ? 'All products' : category}</h2>
              <p className="mt-1 text-sm text-slate-600">{filteredProducts.length} sourcing items shown</p>
            </div>
            <div className="flex gap-2">
              <Link href="/material-upload" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800">Upload BOM</Link>
              <Link href="/quote" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Request project pricing</Link>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-slate-600 shadow-sm">Loading catalog...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="text-xl font-black text-slate-950">No matching catalog item</div>
              <p className="mt-2 text-sm text-slate-600">Clear the filters or send the requirement directly and we can source it.</p>
              <Link href="/quote" className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">Request a sourced item</Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          )}
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-6">
          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 md:grid-cols-3">
            {[
              ['Need a specific manufacturer?', 'Include the manufacturer and part number in your quote request.'],
              ['Open to alternates?', 'Tell us what substitutions are acceptable and we can compare options.'],
              ['Large project list?', 'Upload the BOM rather than selecting items one by one.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-slate-50 p-5">
                <div className="font-black text-slate-950">{title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
