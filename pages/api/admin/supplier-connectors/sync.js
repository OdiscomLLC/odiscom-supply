import { requireAdmin, createSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { normalizeCatalogKey, slugifyProduct } from '../../../../lib/supplierCatalog'
import { searchDigiKeyProduct } from '../../../../lib/suppliers/digikey'
import { searchMouserProduct } from '../../../../lib/suppliers/mouser'

const config={
  digikey:{
    supplierName:'DigiKey',
    sourceName:'DigiKey Product Information V4 API',
    search:searchDigiKeyProduct,
  },
  mouser:{
    supplierName:'Mouser Electronics',
    sourceName:'Mouser Search API',
    search:searchMouserProduct,
  },
}

function clean(value,max=240){
  return typeof value==='string' ? value.trim().slice(0,max) : ''
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({success:false,message:'Method not allowed'})
  if(!(await requireAdmin(req))) return res.status(401).json({success:false,message:'Admin authentication required'})

  const connector=clean(req.body?.connector,30)
  const manufacturer=clean(req.body?.manufacturer,180)
  const mpn=clean(req.body?.mpn,180)
  const requestedProductId=clean(req.body?.productId,80)
  const adapter=config[connector]
  if(!adapter) return res.status(400).json({success:false,message:'Unsupported supplier connector.'})
  if(!manufacturer || !mpn) return res.status(400).json({success:false,message:'Manufacturer and MPN are required.'})

  const admin=createSupabaseAdmin()
  const [{data:supplier,error:supplierError},{data:source,error:sourceError}]=await Promise.all([
    admin.from('suppliers').select('id,name').eq('name',adapter.supplierName).maybeSingle(),
    admin.from('supplier_catalog_sources').select('*').eq('name',adapter.sourceName).maybeSingle(),
  ])
  if(supplierError || !supplier) return res.status(409).json({success:false,message:`${adapter.supplierName} supplier record is missing.`})
  if(sourceError || !source) return res.status(409).json({success:false,message:`${adapter.sourceName} source record is missing.`})

  const startedAt=new Date().toISOString()
  try{
    const result=await adapter.search({manufacturer,mpn})
    if(!result.found){
      await admin.from('supplier_catalog_sources').update({
        last_sync_at:startedAt,
        last_error_at:startedAt,
        last_error:`No exact product match for ${manufacturer} ${mpn}`,
        updated_at:startedAt,
      }).eq('id',source.id)
      return res.status(404).json({success:false,message:'No exact manufacturer/MPN match returned by the supplier API.'})
    }

    const row=result.row
    const manufacturerKey=normalizeCatalogKey(row.manufacturer || manufacturer)
    const mpnKey=normalizeCatalogKey(row.manufacturer_part_number || mpn)
    let product=null

    if(requestedProductId){
      const lookup=await admin.from('products').select('*').eq('id',requestedProductId).maybeSingle()
      product=lookup.data
    }
    if(!product){
      const lookup=await admin.from('products').select('*').eq('manufacturer_key',manufacturerKey).eq('mpn_key',mpnKey).maybeSingle()
      product=lookup.data
    }

    let createdDraft=false
    if(!product){
      const created=await admin.from('products').insert([{
        name:row.product_name || `${row.manufacturer} ${row.manufacturer_part_number}`,
        sku:row.manufacturer_part_number,
        slug:slugifyProduct(row.manufacturer,row.manufacturer_part_number,row.product_name)+'-'+Date.now().toString(36),
        category:row.category,
        manufacturer:row.manufacturer,
        description:row.description,
        unit:row.unit || 'each',
        lead_time:row.lead_time_text,
        status:'draft',
        image_url:row.image_url,
        spec_sheet_url:row.spec_sheet_url,
        manufacturer_part_number:row.manufacturer_part_number,
        manufacturer_key:manufacturerKey,
        mpn_key:mpnKey,
        catalog_origin:'supplier_import',
        sourcing_status:'offer_available',
      }]).select().single()
      if(created.error) throw created.error
      product=created.data
      createdDraft=true
    }

    const now=new Date().toISOString()
    const {data:offer,error:offerError}=await admin.from('supplier_offers').upsert([{
      supplier_id:supplier.id,
      product_id:product.id,
      source_id:source.id,
      supplier_sku:row.supplier_sku,
      offer_key:row.supplier_sku || 'default',
      channel_type:row.channel_type || 'distributor',
      unit_cost:row.unit_cost,
      currency:row.currency || 'USD',
      available_quantity:row.available_quantity,
      availability_status:row.availability_status || 'unknown',
      lead_time_days:row.lead_time_days,
      lead_time_text:row.lead_time_text,
      minimum_order_quantity:row.minimum_order_quantity,
      price_breaks:row.price_breaks || [],
      manufacturer_authorized:row.manufacturer_authorized,
      quote_required:row.unit_cost===null || row.unit_cost===undefined,
      source_updated_at:now,
      last_seen_at:now,
      active:true,
      review_status:'approved',
      reviewed_at:now,
      review_notes:'Refreshed directly from supplier API by an Odiscom admin.',
      notes:`${adapter.label || adapter.supplierName} API refresh. Pricing may be standard/public pricing unless account-specific pricing is returned by the supplier API.`,
      updated_at:now,
    }],{onConflict:'supplier_id,product_id,offer_key'}).select().single()
    if(offerError) throw offerError

    await Promise.all([
      admin.from('products').update({
        sourcing_status:'offer_available',
        lead_time:row.lead_time_text || product.lead_time,
        image_url:product.image_url || row.image_url,
        spec_sheet_url:product.spec_sheet_url || row.spec_sheet_url,
        updated_at:now,
      }).eq('id',product.id),
      admin.from('supplier_catalog_sources').update({
        status:'active',
        last_sync_at:now,
        last_success_at:now,
        last_error:null,
        updated_at:now,
      }).eq('id',source.id),
    ])

    return res.status(200).json({
      success:true,
      createdDraft,
      connector,
      product:{id:product.id,name:product.name,status:product.status,manufacturer:product.manufacturer,mpn:product.manufacturer_part_number},
      offer:{id:offer.id,supplier:supplier.name,supplierSku:offer.supplier_sku,unitCost:offer.unit_cost,availableQuantity:offer.available_quantity,leadTime:offer.lead_time_text},
    })
  }catch(error){
    const failedAt=new Date().toISOString()
    const message=String(error?.message || error)
    await admin.from('supplier_catalog_sources').update({
      last_sync_at:failedAt,
      last_error_at:failedAt,
      last_error:message.slice(0,2000),
      updated_at:failedAt,
    }).eq('id',source.id)
    return res.status(503).json({success:false,message})
  }
}
