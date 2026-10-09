import test from 'node:test'
import assert from 'node:assert/strict'
import { offerEligibility, rankSupplierOffers } from '../lib/supplierOfferRanking.js'

const now=new Date('2026-10-09T12:00:00Z')
const base={
  active:true,
  review_status:'approved',
  availability_status:'in_stock',
  channel_type:'distributor',
  manufacturer_authorized:null,
  source_updated_at:'2026-10-08T12:00:00Z',
  available_quantity:100,
  lead_time_days:5,
  unit_cost:100,
  quote_required:false,
}

test('unapproved, stale, discontinued, and insufficient offers are excluded',()=>{
  assert.equal(offerEligibility({...base,review_status:'pending'},{now}).eligible,false)
  assert.equal(offerEligibility({...base,source_updated_at:'2026-08-01T00:00:00Z'},{now,maxAgeDays:30}).reason,'stale')
  assert.equal(offerEligibility({...base,availability_status:'discontinued'},{now}).eligible,false)
  assert.equal(offerEligibility({...base,available_quantity:3},{now,requiredQuantity:10}).reason,'insufficient_confirmed_quantity')
})

test('direct and authorized fresh stock outranks generic distributor offer before cost tie-breaks',()=>{
  const ranked=rankSupplierOffers([
    {...base,id:'cheap',unit_cost:80,channel_type:'distributor'},
    {...base,id:'direct',unit_cost:100,channel_type:'manufacturer_direct',manufacturer_authorized:true},
  ],{now,requiredQuantity:10})
  assert.equal(ranked[0].offer.id,'direct')
})

test('cost breaks ties when source quality and availability are otherwise equal',()=>{
  const ranked=rankSupplierOffers([
    {...base,id:'high',unit_cost:120},
    {...base,id:'low',unit_cost:90},
  ],{now})
  assert.equal(ranked[0].offer.id,'low')
})
