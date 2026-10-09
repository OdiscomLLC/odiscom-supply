import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mapSupplierRow,
  normalizeAvailability,
  normalizeCatalogKey,
  parseCsv,
  validateSupplierRow,
} from '../lib/supplierCatalog.js'

test('catalog keys normalize manufacturer and part-number punctuation consistently', () => {
  assert.equal(normalizeCatalogKey('HMS / N-Tron'), 'hmsntron')
  assert.equal(normalizeCatalogKey('1005-TX '), '1005tx')
  assert.equal(normalizeCatalogKey(''), null)
})

test('CSV parser handles quoted commas and escaped quotes', () => {
  const rows=parseCsv('manufacturer,mpn,name\n"N-Tron","1005TX","Switch, Industrial"\n"Acme","A-1","Widget ""Pro"""')
  assert.equal(rows.length,2)
  assert.equal(rows[0].name,'Switch, Industrial')
  assert.equal(rows[1].name,'Widget "Pro"')
})

test('supplier row mapping supports common alternate headers', () => {
  const row=mapSupplierRow({
    brand:'N-Tron',
    part_number:'1005TX',
    sku:'DIST-1005TX',
    title:'N-Tron 1005TX',
    price:'$245.50',
    stock:'18',
    lead_time:'3 days',
    taa:'yes',
    baba:'unknown',
  })
  assert.equal(row.manufacturer,'N-Tron')
  assert.equal(row.manufacturer_part_number,'1005TX')
  assert.equal(row.supplier_sku,'DIST-1005TX')
  assert.equal(row.unit_cost,245.5)
  assert.equal(row.available_quantity,18)
  assert.equal(row.taa_compliant,true)
  assert.equal(row.baba_compliant,null)
  assert.equal(row.manufacturer_key,'ntron')
  assert.equal(row.mpn_key,'1005tx')
})

test('row validation rejects missing identity and negative commercial values', () => {
  const row=mapSupplierRow({name:'Unknown item',cost:'-1',stock:'-2'})
  const errors=validateSupplierRow(row)
  assert.ok(errors.includes('manufacturer is required'))
  assert.ok(errors.includes('manufacturer part number or supplier SKU is required'))
  assert.ok(errors.includes('unit cost cannot be negative'))
  assert.ok(errors.includes('available quantity cannot be negative'))
})

test('availability values map to controlled offer statuses', () => {
  assert.equal(normalizeAvailability('Available'),'in_stock')
  assert.equal(normalizeAvailability('Low Stock'),'limited')
  assert.equal(normalizeAvailability('Out of Stock'),'backorder')
  assert.equal(normalizeAvailability('MTO'),'made_to_order')
  assert.equal(normalizeAvailability('Obsolete'),'discontinued')
  assert.equal(normalizeAvailability('Call'),'unknown')
})
