// Read-only REST/Storage probes against a configured Supabase test project.
// Requires pre-existing dedicated tenants and short-lived USER access tokens.
// This script never uses the service-role key and never writes tenant records.
import assert from 'node:assert/strict'

const required = name => {
  const value=process.env[name]
  if (!value) throw new Error(`Missing ${name}; see docs/security/TENANT_ISOLATION_AUDIT.md`)
  return value
}
const base=new URL(required('NEXT_PUBLIC_SUPABASE_URL'))
const anon=required('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const actors = ['A','B'].map(label=>({
  label,token:required(`AUDIT_TENANT_${label}_JWT`),
  business:required(`AUDIT_TENANT_${label}_BUSINESS_ID`),
  order:required(`AUDIT_TENANT_${label}_ORDER_ID`),
  customer:required(`AUDIT_TENANT_${label}_CUSTOMER_ID`),
  privatePath:required(`AUDIT_TENANT_${label}_PRIVATE_FILE_PATH`),
}))
assert.notEqual(actors[0].business,actors[1].business)
async function call(actor,path,body) {
  const response=await fetch(new URL(path,base),{
    method:body===undefined?'GET':'POST',redirect:'error',
    headers:{apikey:anon,Authorization:`Bearer ${actor.token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),
  })
  const text=await response.text()
  let payload
  try {payload=JSON.parse(text)} catch {payload=null}
  // Never print payloads: they may contain tenant records or signed download URLs.
  assert.notEqual(response.status,401,'User token expired/invalid; this is not an isolation pass')
  return {response,payload}
}
async function readRows(actor,table,filters) {
  return call(actor,`/rest/v1/${table}?${new URLSearchParams({select:'id',...filters})}`)
}
for (const [actor,other] of [[actors[0],actors[1]],[actors[1],actors[0]]]) {
  for (const [table,key] of [['orders','order'],['customers','customer']]) {
    const own=await readRows(actor,table,{id:`eq.${actor[key]}`})
    assert.equal(own.response.status,200,`${actor.label}: own ${table} positive control`)
    assert.equal(own.payload?.length,1,`${actor.label}: missing own ${table} fixture`)
    // Guessed ID alone and foreign business filters must both be denied.
    for (const filters of [{id:`eq.${other[key]}`},{business_id:`eq.${other.business}`}]) {
      const result=await readRows(actor,table,filters)
      assert.equal(result.response.status,200,`${actor.label}: ${table} request failed unexpectedly`)
      assert.deepEqual(result.payload,[],`${actor.label}: cross-tenant ${table} exposure`)
    }
  }
  for (const table of ['business_payment_accounts','storefront_payments']) {
    const result=await call(actor,`/rest/v1/${table}?${new URLSearchParams({select:'business_id',business_id:`eq.${other.business}`})}`)
    assert.ok(result.response.status===403 || (result.response.ok && Array.isArray(result.payload) && result.payload.length===0),`${actor.label}: payment data exposure`)
  }
  const signedPath=path=>`/storage/v1/object/sign/expense-attachments/${path.split('/').map(encodeURIComponent).join('/')}`
  const ownFile=await call(actor,signedPath(actor.privatePath),{expiresIn:30})
  assert.ok(ownFile.response.ok,`${actor.label}: own private file positive control failed`)
  const foreignFile=await call(actor,signedPath(other.privatePath),{expiresIn:30})
  assert.ok([400,403,404].includes(foreignFile.response.status),`${actor.label}: can sign another tenant's private file`)
  const args={target_business_id:other.business,range_start:'2026-01-01',range_end:'2026-01-02'}
  for (const rpc of ['get_dashboard_metrics_all_channels','get_dashboard_recent_transactions_all_channels',
    'get_sales_report_summary','search_sales_report']) {
    const result=await call(actor,`/rest/v1/rpc/${rpc}`,args)
    assert.ok(result.response.status===403 && result.payload?.code==='42501',`${actor.label}: ${rpc} must reject foreign tenant with 42501 (missing RPCs do not pass)`)
  }
  console.log(`Tenant ${actor.label}: direct REST, private-file and export probes passed`)
}
