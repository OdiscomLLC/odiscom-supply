import crypto from 'crypto'
import { createSupabaseAdmin } from '../../../lib/supabaseAdmin'

export const config = { api: { bodyParser: false } }

async function readRawBody(req) {
  const chunks=[]
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function verifyStripeSignature(rawBody, header, secret) {
  if (!header || !secret) return false
  const parts=Object.fromEntries(header.split(',').map((part)=>part.split('=')))
  const timestamp=parts.t
  const signature=parts.v1
  if (!timestamp || !signature) return false
  const age=Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))
  if (!Number.isFinite(age) || age>300) return false
  const expected=crypto.createHmac('sha256',secret).update(timestamp+'.'+rawBody.toString('utf8')).digest('hex')
  const a=Buffer.from(expected,'hex')
  const b=Buffer.from(signature,'hex')
  return a.length===b.length && crypto.timingSafeEqual(a,b)
}

async function updateOrderForEvent(admin,event) {
  const session=event.data?.object
  const orderId=session?.metadata?.order_id || session?.client_reference_id
  if (!orderId) return null

  const { data: existing } = await admin.from('stripe_webhook_events').select('event_id').eq('event_id',event.id).maybeSingle()
  if (existing) return orderId

  let patch=null
  let eventRow=null

  if (event.type === 'checkout.session.completed') {
    patch={
      stripe_checkout_session_id:session.id || null,
      stripe_payment_intent_id:typeof session.payment_intent==='string'?session.payment_intent:null,
      payment_status:session.payment_status==='paid'?'paid':'pending'
    }
    eventRow={
      event_type:session.payment_status==='paid'?'payment_received':'payment_pending',
      title:session.payment_status==='paid'?'Payment received':'Payment submitted',
      detail:session.payment_status==='paid'?'Stripe confirmed payment for this order.':'Stripe checkout completed; payment confirmation is pending.'
    }
  } else if (event.type === 'checkout.session.async_payment_succeeded') {
    patch={payment_status:'paid',stripe_checkout_session_id:session.id || null}
    eventRow={event_type:'payment_received',title:'ACH payment received',detail:'Stripe confirmed the bank payment for this order.'}
  } else if (event.type === 'checkout.session.async_payment_failed') {
    patch={payment_status:'failed',stripe_checkout_session_id:session.id || null}
    eventRow={event_type:'payment_failed',title:'Payment failed',detail:'Stripe reported that the bank payment did not complete.'}
  } else if (event.type === 'checkout.session.expired') {
    patch={payment_status:'unpaid'}
    eventRow={event_type:'payment_failed',title:'Checkout expired',detail:'The secure Stripe checkout session expired before payment was confirmed.'}
  } else {
    return null
  }

  const { error:updateError } = await admin.from('orders').update(patch).eq('id',orderId)
  if (updateError) throw updateError

  const { error:eventError } = await admin.from('order_events').insert([{
    order_id:orderId,
    event_type:eventRow.event_type,
    title:eventRow.title,
    detail:eventRow.detail,
    visibility:'customer',
    created_by:'stripe'
  }])
  if (eventError) throw eventError

  const { error:logError } = await admin.from('stripe_webhook_events').insert([{
    event_id:event.id,
    event_type:event.type,
    order_id:orderId
  }])
  if (logError && !String(logError.message || '').toLowerCase().includes('duplicate')) throw logError

  return orderId
}

export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).end()
  const raw=await readRawBody(req)
  const signature=req.headers['stripe-signature']
  if (!verifyStripeSignature(raw,signature,process.env.STRIPE_WEBHOOK_SECRET)) {
    return res.status(400).json({received:false,message:'Invalid signature'})
  }

  let event
  try { event=JSON.parse(raw.toString('utf8')) }
  catch { return res.status(400).json({received:false,message:'Invalid payload'}) }

  try {
    const admin=createSupabaseAdmin()
    await updateOrderForEvent(admin,event)
    return res.status(200).json({received:true})
  } catch {
    return res.status(500).json({received:false})
  }
}
