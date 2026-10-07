import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/finance-status.ts','utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports });
const { financeStatus, financeStatusLabel, financeTotals } = exports;

test('legacy future charges remain planned without changing saved rows', () => {
  assert.equal(financeStatus(null, '2026-11-05', '2026-10-06'), 'planned');
  assert.equal(financeStatus(null, '2026-10-05', '2026-10-06'), 'posted');
  assert.equal(financeStatus('settled', '2026-11-05', '2026-10-06'), 'settled');
});

test('settled and open totals reconcile to the projected month', () => {
  const totals = financeTotals([
    { amount: '100.00', kind: 'income', status: 'settled' },
    { amount: '25.00', kind: 'expense', status: 'settled' },
    { amount: '40.00', kind: 'expense', status: 'planned' },
    { amount: '10.00', kind: 'expense', status: 'posted' },
  ]);
  assert.equal(totals.projected, 25);
  assert.equal(totals.settled, 75);
  assert.equal(totals.open, -50);
  assert.equal(totals.settled + totals.open, totals.projected);
  assert.equal(financeStatusLabel('settled', 'income'), 'Recebido');
  assert.equal(financeStatusLabel('settled', 'expense'), 'Pago');
});
