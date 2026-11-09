import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

test('every repository SECURITY DEFINER signature has an authorization review and explicit execution role manifest',()=>{
  const reviewed = JSON.parse(readFileSync('docs/security/definer-inventory.json','utf8'))
  const manifest = new Map(reviewed.map(entry=>[entry.signature,entry]))
  const definitions = new Map()
  for (const filename of readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).sort()) {
    const sql=readFileSync(`supabase/migrations/${filename}`,'utf8')
    for (const match of sql.matchAll(/create\s+(?:or replace\s+)?function\s+public\.(\w+)\s*\((.*?)\)\s*returns/gis)) {
      const body=sql.slice(match.index,sql.indexOf('$$;',match.index)+3)
      if (!/security\s+definer/i.test(body)) continue
      const types=match[2].split(',').map(p=>p.trim()).filter(Boolean).map(p=>p.split(/\s+/)[1])
      definitions.set(`public.${match[1]}(${types.join(',')})`,{body,filename})
    }
  }
  assert.equal(definitions.size,manifest.size,'New or removed definers require a manifest review')
  const hardening=readFileSync('supabase/migrations/20261109010000_tenant_rpc_execution_hardening.sql','utf8')
  for (const [signature,{body,filename}] of definitions) {
    const entry=manifest.get(signature)
    assert.ok(entry,`Unreviewed definer: ${signature}`)
    assert.equal(filename,entry.source,`Re-review changed definer: ${signature}`)
    assert.equal(createHash('sha256').update(body).digest('hex'),entry.definitionSha256,`Re-review changed body: ${signature}`)
    assert.match(body,/set search_path\s*=\s*''/i,signature)
    assert.ok(entry.authorization.length>30)
    assert.ok(hardening.includes(`('${signature}', '${entry.roles.join(',')}')`),`Missing grants: ${signature}`)
    if (entry.roles.includes('authenticated') && !entry.roles.includes('anon')) {
      assert.match(body,/auth\.uid|has_business_permission|is_business_creator|dashboard_revenue_(documents|items)/,signature)
    }
  }
})
