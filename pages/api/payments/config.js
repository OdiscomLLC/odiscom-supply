export default function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).json({stripeEnabled:false})
  return res.status(200).json({
    stripeEnabled:Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
  })
}
