import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

test('tutorial progress persists independently per user with direct RLS protections and a new-account rollout',async()=>{
  const db=new PGlite()
  const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002'
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
    await db.query('insert into auth.users values ($1)',[a])
    await db.exec(readFileSync('supabase/migrations/20261109020000_user_module_tutorials.sql','utf8'))
    assert.equal((await db.query('select automatic from user_tutorial_preferences where user_id=$1',[a])).rows[0].automatic,false)
    await db.query('insert into auth.users values ($1)',[b])
    assert.equal((await db.query('select * from user_tutorial_preferences where user_id=$1',[b])).rows.length,0)
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b])
    await db.exec('set role authenticated')
    assert.equal((await db.query('select * from user_tutorial_preferences')).rows.length,0)
    await assert.rejects(db.query('insert into user_module_tutorials values ($1,\'dashboard\',\'completed\')',[a]),/row-level security/)
    await assert.rejects(db.query('insert into user_tutorial_preferences values ($1,true)',[a]),/row-level security/)
    await db.query('insert into user_module_tutorials values ($1,\'dashboard\',\'completed\'),($1,\'catalogue\',\'skipped\')',[b])
    await db.query('insert into user_tutorial_preferences values ($1,false)',[b])
    assert.equal((await db.query('select * from user_module_tutorials')).rows.length,2)
    await assert.rejects(db.query('update user_module_tutorials set user_id=$1 where user_id=$2',[a,b]),/row-level security/)
    await assert.rejects(db.query('insert into user_module_tutorials values ($1,\'made-up\',\'completed\')',[b]),/check constraint/)
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a])
    await db.exec('set role authenticated')
    assert.equal((await db.query('select * from user_module_tutorials')).rows.length,0)
    assert.equal((await db.query('update user_module_tutorials set status=\'completed\' where user_id=$1 returning *',[b])).rows.length,0)
    await db.exec('reset role; set role anon')
    await assert.rejects(db.exec('select * from user_module_tutorials'),/permission denied/)
  } finally {await db.close()}
})
