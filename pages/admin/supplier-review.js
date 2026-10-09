import { useEffect, useMemo, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import { supabase } from '../../lib/supabase'

function money(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Not priced'
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Badge({ children, tone='blue' }) {
  const tones={blue:'bg-blue-50 text-blue-700',green:'bg-green-50 text-green-700',amber:'bg-amber-50 text-amber-700',red:'bg-red-50 text-red-700',slate:'bg-slate-100 text-slate-700'}
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tones[tone]||tones.blue}`}>{children}</span>
}

export default function SupplierReview(){
  const [offers,setOffers]=useState([])
  const [suppliers,setSuppliers]=useState([])
  const [search,setSearch]=useState('')
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(true)

  useEffect(()=>{ loadData() },[])

  async function loadData(){
    const [offerRes,supplierRes]=await Promise.all([
      supabase.from('supplier_offers')
        .select('*,suppliers(id,name,approval_status),products(id,name,sku,manufacturer,manufacturer_part_number,category,status,slug,country_of_origin,taa_compliant,baba_compliant)')
        .order('updated_at',{ascending:false}),
      supabase.from('suppliers').select('*').order('created_at',{ascending:false}),
    ])
    if(offerRes.error || supplierRes.error) setMessage(offerRes.error?.message || supplierRes.error?.message)
    setOffers(offerRes.data || [])
    setSuppliers(supplierRes.data || [])
    setLoading(false)
  }

  async function reviewOffer(offer,status){
    const {error}=await supabase.from('supplier_offers').update({
      review_status:status,
      reviewed_at:new Date().toISOString(),
    }).eq('id',offer.id)
    if(error) return setMessage(error.message)
    setMessage(`Offer ${status}.`)
    loadData()
  }

  async function publishProduct(product){
    if(!product?.id) return
    const {error}=await supabase.from('products').update({status:'active'}).eq('id',product.id)
    if(error) return setMessage(error.message)
    setMessage(`${product.name} published to the catalog.`)
    loadData()
  }

  async function approveSupplier(supplier){
    const {error}=await supabase.from('suppliers').update({approval_status:'approved'}).eq('id',supplier.id)
    if(error) return setMessage(error.message)
    setMessage(`${supplier.name} approved.`)
    loadData()
  }

  const filtered=useMemo(()=>{
    const q=search.toLowerCase().trim()
    return offers.filter((offer)=>{
      const product=offer.products||{}
      const supplier=offer.suppliers||{}
      return !q || [
        product.name,product.sku,product.manufacturer,product.manufacturer_part_number,product.category,
        supplier.name,offer.supplier_sku,offer.availability_status,offer.lead_time_text
      ].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  },[offers,search])

  const pendingOffers=offers.filter((offer)=>offer.review_status==='pending')
  const pendingSuppliers=suppliers.filter((supplier)=>supplier.approval_status!=='approved')
  const draftProducts=new Set(offers.filter((offer)=>offer.products?.status==='draft').map((offer)=>offer.product_id)).size

  return (
    <AdminShell title="Supplier Review">
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 text-white shadow-sm">
          <div className="max-w-4xl">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">Supplier offer approval</div>
            <h2 className="mt-3 text-3xl font-black">Review supplier offers separately from the Odiscom product catalog.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Approve costs, stock, lead time, and supplier sourcing independently. Publish a draft canonical product only after its product data has also been reviewed.</p>
          </div>
        </section>

        {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">{message}</div>}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm text-slate-500">Pending offers</div><div className="mt-2 text-3xl font-black text-amber-700">{pendingOffers.length}</div></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm text-slate-500">Draft products</div><div className="mt-2 text-3xl font-black text-blue-700">{draftProducts}</div></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm text-slate-500">Pending suppliers</div><div className="mt-2 text-3xl font-black text-amber-700">{pendingSuppliers.length}</div></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm text-slate-500">Supplier directory</div><div className="mt-2 text-3xl font-black">{suppliers.length}</div></div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search product, manufacturer, MPN, supplier, supplier SKU..." className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"/>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="text-xl font-black text-slate-950">Supplier offers</h3>
              <p className="mt-1 text-sm text-slate-600">Offer approval does not automatically publish a draft product.</p>
            </div>
            {loading?<div className="p-10 text-slate-600">Loading review queue...</div>:(
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-4 text-left">Product</th><th className="px-5 py-4 text-left">Supplier</th><th className="px-5 py-4 text-right">Cost</th><th className="px-5 py-4 text-right">Qty</th><th className="px-5 py-4 text-left">Lead time</th><th className="px-5 py-4 text-left">Review</th><th className="px-5 py-4 text-right">Actions</th></tr></thead>
                  <tbody>
                    {filtered.length===0&&<tr><td colSpan="7" className="p-10 text-center text-slate-500">No supplier offers found.</td></tr>}
                    {filtered.map((offer)=>{
                      const product=offer.products||{}
                      const supplier=offer.suppliers||{}
                      return <tr key={offer.id} className="border-t border-slate-200 align-top hover:bg-slate-50">
                        <td className="px-5 py-4"><div className="font-bold text-slate-950">{product.name||'Unknown product'}</div><div className="mt-1 text-xs text-slate-500">{product.manufacturer||'-'} · <span className="font-mono">{product.manufacturer_part_number||product.sku||'-'}</span></div><div className="mt-2 flex flex-wrap gap-2"><Badge tone={product.status==='active'?'green':'amber'}>{product.status||'draft'}</Badge>{product.taa_compliant===true&&<Badge tone="green">TAA</Badge>}{product.baba_compliant===true&&<Badge tone="green">BABA</Badge>}</div></td>
                        <td className="px-5 py-4"><div className="font-semibold">{supplier.name||'-'}</div><div className="mt-1 font-mono text-xs text-slate-500">{offer.supplier_sku||'No supplier SKU'}</div></td>
                        <td className="px-5 py-4 text-right font-bold">{money(offer.unit_cost)}</td>
                        <td className="px-5 py-4 text-right">{offer.available_quantity??'—'}</td>
                        <td className="px-5 py-4">{offer.lead_time_text||'Confirm at quote'}<div className="mt-1 text-xs text-slate-500">{offer.availability_status}</div></td>
                        <td className="px-5 py-4"><Badge tone={offer.review_status==='approved'?'green':offer.review_status==='rejected'?'red':'amber'}>{offer.review_status||'pending'}</Badge></td>
                        <td className="px-5 py-4 text-right"><div className="flex min-w-32 flex-col gap-2">
                          {offer.review_status!=='approved'&&<button type="button" onClick={()=>reviewOffer(offer,'approved')} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white">Approve offer</button>}
                          {offer.review_status!=='rejected'&&<button type="button" onClick={()=>reviewOffer(offer,'rejected')} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Reject offer</button>}
                          {product.status==='draft'&&<button type="button" onClick={()=>publishProduct(product)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Publish product</button>}
                        </div></td>
                      </tr>
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5"><h3 className="text-xl font-black text-slate-950">Supplier profiles</h3><p className="mt-1 text-sm text-slate-600">Account approval remains separate from offer approval.</p></div>
            <div className="divide-y divide-slate-200">
              {suppliers.length===0&&<div className="p-8 text-slate-500">No suppliers found.</div>}
              {suppliers.map((supplier)=><div key={supplier.id} className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="font-bold text-slate-950">{supplier.name}</div><div className="mt-1 text-xs text-slate-500">{supplier.email||'No email'} · {supplier.phone||'No phone'}</div><div className="mt-2 text-xs leading-5 text-slate-500">{supplier.product_categories||'No categories listed'}</div></div><Badge tone={supplier.approval_status==='approved'?'green':'amber'}>{supplier.approval_status||'pending'}</Badge></div>{supplier.approval_status!=='approved'&&<button type="button" onClick={()=>approveSupplier(supplier)} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">Approve supplier</button>}</div>)}
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  )
}
