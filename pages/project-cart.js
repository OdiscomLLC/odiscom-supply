import { useState } from 'react'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { useProjectCart } from '../lib/projectCart'

export default function ProjectCartPage() {
  const { items, lineCount, totalUnits, updateItem, removeItem, clearCart, hydrated } = useProjectCart()
  const [confirmClear, setConfirmClear] = useState(false)

  const quoteHref = lineCount ? '/quote?cart=1' : '/quote'

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-6 py-14">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">Project cart</div>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Build the material package before you request pricing</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">This cart is a working project list, not a retail checkout. Add parts, adjust quantities, include line notes, then submit the package for project pricing.</p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10">
          {!hydrated ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]"><div className="space-y-4">{[1,2,3].map((n)=><div key={n} className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="h-3 w-28 rounded bg-slate-200"/><div className="mt-4 h-6 w-2/3 rounded bg-slate-200"/><div className="mt-8 h-10 w-full rounded bg-slate-100"/></div>)}</div><div className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="h-3 w-28 rounded bg-slate-200"/><div className="mt-5 grid grid-cols-2 gap-3"><div className="h-20 rounded-2xl bg-slate-100"/><div className="h-20 rounded-2xl bg-slate-100"/></div></div></div>
          ) : items.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm sm:p-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-xl font-black text-blue-700 ring-1 ring-blue-100">PL</div>
              <div className="mt-5 text-2xl font-black text-slate-950">Start a project material list</div>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">Add individual products when you are still building the package, or upload the full BOM when the material list is already defined. Quantities and line notes stay with the project until you request pricing.</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/shop" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700">Browse products</Link>
                <Link href="/material-upload" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-50">Upload BOM</Link>
              </div>
              <div className="mt-6 text-xs font-semibold text-slate-400">Project pricing • Approved alternates • Freight coordination • Human review</div>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
              <div className="space-y-4">
                {items.map((item) => (
                  <article key={item.key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">{item.category}</div>
                        <h2 className="mt-2 text-xl font-black text-slate-950">{item.name}</h2>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          {item.manufacturer && <span>{item.manufacturer}</span>}
                          {item.sku && <span className="font-mono">{item.sku}</span>}
                          <span>{item.unit}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeItem(item.key)} className="self-start text-sm font-bold text-red-600 hover:text-red-700">Remove</button>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr]">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Quantity</label>
                        <div className="mt-2 flex items-center gap-2">
                          <button type="button" onClick={() => updateItem(item.key, { quantity: Math.max(1, item.quantity - 1) })} className="h-10 w-10 rounded-xl border border-slate-300 font-bold">−</button>
                          <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.key, { quantity: Math.max(1, Number(e.target.value || 1)) })} className="h-10 w-20 rounded-xl border border-slate-300 px-3 text-center text-sm font-bold" />
                          <button type="button" onClick={() => updateItem(item.key, { quantity: item.quantity + 1 })} className="h-10 w-10 rounded-xl border border-slate-300 font-bold">+</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Line notes</label>
                        <input value={item.notes || ''} onChange={(e) => updateItem(item.key, { notes: e.target.value })} placeholder="Approved manufacturer, alternate restrictions, delivery note..." className="mt-2 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="space-y-4">
                <div className="sticky top-32 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Project summary</div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Line items</div><div className="mt-1 text-2xl font-black">{lineCount}</div></div>
                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Total units</div><div className="mt-1 text-2xl font-black">{totalUnits}</div></div>
                  </div>
                  <Link href={quoteHref} className="mt-5 block rounded-xl bg-blue-600 px-5 py-3.5 text-center text-sm font-black text-white hover:bg-blue-700">Request project pricing</Link>
                  <Link href="/compare" className="mt-3 block rounded-xl border border-blue-200 bg-blue-50 px-5 py-3.5 text-center text-sm font-bold text-blue-800">Compare project items</Link><Link href="/shop" className="mt-3 block rounded-xl border border-slate-300 px-5 py-3.5 text-center text-sm font-bold text-slate-900">Continue sourcing</Link>
                  <Link href="/material-upload" className="mt-3 block rounded-xl border border-slate-300 px-5 py-3.5 text-center text-sm font-bold text-slate-900">Upload BOM instead</Link>

                  {!confirmClear ? (
                    <button type="button" onClick={() => setConfirmClear(true)} className="mt-5 w-full text-sm font-bold text-slate-500 hover:text-red-600">Clear project cart</button>
                  ) : (
                    <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm">
                      <div className="font-bold text-red-800">Clear every line item?</div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => { clearCart(); setConfirmClear(false) }} className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white">Clear</button>
                        <button type="button" onClick={() => setConfirmClear(false)} className="rounded-lg border border-red-200 px-3 py-2 font-bold text-red-800">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}
