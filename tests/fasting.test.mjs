import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function actions() {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
    rpc: async (name, args) => { calls.push({ name, args }); return { data: {}, error: null }; },
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('app/fasting-actions.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (name === 'next/cache') return { revalidatePath() {} };
      if (name === '@/lib/supabase/server') return { createClient: async () => client };
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return { api: exports, calls };
}

function form(values) { return { get: name => values[name] ?? null }; }

test('início do jejum mantém 22h30 de São Paulo ao gravar no Supabase', async () => {
  const { api, calls } = actions();
  await api.startFast(form({ started_at: '2026-10-03T22:30' }));
  assert.equal(calls[0].name, 'aq_fasting_start');
  assert.equal(calls[0].args.p_started_at, '2026-10-04T01:30:00.000Z');
});

test('fim do jejum converte início e fim para o mesmo fuso', async () => {
  const { api, calls } = actions();
  await api.finishFast(form({ session_id: 'session', started_at: '2026-10-03T22:30', ended_at: '2026-10-04T06:30' }));
  assert.equal(calls[0].args.p_started_at, '2026-10-04T01:30:00.000Z');
  assert.equal(calls[0].args.p_ended_at, '2026-10-04T09:30:00.000Z');
});

test('cancelar jejum chama a operação sem conceder recompensa', async () => {
  const { api, calls } = actions();
  await api.cancelFast(form({ session_id: 'session' }));
  assert.equal(calls[0].name, 'aq_fasting_cancel');
  assert.equal(calls[0].args.p_session_id, 'session');
});
