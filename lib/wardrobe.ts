export const wardrobeCategories = ['top', 'bottom', 'one_piece', 'shoes', 'outerwear', 'accessory'] as const;
export const wardrobeConditions = ['new', 'good', 'worn'] as const;
export const wardrobeOccasions = ['work', 'gym', 'social', 'errands', 'home'] as const;
export type WardrobeCategory = (typeof wardrobeCategories)[number];
export type WardrobeCondition = (typeof wardrobeConditions)[number];
export type WardrobeOccasion = (typeof wardrobeOccasions)[number];
export type WardrobeItem = {
  id: string;
  name: string;
  category: WardrobeCategory;
  color: string;
  condition: WardrobeCondition;
  occasions: WardrobeOccasion[];
  photo_path: string;
  processed_path: string | null;
  prefer_original: boolean;
  purchased_on: string | null;
  last_worn_on: string | null;
  image_url?: string;
};

export const categoryLabels: Record<WardrobeCategory, string> = {
  top: 'Parte de cima', bottom: 'Parte de baixo', one_piece: 'Peça única', shoes: 'Calçado', outerwear: 'Casaco', accessory: 'Acessório',
};
export const conditionLabels: Record<WardrobeCondition, string> = {
  new: 'Nova / especial', good: 'Bem conservada', worn: 'Mais usada',
};
export const occasionLabels: Record<WardrobeOccasion, string> = {
  work: 'Trabalho', gym: 'Academia', social: 'Sair', errands: 'Rua / mercado', home: 'Casa',
};

const neutral = new Set(['preto', 'branco', 'cinza', 'bege', 'marrom', 'azul-marinho']);
const complementary = new Set(['azul|laranja', 'amarelo|roxo', 'verde|vermelho']);
function colorScore(a: string, b: string) {
  if (a === b) return 3;
  if (neutral.has(a) || neutral.has(b)) return 4;
  if (complementary.has([a, b].sort().join('|'))) return 3;
  return 0;
}
function suited(item: WardrobeItem, occasion: WardrobeOccasion) {
  if (item.occasions.length) return item.occasions.includes(occasion);
  if (item.condition === 'new') return occasion !== 'gym' && occasion !== 'home';
  if (item.condition === 'worn') return occasion !== 'work' && occasion !== 'social';
  return true;
}
export type Outfit = { items: WardrobeItem[]; score: number; reasons: string[] };
export function suggestOutfits(items: WardrobeItem[], occasion: WardrobeOccasion, limit = 6): Outfit[] {
  const available = items.filter(item => suited(item, occasion));
  const by = (category: WardrobeCategory) => available.filter(item => item.category === category);
  const bases: WardrobeItem[][] = [];
  for (const top of by('top')) for (const bottom of by('bottom')) bases.push([top, bottom]);
  for (const dress of by('one_piece')) bases.push([dress]);
  const shoes = by('shoes');
  if (!shoes.length) return [];
  const outfits: Outfit[] = [];
  for (const base of bases) for (const shoe of shoes) {
    const core = [...base, shoe];
    const colors = core.map(item => item.color.toLowerCase());
    const harmony = colors.slice(1).reduce((score, color) => score + colorScore(colors[0], color), 0);
    const condition = core.reduce((score, item) => score + (item.condition === 'good' ? 2 : item.condition === 'new' && (occasion === 'work' || occasion === 'social') ? 3 : item.condition === 'worn' && (occasion === 'gym' || occasion === 'home') ? 2 : 0), 0);
    const variety = core.reduce((score, item) => score + (item.last_worn_on ? Math.min(4, Math.floor((Date.now() - new Date(`${item.last_worn_on}T12:00:00Z`).getTime()) / 86400000)) : 4), 0);
    const reasons = ['Peças marcadas para esta ocasião'];
    if (harmony > 0) reasons.push('Cores em harmonia');
    if (variety > 0) reasons.push('Ajuda a variar o guarda-roupa');
    outfits.push({ items: core, score: harmony + condition + variety, reasons });
  }
  return outfits.sort((a, b) => b.score - a.score || a.items.map(i => i.id).join().localeCompare(b.items.map(i => i.id).join())).slice(0, limit);
}
