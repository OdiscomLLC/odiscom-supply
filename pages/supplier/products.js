import { useEffect, useMemo, useState } from 'react'
import SupplierShell from '../../components/SupplierShell'
import { supabase } from '../../lib/supabase'

function money(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Not priced'
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const emptyForm={
  manufacturer:'',
  manufacturer_part_number:'',
  supplier_sku:'',
  product_name:'',
  category:'',
  description:'',
  unit:'each',
  unit_cost:'',
  available_quantity:'',
  availability_status:'unknown',
  lead_time_text:'',
  minimum_order_quantity:'',
  freight_terms:'',
  country_of_origin:'',
  taa_compliant:'',
  baba_compliant:'',
  image_url:'',
  spec_sheet_url:'',
}

function Badge({children,tone='blue'}){
  const tones={blue:'bg-blue-50 text-blue-700',green:'bg-green-50 text-green-700',amber:'bg-amber-50 text-amber-700',red:'bg-red-50 text-red-700',slate:'bg-slate-100 text-slate-700'}
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tones[tone]||tones.blue}`}>{children}</span>
}

export default function SupplierProducts(){
  const [supplier,setSupplier]=useState(null)
  const [offers,setOffers]=useState([])
  const [form,setForm]=useState(emptyForm)
  const [search,setSearch]=useState('')
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(true)
  const [submitting,setSubmitting]=useState(false)

  useEffect(()=>{ loadOffers() },[])

  async function authHeaders(){
    const {data}=await supabase.auth.getSession()
    const token=data.session?.access_token
    return token ? {Authorization:'Bearer '+token} : {}
  }

  async function loadOffers(){
    setLoading(true)
    setMessage('')
    const headers=await authHeaders()
    const response=await fetch('/api/supplier/offers',{headers})
    const data=await response.json()
    if(!response.ok){
      setMessage(data.message || 'Supplier offers could not be loaded.')
      setLoading(false)
      return
    }
    setSupplier(data.supplier)
    setOffers(data.offers || [])
    setLoading(false)
  }

  function updateField(field,value){
    setForm((current)=>({...current,[field]:value}))
  }

  async function submitOffer(e){
    e.preventDefault()
    setSubmitting(true)
    setMessage('')
    const headers=await authHeaders()
    const response=await fetch('/api/supplier/offers',{
      method:'POST',
      headers:{'Content-Type':'application/json',...headers},
      body:JSON.stringify(form)
    })
    const data=await response.json()
    setSubmitting(false)
    if(!response.ok) return setMessage(data.message || 'Offer could not be submitted.')
    setForm(emptyForm)
    setMessage(data.message || 'Offer submitted for review.')
    loadOffers()
  }

  const filtered=useMemo(()=>{
    const query=search.toLowerCase().trim()
    return offers.filter((offer)=>{
      const product=offer.products || {}
      return !query || [
        product.name,product.manufacturer,product.manufacturer_part_number,product.category,
        offer.supplier_sku,offer.availability_status,offer.lead_time_text
      ].filter(Boolean).join(' ').toLowerCase().includes(query)
    })
  },[offers,search])

  return (
    <SupplierShell title="Supplier Offers & Catalog">
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 text-white shadow-sm">
          <div className="max-w-4xl">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">Supplier catalog feed</div>
            <h2 className="mt-3 text-3xl font-black">Submit offers against one canonical Odiscom product catalog.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Use the manufacturer part number as the product identity. Your supplier SKU, cost, stock, lead time, and terms remain attached to your offer and do not create duplicate public listings.</p>
          </div>
        </section>

        {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">{message}</div>}

        <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
          <form onSubmit={submitOffer} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-xl font-black text-slate-950">Submit / update an offer</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">Unknown products are created as drafts for Odiscom review. Nothing submitted here auto-publishes to the storefront.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input required value={form.manufacturer} onChange={(e)=>updateField('manufacturer',e.target.value)} placeholder="Manufacturer" className="rounded-xl border border-slate-300 p-3 text-sm"/>
              <input required value={form.manufacturer_part_number} onChange={(e)=>updateField('manufacturer_part_number',e.target.value)} placeholder="Manufacturer part number" className="rounded-xl border border-slate-300 p-3 text-sm"/>
            </div>
            <input value={form.supplier_sku} onChange={(e)=>updateField('supplier_sku',e.target.value)} placeholder="Your supplier SKU / item number" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>
            <input required value={form.product_name} onChange={(e)=>updateField('product_name',e.target.value)} placeholder="Product name" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>
            <input value={form.category} onChange={(e)=>updateField('category',e.target.value)} placeholder="Category" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>
            <textarea value={form.description} onChange={(e)=>updateField('description',e.target.value)} rows="3" placeholder="Description / important specifications" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>

            <div className="grid grid-cols-2 gap-3">
              <input type="number" step="0.0001" min="0" value={form.unit_cost} onChange={(e)=>updateField('unit_cost',e.target.value)} placeholder="Your unit cost" className="rounded-xl border border-slate-300 p-3 text-sm"/>
              <input type="number" step="0.01" min="0" value={form.available_quantity} onChange={(e)=>updateField('available_quantity',e.target.value)} placeholder="Available qty" className="rounded-xl border border-slate-300 p-3 text-sm"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={form.availability_status} onChange={(e)=>updateField('availability_status',e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm">
                <option value="unknown">Availability unknown</option>
                <option value="in_stock">In stock</option>
                <option value="limited">Limited stock</option>
                <option value="backorder">Backorder</option>
                <option value="made_to_order">Made to order</option>
                <option value="discontinued">Discontinued</option>
              </select>
              <input value={form.lead_time_text} onChange={(e)=>updateField('lead_time_text',e.target.value)} placeholder="Lead time" className="rounded-xl border border-slate-300 p-3 text-sm"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" step="0.01" min="0" value={form.minimum_order_quantity} onChange={(e)=>updateField('minimum_order_quantity',e.target.value)} placeholder="MOQ" className="rounded-xl border border-slate-300 p-3 text-sm"/>
              <input value={form.unit} onChange={(e)=>updateField('unit',e.target.value)} placeholder="Unit (each, reel, ft...)" className="rounded-xl border border-slate-300 p-3 text-sm"/>
            </div>
            <input value={form.freight_terms} onChange={(e)=>updateField('freight_terms',e.target.value)} placeholder="Freight / shipping terms" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>
            <input value={form.country_of_origin} onChange={(e)=>updateField('country_of_origin',e.target.value)} placeholder="Country of origin, if confirmed" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>

            <div className="grid grid-cols-2 gap-3">
              <select value={form.taa_compliant} onChange={(e)=>updateField('taa_compliant',e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm"><option value="">TAA not confirmed</option><option value="yes">TAA compliant</option><option value="no">Not TAA compliant</option></select>
              <select value={form.baba_compliant} onChange={(e)=>updateField('baba_compliant',e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm"><option value="">BABA not confirmed</option><option value="yes">BABA compliant</option><option value="no">Not BABA compliant</option></select>
            </div>
            <input value={form.spec_sheet_url} onChange={(e)=>updateField('spec_sheet_url',e.target.value)} placeholder="Manufacturer spec sheet URL" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>
            <input value={form.image_url} onChange={(e)=>updateField('image_url',e.target.value)} placeholder="Manufacturer product image URL" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>

            <button disabled={submitting || !supplier} className="w-full rounded-xl bg-blue-600 py-3 font-black text-white transition hover:bg-blue-700 disabled:opacity-50">{submitting?'Submitting...':'Submit offer for review'}</button>
          </form>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="font-black text-slate-950">{supplier?.name || 'Supplier offers'}</div>
              <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search manufacturer, MPN, supplier SKU..." className="mt-4 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"/>
            </div>
            {loading ? <div className="p-10 text-slate-600">Loading offers...</div> :
            filtered.length===0 ? <div className="p-10 text-center text-slate-500">No supplier offers found.</div> :
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-4 text-left">Product</th><th className="px-5 py-4 text-left">Supplier SKU</th><th className="px-5 py-4 text-right">Cost</th><th className="px-5 py-4 text-right">Qty</th><th className="px-5 py-4 text-left">Lead time</th><th className="px-5 py-4 text-left">Review</th></tr></thead>
                <tbody>{filtered.map((offer)=>{
                  const product=offer.products || {}
                  return <tr key={offer.id} className="border-t border-slate-200 align-top">
                    <td className="px-5 py-4"><div className="font-bold text-slate-950">{product.name || 'Draft product'}</div><div className="mt-1 text-xs text-slate-500">{product.manufacturer || '-'} · <span className="font-mono">{product.manufacturer_part_number || product.sku || '-'}</span></div><div className="mt-2"><Badge tone={product.status==='active'?'green':'amber'}>{product.status || 'draft'}</Badge></div></td>
                    <td className="px-5 py-4 font-mono text-xs">{offer.supplier_sku || '-'}</td>
                    <td className="px-5 py-4 text-right font-bold">{money(offer.unit_cost)}</td>
                    <td className="px-5 py-4 text-right">{offer.available_quantity ?? '—'}</td>
                    <td className="px-5 py-4">{offer.lead_time_text || 'Confirm at quote'}</td>
                    <td className="px-5 py-4"><Badge tone={offer.review_status==='approved'?'green':offer.review_status==='rejected'?'red':'amber'}>{offer.review_status || 'pending'}</Badge><div className="mt-2 text-xs text-slate-500">{offer.availability_status}</div></td>
                  </tr>
                })}</tbody>
              </table>
            </div>}
          </section>
        </div>
      </div>
    </SupplierShell>
  )
}
