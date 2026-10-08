import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { useProjectCart } from '../lib/projectCart'
import { supabase } from '../lib/supabase'

export default function ComparePage(){
  const {items,hydrated}=useProjectCart()
  const [details,setDetails]=useState({})
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    if(!hydrated){return}
    async function load(){
      const skus=[...new Set(items.map(i=>i.sku).filter(Boolean))]
      if(!skus.length){setLoading(false);return}
      const {data}=await supabase.from('products').select('*').in('sku',skus).eq('status','active')
      const map={}
      for(const p of data||[]) map[p.sku]=p
      setDetails(map)
      setLoading(false)
    }
    load()
  },[hydrated,items])

  const rows=useMemo(()=>[
    ['Manufacturer',(i,p)=>p?.manufacturer || i.manufacturer || 'Open sourcing'],
    ['Part / SKU',(i,p)=>p?.manufacturer_part_number || p?.sku || i.sku || 'Request item'],
    ['Category',(i,p)=>p?.category || i.category || '-'],
    ['Unit',(i,p)=>p?.unit || i.unit || 'each'],
    ['Lead time',(i,p)=>p?.lead_time || 'Confirmed at quote'],
    ['Country of origin',(i,p)=>p?.country_of_origin || 'Confirmed at quote'],
    ['TAA',(i,p)=>p?.taa_compliant===true?'Compliant':p?.taa_compliant===false?'Not confirmed compliant':'Not confirmed'],
    ['BABA',(i,p)=>p?.baba_compliant===true?'Compliant':p?.baba_compliant===false?'Not confirmed compliant':'Not confirmed'],
    ['Quantity',(i)=>i.quantity],
    ['Line notes',(i)=>i.notes || '-'],
  ],[])

  return (
    <>
      <Header/>
      <main className="min-h-screen bg-slate-50">
        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-6 py-14">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">Project comparison</div>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Compare the products in your project package side by side</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">Use confirmed catalog data where available. Unconfirmed compliance, origin, availability, and lead time remain explicitly marked for quote review.</p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-6 py-10">
          {!hydrated || loading ? <div className="rounded-3xl bg-white p-10 text-slate-600 shadow-sm">Loading comparison...</div> :
          items.length===0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-sm font-black text-blue-700">CMP</div><div className="mt-4 text-xl font-black text-slate-950">Add project items before comparing</div><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Comparison uses the products already in your project cart so quantities, manufacturer preferences, compliance fields, and specifications stay tied to the same sourcing package.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/shop" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white">Browse catalog</Link><Link href="/project-cart" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-900">Open project cart</Link></div></div> :
          <>
            <div className="mb-6 flex flex-wrap gap-3">
              <Link href="/project-cart" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900">Back to project cart</Link>
              <Link href="/quote?cart=1" className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white">Request pricing</Link>
            </div>
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-[900px] w-full text-sm">
                <thead>
                  <tr className="bg-slate-950 text-white">
                    <th className="w-48 p-4 text-left">Attribute</th>
                    {items.map((item)=><th key={item.key} className="min-w-64 p-4 text-left"><div className="text-xs uppercase tracking-[0.14em] text-blue-200">{item.category}</div><div className="mt-2 text-base font-black">{item.name}</div></th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label,getValue])=>(
                    <tr key={label} className="border-t border-slate-200">
                      <th className="bg-slate-50 p-4 text-left font-black text-slate-700">{label}</th>
                      {items.map((item)=><td key={item.key} className="p-4 align-top font-medium text-slate-800">{String(getValue(item,details[item.sku]) ?? '-')}</td>)}
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200">
                    <th className="bg-slate-50 p-4 text-left font-black text-slate-700">Structured specs</th>
                    {items.map((item)=>{
                      const specs=details[item.sku]?.specifications || {}
                      return <td key={item.key} className="p-4 align-top">{Object.keys(specs).length ? <div className="space-y-2">{Object.entries(specs).map(([k,v])=><div key={k}><span className="font-bold">{k.replaceAll('_',' ')}:</span> {String(v)}</div>)}</div> : <span className="text-slate-400">Not yet structured</span>}</td>
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </>}
        </section>
      </main>
      <Footer/>
    </>
  )
}
