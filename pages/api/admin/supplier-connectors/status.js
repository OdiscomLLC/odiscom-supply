import { requireAdmin, createSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { digikeyConfigured } from '../../../../lib/suppliers/digikey'
import { mouserConfigured } from '../../../../lib/suppliers/mouser'

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({success:false,message:'Method not allowed'})
  if(!(await requireAdmin(req))) return res.status(401).json({success:false,message:'Admin authentication required'})

  const admin=createSupabaseAdmin()
  const {data:sources,error}=await admin
    .from('supplier_catalog_sources')
    .select('id,name,status,source_type,credential_reference,last_sync_at,last_success_at,last_error,suppliers(name)')
    .in('name',['DigiKey Product Information V4 API','Mouser Search API'])
  if(error) return res.status(500).json({success:false,message:error.message})

  const sourceMap=Object.fromEntries((sources||[]).map((source)=>[source.name,source]))
  return res.status(200).json({
    success:true,
    connectors:[
      {
        id:'digikey',
        label:'DigiKey',
        configured:digikeyConfigured(),
        credentials:['DIGIKEY_CLIENT_ID','DIGIKEY_CLIENT_SECRET','DIGIKEY_ACCOUNT_ID (optional for account pricing)'],
        source:sourceMap['DigiKey Product Information V4 API'] || null,
      },
      {
        id:'mouser',
        label:'Mouser',
        configured:mouserConfigured(),
        credentials:['MOUSER_API_KEY'],
        source:sourceMap['Mouser Search API'] || null,
      },
    ],
  })
}
