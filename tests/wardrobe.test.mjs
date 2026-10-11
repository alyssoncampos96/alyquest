import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/wardrobe.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Set, Date });
const { suggestOutfits } = exports;
const item = (id, category, condition = 'good', occasions = [], color = 'preto') => ({ id, name: id, category, condition, occasions, color, photo_path: '', processed_path: null, purchased_on: null, last_worn_on: null });

test('uma combinação só aparece com parte superior, inferior e calçado', () => {
  assert.equal(suggestOutfits([item('a', 'top'), item('b', 'bottom')], 'work').length, 0);
  const outfits = suggestOutfits([item('a', 'top'), item('b', 'bottom'), item('c', 'shoes')], 'work');
  assert.equal(outfits.length, 1);
  assert.deepEqual(Array.from(outfits[0].items, piece => piece.id), ['a', 'b', 'c']);
});

test('peça única substitui parte superior e inferior', () => {
  const outfits = suggestOutfits([item('vestido', 'one_piece'), item('tenis', 'shoes')], 'social');
  assert.equal(outfits.length, 1);
  assert.equal(outfits[0].items.length, 2);
});

test('ocasiões escolhidas pela pessoa prevalecem sobre a condição da roupa', () => {
  const clothes = [item('nova-de-academia', 'top', 'new', ['gym']), item('short', 'bottom', 'worn'), item('tenis', 'shoes', 'worn')];
  assert.equal(suggestOutfits(clothes, 'gym').length, 1);
  assert.equal(suggestOutfits(clothes, 'work').length, 0);
});

test('roupa mais usada não entra por padrão no trabalho, mas pode entrar se marcada', () => {
  const clothes = [item('camiseta', 'top', 'worn'), item('calca', 'bottom'), item('sapato', 'shoes')];
  assert.equal(suggestOutfits(clothes, 'work').length, 0);
  clothes[0].occasions = ['work'];
  assert.equal(suggestOutfits(clothes, 'work').length, 1);
});
