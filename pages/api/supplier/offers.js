import { createSupabaseAdmin } from '../../../lib/supabaseAdmin'
import {
  normalizeAvailability,
  normalizeCatalogKey,
  normalizeText,
  parseBoolean,
  parseNumber,
  slugifyProduct,
} from '../../../lib/supplierCatalog'

async function getSupplierContext(req) {
  const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')
  if(!token) return { error:'Authentication required', status:401 }

  const admin=createSupabaseAdmin()
  const {data:{user},error:userError}=await admin.auth.getUser(token)
  if(userError || !user?.id || !user?.email) return { error:'Authentication required', status:401 }

  const {data:supplier,error:supplierError}=await admin
    .from('suppliers')
    .select('id,name,owner_user_id,email')
    .eq('owner_user_id',user.id)
    .maybeSingle()

  if(supplierError) return { error:supplierError.message, status:500 }
  if(!supplier) return { error:'Link your supplier profile to this signed-in account before submitting offers.', status:403 }

  return { admin,user,supplier }
}

function clean(value,max=500){
  const text=normalizeText(value)
  return text ? text.slice(0,max) : null
}

export default async function handler(req,res){
  const context=await getSupplierContext(req)
  if(context.error) return res.status(context.status).json({success:false,message:context.error})
  const {admin,user,supplier}=context

  if(req.method==='GET'){
    const {data,error}=await admin
      .from('supplier_offers')
      .select('*,products(id,name,sku,manufacturer,manufacturer_part_number,category,status,slug)')
      .eq('supplier_id',supplier.id)
      .order('updated_at',{ascending:false})

    if(error) return res.status(500).json({success:false,message:error.message})
    return res.status(200).json({success:true,supplier:{id:supplier.id,name:supplier.name},offers:data||[]})
  }

  if(req.method!=='POST') return res.status(405).json({success:false,message:'Method not allowed'})

  const manufacturer=clean(req.body?.manufacturer,180)
  const mpn=clean(req.body?.manufacturer_part_number,180)
  const productName=clean(req.body?.product_name,260)
  const supplierSku=clean(req.body?.supplier_sku,180)
  const manufacturerKey=normalizeCatalogKey(manufacturer)
  const mpnKey=normalizeCatalogKey(mpn)

  if(!manufacturerKey || !mpnKey || !productName){
    return res.status(400).json({success:false,message:'Manufacturer, manufacturer part number, and product name are required.'})
  }

  const unitCost=parseNumber(req.body?.unit_cost)
  const availableQuantity=parseNumber(req.body?.available_quantity)
  const minimumOrderQuantity=parseNumber(req.body?.minimum_order_quantity)
  if(unitCost!==null && unitCost<0) return res.status(400).json({success:false,message:'Unit cost cannot be negative.'})
  if(availableQuantity!==null && availableQuantity<0) return res.status(400).json({success:false,message:'Available quantity cannot be negative.'})
  if(minimumOrderQuantity!==null && minimumOrderQuantity<0) return res.status(400).json({success:false,message:'Minimum order quantity cannot be negative.'})

  let {data:product,error:productError}=await admin
    .from('products')
    .select('*')
    .eq('manufacturer_key',manufacturerKey)
    .eq('mpn_key',mpnKey)
    .maybeSingle()

  if(productError) return res.status(500).json({success:false,message:productError.message})

  let createdDraft=false
  if(!product){
    const {data:created,error:createError}=await admin.from('products').insert([{
      name:productName,
      sku:mpn,
      slug:slugifyProduct(manufacturer,mpn,productName),
      category:clean(req.body?.category,180),
      manufacturer,
      manufacturer_part_number:mpn,
      manufacturer_key:manufacturerKey,
      mpn_key:mpnKey,
      description:clean(req.body?.description,3000),
      unit:clean(req.body?.unit,40)||'each',
      image_url:clean(req.body?.image_url,1000),
      spec_sheet_url:clean(req.body?.spec_sheet_url,1000),
      country_of_origin:clean(req.body?.country_of_origin,120),
      taa_compliant:parseBoolean(req.body?.taa_compliant),
      baba_compliant:parseBoolean(req.body?.baba_compliant),
      status:'draft',
      catalog_origin:'supplier_portal',
      sourcing_status:'offer_available',
    }]).select().single()

    if(createError){
      if(String(createError.message||'').toLowerCase().includes('duplicate')){
        const retry=await admin.from('products').select('*').eq('manufacturer_key',manufacturerKey).eq('mpn_key',mpnKey).maybeSingle()
        product=retry.data
      }else{
        return res.status(500).json({success:false,message:createError.message})
      }
    }else{
      product=created
      createdDraft=true
    }
  }

  if(!product) return res.status(409).json({success:false,message:'Product match could not be resolved. Odiscom review is required.'})

  let {data:source}=await admin
    .from('supplier_catalog_sources')
    .select('id')
    .eq('supplier_id',supplier.id)
    .eq('source_type','portal')
    .maybeSingle()

  if(!source){
    const createdSource=await admin.from('supplier_catalog_sources').insert([{
      supplier_id:supplier.id,
      name:'Supplier portal',
      source_type:'portal',
      status:'active',
      sync_settings:{publishing:'draft_only',pricing_visibility:'internal'}
    }]).select('id').single()
    source=createdSource.data
  }

  const now=new Date().toISOString()
  const offerKey=supplierSku || 'default'
  const {data:offer,error:offerError}=await admin.from('supplier_offers').upsert([{
    supplier_id:supplier.id,
    product_id:product.id,
    source_id:source?.id||null,
    supplier_sku:supplierSku,
    offer_key:offerKey,
    channel_type:'distributor',
    unit_cost:unitCost,
    currency:clean(req.body?.currency,8)||'USD',
    available_quantity:availableQuantity,
    availability_status:normalizeAvailability(req.body?.availability_status),
    lead_time_days:parseNumber(req.body?.lead_time_days),
    lead_time_text:clean(req.body?.lead_time_text,180),
    minimum_order_quantity:minimumOrderQuantity,
    freight_terms:clean(req.body?.freight_terms,500),
    manufacturer_authorized:null,
    quote_required:unitCost===null,
    source_updated_at:now,
    last_seen_at:now,
    active:true,
    review_status:'pending',
    submitted_by_user_id:user.id,
    reviewed_at:null,
    review_notes:null,
    updated_at:now,
  }],{onConflict:'supplier_id,product_id,offer_key'}).select().single()

  if(offerError) return res.status(500).json({success:false,message:offerError.message})

  await admin.from('products').update({sourcing_status:'offer_available',updated_at:now}).eq('id',product.id)
  await admin.from('supplier_catalog_sources').update({last_sync_at:now,last_success_at:now,last_error:null,updated_at:now}).eq('id',source?.id)

  return res.status(200).json({
    success:true,
    createdDraft,
    message:createdDraft
      ? 'Offer submitted. A draft canonical product was created for Odiscom review.'
      : 'Offer submitted for Odiscom review.',
    product:{id:product.id,name:product.name,status:product.status},
    offer:{id:offer.id,review_status:offer.review_status},
  })
}
