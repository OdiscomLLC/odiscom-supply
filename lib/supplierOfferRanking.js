function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const n=Number(value)
  return Number.isFinite(n) ? n : null
}

export function offerAgeDays(offer, now = new Date()) {
  const stamp=offer?.source_updated_at || offer?.last_seen_at || offer?.updated_at
  if(!stamp) return Infinity
  const time=new Date(stamp).getTime()
  if(!Number.isFinite(time)) return Infinity
  return Math.max(0,(now.getTime()-time)/86400000)
}

export function offerEligibility(offer,{requiredQuantity=1,maxAgeDays=30}={}) {
  if(!offer?.active) return {eligible:false,reason:'inactive'}
  if(offer.review_status!=='approved') return {eligible:false,reason:'not_approved'}
  if(offer.availability_status==='discontinued') return {eligible:false,reason:'discontinued'}

  const age=offerAgeDays(offer)
  if(age>maxAgeDays) return {eligible:false,reason:'stale'}

  const available=numberOrNull(offer.available_quantity)
  if(available!==null && available<Number(requiredQuantity||1)) {
    return {eligible:false,reason:'insufficient_confirmed_quantity'}
  }

  return {eligible:true,reason:'eligible'}
}

function channelScore(channel){
  return {
    manufacturer_direct:50,
    authorized_distributor:40,
    distributor:25,
    reseller:15,
    marketplace:0,
  }[channel] ?? 10
}

function availabilityScore(status){
  return {
    in_stock:40,
    limited:25,
    made_to_order:15,
    backorder:5,
    unknown:0,
    discontinued:-100,
  }[status] ?? 0
}

export function scoreSupplierOffer(offer,options={}){
  const eligibility=offerEligibility(offer,options)
  if(!eligibility.eligible) return {score:-Infinity,eligibility}

  const age=offerAgeDays(offer,options.now || new Date())
  const lead=numberOrNull(offer.lead_time_days)
  const cost=numberOrNull(offer.unit_cost)

  let score=100
  score+=channelScore(offer.channel_type)
  score+=availabilityScore(offer.availability_status)
  if(offer.manufacturer_authorized===true) score+=20
  if(offer.manufacturer_authorized===false) score-=5
  score+=Math.max(0,20-Math.min(20,age))
  if(lead!==null) score+=Math.max(0,20-Math.min(20,lead/2))
  if(cost!==null) score+=Math.max(0,10-Math.min(10,cost/1000))
  if(offer.quote_required) score-=10

  return {score,eligibility,ageDays:age,unitCost:cost,leadTimeDays:lead}
}

export function rankSupplierOffers(offers,options={}){
  return (offers || [])
    .map((offer)=>({offer,...scoreSupplierOffer(offer,options)}))
    .filter((entry)=>entry.eligibility.eligible)
    .sort((a,b)=>{
      if(b.score!==a.score) return b.score-a.score
      const aCost=a.unitCost===null?Infinity:a.unitCost
      const bCost=b.unitCost===null?Infinity:b.unitCost
      if(aCost!==bCost) return aCost-bCost
      const aLead=a.leadTimeDays===null?Infinity:a.leadTimeDays
      const bLead=b.leadTimeDays===null?Infinity:b.leadTimeDays
      return aLead-bLead
    })
}
