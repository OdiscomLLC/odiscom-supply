import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { broadbandCatalog } from '../data/broadbandCatalog'
import { expandCatalogGroups } from '../data/catalogOptions'
import { useProjectCart } from '../lib/projectCart'

function ProductRow({ category, item, quantity, onChange }) {
  function update(next) {
    const value = Math.max(0, Number(next || 0))
    onChange(value)
  }

  const name = typeof item === 'string' ? item : item.name
  const unit = typeof item === 'string' ? 'each' : item.unit || 'each'
  const length = typeof item === 'string' ? '' : item.length || ''
  const lengthLabel = typeof item === 'string' ? '' : item.lengthLabel || ''

  return (
    <div className="group rounded-xl border border-slate-200 bg-white px-4 py-4 transition hover:border-blue-300 hover:shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{category}</span>
            {length && <span className="rounded-full bg-blue-50 px-2 py-1 font-bold text-blue-700">Requested length: {length}</span>}
            <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">Unit: {unit}</span>
          </div>
          {lengthLabel && <div className="mt-2 text-xs leading-5 text-slate-500">{lengthLabel}</div>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => update((quantity || 0) - 1)} className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50">-</button>
          <input type="number" min="0" value={quantity || ''} onChange={(e) => update(e.target.value)} placeholder="Qty" className="h-9 w-24 rounded-lg border border-slate-300 bg-white px-3 text-center text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500" />
          <button type="button" onClick={() => update((quantity || 0) + 1)} className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50">+</button>
        </div>
      </div>
    </div>
  )
}

