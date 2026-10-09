import test from 'node:test'
import assert from 'node:assert/strict'
import { searchDigiKeyProduct } from '../lib/suppliers/digikey.js'
import { searchMouserProduct } from '../lib/suppliers/mouser.js'

test('DigiKey adapter requests OAuth then maps an exact manufacturer/MPN match', async () => {
  const previous={id:process.env.DIGIKEY_CLIENT_ID,secret:process.env.DIGIKEY_CLIENT_SECRET,account:process.env.DIGIKEY_ACCOUNT_ID}
  process.env.DIGIKEY_CLIENT_ID='client'
  process.env.DIGIKEY_CLIENT_SECRET='secret'
  process.env.DIGIKEY_ACCOUNT_ID='account'
  const calls=[]
  const fetchImpl=async (url,options={})=>{
    calls.push({url:String(url),options})
    if(String(url).includes('/oauth2/token')){
      return {ok:true,json:async()=>({access_token:'token'})}
    }
    return {ok:true,json:async()=>({
      ExactMatches:[{
        Manufacturer:{Name:'HMS Networks'},
        ManufacturerProductNumber:'1005TX',
        UnitPrice:245.5,
        ManufacturerPublicQuantity:7,
        ManufacturerLeadWeeks:'4',
        Description:{ProductDescription:'N-Tron 1005TX',DetailedDescription:'Industrial Ethernet switch'},
        Category:{Name:'Industrial Ethernet Switches'},
        DatasheetUrl:'https://example.com/spec.pdf',
        PhotoUrl:'https://example.com/image.jpg',
        ProductVariations:[{DigiKeyProductNumber:'1005TX-ND',MinimumOrderQuantity:1,StandardPricing:[{BreakQuantity:1,UnitPrice:245.5}]}],
      }]
    })}
  }
  try{
    const result=await searchDigiKeyProduct({manufacturer:'HMS Networks',mpn:'1005TX',fetchImpl})
    assert.equal(result.found,true)
    assert.equal(result.row.supplier_sku,'1005TX-ND')
    assert.equal(result.row.unit_cost,245.5)
    assert.equal(result.row.available_quantity,7)
    assert.equal(result.row.lead_time_days,28)
    assert.equal(calls.length,2)
    assert.match(calls[0].options.body.toString(),/grant_type=client_credentials/)
    assert.equal(calls[1].options.headers['X-DIGIKEY-Account-Id'],'account')
  } finally {
    if(previous.id===undefined) delete process.env.DIGIKEY_CLIENT_ID; else process.env.DIGIKEY_CLIENT_ID=previous.id
    if(previous.secret===undefined) delete process.env.DIGIKEY_CLIENT_SECRET; else process.env.DIGIKEY_CLIENT_SECRET=previous.secret
    if(previous.account===undefined) delete process.env.DIGIKEY_ACCOUNT_ID; else process.env.DIGIKEY_ACCOUNT_ID=previous.account
  }
})

test('Mouser adapter maps exact part search pricing and availability', async () => {
  const previous=process.env.MOUSER_API_KEY
  process.env.MOUSER_API_KEY='key'
  let requestBody=null
  const fetchImpl=async (_url,options={})=>{
    requestBody=JSON.parse(options.body)
    return {ok:true,json:async()=>({
      SearchResults:{Parts:[{
        Manufacturer:'HMS Networks',
        ManufacturerPartNumber:'1005TX',
        MouserPartNumber:'523-1005TX',
        Description:'N-Tron 1005TX Industrial Ethernet Switch',
        Category:'Industrial Ethernet Switches',
        Availability:'12 In Stock',
        LeadTime:'21',
        Min:'1',
        DataSheetUrl:'https://example.com/spec.pdf',
        ImagePath:'https://example.com/image.jpg',
        ProductDetailUrl:'https://example.com/product',
        PriceBreaks:[{Quantity:1,Price:'$250.00',Currency:'USD'},{Quantity:10,Price:'$230.00',Currency:'USD'}],
      }]}
    })}
  }
  try{
    const result=await searchMouserProduct({manufacturer:'HMS Networks',mpn:'1005TX',fetchImpl})
    assert.equal(result.found,true)
    assert.equal(result.row.supplier_sku,'523-1005TX')
    assert.equal(result.row.available_quantity,12)
    assert.equal(result.row.unit_cost,250)
    assert.equal(result.row.minimum_order_quantity,1)
    assert.equal(requestBody.SearchByPartRequest.mouserPartNumber,'1005TX')
  } finally {
    if(previous===undefined) delete process.env.MOUSER_API_KEY; else process.env.MOUSER_API_KEY=previous
  }
})
