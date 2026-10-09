import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/opportunities', label: 'Hardware Bids' },
  { href: '/admin/quotes', label: 'Quotes' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/suppliers', label: 'Supplier Pipeline' },
  { href: '/admin/supplier-imports', label: 'Catalog Imports' },
  { href: '/admin/supplier-review', label: 'Supplier Review' },
  { href: '/admin/material-uploads', label: 'Material Uploads' },
]

export default function AdminShell({ title, children }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.replace('/admin/login')
        return
      }
      setUser(data.session.user)
      setChecking(false)
    }
    checkSession()
  }, [router])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  if (checking) return <main className="min-h-screen bg-gray-50 p-10 text-gray-600">Checking admin session...</main>

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-slate-950 text-white hidden md:flex md:flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="text-xl font-bold">Odiscom Supply</div>
          <div className="text-xs text-slate-400 mt-1">Admin Console</div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`block px-4 py-3 rounded-lg text-sm font-semibold ${router.pathname === item.href ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
          <div className="truncate mb-3">{user?.email}</div>
          <button onClick={signOut} className="w-full bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-4 py-2 font-semibold">Sign out</button>
        </div>
      </aside>
      <main className="flex-1">
        <header className="bg-white border-b px-6 py-5 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="text-sm text-gray-500">Source through Odiscom Supply and prepare hardware bids for Odiscom LLC.</p>
          </div>
          <Link href="/" className="text-sm font-semibold text-blue-600">View site</Link>
        </header>
        <section className="p-6">{children}</section>
      </main>
    </div>
  )
}
