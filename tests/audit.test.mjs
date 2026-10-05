import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, mocks = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { exports, URL, require(name) { if (!(name in mocks)) throw new Error(`Unexpected dependency ${name}`); return mocks[name]; }, process: {env:{}} });
  return exports;
}
function actions({user = {id:'user'}, error = null} = {}) {
  const calls = [], paths = [];
  const client = {auth:{getUser:async()=>({data:{user}})}, rpc: async (name, args) => {calls.push({name,args});return {data:'session',error}}};
  return { api: load('app/actions.ts', {'@/lib/user-preferences':load('lib/user-preferences.ts'), 'next/cache':{revalidatePath:(p,type)=>{assert.equal(type,undefined);paths.push(p)}}, '@/lib/supabase/server':{createClient:async()=>client}}), calls, paths };
}
test('completeTask delegates task completion to the existing RPC and invalidates all affected pages', async()=>{
  const {api,calls,paths}=actions(); await api.completeTask('task');
  assert.equal(calls.length,1); assert.equal(calls[0].name,'complete_task'); assert.equal(calls[0].args.p_task_id,'task');
  assert.deepEqual(paths,['/','/tasks','/workouts','/focus','/bosses','/shop','/achievements']);
});
test('unauthenticated task completion never invokes RPC',async()=>{
  const {api,calls,paths}=actions({user:null});await assert.rejects(api.completeTask('task'),/autenticado/);assert.equal(calls.length,0);assert.equal(paths.length,0);
});
test('RPC failure does not report a successful completion or invalidate pages',async()=>{
  const {api,paths}=actions({error:{message:'failure'}});await assert.rejects(api.completeTask('task'),/failure/);assert.equal(paths.length,0);
});
test('proxy propagates refreshed cookies to request and response and preserves cache headers',async()=>{
  let options,claims=0; const writes=[];
  const request={cookies:{getAll:()=>[{name:'session',value:'old'}],set:(n,v)=>writes.push([n,v])}};
  const responses=[];
  const api=load('lib/supabase/proxy.ts',{
    '@supabase/ssr':{createServerClient:(_u,_k,o)=>{options=o;return {auth:{getClaims:async()=>{claims++;o.cookies.setAll([{name:'session',value:'new',options:{httpOnly:true}}],{'cache-control':'private, no-store'});}}}}},
    'next/server':{NextResponse:{next:()=>{const r={cookies:{set:(...args)=>{r.cookie=args}},headers:new Map()};responses.push(r);return r}}},
    './config':{supabaseConfig:()=>({url:'https://example.invalid',key:'public-test-key'})}
  });
  const response=await api.updateSession(request);assert.equal(claims,1);assert.equal(response,responses.at(-1));assert.deepEqual(writes,[['session','new']]);assert.equal(response.cookie[1],'new');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(options.cookies.getAll()[0].value,'old');
});
test('auth redirects reject external destinations',()=>{
  const {safeNext}=load('lib/supabase/redirect.ts');for(const value of ['https://example.invalid','//example.invalid','/\\example.invalid','/\n/example.invalid',null])assert.equal(safeNext(value),'/');assert.equal(safeNext('/auth/update-password'),'/auth/update-password');
});
test('levels handle invalid XP without hanging',()=>{
  const {getLevelProgress}=load('lib/game.ts');assert.equal(getLevelProgress(Infinity).level,1);assert.equal(getLevelProgress(NaN).level,1);assert.equal(getLevelProgress(-1).level,1);assert.equal(getLevelProgress(10).level,2);
});
