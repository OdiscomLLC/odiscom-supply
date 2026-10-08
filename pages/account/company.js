import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { supabase } from '../../lib/supabase'

const emptyProfile = {
  company:'', contact_name:'', email:'', phone:'', address_line1:'', address_line2:'',
  city:'', state:'', postal_code:'', country:'US', tax_status:'standard',
  payment_preference:'invoice-or-po', freight_preference:'quote-best-option', po_required:false
}

export default function BuyerCompanyProfile() {
  const [user,setUser]=useState(null)
  const [profile,setProfile]=useState(emptyProfile)
  const [customerId,setCustomerId]=useState(null)
  const [loading,setLoading]=useState(true)
  const [message,setMessage]=useState('')

  useEffect(()=>{ initialize() },[])

  async function initialize() {
    const { data } = await supabase.auth.getUser()
    const currentUser=data.user
    setUser(currentUser || null)
    if(!currentUser?.email){ setLoading(false); return }
    const { data: customer, error } = await supabase.from('customers').select('*').maybeSingle()
    if(error) setMessage('Buyer profile could not be loaded.')
    if(customer){
      setCustomerId(customer.id)
      setProfile({...emptyProfile,...customer,email:currentUser.email})
    } else {
      setProfile({...emptyProfile,email:currentUser.email})
    }
    setLoading(false)
  }

  function change(e) {
    const {name,value,type,checked}=e.target
    setProfile((p)=>({...p,[name]:type==='checkbox'?checked:value}))
  }

  async function save(e){
    e.preventDefault()
    setMessage('')
    if(!user?.email) return setMessage('Sign in from Buyer Account first.')
    const payload={
      company:profile.company || null,
      contact_name:profile.contact_name || null,
      email:user.email,
      phone:profile.phone || null,
      address_line1:profile.address_line1 || null,
      address_line2:profile.address_line2 || null,
      city:profile.city || null,
      state:profile.state || null,
      postal_code:profile.postal_code || null,
      country:profile.country || 'US',
      tax_status:profile.tax_status,
      payment_preference:profile.payment_preference,
      freight_preference:profile.freight_preference,
      po_required:Boolean(profile.po_required),
    }
    const query = customerId
      ? supabase.from('customers').update(payload).eq('id',customerId).select().single()
      : supabase.from('customers').insert([{...payload,account_status:'prospect',pricing_tier:'standard'}]).select().single()
    const {data,error}=await query
    if(error) return setMessage('Profile could not be saved: '+error.message)
    setCustomerId(data.id)
    setProfile({...emptyProfile,...data,email:user.email})
    setMessage('Buyer company profile saved.')
  }

  if(loading) return <><Header/><main className="min-h-screen bg-slate-50 p-10 text-slate-600">Loading buyer profile...</main><Footer/></>

  return (
    <>
      <Header/>
      <main className="min-h-screen bg-slate-50">
        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <Link href="/account" className="text-sm font-bold text-blue-300">← Buyer account</Link>
            <div className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-blue-300">Company profile</div>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Procurement preferences and company information</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">Save delivery, tax, PO, freight, and payment preferences so future quote requests can be prepared around your buying process.</p>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-6 py-10">
          {!user ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-900">Sign in through <Link href="/account" className="font-black underline">Buyer Account</Link> before editing a company profile.</div>
          ) : (
            <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</div>}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950">Company</h2>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <input name="company" value={profile.company||''} onChange={change} placeholder="Company name" className="rounded-xl border border-slate-300 p-3"/>
                    <input name="contact_name" value={profile.contact_name||''} onChange={change} placeholder="Primary contact" className="rounded-xl border border-slate-300 p-3"/>
                    <input value={user.email||''} readOnly className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-600"/>
                    <input name="phone" value={profile.phone||''} onChange={change} placeholder="Phone" className="rounded-xl border border-slate-300 p-3"/>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950">Delivery address</h2>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <input name="address_line1" value={profile.address_line1||''} onChange={change} placeholder="Address line 1" className="md:col-span-2 rounded-xl border border-slate-300 p-3"/>
                    <input name="address_line2" value={profile.address_line2||''} onChange={change} placeholder="Address line 2" className="md:col-span-2 rounded-xl border border-slate-300 p-3"/>
                    <input name="city" value={profile.city||''} onChange={change} placeholder="City" className="rounded-xl border border-slate-300 p-3"/>
                    <input name="state" value={profile.state||''} onChange={change} placeholder="State" className="rounded-xl border border-slate-300 p-3"/>
                    <input name="postal_code" value={profile.postal_code||''} onChange={change} placeholder="ZIP / postal code" className="rounded-xl border border-slate-300 p-3"/>
                    <input name="country" value={profile.country||'US'} onChange={change} placeholder="Country" className="rounded-xl border border-slate-300 p-3"/>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950">Procurement preferences</h2>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <select name="tax_status" value={profile.tax_status} onChange={change} className="rounded-xl border border-slate-300 p-3">
                      <option value="standard">Standard taxable purchase</option><option value="tax-exempt">Tax exempt</option><option value="resale">Resale</option><option value="government">Government / public entity</option>
                    </select>
                    <select name="payment_preference" value={profile.payment_preference} onChange={change} className="rounded-xl border border-slate-300 p-3">
                      <option value="invoice-or-po">Invoice / PO</option><option value="ach">ACH</option><option value="card">Card</option><option value="terms">Payment terms</option>
                    </select>
                    <select name="freight_preference" value={profile.freight_preference} onChange={change} className="rounded-xl border border-slate-300 p-3 md:col-span-2">
                      <option value="quote-best-option">Quote best freight option</option><option value="prepaid-add">Prepay and add</option><option value="customer-account">Use buyer freight account</option><option value="jobsite-delivery">Coordinate jobsite delivery</option><option value="pickup">Pickup when available</option>
                    </select>
                    <label className="md:col-span-2 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                      <input type="checkbox" name="po_required" checked={Boolean(profile.po_required)} onChange={change}/> Purchase order required for orders
                    </label>
                  </div>
                </div>
                <button className="rounded-xl bg-blue-600 px-6 py-3.5 font-black text-white hover:bg-blue-700">Save company profile</button>
              </div>
              <aside className="space-y-4">
                <div className="rounded-3xl bg-slate-950 p-6 text-white">
                  <div className="text-lg font-black">Buyer documents</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Store tax exemption, resale, PO, and credit documents in your private account vault.</p>
                  <Link href="/account/documents" className="mt-5 block rounded-xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950">Open document vault</Link>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="font-black text-slate-950">Protected fields</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Account status and pricing tier remain controlled by Odiscom Supply and cannot be changed from the buyer portal.</p>
                </div>
              </aside>
            </form>
          )}
        </section>
      </main>
      <Footer/>
    </>
  )
}
