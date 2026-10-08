import { recordTotal } from '../../lib/pricing'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { supabase } from '../../lib/supabase'

function money(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Not priced'
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Account() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [quotes, setQuotes] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let mounted = true

    async function initialize() {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setUser(data.user || null)
      if (data.user?.email) await loadCustomerData(data.user.email)
      else setLoading(false)
    }

    initialize()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null
      setUser(nextUser)
      if (nextUser?.email) loadCustomerData(nextUser.email)
      else {
        setQuotes([])
        setOrders([])
        setLoaded(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function requestAccess(e) {
    e.preventDefault()
    setMessage('')
    if (!email) return
    setLoading(true)
    const redirectBase = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${redirectBase.replace(/\/$/, '')}/account` },
    })
    setLoading(false)
    if (error) return setMessage('We could not send the secure sign-in link. Please try again or contact sales@odiscom.com.')
    setMessage('Secure sign-in link sent. Open the email from this device to access your quotes and orders.')
  }

  async function loadCustomerData(customerEmail) {
    if (!customerEmail) return
    setLoading(true)
    setLoaded(false)
    setMessage('')

    const [{ data: quoteData, error: quoteError }, { data: orderData, error: orderError }] = await Promise.all([
      supabase.from('quotes').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
    ])

    if (quoteError || orderError) {
      setMessage('Your account activity could not be loaded.')
      setQuotes([])
      setOrders([])
      setLoading(false)
      return
    }

    setQuotes(quoteData || [])
    setOrders(orderData || [])
    setLoaded(true)
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setLoaded(false)
    setQuotes([])
    setOrders([])
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">Secure buyer account</div>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight md:text-5xl">Quotes, orders, and project activity tied to your verified email</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">Access is passwordless. We verify the email address before Supabase RLS allows any customer quote or order records to be returned.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-10">
          {!user ? (
            <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Buyer sign in</div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Send me a secure access link</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Use the same email address that appears on your Odiscom Supply quote request or order.</p>
              {message && <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
              <form onSubmit={requestAccess} className="mt-6 space-y-3">
                <label className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500" htmlFor="buyer-email">Business email</label>
                <input id="buyer-email" type="email" required disabled={loading} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@company.com" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60" />
                <button disabled={loading} className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60">{loading ? 'Sending secure link...' : 'Email secure sign-in link'}</button>
              </form>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><span className="font-black text-slate-800">Passwordless access.</span> Use the email tied to your quote or order. We send a one-time secure sign-in link, and no account data is exposed from an email lookup alone.</div>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Signed in as</div>
                  <div className="mt-1 font-bold text-slate-950">{user.email}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/account/company" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800">Company profile</Link>
                  <Link href="/account/documents" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800">Documents</Link>
                  <Link href="/project-cart" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800">Project cart</Link>
                  <button type="button" onClick={signOut} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Sign out</button>
                </div>
              </div>

              {message && <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}

              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">Quotes</div><div className="mt-1 text-3xl font-black text-slate-950">{loaded ? quotes.length : '—'}</div></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">Orders</div><div className="mt-1 text-3xl font-black text-slate-950">{loaded ? orders.length : '—'}</div></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">Order Value</div><div className="mt-1 text-3xl font-black text-slate-950">{loaded ? money(recordTotal(orders, 'total')) : '—'}</div></div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5"><h2 className="text-xl font-black text-slate-950">Quotes</h2><p className="mt-1 text-sm text-slate-600">Only records owned by your authenticated email are returned.</p></div>
                  <div className="divide-y divide-slate-200">
                    {loading && <div className="p-8 text-slate-500">Loading quotes...</div>}
                    {loaded && quotes.length === 0 && <div className="p-8 text-slate-500">No quotes found for this account.</div>}
                    {quotes.map((quote) => (
                      <div key={quote.id} className="p-6">
                        <div className="flex items-start justify-between gap-4"><div><div className="font-mono text-sm font-black text-blue-700">{quote.quote_id}</div><div className="mt-1 font-semibold text-slate-950">{quote.company}</div><div className="mt-2 text-xs text-slate-500">{quote.created_at ? new Date(quote.created_at).toLocaleString() : ''}</div></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{quote.status}</span></div>
                        <div className="mt-4 flex gap-3"><Link href={`/account/quotes/${quote.id}`} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">View Quote</Link><a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-900">PDF</a></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5"><h2 className="text-xl font-black text-slate-950">Orders</h2><p className="mt-1 text-sm text-slate-600">Accepted quotes and fulfillment progress.</p></div>
                  <div className="divide-y divide-slate-200">
                    {loading && <div className="p-8 text-slate-500">Loading orders...</div>}
                    {loaded && orders.length === 0 && <div className="p-8 text-slate-500">No orders found for this account.</div>}
                    {orders.map((order) => (
                      <div key={order.id} className="p-6">
                        <div className="flex items-start justify-between gap-4"><div><div className="font-mono text-sm font-black text-green-700">{order.order_number}</div><div className="mt-1 font-semibold text-slate-950">{order.company}</div><div className="mt-2 text-xs text-slate-500">{order.created_at ? new Date(order.created_at).toLocaleString() : ''}</div></div><div className="text-right"><div className="font-bold text-slate-950">{money(order.total)}</div><span className="mt-2 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{order.fulfillment_status || order.status}</span></div></div>
                        <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-500">Payment: {order.payment_status || 'unpaid'}</span><Link href={`/account/orders/${order.id}`} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">View order</Link></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}
