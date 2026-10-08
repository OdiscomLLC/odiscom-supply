import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { supabase } from '../../lib/supabase'

export default function BuyerDocuments() {
  const [user,setUser]=useState(null)
  const [docs,setDocs]=useState([])
  const [file,setFile]=useState(null)
  const [type,setType]=useState('tax_exemption')
  const [loading,setLoading]=useState(true)
  const [uploading,setUploading]=useState(false)
  const [message,setMessage]=useState('')

  useEffect(()=>{ initialize() },[])

  async function initialize() {
    const {data}=await supabase.auth.getUser()
    setUser(data.user || null)
    if(data.user) await loadDocs()
    else setLoading(false)
  }

  async function loadDocs() {
    const {data,error}=await supabase.from('customer_documents').select('*').order('created_at',{ascending:false})
    if(error) setMessage('Documents could not be loaded.')
    setDocs(data || [])
    setLoading(false)
  }

  async function upload(e) {
    e.preventDefault()
    if(!user || !file) return
    setUploading(true)
    setMessage('')
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-')
    const path=`${user.id}/${Date.now()}-${safeName}`
    const {error:storageError}=await supabase.storage.from('buyer-documents').upload(path,file,{upsert:false})
    if(storageError){ setUploading(false); return setMessage('Upload failed: '+storageError.message) }
    const {error:rowError}=await supabase.from('customer_documents').insert([{
      owner_user_id:user.id,
      customer_email:user.email,
      document_type:type,
      file_name:file.name,
      storage_path:path,
      status:'submitted'
    }])
    if(rowError){ setUploading(false); return setMessage('File uploaded but the document record could not be saved. Contact sales@odiscom.com.') }
    setFile(null)
    setUploading(false)
    setMessage('Document submitted securely for review.')
    loadDocs()
  }

  async function download(doc) {
    const {data,error}=await supabase.storage.from('buyer-documents').createSignedUrl(doc.storage_path,60)
    if(error || !data?.signedUrl) return setMessage('Could not open this document.')
    window.location.assign(data.signedUrl)
  }

  return (
    <>
      <Header/>
      <main className="min-h-screen bg-slate-50">
        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <Link href="/account" className="text-sm font-bold text-blue-300">← Buyer account</Link>
            <div className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-blue-300">Private document vault</div>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Procurement and tax documents</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">Documents are stored in a private bucket and are only readable by your authenticated account and authorized Odiscom administrators.</p>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-6 py-10">
          {!user ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8">Sign in through <Link href="/account" className="font-black underline">Buyer Account</Link> first.</div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
              <form onSubmit={upload} className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black">Upload document</h2>
                {message && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</div>}
                <select value={type} onChange={(e)=>setType(e.target.value)} className="mt-5 w-full rounded-xl border border-slate-300 p-3">
                  <option value="tax_exemption">Tax exemption certificate</option>
                  <option value="resale_certificate">Resale certificate</option>
                  <option value="purchase_order">Purchase order</option>
                  <option value="credit_application">Credit application</option>
                  <option value="other">Other procurement document</option>
                </select>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" onChange={(e)=>setFile(e.target.files?.[0] || null)} className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm"/>
                <p className="mt-3 text-xs leading-5 text-slate-500">PDF, PNG, JPG, or DOCX. Maximum 10 MB.</p>
                <button disabled={!file || uploading} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-50">{uploading?'Uploading securely...':'Submit document'}</button>
              </form>
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-6">
                  <h2 className="text-xl font-black">Submitted documents</h2>
                  <p className="mt-1 text-sm text-slate-600">Odiscom can review and update each document status.</p>
                </div>
                {loading ? <div className="p-8 text-slate-500">Loading documents...</div> :
                docs.length===0 ? <div className="p-8 text-slate-500">No documents submitted yet.</div> :
                <div className="divide-y divide-slate-200">
                  {docs.map((doc)=>(
                    <div key={doc.id} className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-bold text-slate-950">{doc.file_name}</div>
                        <div className="mt-1 text-xs text-slate-500">{doc.document_type.replaceAll('_',' ')} • {new Date(doc.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{doc.status}</span>
                        <button type="button" onClick={()=>download(doc)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-900">Open</button>
                      </div>
                    </div>
                  ))}
                </div>}
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer/>
    </>
  )
}
