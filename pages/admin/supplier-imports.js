import { useEffect, useMemo, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import { supabase } from '../../lib/supabase'

const sampleCsv = `manufacturer,manufacturer_part_number,supplier_sku,product_name,description,category,unit_cost,currency,available_quantity,availability_status,lead_time_text,unit
N-Tron,1005TX,1005TX,N-Tron 1005TX Industrial Ethernet Switch,Industrial Ethernet switch,Industrial Networking,0,USD,,unknown,Confirm at quote,each`

function Badge({ children, tone='blue' }) {
  const tones={blue:'bg-blue-50 text-blue-700',green:'bg-green-50 text-green-700',amber:'bg-amber-50 text-amber-700',red:'bg-red-50 text-red-700',slate:'bg-slate-100 text-slate-700'}
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tones[tone]||tones.blue}`}>{children}</span>
}

export default function SupplierCatalogImports() {
  const [suppliers,setSuppliers]=useState([])
  const [sources,setSources]=useState([])
  const [jobs,setJobs]=useState([])
  const [supplierId,setSupplierId]=useState('')
  const [sourceId,setSourceId]=useState('')
  const [csv,setCsv]=useState(sampleCsv)
  const [fileName,setFileName]=useState('')
  const [preview,setPreview]=useState(null)
  const [loading,setLoading]=useState(true)
  const [submitting,setSubmitting]=useState(false)
  const [message,setMessage]=useState('')

  useEffect(()=>{ load() },[])

  async function load() {
    const [supplierRes,sourceRes,jobRes]=await Promise.all([
      supabase.from('suppliers').select('id,name,onboarding_status,approval_status').order('name'),
      supabase.from('supplier_catalog_sources').select('*').order('created_at',{ascending:false}),
      supabase.from('supplier_import_jobs').select('*,suppliers(name)').order('created_at',{ascending:false}).limit(30),
    ])
    if (supplierRes.error || sourceRes.error || jobRes.error) setMessage('Supplier import data could not be loaded.')
    setSuppliers(supplierRes.data || [])
    setSources(sourceRes.data || [])
    setJobs(jobRes.data || [])
    setLoading(false)
  }

  const supplierSources=useMemo(()=>sources.filter((source)=>source.supplier_id===supplierId),[sources,supplierId])

  async function callImport(dryRun) {
    setSubmitting(true)
    setMessage('')
    const {data:sessionData}=await supabase.auth.getSession()
    const token=sessionData.session?.access_token
    if(!token){ setSubmitting(false); return setMessage('Admin session is required.') }
    const response=await fetch('/api/admin/supplier-catalog/import',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body:JSON.stringify({supplierId,sourceId:sourceId||null,csv,fileName:fileName||null,dryRun})
    })
    const data=await response.json()
    setSubmitting(false)
    if(!response.ok) return setMessage(data.message || 'Import failed.')
    if(dryRun){
      setPreview(data)
      setMessage('Preview complete. No catalog data was changed.')
    } else {
      setPreview(null)
      setMessage(`Import completed: ${data.summary?.updatedOfferCount || 0} supplier offers updated.`)
      load()
    }
  }

  async function addSource() {
    if(!supplierId) return setMessage('Choose a supplier first.')
    const name=window.prompt('Source name, e.g. Adams Cable CSV')
    if(!name) return
    const type=window.prompt('Source type: api, csv, sftp, edi, portal, or manual','csv')
    if(!type) return
    const {error}=await supabase.from('supplier_catalog_sources').insert([{supplier_id:supplierId,name,source_type:type,status:'active'}])
    if(error) return setMessage(error.message)
    setMessage('Catalog source added.')
    load()
  }

  const summary=preview?.summary || {}

  return (
    <AdminShell title="Supplier Catalog Imports">
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 text-white shadow-sm">
          <div className="max-w-4xl">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">Catalog ingestion engine</div>
            <h2 className="mt-3 text-3xl font-black">Normalize supplier feeds into one Odiscom product catalog.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Supplier rows become internal offers behind canonical manufacturer products. New matches are created as drafts and do not publish automatically.</p>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm text-slate-500">Suppliers</div><div className="mt-2 text-3xl font-black">{suppliers.length}</div></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm text-slate-500">Catalog sources</div><div className="mt-2 text-3xl font-black">{sources.length}</div></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm text-slate-500">Recent jobs</div><div className="mt-2 text-3xl font-black">{jobs.length}</div></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm text-slate-500">Auto-publish</div><div className="mt-2 text-xl font-black text-amber-700">Disabled</div></div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[460px_1fr]">
          <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-xl font-black text-slate-950">Import supplier feed</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">Start with CSV. The same import API also accepts normalized JSON rows for future supplier API connectors.</p>
            </div>

            {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">{message}</div>}

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Supplier</span>
              <select value={supplierId} onChange={(e)=>{setSupplierId(e.target.value);setSourceId('');setPreview(null)}} className="w-full rounded-xl border border-slate-300 bg-white p-3">
                <option value="">Choose supplier</option>
                {suppliers.map((supplier)=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Catalog source</span>
              <div className="flex gap-2">
                <select value={sourceId} onChange={(e)=>setSourceId(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white p-3">
                  <option value="">Unassigned / one-time import</option>
                  {supplierSources.map((source)=><option key={source.id} value={source.id}>{source.name} ({source.source_type})</option>)}
                </select>
                <button type="button" onClick={addSource} className="rounded-xl border border-slate-300 px-3 text-sm font-bold">+ Source</button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">File/reference name</span>
              <input value={fileName} onChange={(e)=>setFileName(e.target.value)} placeholder="supplier-catalog-2026-10-09.csv" className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">CSV data</span>
              <textarea value={csv} onChange={(e)=>{setCsv(e.target.value);setPreview(null)}} rows="16" className="w-full rounded-xl border border-slate-300 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-blue-500"/>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" disabled={!supplierId || !csv.trim() || submitting} onClick={()=>callImport(true)} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800 disabled:opacity-50">Preview import</button>
              <button type="button" disabled={!supplierId || !csv.trim() || submitting || !preview} onClick={()=>callImport(false)} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{submitting?'Working...':'Apply import'}</button>
            </div>
            <p className="text-xs leading-5 text-slate-500">Preview first. Applying the import never activates a newly created product automatically.</p>
          </section>

          <div className="space-y-6">
            {preview && (
              <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-6">
                  <h3 className="text-xl font-black">Import preview</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="green">Matched {summary.matched || 0}</Badge>
                    <Badge tone="blue">Create draft {summary.create_draft || 0}</Badge>
                    <Badge tone="red">Rejected {summary.rejected || 0}</Badge>
                    <Badge tone="slate">Rows {preview.totalRows || 0}</Badge>
                  </div>
                </div>
                <div className="max-h-[520px] overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-600"><tr><th className="p-3 text-left">Row</th><th className="p-3 text-left">Manufacturer / MPN</th><th className="p-3 text-left">Product</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right">Qty</th><th className="p-3 text-left">Result</th></tr></thead>
                    <tbody>{preview.rows?.map((row)=><tr key={row.row_number} className="border-t border-slate-200"><td className="p-3">{row.row_number}</td><td className="p-3"><div className="font-bold">{row.manufacturer || '-'}</div><div className="font-mono text-slate-500">{row.manufacturer_part_number || row.supplier_sku || '-'}</div></td><td className="p-3">{row.product_name || '-'}</td><td className="p-3 text-right">{row.unit_cost===null||row.unit_cost===undefined?'—':`$${Number(row.unit_cost).toFixed(2)}`}</td><td className="p-3 text-right">{row.available_quantity ?? '—'}</td><td className="p-3"><Badge tone={row.match_status==='matched'?'green':row.match_status==='create_draft'?'blue':'red'}>{row.match_status}</Badge>{row.validation_errors?.length>0&&<div className="mt-1 text-red-600">{row.validation_errors.join('; ')}</div>}</td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6"><h3 className="text-xl font-black">Recent import jobs</h3><p className="mt-1 text-sm text-slate-600">Audit trail for supplier feed processing.</p></div>
              {loading?<div className="p-8 text-slate-500">Loading import jobs...</div>:jobs.length===0?<div className="p-8 text-slate-500">No supplier imports yet.</div>:<div className="divide-y divide-slate-200">{jobs.map((job)=><div key={job.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-black text-slate-950">{job.suppliers?.name || 'Supplier import'}</div><div className="mt-1 text-xs text-slate-500">{job.file_name || job.source_reference || job.id}</div></div><Badge tone={job.status==='completed'?'green':job.status==='failed'?'red':'amber'}>{job.status}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Rows</div><div className="mt-1 font-black">{job.row_count}</div></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Offers</div><div className="mt-1 font-black">{job.updated_offer_count}</div></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Review</div><div className="mt-1 font-black">{job.review_count + job.rejected_count}</div></div></div></div>)}</div>}
            </section>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
