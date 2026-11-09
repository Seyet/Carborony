import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'

const api = loadTs('src/lib/api/server.ts')
const A = '00000000-0000-4000-8000-000000000001'
const B = '00000000-0000-4000-8000-000000000002'
const foreignId = '00000000-0000-4000-8000-000000000003'
const permissions = ['sales.view','sales.manage','products.manage','expenses.view','reports.export']

// This client tests application scoping only. It deliberately has no RLS; a
// forgotten business filter exposes the seeded foreign row and fails the test.
function boundary({ perms = permissions, expense = null } = {}) {
  const calls = []
  const foreign = { id: foreignId, business_id: B, document_type:'order', ...expense }
  const client = {
    from(table) {
      const filters = []
      const q = {
        select() { return q },
        eq(key,value) { filters.push([key,value]); return q },
        order(){return q}, limit(){return q},
        async single(){return result()}, async maybeSingle(){return result()},
        then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)},
      }
      function result() {
        calls.push({ table, filters })
        if (table === 'businesses') return { data:{ id:A, currency_code:'NGN', timezone:'Africa/Lagos' }, error:null }
        const row = expense && table === 'expenses' ? { ...foreign, business_id:A } : foreign
        return { data:filters.every(([key,value])=>row[key]===value)?row:null, error:null }
      }
      return q
    },
    rpc(name,args) {
      calls.push({ rpc:name,args })
      assert.equal(args.target_business_id,A,'RPC must derive tenant from verified membership')
      return { single:async()=>({data:null,error:{code:'42501'}}),
        maybeSingle:async()=>({data:null,error:null}),
        then:resolve=>Promise.resolve({data:[],error:null,status:200}).then(resolve) }
    },
    storage: { from(){throw new Error('Foreign file must never reach storage')} },
  }
  const business = { id:A, permissions:perms, name:'Tenant A',roleCode:'owner' }
  const deps = {
    '@/lib/api/server':api,
    '@/features/businesses/server/get-current-business':{getCurrentBusiness:async()=>business,getCurrentBusinessOrNull:async()=>business},
    '@/lib/auth/session':{getCurrentUser:async()=>({id:'actor-a'})},
    '@/lib/supabase/server':{createClient:async()=>client},
    'next/cache':{revalidatePath(){}},
  }
  return {calls,client,load:path=>loadTs(path,deps)}
}

test('guessed order and receipt IDs cannot read another current business', async()=>{
  for (const kind of ['sale','order','invoice']) {
    const {load,calls} = boundary()
    const service = load('src/features/sales/documents/server/get-transaction-document.ts')
    await assert.rejects(service.getTransactionDocument(kind,foreignId),error=>error.status===404)
    const lookup = calls.find(call=>['sales','orders'].includes(call.table))
    assert.ok(lookup.filters.some(([k,v])=>k==='business_id'&&v===A))
    assert.ok(lookup.filters.some(([k,v])=>k==='id'&&v===foreignId))
  }
  const {load} = boundary()
  await assert.rejects(load('src/features/orders/server/get-orders.ts').getOrderDetails(foreignId),{code:'ORDER_NOT_FOUND'})
})

test('customer read and update RPCs bind guessed IDs to the authenticated current business',async()=>{
  const {load,calls} = boundary()
  const customers = load('src/features/customers/server/customers.ts')
  await assert.rejects(customers.getCustomerDetails(foreignId,1),{code:'CUSTOMER_NOT_FOUND'})
  await assert.rejects(customers.saveCustomer({fullName:'Foreign edit',businessId:B,tags:[]},foreignId),{code:'CUSTOMER_FORBIDDEN'})
  for (const call of calls.filter(call=>call.rpc)) {
    assert.equal(call.args.target_business_id,A)
    assert.equal(call.args.target_customer_id,foreignId)
  }
})

test('order updates bind guessed order IDs to the current business', async()=>{
  const {load,calls}=boundary()
  await assert.rejects(load('src/features/orders/server/update-order-status.ts').updateOrderStatus(foreignId,{status:'confirmed',note:''}))
  assert.equal(calls[0].args.target_order_id,foreignId)
  assert.equal(calls[0].args.target_business_id,A)
})

test('foreign product and media IDs cannot create, finalize or delete files',async()=>{
  for (const method of ['createMediaUploads','finalizeMediaUploads']) {
    const {load} = boundary()
    await assert.rejects(load('src/features/catalogue/server/manage-media.ts')[method](foreignId,{files:[],items:[]}),{code:'PRODUCT_NOT_FOUND'})
  }
  const {load}=boundary()
  await assert.rejects(load('src/features/catalogue/server/manage-media.ts').manageMedia(foreignId,{action:'delete',mediaId:foreignId}),{code:'MEDIA_NOT_FOUND'})
})

test('foreign expense IDs and forged stored paths cannot reach private storage',async()=>{
  const {load}=boundary()
  await assert.rejects(load('src/features/expenses/server/manage-attachment.ts').getExpenseAttachmentDownload(foreignId),{code:'EXPENSE_NOT_FOUND'})
  const {load:loadForged}=boundary({expense:{attachment_storage_path:`${B}/${foreignId}/00000000-0000-4000-8000-000000000004.pdf`,attachment_file_name:'receipt.pdf',attachment_mime_type:'application/pdf',attachment_file_size:10}})
  await assert.rejects(loadForged('src/features/expenses/server/manage-attachment.ts').getExpenseAttachmentDownload(foreignId),{code:'ATTACHMENT_DOWNLOAD_FAILED'})
  await load('src/features/expenses/server/manage-attachment.ts').removeUnreferencedExpenseAttachment({businessId:A,expenseId:foreignId,storagePath:`${B}/${foreignId}/file.pdf`,supabase:{from(){throw new Error('Foreign cleanup must stop before queries')}}})
})

test('export, document and media permissions reject before data queries',async()=>{
  const cases = [
    ['src/features/reports/server/get-report-export.ts','getReportExportDocument',[{}],'REPORT_EXPORT_FORBIDDEN'],
    ['src/features/dashboard/server/export-overview.ts','exportDashboardOverview',[{}],'DASHBOARD_EXPORT_FORBIDDEN'],
    ['src/features/sales/documents/server/get-transaction-document.ts','getTransactionDocument',['sale',foreignId],'DOCUMENT_FORBIDDEN'],
    ['src/features/catalogue/server/manage-media.ts','createMediaUploads',[foreignId,{}],'MEDIA_FORBIDDEN'],
  ]
  for (const [path,method,args,code] of cases) {
    const {load,calls}=boundary({perms:[]})
    await assert.rejects(load(path)[method](...args),{code})
    assert.equal(calls.length,0)
  }
})

test('dashboard export never accepts a supplied tenant ID',async()=>{
  const {load,calls}=boundary()
  await assert.rejects(load('src/features/dashboard/server/export-overview.ts').exportDashboardOverview({businessId:B,startDate:'2026-01-01',endDate:'2026-01-02'}),{code:'DASHBOARD_EXPORT_FAILED'})
  const rpcs=calls.filter(call=>call.rpc)
  assert.equal(rpcs.length,4)
  assert.ok(rpcs.every(call=>call.args.target_business_id===A))
})
