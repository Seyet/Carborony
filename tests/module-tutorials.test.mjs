import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'

const guides = loadTs('src/features/tutorials/guides.ts')
const schemas = loadTs('src/features/tutorials/schemas.ts',{'./guides':guides})
const api = loadTs('src/lib/api/server.ts')

test('module tutorials select the most specific route and respect module permissions',()=>{
  assert.equal(guides.getModuleGuide('/app/dashboard',['dashboard.view']).id,'dashboard')
  assert.equal(guides.getModuleGuide('/app/sales/history/receipt/123',['sales.view']).id,'sales-history')
  assert.equal(guides.getModuleGuide('/app/orders/123',['sales.view']).id,'orders')
  assert.equal(guides.getModuleGuide('/app/customers/new',['customers.view']).id,'customers')
  assert.equal(guides.getModuleGuide('/app/dashboard',[]),undefined)
  assert.equal(guides.getModuleGuide('/app/orders-elsewhere',['sales.view']),undefined)
  assert.equal(guides.getModuleGuide('/login',['dashboard.view']),undefined)
  for (const route of ['social-posts','campaigns','ai-content']) {
    assert.equal(guides.getModuleGuide(`/app/marketing/${route}`,['settings.view']),undefined)
  }
  assert.equal(new Set(guides.moduleGuides.map(g=>g.id)).size,guides.moduleGuides.length)
  assert.ok(guides.moduleGuides.every(g=>g.steps.length>=2))
})

test('guide progress rejects unknown modules/statuses and strips caller-selected identities',()=>{
  assert.equal(schemas.tutorialProgressSchema.safeParse({action:'finish',moduleId:'unknown',status:'completed'}).success,false)
  assert.equal(schemas.tutorialProgressSchema.safeParse({action:'finish',moduleId:'dashboard',status:'invalid'}).success,false)
  assert.deepEqual(schemas.tutorialProgressSchema.parse({action:'finish',moduleId:'dashboard',status:'skipped',userId:'someone-else'}),{
    action:'finish',moduleId:'dashboard',status:'skipped',
  })
})

function service({user={id:'user-a'},error=null,automatic=null,modules=[]}={}) {
  const calls=[]
  const progressService=loadTs('src/features/tutorials/server/progress.ts',{
    '@/lib/api/server':api,
    '@/lib/auth/session':{getCurrentUser:async()=>user},
    '@/lib/supabase/server':{createClient:async()=>({from(table){
      return {
        async upsert(row,options){calls.push({table,row,options});return {error}},
        select(){return this},eq(key,value){calls.push({table,key,value});return this},
        maybeSingle:async()=>({data:automatic===null?null:{automatic},error}),
        then(resolve){return Promise.resolve({data:modules.map(module_id=>({module_id})),error}).then(resolve)},
      }
    }})},
  })
  return {...progressService,calls}
}

test('progress is saved for the verified user and independent module keys do not overwrite each other',async()=>{
  const s=service()
  await s.saveTutorialProgress({action:'finish',moduleId:'dashboard',status:'completed',userId:'user-b'})
  await s.saveTutorialProgress({action:'finish',moduleId:'catalogue',status:'skipped'})
  assert.ok(s.calls.every(call=>call.row.user_id==='user-a'))
  assert.deepEqual(s.calls.map(call=>call.row.module_id),['dashboard','catalogue'])
  assert.ok(s.calls.every(call=>call.options.onConflict==='user_id,module_id'))
  await s.saveTutorialProgress({action:'disable'})
  assert.deepEqual(s.calls.at(-1).row,{user_id:'user-a',automatic:false})
})

test('new users get first-visit guides; existing preferences and completed modules are respected',async()=>{
  assert.deepEqual(await service().getTutorialProgress('user-a'),{automatic:true,handledModules:[]})
  const s=service({automatic:false,modules:['dashboard','sales']})
  assert.deepEqual(await s.getTutorialProgress('user-a'),{automatic:false,handledModules:['dashboard','sales']})
  assert.ok(s.calls.every(call=>call.key==='user_id'&&call.value==='user-a'))
})

test('progress requires authentication and unavailable persistence does not break the workspace',async()=>{
  const unauthenticated=service({user:null})
  await assert.rejects(unauthenticated.saveTutorialProgress({action:'disable'}),{status:401})
  assert.equal(unauthenticated.calls.length,0)
  const unavailable=service({error:{code:'42P01'}})
  assert.deepEqual(await unavailable.getTutorialProgress('user-a'),{automatic:false,handledModules:[]})
  await assert.rejects(unavailable.saveTutorialProgress({action:'disable'}),{status:503,code:'TUTORIAL_SAVE_FAILED'})
})
