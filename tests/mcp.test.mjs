import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/mcp.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, Request, Response, URL, Date });
const { createMcpHandler } = exports;
const tool = { name: 'listarTarefasOuMissoes', inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 50 }, task_id: { type: 'string', format: 'uuid' } } } };
let calls = 0;
const handler = createMcpHandler({ tools: [tool], authenticate: async token => token === 'test-only', call: async (_name, args, token) => { calls++; assert.equal(token, 'test-only'); return Response.json({ ok: true, tasks: [], limit: args.limit }); } });
const request = (body, extra = {}) => new Request('http://localhost/api/mcp', { method: 'POST', headers: { authorization: 'Bearer test-only', accept: 'application/json, text/event-stream', 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) });
const rpc = (method, params = {}, id = 1) => ({ jsonrpc: '2.0', id, method, params });
test('initialize negotiates protocol and timezone; ping and list are read-only', async () => {
  const result = await (await handler(request(rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })))).json();
  assert.equal(result.result.protocolVersion, '2025-06-18');
  assert.match(result.result.instructions, /America\/Sao_Paulo/);
  assert.equal((await (await handler(request(rpc('tools/list')))).json()).result.tools.length, 1);
  assert.deepEqual((await (await handler(request(rpc('ping')))).json()).result, {});
});
test('notifications return 202 without a body and cannot execute tools', async () => {
  const before = calls;
  assert.equal((await handler(request({ jsonrpc: '2.0', method: 'notifications/initialized' }))).status, 202);
  assert.equal((await handler(request({ jsonrpc: '2.0', method: 'tools/call', params: { name: tool.name } }))).status, 400);
  assert.equal(calls, before);
});
test('listing invokes existing handler and returns tool content', async () => {
  const response = await handler(request(rpc('tools/call', { name: tool.name, arguments: { limit: 2 } })));
  const body = await response.json();
  assert.equal(body.result.isError, false);
  assert.deepEqual(JSON.parse(body.result.content[0].text), { ok: true, tasks: [], limit: 2 });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('rejects invalid auth, origin, schema, unknown methods and tools', async () => {
  assert.equal((await handler(request(rpc('ping'), { authorization: 'Bearer invalid' }))).status, 401);
  assert.equal((await handler(request(rpc('ping'), { origin: 'https://untrusted.example' }))).status, 403);
  assert.equal((await handler(request(rpc('ping'), { 'mcp-protocol-version': 'invalid' }))).status, 400);
  for (const args of [{ limit: 51 }, { limit: 1.5 }, { task_id: 'invented' }, { token: 'x' }]) assert.equal((await (await handler(request(rpc('tools/call', { name: tool.name, arguments: args })))).json()).error.code, -32602);
  assert.equal((await (await handler(request(rpc('unknown')))).json()).error.code, -32601);
  assert.equal((await (await handler(request(rpc('tools/call', { name: 'unknown' })))).json()).error.code, -32602);
});
test('upstream failures are tool errors; exceptions never expose secrets', async () => {
  const failing = createMcpHandler({ tools: [tool], authenticate: async () => true, call: async () => { throw new Error('test-only'); } });
  const body = await (await failing(request(rpc('tools/call', { name: tool.name })))).json();
  assert.equal(body.result.isError, true);
  assert.ok(!JSON.stringify(body).includes('test-only'));
});
