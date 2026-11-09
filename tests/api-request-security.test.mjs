import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { loadTs } from './helpers/load-ts.mjs'

const { handleJsonPost } = loadTs('src/lib/api/server.ts')
const schema = z.object({ text: z.string() })
const encoder = new TextEncoder()
function request(body = '{"text":"ok"}', headers = {}, url = 'https://app.example/api/test') {
  return new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body,
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}) })
}
async function send(req, options = {}) {
  let called = false
  const response = await handleJsonPost(req, schema, data => { called = true; return { data } }, options)
  return { status: response.status, payload: await response.json(), called }
}

// Keep environment changes sequential and restore them even when an assertion fails.
test('origin enforcement trusts only explicit configuration and platform environment, never request host headers', async () => {
  const keys = ['NODE_ENV', 'TRUSTED_APP_ORIGINS', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_BRANCH_URL']
  const saved = Object.fromEntries(keys.map(key => [key,process.env[key]]))
  try {
    for (const key of keys) delete process.env[key]
    process.env.NODE_ENV = 'production'
    process.env.TRUSTED_APP_ORIGINS = 'https://app.example, https://store.example'
    for (const origin of ['https://app.example','https://store.example']) {
      assert.equal((await send(request(undefined,{ origin }))).status,200)
    }
    for (const origin of ['https://evil.example','null','https://app.example.evil.test','https://app.example/path','https://app.example:8443','http://app.example','']) {
      const result = await send(request(undefined, { origin, host: 'evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https' },'https://evil.example/api/test'))
      assert.equal(result.status,403,origin)
      assert.equal(result.called,false)
    }
    assert.equal((await send(request())).status,200) // non-browser JSON client
    assert.equal((await send(request(undefined, { 'sec-fetch-site': 'cross-site' }))).status,403)
    process.env.VERCEL_URL = 'preview.example.vercel.app'
    assert.equal((await send(request(undefined, { origin:'https://preview.example.vercel.app' }))).status,200)
    delete process.env.TRUSTED_APP_ORIGINS
    assert.equal((await send(request(undefined,{ origin:'https://app.example' }))).status,403)
    assert.equal((await send(request(undefined,{ origin:'http://localhost:3000' }))).status,403)
    process.env.NODE_ENV = 'development'
    assert.equal((await send(request(undefined,{ origin:'http://localhost:3000' }))).status,200)
    process.env.TRUSTED_APP_ORIGINS = 'https://app.example/path'
    assert.equal((await send(request(undefined,{ origin:'https://app.example' }))).status,503)
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
})

test('stream limits stop oversized input early, cancel the producer, and never invoke the handler', async () => {
  for (const headers of [{}, { 'content-length':'1' }]) {
    let pulls = 0
    let cancelled = false
    const body = new ReadableStream({
      pull(controller) { pulls++; controller.enqueue(encoder.encode('12345678')) },
      cancel() { cancelled = true },
    }, { highWaterMark:0 })
    const result = await send(request(body,headers),{ maxBytes:10 })
    assert.equal(result.status,413)
    assert.equal(result.payload.error.code,'PAYLOAD_TOO_LARGE')
    assert.equal(result.called,false)
    assert.equal(pulls,2)
    assert.equal(cancelled,true)
    assert.equal(body.locked,false)
  }
})

test('declared oversize is rejected before reading; bytes and UTF-8 boundaries are validated', async () => {
  let pulls = 0
  let cancelled = false
  const body = new ReadableStream({ pull(){pulls++}, cancel(){cancelled=true} },{ highWaterMark:0 })
  assert.equal((await send(request(body,{'content-length':'100'}),{maxBytes:20})).status,413)
  assert.equal(pulls,0)
  assert.equal(cancelled,true)
  const bytes = encoder.encode('{"text":"é"}')
  const chunks = new ReadableStream({ start(c) {
    const split = bytes.indexOf(0xc3)+1
    c.enqueue(bytes.slice(0,split));c.enqueue(bytes.slice(split));c.close()
  } })
  assert.equal((await send(request(chunks),{maxBytes:bytes.length})).payload.data.text,'é')
  assert.equal((await send(request('{"text":"é"}'),{maxBytes:bytes.length-1})).status,413)
  for (const content of ['', '{', new Uint8Array([0xff])]) {
    const result = await send(request(content))
    assert.equal(result.status,400)
    assert.equal(result.called,false)
  }
  assert.equal((await send(request(undefined,{'content-length':'-1'}))).status,400)
  const broken = new ReadableStream({ start(c){c.error(new Error('Disconnected'))} })
  assert.equal((await send(request(broken))).status,400)
})
