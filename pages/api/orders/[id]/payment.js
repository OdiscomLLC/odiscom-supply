import { requireOwnedOrder } from '../../../../lib/buyerAuth'

function cleanText(value, max=180) {
  return typeof value === 'string' ? value.trim().slice(0,max) : ''
}

async function createStripeCheckout(order, method) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe checkout is not configured.')
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/,'')
  if (!site) throw new Error('Site URL is not configured.')

  const cents = Math.round(Number(order.total || 0) * 100)
  if (!Number.isFinite(cents) || cents <= 0) throw new Error('Order total is not payable.')

  const body = new URLSearchParams()
  body.set('mode','payment')
  body.set('customer_email',order.email)
  body.set('client_reference_id',order.id)
  body.set('success_url',site + '/account/orders/' + order.id + '?checkout=success')
  body.set('cancel_url',site + '/account/orders/' + order.id + '?checkout=cancelled')
  body.set('metadata[order_id]',order.id)
  body.set('metadata[order_number]',order.order_number || '')
  body.set('line_items[0][quantity]','1')
  body.set('line_items[0][price_data][currency]','usd')
  body.set('line_items[0][price_data][unit_amount]',String(cents))
  body.set('line_items[0][price_data][product_data][name]','Odiscom Supply Order ' + (order.order_number || order.id))
  body.set('payment_method_types[0]',method === 'ach' ? 'us_bank_account' : 'card')

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions',{
    method:'POST',
    headers:{
      Authorization:'Bearer ' + process.env.STRIPE_SECRET_KEY,
      'Content-Type':'application/x-www-form-urlencoded'
    },
    body
  })
  const data = await response.json()
  if (!response.ok || !data?.id || !data?.url) throw new Error(data?.error?.message || 'Stripe checkout could not be created.')
  return data
}

export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({success:false,message:'Method not allowed'})
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({success:false,message:'Invalid order'})

  const { user, admin, order, error } = await requireOwnedOrder(req,id)
  if (error) return res.status(error === 'Authentication required' ? 401 : 404).json({success:false,message:error})
  if (order.status === 'cancelled') return res.status(409).json({success:false,message:'Cancelled orders cannot be checked out.'})

  const method = cleanText(req.body?.method,40)
  const allowed = new Set(['purchase_order','invoice','terms','card','ach'])
  if (!allowed.has(method)) return res.status(400).json({success:false,message:'Choose a valid payment method.'})

  const poNumber = cleanText(req.body?.po_number,100)
  const customerReference = cleanText(req.body?.customer_reference,120)
  const freightPreference = cleanText(req.body?.freight_preference,80)
  const deliveryLocation = cleanText(req.body?.delivery_location,240)

  if (method === 'purchase_order' && !poNumber) {
    return res.status(400).json({success:false,message:'Enter the purchase order number.'})
  }

  if (method === 'card' || method === 'ach') {
    try {
      const session = await createStripeCheckout(order,method)
      const { error: updateError } = await admin.from('orders').update({
        payment_method: method,
        payment_status: 'pending',
        po_number: poNumber || null,
        customer_reference: customerReference || null,
        freight_preference: freightPreference || null,
        delivery_location: deliveryLocation || null,
        stripe_checkout_session_id: session.id
      }).eq('id',order.id)
      if (updateError) throw updateError

      await admin.from('order_events').insert([{
        order_id:order.id,
        event_type:'payment_pending',
        title: method === 'ach' ? 'ACH checkout started' : 'Card checkout started',
        detail:'Secure payment checkout was opened for this order.',
        visibility:'customer',
        created_by:user.email
      }])

      return res.status(200).json({success:true,checkoutUrl:session.url})
    } catch (e) {
      return res.status(503).json({success:false,message:e.message || 'Payment checkout is unavailable.'})
    }
  }

  const nextStatus = 'pending'
  const eventType = method === 'purchase_order' ? 'po_submitted' : method === 'invoice' ? 'invoice_requested' : 'terms_requested'
  const title = method === 'purchase_order' ? 'Purchase order submitted' : method === 'invoice' ? 'Invoice requested' : 'Payment terms requested'
  const { error: updateError } = await admin.from('orders').update({
    payment_method: method,
    payment_status: nextStatus,
    po_number: poNumber || null,
    customer_reference: customerReference || null,
    freight_preference: freightPreference || null,
    delivery_location: deliveryLocation || null
  }).eq('id',order.id)
  if (updateError) return res.status(500).json({success:false,message:'Order checkout preferences could not be saved.'})

  await admin.from('order_events').insert([{
    order_id:order.id,
    event_type:eventType,
    title,
    detail: poNumber ? 'PO / reference: ' + poNumber : 'Odiscom Supply will review this request.',
    visibility:'customer',
    created_by:user.email
  }])

  return res.status(200).json({success:true,message:title})
}
