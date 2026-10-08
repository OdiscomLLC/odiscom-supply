import { useEffect, useState } from 'react'
import SupplierShell from '../../components/SupplierShell'
import { supabase } from '../../lib/supabase'

const emptyProfile = {
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  website: '',
  product_categories: '',
  payment_terms: '',
  lead_time: '',
  notes: '',
}

export default function SupplierProfile() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(emptyProfile)
  const [supplierId, setSupplierId] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data: sessionData } = await supabase.auth.getSession()
    const sessionUser = sessionData.session?.user
    setUser(sessionUser || null)
    if (!sessionUser?.email) {
      setLoading(false)
      return
    }
    let { data, error } = await supabase.from('suppliers').select('*').eq('owner_user_id', sessionUser.id).maybeSingle()
    if (!data && !error) {
      const fallback = await supabase.from('suppliers').select('*').eq('email', sessionUser.email).maybeSingle()
      data = fallback.data
      error = fallback.error
    }
    if (error) setMessage(error.message)
    if (data) {
      setSupplierId(data.id)
      setProfile({ ...emptyProfile, ...data, email: sessionUser.email })
    } else {
      setProfile({ ...emptyProfile, email: sessionUser.email })
    }
    setLoading(false)
  }

  function updateField(field, value) {
    setProfile({ ...profile, [field]: value })
  }

  async function saveProfile(e) {
    e.preventDefault()
    setMessage('')
    if (!profile.name || !user?.email) return setMessage('Supplier name and signed-in email are required.')
    const editableProfile = {
      name: profile.name,
      contact_name: profile.contact_name || null,
      email: user.email,
      phone: profile.phone || null,
      website: profile.website || null,
      product_categories: profile.product_categories || null,
      payment_terms: profile.payment_terms || null,
      lead_time: profile.lead_time || null,
      notes: profile.notes || null,
      owner_user_id: user.id,
      updated_at: new Date().toISOString(),
    }
    if (supplierId) {
      const { error } = await supabase.from('suppliers').update(editableProfile).eq('id', supplierId)
      if (error) return setMessage(error.message)
      setMessage('Supplier profile updated.')
      return
    }
    const { data, error } = await supabase.from('suppliers').insert([editableProfile]).select().single()
    if (error) return setMessage(error.message)
    setSupplierId(data.id)
    setMessage('Supplier profile created.')
  }

  return (
    <SupplierShell title="Supplier Profile">
      {loading ? (
        <div className="rounded-3xl bg-white p-10 text-slate-600 shadow-sm">Loading profile...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <form onSubmit={saveProfile} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Supplier Company Record</div>
              <h2 className="text-2xl font-bold text-slate-950">Maintain your supplier profile</h2>
              <p className="mt-2 text-sm text-slate-600">This information helps Odiscom Supply assign quotes, validate product pricing, and coordinate sourcing.</p>
            </div>
            {message && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</div>}
            <input required value={profile.name || ''} onChange={(e) => updateField('name', e.target.value)} placeholder="Supplier company name" className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
            <div className="grid gap-4 md:grid-cols-2">
              <input value={profile.contact_name || ''} onChange={(e) => updateField('contact_name', e.target.value)} placeholder="Primary contact" className="rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
              <input value={profile.phone || ''} onChange={(e) => updateField('phone', e.target.value)} placeholder="Phone" className="rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
            </div>
            <input required type="email" value={user?.email || ''} readOnly placeholder="Supplier login email" className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-600" />
            <input value={profile.website || ''} onChange={(e) => updateField('website', e.target.value)} placeholder="Website" className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
            <input value={profile.product_categories || ''} onChange={(e) => updateField('product_categories', e.target.value)} placeholder="Product categories, comma separated" className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
            <div className="grid gap-4 md:grid-cols-2">
              <input value={profile.payment_terms || ''} onChange={(e) => updateField('payment_terms', e.target.value)} placeholder="Payment terms" className="rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
              <input value={profile.lead_time || ''} onChange={(e) => updateField('lead_time', e.target.value)} placeholder="Typical lead time" className="rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
            </div>
            <textarea value={profile.notes || ''} onChange={(e) => updateField('notes', e.target.value)} rows="7" placeholder="Account numbers, reps, pricing notes, territory restrictions, freight notes, product line strengths..." className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500" />
            <button className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">Save Supplier Profile</button>
          </form>
          <aside className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-white shadow-sm">
              <h3 className="text-xl font-bold">Portal access</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">Your login email should match the supplier email on this profile so products and pricing can be tied back to your company.</p>
              <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm">Signed in as:<br /><strong>{user?.email}</strong></div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-950">What to keep current</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                <li>Product categories you can supply</li>
                <li>Current rep and contact information</li>
                <li>Typical lead times and terms</li>
                <li>Any sourcing notes or limitations</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </SupplierShell>
  )
}
