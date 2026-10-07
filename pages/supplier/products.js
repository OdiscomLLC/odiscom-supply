import { amount, margins } from '../../lib/pricing'
import { useEffect, useMemo, useState } from 'react'
import SupplierShell from '../../components/SupplierShell'
import { supabase } from '../../lib/supabase'

function money(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Not priced'
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const emptyProduct = {
  name: '',
  sku: '',
  slug: '',
  category: '',
  manufacturer: '',
  description: '',
  price: '',
  cost: '',
  unit: 'each',
  lead_time: '',
  status: 'supplier_review',
  image_url: '',
  spec_sheet_url: '',
}

export default function SupplierProducts() {
  const [supplier, setSupplier] = useState(null)
  const [userId, setUserId] = useState(null)
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyProduct)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: sessionData } = await supabase.auth.getSession()
    const sessionUser = sessionData.session?.user
    const email = sessionUser?.email
    if (!email || !sessionUser?.id) {
      setLoading(false)
      return
    }
    setUserId(sessionUser.id)

    let { data: supplierData } = await supabase.from('suppliers').select('*').eq('owner_user_id', sessionUser.id).maybeSingle()
    if (!supplierData) {
      const fallback = await supabase.from('suppliers').select('*').eq('email', email).maybeSingle()
      supplierData = fallback.data
    }
    setSupplier(supplierData || null)

    if (supplierData?.name) {
      const { data: productData } = await supabase.from('products').select('*').eq('supplier_user_id', sessionUser.id).order('created_at', { ascending: false })
      setProducts(productData || [])
    }
    setLoading(false)
  }

  function updateField(field, value) {
    const next = { ...form, [field]: value }
    if (field === 'name' && !form.slug) next.slug = slugify(value)
    if (field === 'slug') next.slug = slugify(value)
    setForm(next)
  }

  async function saveProduct(e) {
    e.preventDefault()
    setMessage('')
    if (!supplier?.name || !userId) return setMessage('Create or link your supplier profile first.')
    const cleanSlug = slugify(form.slug || form.name || form.sku)
    if (!cleanSlug) return setMessage('Product needs a valid slug.')

    const { error } = await supabase.from('products').insert([{ ...form, slug: cleanSlug, supplier_name: supplier.name, supplier_user_id: userId, manufacturer: form.manufacturer.trim() || null, status: 'supplier_review', supplier_status: 'supplier_review', price: amount(form.price), cost: amount(form.cost) }])
    if (error) return setMessage(error.message)
    setForm(emptyProduct)
    setMessage('Product submitted for Odiscom review.')
    loadData()
  }

  async function updateProduct(product, fields) {
    const { error } = await supabase.from('products').update({ ...fields, status: 'supplier_review' }).eq('id', product.id)
    if (error) return setMessage(error.message)
    setMessage('Product update submitted for Odiscom review.')
    loadData()
  }

  const filteredProducts = useMemo(() => {
    const query = search.toLowerCase().trim()
    return products.filter((product) => !query || [product.name, product.sku, product.category, product.lead_time].join(' ').toLowerCase().includes(query))
  }, [products, search])

  return (
    <SupplierShell title="Supplier Products & Pricing">
      <div className="space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 text-white shadow-sm">
          <div className="max-w-3xl">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Supplier Catalog Updates</div>
            <h2 className="text-3xl font-bold">Submit products, cost updates, lead times, and availability.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Supplier-submitted updates are marked for Odiscom review before they are used for active public catalog pricing or quoting.</p>
          </div>
        </div>

        {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</div>}

        {!supplier && <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">Create your supplier profile before adding products.</div>}

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <form onSubmit={saveProduct} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div><h2 className="text-xl font-bold text-slate-950">Submit Product</h2><p className="mt-1 text-sm text-slate-600">Add a supplier product or update Odiscom with cost and lead-time information.</p></div>
            <input required value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Product name" className="w-full rounded-xl border border-slate-300 p-3" />
            <div className="grid grid-cols-2 gap-3"><input value={form.sku} onChange={(e) => updateField('sku', e.target.value)} placeholder="SKU" className="rounded-xl border border-slate-300 p-3" /><input value={form.slug} onChange={(e) => updateField('slug', e.target.value)} placeholder="clean-url-slug" className="rounded-xl border border-slate-300 p-3" /></div>
            <input value={form.category} onChange={(e) => updateField('category', e.target.value)} placeholder="Category" className="w-full rounded-xl border border-slate-300 p-3" />
            <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows="4" placeholder="Description, specs, availability notes..." className="w-full rounded-xl border border-slate-300 p-3" />
            <div className="grid grid-cols-2 gap-3"><input type="number" value={form.cost} onChange={(e) => updateField('cost', e.target.value)} placeholder="Supplier cost" className="rounded-xl border border-slate-300 p-3" /><input type="number" value={form.price} onChange={(e) => updateField('price', e.target.value)} placeholder="Suggested sell" className="rounded-xl border border-slate-300 p-3" /></div>
            <div className="grid grid-cols-2 gap-3"><input value={form.unit} onChange={(e) => updateField('unit', e.target.value)} placeholder="Unit" className="rounded-xl border border-slate-300 p-3" /><input value={form.lead_time} onChange={(e) => updateField('lead_time', e.target.value)} placeholder="Lead time" className="rounded-xl border border-slate-300 p-3" /></div>
            <input value={form.image_url} onChange={(e) => updateField('image_url', e.target.value)} placeholder="Image URL" className="w-full rounded-xl border border-slate-300 p-3" />
            <input value={form.spec_sheet_url} onChange={(e) => updateField('spec_sheet_url', e.target.value)} placeholder="Spec sheet URL" className="w-full rounded-xl border border-slate-300 p-3" />
            <button disabled={!supplier} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Submit Product</button>
          </form>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your products..." className="w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm" /></div>
            {loading ? <div className="p-10 text-slate-600">Loading products...</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-4 text-left">Product</th><th className="px-5 py-4 text-right">Cost</th><th className="px-5 py-4 text-left">Lead Time</th><th className="px-5 py-4 text-left">Status</th><th className="px-5 py-4 text-right">Quick Update</th></tr></thead><tbody>{filteredProducts.length === 0 && <tr><td colSpan="5" className="p-10 text-center text-slate-500">No supplier products found.</td></tr>}{filteredProducts.map((product) => <ProductRow key={product.id} product={product} onUpdate={updateProduct} />)}</tbody></table></div>}
          </div>
        </div>
      </div>
    </SupplierShell>
  )
}

function ProductRow({ product, onUpdate }) {
  const [cost, setCost] = useState(product.cost ?? '')
  const [leadTime, setLeadTime] = useState(product.lead_time || '')
  const [status, setStatus] = useState(product.status || 'supplier_review')

  return (
    <tr className="border-t align-top hover:bg-slate-50">
      <td className="px-5 py-4"><div className="font-semibold text-slate-950">{product.name}</div><div className="mt-1 text-xs text-slate-500">{product.sku || 'No SKU'} · {product.category || 'No category'}</div></td>
      <td className="px-5 py-4 text-right"><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-28 rounded-lg border px-3 py-2 text-right text-sm" /><div className="mt-1 text-xs text-slate-500">Current {money(product.cost)}</div></td>
      <td className="px-5 py-4"><input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} className="w-40 rounded-lg border px-3 py-2 text-sm" /></td>
      <td className="px-5 py-4"><select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="supplier_review">Review</option><option value="active">Available</option><option value="draft">Unavailable</option></select></td>
      <td className="px-5 py-4 text-right"><button type="button" onClick={() => onUpdate(product, { cost: amount(cost), lead_time: leadTime, supplier_status: status })} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Submit Update</button></td>
    </tr>
  )
}
