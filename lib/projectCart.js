import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'odiscom_project_cart_v1'
const ProjectCartContext = createContext(null)

function normalizeItem(item) {
  return {
    key: item.key || [item.category || '', item.sku || '', item.name || item.product_name || ''].join('::'),
    name: item.name || item.product_name || 'Catalog item',
    sku: item.sku || '',
    category: item.category || 'Telecom Supply',
    manufacturer: item.manufacturer || '',
    unit: item.unit || 'each',
    quantity: Math.max(1, Number(item.quantity || 1) || 1),
    notes: item.notes || '',
    source: item.source || 'catalog',
  }
}

export function ProjectCartProvider({ children }) {
  const [items, setItems] = useState([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (Array.isArray(parsed)) setItems(parsed.map(normalizeItem))
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, hydrated])

  function addItem(item) {
    const next = normalizeItem(item)
    setItems((current) => {
      const index = current.findIndex((candidate) => candidate.key === next.key)
      if (index === -1) return [...current, next]
      return current.map((candidate, i) => i === index
        ? { ...candidate, quantity: candidate.quantity + next.quantity, notes: next.notes || candidate.notes }
        : candidate)
    })
  }

  function updateItem(key, fields) {
    setItems((current) => current.map((item) => item.key === key ? normalizeItem({ ...item, ...fields, key }) : item))
  }

  function removeItem(key) {
    setItems((current) => current.filter((item) => item.key !== key))
  }

  function clearCart() {
    setItems([])
  }

  const value = useMemo(() => ({
    items,
    hydrated,
    lineCount: items.length,
    totalUnits: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    addItem,
    updateItem,
    removeItem,
    clearCart,
  }), [items, hydrated])

  return <ProjectCartContext.Provider value={value}>{children}</ProjectCartContext.Provider>
}

export function useProjectCart() {
  const context = useContext(ProjectCartContext)
  if (!context) throw new Error('useProjectCart must be used inside ProjectCartProvider')
  return context
}
