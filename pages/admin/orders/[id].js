import { totalFor, lineTotal, margins, amount } from '../../../lib/pricing'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AdminShell from '../../../components/AdminShell'
import { supabase } from '../../../lib/supabase'

function money(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Not priced'
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Badge({ children, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-700',
  }
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] || tones.blue}`}>{children}</span>
}

function statusTone(status) {
  if (status === 'completed' || status === 'shipped') return 'green'
  if (status === 'on_hold') return 'red'
  if (status === 'new') return 'amber'
  return 'blue'
}

export default function OrderDetail() {
  const router = useRouter()
  const { id } = router.query
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [fulfillment, setFulfillment] = useState({ fulfillment_status:'pending', carrier:'', tracking_number:'', tracking_url:'', expected_delivery:'' })

  useEffect(() => { if (id) loadOrder() }, [id])

  async function loadOrder() {
    setLoading(true)
    setNotFound(false)

    if (id === '[order-id]' || id === 'order-id') {
      setNotFound(true)
      setLoading(false)
      return
    }

    const { data: orderData, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()

    if (error || !orderData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const { data: itemsData,error:itemsError } = await supabase.from('order_items').select('*').eq('order_id', id).order('created_at', { ascending: true })
    if(itemsError) {setOrder(orderData);setItems([]);setMessage('Order items could not be loaded. Margin is unavailable.');setLoading(false);return}
    setOrder(orderData)
    setFulfillment({ fulfillment_status:orderData.fulfillment_status || 'pending', carrier:orderData.carrier || '', tracking_number:orderData.tracking_number || '', tracking_url:orderData.tracking_url || '', expected_delivery:orderData.expected_delivery || '' })
    setItems(itemsData || [])
    setLoading(false)
  }

  async function updateStatus(newStatus) {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id)
    if (error) return setMessage(error.message)
    setOrder({ ...order, status: newStatus })
    setMessage('Order status updated.')
  }

  async function saveFulfillment(e) {
    e.preventDefault()
    setMessage('')
    const previousStatus = order.fulfillment_status || 'pending'
    const now = new Date().toISOString()
    const patch = {
      fulfillment_status: fulfillment.fulfillment_status,
      carrier: fulfillment.carrier || null,
      tracking_number: fulfillment.tracking_number || null,
      tracking_url: fulfillment.tracking_url || null,
      expected_delivery: fulfillment.expected_delivery || null,
      shipped_at: fulfillment.fulfillment_status === 'shipped' && !order.shipped_at ? now : order.shipped_at,
      delivered_at: fulfillment.fulfillment_status === 'delivered' && !order.delivered_at ? now : order.delivered_at,
    }

    const { error } = await supabase.from('orders').update(patch).eq('id', id)
    if (error) return setMessage(error.message)

    if (previousStatus !== fulfillment.fulfillment_status || fulfillment.tracking_number !== (order.tracking_number || '')) {
      const eventType = fulfillment.fulfillment_status === 'delivered'
        ? 'delivered'
        : fulfillment.fulfillment_status === 'shipped'
          ? 'shipped'
          : fulfillment.tracking_number !== (order.tracking_number || '')
            ? 'tracking_updated'
            : fulfillment.fulfillment_status === 'ready'
              ? 'ready'
              : 'sourcing'
      const title = eventType === 'delivered' ? 'Order delivered'
        : eventType === 'shipped' ? 'Order shipped'
        : eventType === 'tracking_updated' ? 'Tracking updated'
        : eventType === 'ready' ? 'Order ready'
        : 'Fulfillment updated'
      const detail = [
        fulfillment.carrier ? 'Carrier: ' + fulfillment.carrier : '',
        fulfillment.tracking_number ? 'Tracking: ' + fulfillment.tracking_number : '',
        fulfillment.expected_delivery ? 'Expected delivery: ' + fulfillment.expected_delivery : '',
      ].filter(Boolean).join(' • ') || 'Order fulfillment status changed to ' + fulfillment.fulfillment_status + '.'

      const { error: eventError } = await supabase.from('order_events').insert([{
        order_id:id,
        event_type:eventType,
        title,
        detail,
        visibility:'customer',
        created_by:'admin'
      }])
      if (eventError) return setMessage('Fulfillment saved, but the customer timeline event could not be recorded.')
    }

    setOrder({ ...order, ...patch })
    setMessage('Fulfillment and tracking updated.')
  }

  if (loading) return <AdminShell title="Order Detail"><div className="rounded-3xl bg-white p-10 text-slate-600 shadow-sm">Loading order...</div></AdminShell>

  if (notFound || !order) {
    return (
      <AdminShell title="Order Not Found">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-950">Order not found</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            This page needs a real order ID from the Orders table. The placeholder URL /admin/orders/[order-id] will not load an order.
          </p>
          <button onClick={() => router.push('/admin/orders')} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
            Go to Orders
          </button>
        </div>
      </AdminShell>
    )
  }

  const sellTotal = amount(order.total) ?? totalFor(items)
  const costTotal = totalFor(items,'unit_cost')
  const marginTotal = margins(sellTotal,costTotal).grossProfit
  const marginPercent = margins(sellTotal,costTotal).margin

  return (
    <AdminShell title={order.order_number}>
      <div className="space-y-6">
        {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</div>}

        <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 text-white shadow-sm">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <button onClick={() => router.push('/admin/orders')} className="mb-4 text-sm font-semibold text-blue-200">← Back to orders</button>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Fulfillment Workspace</div>
              <h2 className="text-3xl font-bold">{order.company}</h2>
              <p className="mt-2 text-slate-300">{order.contact_name} · {order.email} · {order.phone || 'No phone'}</p>
              <div className="mt-4"><Badge tone={statusTone(order.status)}>{order.status}</Badge></div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[620px]">
              <div className="rounded-2xl bg-white/10 p-4"><div className="text-xs text-slate-300">Order Total</div><div className="mt-1 text-xl font-bold">{money(sellTotal)}</div></div>
              <div className="rounded-2xl bg-white/10 p-4"><div className="text-xs text-slate-300">Estimated Cost</div><div className="mt-1 text-xl font-bold">{money(costTotal)}</div></div>
              <div className="rounded-2xl bg-white/10 p-4"><div className="text-xs text-slate-300">Gross Margin</div><div className="mt-1 text-xl font-bold text-green-300">{money(marginTotal)}</div></div>
              <div className="rounded-2xl bg-white/10 p-4"><div className="text-xs text-slate-300">Margin %</div><div className="mt-1 text-xl font-bold text-green-300">{marginPercent == null ? 'Not established' : marginPercent.toFixed(1) + '%'}</div></div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Customer & Order Details</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Company</div><div className="mt-2 font-semibold text-slate-950">{order.company}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contact</div><div className="mt-2 font-semibold text-slate-950">{order.contact_name}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Email</div><div className="mt-2 font-semibold text-slate-950">{order.email}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phone</div><div className="mt-2 font-semibold text-slate-950">{order.phone || '-'}</div></div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5"><h2 className="text-xl font-bold text-slate-950">Order Items</h2>{!items.length && <p role="alert">This order has no saved line items. Review its originating quote before fulfillment.</p>}<p className="mt-1 text-sm text-slate-600">Supplier, cost, sell, and margin detail for fulfillment.</p></div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600"><tr><th className="p-4 text-left">Product</th><th className="p-4 text-left">Supplier</th><th className="p-4 text-right">Qty</th><th className="p-4 text-right">Sell</th><th className="p-4 text-right">Cost</th><th className="p-4 text-right">Margin</th><th className="p-4 text-right">Line Total</th></tr></thead>
                  <tbody>
                    {items.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-500">No order items.</td></tr>}
                    {items.map((item) => {
                      const lineCost = item.cost_confirmed ? lineTotal(item,'unit_cost') : null
                      const itemSellTotal = lineTotal(item)
                      const lineMargin = margins(itemSellTotal,lineCost).grossProfit
                      return <tr key={item.id} className="border-t border-slate-200"><td className="p-4 font-semibold text-slate-950">{item.product_name}</td><td className="p-4">{item.supplier_name || '-'}</td><td className="p-4 text-right">{item.quantity}</td><td className="p-4 text-right">{money(item.unit_price)}</td><td className="p-4 text-right">{money(item.cost_confirmed ? item.unit_cost : null)}</td><td className="p-4 text-right font-bold text-green-700">{money(lineMargin)}</td><td className="p-4 text-right font-bold">{money(itemSellTotal)}</td></tr>
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">Fulfillment Status</h2>
                <p className="mt-2 text-sm text-slate-600">Update order progress as materials are sourced, received, shipped, or completed.</p>
                <select value={order.status} onChange={(e) => updateStatus(e.target.value)} className="mt-5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                  <option value="new">New</option>
                  <option value="processing">Processing</option>
                  <option value="ordered">Ordered from Vendor</option>
                  <option value="received">Received</option>
                  <option value="shipped">Shipped</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>

              <form onSubmit={saveFulfillment} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">Customer Fulfillment & Tracking</h2>
                <p className="mt-2 text-sm text-slate-600">Publish shipment milestones and tracking to the buyer order page.</p>
                <div className="mt-5 space-y-3">
                  <select value={fulfillment.fulfillment_status} onChange={(e)=>setFulfillment({...fulfillment,fulfillment_status:e.target.value})} className="w-full rounded-xl border border-slate-300 p-3 text-sm">
                    <option value="pending">Pending</option>
                    <option value="sourcing">Sourcing</option>
                    <option value="ready">Ready</option>
                    <option value="partially_shipped">Partially shipped</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="on_hold">On hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <input value={fulfillment.carrier} onChange={(e)=>setFulfillment({...fulfillment,carrier:e.target.value})} placeholder="Carrier" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>
                  <input value={fulfillment.tracking_number} onChange={(e)=>setFulfillment({...fulfillment,tracking_number:e.target.value})} placeholder="Tracking number" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>
                  <input value={fulfillment.tracking_url} onChange={(e)=>setFulfillment({...fulfillment,tracking_url:e.target.value})} placeholder="Tracking URL" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>
                  <input type="date" value={fulfillment.expected_delivery} onChange={(e)=>setFulfillment({...fulfillment,expected_delivery:e.target.value})} className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>
                </div>
                <button className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">Save & publish tracking</button>
              </form>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">Payment</h2>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-[0.15em] text-slate-500">Method</div><div className="mt-1 font-bold">{order.payment_method || 'unselected'}</div></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-[0.15em] text-slate-500">Status</div><div className="mt-1 font-bold">{order.payment_status || 'unpaid'}</div></div>
                  {order.po_number && <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-[0.15em] text-slate-500">PO</div><div className="mt-1 font-mono font-bold">{order.po_number}</div></div>}
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-white shadow-sm"><div className="text-lg font-bold">Margin Reminder</div><p className="mt-2 text-sm leading-6 text-slate-300">Keep supplier costs current so dashboard margin reporting remains accurate.</p></div>
            </div>
          </aside>
        </div>
      </div>
    </AdminShell>
  )
}
