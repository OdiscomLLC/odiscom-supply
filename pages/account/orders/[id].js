import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Header from '../../../components/Header'
import Footer from '../../../components/Footer'
import { supabase } from '../../../lib/supabase'

function money(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Not priced'
  return '$' + Number(value || 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
}

function badge(status) {
  const map={
    paid:'bg-emerald-50 text-emerald-700',
    pending:'bg-amber-50 text-amber-700',
    failed:'bg-red-50 text-red-700',
    shipped:'bg-blue-50 text-blue-700',
    delivered:'bg-emerald-50 text-emerald-700'
  }
  return map[status] || 'bg-slate-100 text-slate-700'
}

export default function BuyerOrderPage() {
  const router=useRouter()
  const {id}=router.query
  const [order,setOrder]=useState(null)
  const [items,setItems]=useState([])
  const [events,setEvents]=useState([])
  const [loading,setLoading]=useState(true)
  const [message,setMessage]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [stripeEnabled,setStripeEnabled]=useState(false)
  const [form,setForm]=useState({
    method:'purchase_order',
    po_number:'',
    customer_reference:'',
    freight_preference:'quote-best-option',
    delivery_location:''
  })

  useEffect(()=>{ if(id) load() },[id])
  useEffect(()=>{ fetch('/api/payments/config').then(r=>r.json()).then(data=>setStripeEnabled(Boolean(data.stripeEnabled))).catch(()=>setStripeEnabled(false)) },[])

  async function load() {
    setLoading(true)
    const {data:orderData,error}=await supabase.from('orders').select('*').eq('id',id).single()
    if(error || !orderData){ setMessage('Order not found.'); setLoading(false); return }
    const [{data:itemData},{data:eventData}]=await Promise.all([
      supabase.from('order_items').select('*').eq('order_id',id).order('created_at'),
      supabase.from('order_events').select('*').eq('order_id',id).order('created_at',{ascending:false})
    ])
    setOrder(orderData)
    setItems(itemData || [])
    setEvents(eventData || [])
    setForm((f)=>({
      ...f,
      method:orderData.payment_method && orderData.payment_method!=='unselected'?orderData.payment_method:f.method,
      po_number:orderData.po_number || '',
      customer_reference:orderData.customer_reference || '',
      freight_preference:orderData.freight_preference || 'quote-best-option',
      delivery_location:orderData.delivery_location || ''
    }))
    setLoading(false)
  }

  async function submitPayment(e) {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')
    const {data:sessionData}=await supabase.auth.getSession()
    const token=sessionData.session?.access_token
    if(!token){ setSubmitting(false); return setMessage('Sign in again before selecting payment.') }
    const response=await fetch('/api/orders/'+id+'/payment',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body:JSON.stringify(form)
    })
    const data=await response.json()
    setSubmitting(false)
    if(!response.ok) return setMessage(data.message || 'Checkout could not be updated.')
    if(data.checkoutUrl){ window.location.assign(data.checkoutUrl); return }
    setMessage(data.message || 'Checkout preference saved.')
    load()
  }

  const totalUnits=useMemo(()=>items.reduce((sum,item)=>sum+Number(item.quantity||0),0),[items])

  if(loading) return <><Header/><main className="min-h-screen bg-slate-50 p-10 text-slate-600">Loading order...</main><Footer/></>

  return (
    <>
      <Header/>
      <main className="min-h-screen bg-slate-50">
        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-6 py-14">
            <Link href="/account" className="text-sm font-bold text-blue-300">← Buyer account</Link>
            <div className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-blue-300">Order</div>
            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight md:text-5xl">{order?.order_number || 'Order'}</h1>
                <p className="mt-3 text-slate-300">{order?.company} • {order?.email}</p>
              </div>
              <div className="text-left md:text-right">
                <div className="text-sm text-slate-400">Order total</div>
                <div className="mt-1 text-3xl font-black">{money(order?.total)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 xl:grid-cols-[1fr_390px]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Payment</div><span className={'mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black '+badge(order?.payment_status)}>{order?.payment_status || 'unpaid'}</span></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Fulfillment</div><span className={'mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black '+badge(order?.fulfillment_status)}>{order?.fulfillment_status || 'pending'}</span></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Line items</div><div className="mt-2 text-2xl font-black">{items.length}</div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Units</div><div className="mt-2 text-2xl font-black">{totalUnits}</div></div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6"><h2 className="text-xl font-black">Order items</h2></div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600"><tr><th className="p-4 text-left">Product</th><th className="p-4 text-right">Qty</th><th className="p-4 text-right">Unit</th><th className="p-4 text-right">Total</th></tr></thead>
                  <tbody>{items.map((item)=><tr key={item.id} className="border-t border-slate-200"><td className="p-4 font-semibold text-slate-950">{item.product_name}</td><td className="p-4 text-right">{item.quantity}</td><td className="p-4 text-right">{money(item.unit_price)}</td><td className="p-4 text-right font-black">{money(item.total_price)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>

            {(order?.tracking_number || order?.carrier || order?.expected_delivery) && (
              <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Shipment</div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div><div className="text-xs text-slate-500">Carrier</div><div className="mt-1 font-black">{order.carrier || 'Pending'}</div></div>
                  <div><div className="text-xs text-slate-500">Tracking</div><div className="mt-1 font-mono font-bold">{order.tracking_number || 'Pending'}</div></div>
                  <div><div className="text-xs text-slate-500">Expected</div><div className="mt-1 font-black">{order.expected_delivery || 'Pending'}</div></div>
                </div>
                {order.tracking_url && <a href={order.tracking_url} target="_blank" rel="noreferrer" className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white">Track shipment</a>}
              </div>
            )}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">Order timeline</h2>
              <div className="mt-6 space-y-5">
                {events.length===0 && <div className="text-sm text-slate-500">No order events yet.</div>}
                {events.map((event)=>(
                  <div key={event.id} className="grid grid-cols-[14px_1fr] gap-4">
                    <div className="mt-1 h-3 w-3 rounded-full bg-blue-600"/>
                    <div><div className="font-black text-slate-950">{event.title}</div><div className="mt-1 text-sm text-slate-600">{event.detail || ''}</div><div className="mt-1 text-xs text-slate-400">{new Date(event.created_at).toLocaleString()}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside>
            <form onSubmit={submitPayment} className="sticky top-32 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Checkout</div>
              <h2 className="mt-2 text-2xl font-black">Choose how this order is paid</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">PO, invoice, and terms requests are reviewed by Odiscom. Card and ACH use secure Stripe-hosted checkout when configured. Until Stripe is connected, PO, invoice, and terms remain available.</p>
              {message && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</div>}
              <div className="mt-5 space-y-4">
                <select value={form.method} onChange={(e)=>setForm({...form,method:e.target.value})} className="w-full rounded-xl border border-slate-300 p-3">
                  <option value="purchase_order">Purchase order</option>
                  <option value="invoice">Request invoice</option>
                  <option value="terms">Request payment terms</option>
                  {stripeEnabled && <option value="card">Credit / debit card</option>}
                  {stripeEnabled && <option value="ach">ACH bank payment</option>}
                </select>
                <input value={form.po_number} onChange={(e)=>setForm({...form,po_number:e.target.value})} placeholder="PO number" className="w-full rounded-xl border border-slate-300 p-3"/>
                <input value={form.customer_reference} onChange={(e)=>setForm({...form,customer_reference:e.target.value})} placeholder="Project / requisition reference" className="w-full rounded-xl border border-slate-300 p-3"/>
                <select value={form.freight_preference} onChange={(e)=>setForm({...form,freight_preference:e.target.value})} className="w-full rounded-xl border border-slate-300 p-3">
                  <option value="quote-best-option">Best freight option</option><option value="prepaid-add">Prepay and add</option><option value="customer-account">Buyer freight account</option><option value="jobsite-delivery">Jobsite delivery</option><option value="pickup">Pickup</option>
                </select>
                <input value={form.delivery_location} onChange={(e)=>setForm({...form,delivery_location:e.target.value})} placeholder="Delivery location / jobsite" className="w-full rounded-xl border border-slate-300 p-3"/>
              </div>
              <button disabled={submitting || order?.payment_status==='paid'} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white disabled:opacity-50">{submitting?'Saving...':order?.payment_status==='paid'?'Payment confirmed':'Continue checkout'}</button>
              <Link href="/account/documents" className="mt-3 block rounded-xl border border-slate-300 px-5 py-3 text-center text-sm font-bold text-slate-900">Upload PO or tax document</Link>
            </form>
          </aside>
        </section>
      </main>
      <Footer/>
    </>
  )
}
