import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, require = () => {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require, URL, URLSearchParams });
  return exports;
}
const preferences = load('lib/user-preferences.ts');
const redirect = load('lib/supabase/redirect.ts');
const { completeAuth } = load('lib/supabase/complete-auth.ts', () => redirect);
function client({ error = null, user = { id: 'user' } } = {}) {
  const calls = [];
  const auth = Object.fromEntries(['exchangeCodeForSession', 'verifyOtp', 'setSession'].map(method => [method, async value => { calls.push([method, value]); return { error }; }]));
  auth.getUser = async () => ({ data: { user }, error: null });
  return { auth, calls };
}
test('names are user-specific and legacy accounts get a neutral fallback', () => {
  assert.equal(preferences.cleanName('  Maria  '), 'Maria');
  assert.equal(preferences.displayName({ display_name: 'Maria', full_name: 'Other' }), 'Maria');
  assert.equal(preferences.displayName({}), 'Seu personagem');
  assert.throws(() => preferences.cleanName(' '));
  assert.throws(() => preferences.cleanName('x'.repeat(81)));
});
test('custom categories are trimmed, bounded and tolerate malformed metadata', () => {
  assert.equal(preferences.cleanCategory('  Estudos  '), 'Estudos');
  assert.deepEqual(Array.from(preferences.customCategories({ task_categories: ['Estudos', null, 3, ' ', 'x'.repeat(81)] })), ['Estudos']);
  assert.throws(() => preferences.cleanCategory(' '));
  assert.throws(() => preferences.cleanCategory('x'.repeat(81)));
});
test('PKCE confirmation exchanges the code before entering the app', async () => {
  const s = client();
  assert.equal(await completeAuth(s, new URL('https://app.test/auth/callback?code=abc')), '/');
  assert.deepEqual(s.calls, [['exchangeCodeForSession', 'abc']]);
});
test('implicit links establish a cookie-backed session and recovery goes to password form', async () => {
  const s = client();
  assert.equal(await completeAuth(s, new URL('https://app.test/auth/callback#access_token=a&refresh_token=r&type=recovery')), '/auth/update-password');
  assert.equal(s.calls[0][0], 'setSession');
  assert.equal(s.calls[0][1].refresh_token, 'r');
});
test('token-hash links verify OTP and cannot redirect to another origin', async () => {
  const s = client();
  assert.equal(await completeAuth(s, new URL('https://app.test/auth/callback?token_hash=h&type=email&next=https://evil.test')), '/');
  assert.equal(s.calls[0][0], 'verifyOtp');
  assert.equal(s.calls[0][1].token_hash, 'h');
});
test('missing PKCE verifier directs to sign-in instead of an app failure', async () => {
  const s = client({ error: { code: 'pkce_code_verifier_not_found', message: 'missing verifier' }, user: null });
  assert.equal(await completeAuth(s, new URL('https://app.test/auth/callback?code=abc')), '/auth/login?confirmation=other-browser');
});
test('expired links and unverified sessions never enter the app', async () => {
  await assert.rejects(completeAuth(client(), new URL('https://app.test/auth/callback#error=access_denied&error_code=otp_expired')));
  await assert.rejects(completeAuth(client({ user: null }), new URL('https://app.test/auth/callback')));
});
