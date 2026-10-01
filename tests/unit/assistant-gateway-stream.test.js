import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { EventEmitter } from 'node:events';

for (const key of ['SUPABASE_URL','VITE_SUPABASE_URL','SUPABASE_ANON_KEY','VITE_SUPABASE_ANON_KEY']) delete process.env[key];
process.env.GROQ_API_KEY='offline-key';
const { startAssistantProviderStream,handleAssistantGateway }=await import('../../server-assistant.js');
const { assistantQuotaSummary,clearAssistantQuotaForTests }=await import('../../server-assistant-quota.js');
const { readTurn }=await import('../../js/lib/model-gateway.js');
const encoder=new TextEncoder();
const first='data: {"choices":[{"delta":{"content":"A useful reply"}}]}\n\n';
const ending='data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
const noop=()=>{};

test('The startup deadline stops once a provider answers, and cancellation still reaches the stream',async () => {
  const original=globalThis.fetch; let upstreamSignal; let reads=0;
  globalThis.fetch=async (_url,options) => {
    upstreamSignal=options.signal;
    return { ok:true,body:{ getReader:() => ({
      async read() { return reads++===0 ? { value:encoder.encode(first),done:false } : { value:encoder.encode(ending),done:false }; },
      async cancel() {},
    }) } };
  };
  const controller=new AbortController();
  try {
    const reply=await startAssistantProviderStream({ provider:{ id:'groq',url:'https://provider.example.test',key:()=> 'offline-key',label:'Offline' },model:'test' },{ messages:[{ role:'user',content:'Hello' }],mode:'fast' },controller.signal,20);
    await delay(50);
    assert.equal(upstreamSignal.aborted,false,'A slow complete answer must outlive the startup deadline');
    await reply.reader.read();
    controller.abort();
    assert.equal(upstreamSignal.aborted,true);
  } finally { globalThis.fetch=original; }
});

test('A provider that never starts is cancelled by the startup deadline',async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async (_url,options) => new Promise((_,reject) => options.signal.addEventListener('abort',()=>reject(new Error('Aborted')),{ once:true }));
  try {
    await assert.rejects(startAssistantProviderStream({ provider:{ id:'groq',url:'https://provider.example.test',key:()=> 'offline-key',label:'Offline' },model:'test' },{ messages:[{ role:'user',content:'Hello' }] },new AbortController().signal,20),/no answer within/);
  } finally { globalThis.fetch=original; }
});

async function gateway({ truncated=false,disconnect=false }={}) {
  let upstreamSignal; let reads=0;
  const original=globalThis.fetch;
  globalThis.fetch=async (_url,options) => {
    upstreamSignal=options.signal;
    return { ok:true,body:{ getReader:() => ({
      async read() {
        if(reads++===0) return { value:encoder.encode(first),done:false };
        if(upstreamSignal.aborted) throw new Error('Aborted');
        if(truncated || reads>2) return { done:true };
        return { value:encoder.encode(ending),done:false };
      },
      async cancel() {},
    }) } };
  };
  const payload=JSON.stringify({ turnId:'turn_stream_test',messages:[{ role:'user',content:'A long reply' }] });
  const request={ method:'POST',headers:{ host:'localhost' },socket:{ remoteAddress:'127.0.0.1' },async *[Symbol.asyncIterator]() { yield payload; } };
  const response=new EventEmitter();
  response.body=''; response.headersSent=false; response.destroyed=false;
  response.writeHead=()=> { response.headersSent=true; };
  response.write=value => { response.body+=value; if(disconnect && String(value).includes('A useful reply')) { response.destroyed=true; response.emit('close'); } return true; };
  response.end=value => { response.body+=value || ''; };
  clearAssistantQuotaForTests();
  try {
    await handleAssistantGateway(request,response,new URL('http://localhost/api/assistant/v2/chat'));
    return { body:response.body,summary:await assistantQuotaSummary({ id:'local-development' }),upstreamSignal };
  } finally { globalThis.fetch=original; }
}

test('A completed gateway reply commits its durable message charge',async () => {
  const result=await gateway();
  assert.match(result.body,/A useful reply/);
  assert.equal(result.summary.messagesUsed,1);
  assert.equal(result.summary.requestsUsed,1);
});
test('An interrupted reply refunds its message and reports the incomplete stream',async () => {
  const result=await gateway({ truncated:true });
  assert.equal(result.summary.messagesUsed,0);
  assert.equal(result.summary.requestsUsed,1);
  assert.match(result.body,/model connection dropped/);
});
test('Stopping after the first token cancels the winning provider and refunds the message',async () => {
  const result=await gateway({ disconnect:true });
  assert.equal(result.upstreamSignal.aborted,true);
  assert.equal(result.summary.messagesUsed,0);
});
test('The browser refuses truncated tool calls and provider metadata without an answer',async () => {
  for(const payload of [
    'event: provider\ndata: {"provider":"test"}\n\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_partial","function":{"name":"save_note","arguments":"{}"}}]}}]}\n\n',
  ]) await assert.rejects(readTurn(new Response(payload),{ onText:noop,onThinking:noop,onProvider:noop }),/before completing/);
});
test('The browser accepts a complete final SSE event without a trailing newline',async () => {
  const result=await readTurn(new Response('data: {"choices":[{"delta":{"content":"Finished."},"finish_reason":"stop"}]}'),{ onText:noop,onThinking:noop,onProvider:noop });
  assert.equal(result.text,'Finished.'); assert.equal(result.finish,'stop');
});