export default function QuotePage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', details: '' })
  const [selectedItems, setSelectedItems] = useState({})
  const [search, setSearch] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [quoteId, setQuoteId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { items: cartItems, clearCart } = useProjectCart()

  const expandedCatalog = useMemo(() => expandCatalogGroups(broadbandCatalog), [])

  useEffect(() => {
    if (!router.isReady || typeof router.query.item !== 'string') return

    const requestedName = router.query.item.trim()
    const requestedCategory = typeof router.query.category === 'string' ? router.query.category.trim() : ''
    const requestedSku = typeof router.query.sku === 'string' ? router.query.sku.trim() : ''
    const requestedQty = Math.max(1, Number(router.query.qty || 1) || 1)
    let matched = null

    for (const group of expandedCatalog) {
      if (requestedCategory && group.category !== requestedCategory) continue
      const item = group.items.find((candidate) => candidate.name.toLowerCase() === requestedName.toLowerCase())
      if (item) {
        matched = { group, item }
        break
      }
    }

    setSearch(requestedName)

    if (matched) {
      const key = `${matched.group.category}::${matched.item.name}`
      setSelectedItems((current) => ({
        ...current,
        [key]: {
          category: matched.group.category,
          product_name: matched.item.name,
          quantity: requestedQty,
          unit: matched.item.unit || 'each',
          length: matched.item.length || '',
        },
      }))
    } else {
      const requestedLine = ['Requested catalog item: ' + requestedName, requestedSku ? 'SKU/Part: ' + requestedSku : '', requestedCategory ? 'Category: ' + requestedCategory : '', 'Quantity: ' + requestedQty]
        .filter(Boolean)
        .join(' | ')
      setForm((current) => ({
        ...current,
        details: current.details.includes(requestedLine) ? current.details : [requestedLine, current.details].filter(Boolean).join('\n'),
      }))
    }
  }, [router.isReady, router.query.item, router.query.category, router.query.qty, router.query.sku, expandedCatalog])

  useEffect(() => {
    if (!router.isReady || router.query.cart !== '1' || !cartItems.length) return
    setSelectedItems((current) => {
      const next = { ...current }
      for (const item of cartItems) {
        const key = `${item.category}::${item.name}`
        next[key] = {
          category: item.category,
          product_name: item.name,
          product_slug: item.sku || item.key,
          quantity: item.quantity,
          unit: item.unit || 'each',
          notes: item.notes || '',
        }
      }
      return next
    })
  }, [router.isReady, router.query.cart, cartItems])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  function updateItem(category, item, quantity) {
    const name = typeof item === 'string' ? item : item.name
    const unit = typeof item === 'string' ? 'each' : item.unit || 'each'
    const length = typeof item === 'string' ? '' : item.length || ''
    const key = `${category}::${name}`
    const qty = Number(quantity || 0)
    const nextItems = { ...selectedItems }

    if (qty > 0) {
      nextItems[key] = { category, product_name: name, quantity: qty, unit, length }
    } else {
      delete nextItems[key]
    }

    setSelectedItems(nextItems)
  }

  const filteredCatalog = useMemo(() => {
    const query = search.toLowerCase().trim()
    if (!query) return expandedCatalog

    return expandedCatalog
      .map((group) => ({ ...group, items: group.items.filter((item) => `${group.category} ${item.name} ${item.length || ''}`.toLowerCase().includes(query)) }))
      .filter((group) => group.items.length > 0)
  }, [search, expandedCatalog])

  const selectedList = useMemo(() => Object.values(selectedItems).sort((a, b) => a.category === b.category ? a.product_name.localeCompare(b.product_name) : a.category.localeCompare(b.category)), [selectedItems])
  const totalUnits = selectedList.reduce((sum, item) => sum + Number(item.quantity || 0), 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, selectedItems: selectedList }),
    })

    const data = await res.json()
    setLoading(false)

    if (data.success) {
      setSubmitted(true)
      setQuoteId(data.quoteId)
      if (router.query.cart === '1') clearCart()
    } else {
      setError(data.error || data.message || 'Error submitting quote')
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-blue-500 blur-3xl" />
            <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-cyan-400 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-7xl px-6 py-16 lg:py-20">
            <div className="max-w-4xl">
              <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Odiscom Supply • B2B Telecom Sourcing</div>
              <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-5xl">Request a project quote for fiber, wireless, tower, OSP, and construction supply materials</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-200 md:text-lg">Fiber cable items include standard reel, spool, and assembly lengths. Select materials, enter quantities, and submit your request. We quote by project volume, lead time, freight, and availability.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {['Fiber Broadband Materials', 'Cell Tower & Wireless Hardware', 'Splicing, Testing & Tools', 'Trailers, Reel Handling & OSP'].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm text-slate-100 backdrop-blur">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="-mt-8 relative z-10 mx-auto max-w-7xl px-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-semibold text-slate-900">Contractor-focused quoting</div><p className="mt-2 text-sm text-slate-600">Built for broadband builds, tower upgrades, OSP construction, and telecom infrastructure sourcing.</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-semibold text-slate-900">Standard cable lengths</div><p className="mt-2 text-sm text-slate-600">Fiber cable is listed by common reel, spool, and pre-terminated assembly lengths.</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-semibold text-slate-900">Fiber + wireless + tools</div><p className="mt-2 text-sm text-slate-600">Source everything from cable and connectors to splicers, grounding kits, and deployment trailers.</p></div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10">
          {submitted ? (
            <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
              <h2 className="text-3xl font-bold text-slate-900">Quote request submitted</h2>
              <p className="mt-3 text-slate-600">Your material request has been received and routed to Odiscom Supply for review.</p>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quote ID</div><div className="mt-2 text-2xl font-bold text-blue-700">{quoteId}</div></div>
              <p className="mt-6 text-sm text-slate-500">We’ll review your selected items, quantities, and notes, then follow up with pricing and availability.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-8 xl:grid-cols-[1.55fr_0.9fr]">
              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div><h2 className="text-2xl font-bold text-slate-900">Select materials</h2><p className="mt-1 text-sm text-slate-600">Search the catalog and enter quantities. Leave pricing to us.</p></div>
                      <div className="inline-flex items-center rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">{selectedList.length} items selected • {totalUnits} total units</div>
                    </div>
                    <div className="mt-5"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search fiber count, reel length, conduit, splice closures, tower mounts, grounding kits..." className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white" /></div>
                  </div>
                  <div className="max-h-[950px] overflow-y-auto px-6 py-6">
                    <div className="space-y-8">
                      {filteredCatalog.map((group) => (
                        <div key={group.category}>
                          <div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-bold text-slate-900">{group.category}</h3><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Telecom construction catalog</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{group.items.length} items</span></div>
                          <div className="grid gap-3">
                            {group.items.map((item) => {
                              const key = `${group.category}::${item.name}`
                              return <ProductRow key={key} category={group.category} item={item} quantity={selectedItems[key]?.quantity || 0} onChange={(qty) => updateItem(group.category, item, qty)} />
                            })}
                          </div>
                        </div>
                      ))}
                      {filteredCatalog.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-500">No catalog items matched your search.</div>}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="sticky top-24 space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-6 py-5"><h2 className="text-xl font-bold text-slate-900">Project contact details</h2><p className="mt-1 text-sm text-slate-600">Tell us who you are and what this request is for.</p></div>
                    <div className="px-6 py-6">
                      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                      <div className="space-y-4">
                        <input name="name" placeholder="Full name" required onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500" />
                        <input name="company" placeholder="Company" required onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500" />
                        <input name="email" type="email" placeholder="Email" required onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500" />
                        <input name="phone" placeholder="Phone" onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500" />
                        <textarea name="details" placeholder="Project location, delivery requirements, requested brands, alternates, deadlines, freight considerations, or anything else we should know..." rows="7" onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500" />
                      </div>
                      <button type="submit" disabled={loading} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Submitting quote request...' : 'Submit quote request'}</button>
                      <p className="mt-3 text-xs leading-5 text-slate-500">No public pricing is displayed. Final quotes may vary based on quantity, freight, lead time, approved alternates, and project requirements.</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-6 py-5"><h2 className="text-xl font-bold text-slate-900">Quote summary</h2><p className="mt-1 text-sm text-slate-600">Review your selected materials before submitting.</p></div>
                    <div className="px-6 py-6">
                      {selectedList.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">No items selected yet. Add quantities from the catalog on the left.</div> : <><div className="mb-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-50 px-4 py-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Line Items</div><div className="mt-1 text-2xl font-bold text-slate-900">{selectedList.length}</div></div><div className="rounded-2xl bg-slate-50 px-4 py-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total Units</div><div className="mt-1 text-2xl font-bold text-slate-900">{totalUnits}</div></div></div><div className="max-h-80 space-y-3 overflow-y-auto pr-1">{selectedList.map((item) => <div key={`${item.category}-${item.product_name}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold text-slate-900">{item.product_name}</div><div className="mt-1 text-xs text-slate-500">{item.category}</div>{item.length && <div className="mt-1 text-xs font-bold text-blue-700">Requested length: {item.length}</div>}</div><div className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Qty {item.quantity}</div></div></div>)}</div></>}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-blue-950 px-6 py-6 text-white shadow-sm"><div className="text-lg font-bold">Why buyers use Odiscom Supply</div><ul className="mt-4 space-y-3 text-sm text-slate-200"><li>• One sourcing channel for fiber, tower, and OSP supply</li><li>• Project-based quoting instead of generic retail pricing</li><li>• Support for contractor, ISP, and infrastructure buyers</li><li>• Ideal for bulk material lists and telecom deployments</li></ul></div>
                </div>
              </aside>
            </form>
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}
