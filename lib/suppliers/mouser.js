import { normalizeCatalogKey, normalizeText, parseNumber } from '../supplierCatalog.js'

const API_URL='https://api.mouser.com/api/v1/search/partnumber'

export function mouserConfigured() {
  return Boolean(process.env.MOUSER_API_KEY)
}

function exactPart(parts,manufacturer,mpn){
  const mk=normalizeCatalogKey(manufacturer)
  const pk=normalizeCatalogKey(mpn)
  return (parts || []).find((p)=>{
    const partKey=normalizeCatalogKey(p?.ManufacturerPartNumber)
    const manufacturerKey=normalizeCatalogKey(p?.Manufacturer)
    return partKey===pk && (!mk || manufacturerKey===mk)
  }) || null
}

function availabilityNumber(value){
  if(typeof value==='number') return value
  const match=String(value || '').replace(/,/g,'').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

export async function searchMouserProduct({manufacturer,mpn,fetchImpl=fetch}) {
  if(!mouserConfigured()) throw new Error('Mouser API key is not configured.')
  const url=`${API_URL}?apiKey=${encodeURIComponent(process.env.MOUSER_API_KEY)}`
  const response=await fetchImpl(url,{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({
      SearchByPartRequest:{
        mouserPartNumber:mpn,
        partSearchOptions:'None',
      }
    }),
  })
  const data=await response.json()
  if(!response.ok) throw new Error(data?.Errors?.[0]?.Message || data?.message || 'Mouser product search failed.')
  const part=exactPart(data?.SearchResults?.Parts,manufacturer,mpn)
  if(!part) return {found:false,raw:data}

  const qty=availabilityNumber(part.Availability)
  const breaks=(part.PriceBreaks || []).map((p)=>({
    BreakQuantity:parseNumber(p.Quantity),
    UnitPrice:parseNumber(p.Price),
    Currency:p.Currency || 'USD',
  })).filter((p)=>p.BreakQuantity !== null || p.UnitPrice !== null)
  const unitCost=breaks.find((p)=>p.UnitPrice !== null)?.UnitPrice ?? null

  return {
    found:true,
    raw:part,
    row:{
      manufacturer:normalizeText(part.Manufacturer) || manufacturer,
      manufacturer_part_number:normalizeText(part.ManufacturerPartNumber) || mpn,
      supplier_sku:normalizeText(part.MouserPartNumber),
      product_name:normalizeText(part.Description) || `${manufacturer} ${mpn}`,
      description:normalizeText(part.Description),
      category:normalizeText(part.Category),
      unit:'each',
      unit_cost:unitCost,
      currency:'USD',
      available_quantity:qty,
      availability_status:qty !== null && qty > 0 ? 'in_stock' : 'unknown',
      lead_time_days:parseNumber(part.LeadTime),
      lead_time_text:normalizeText(part.LeadTime),
      minimum_order_quantity:parseNumber(part.Min),
      price_breaks:breaks,
      image_url:normalizeText(part.ImagePath),
      spec_sheet_url:normalizeText(part.DataSheetUrl),
      country_of_origin:null,
      taa_compliant:null,
      baba_compliant:null,
      channel_type:'distributor',
      manufacturer_authorized:null,
      source_reference:normalizeText(part.ProductDetailUrl),
    }
  }
}
