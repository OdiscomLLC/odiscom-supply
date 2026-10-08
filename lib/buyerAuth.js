import { createSupabaseAdmin } from './supabaseAdmin'

export async function requireBuyer(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return { user: null, error: 'Authentication required' }

  const admin = createSupabaseAdmin()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user?.email) return { user: null, error: 'Authentication required' }

  return { user, admin, error: null }
}

export async function requireOwnedOrder(req, orderId) {
  const auth = await requireBuyer(req)
  if (auth.error) return auth

  const { data: order, error } = await auth.admin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) return { ...auth, order: null, error: 'Order not found' }
  if (String(order.email || '').toLowerCase() !== String(auth.user.email || '').toLowerCase()) {
    return { ...auth, order: null, error: 'Order not found' }
  }

  return { ...auth, order }
}
