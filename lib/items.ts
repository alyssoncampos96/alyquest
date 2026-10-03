export type ShopItem = {
  id: string;
  name: string;
  icon: string;
  description: string;
  price: number | string;
  damage_bonus: number | string;
  defense_bonus?: number | string | null;
  crit_bonus?: number | string | null;
  item_type?: string | null;
  battle_slot?: string | null;
  pet_ability?: string | null;
  rarity?: string | null;
  effect?: string | null;
};

export const slotLabels: Record<string, string> = {
  weapon: "Arma",
  armor: "Armadura",
  boots: "Botas",
  cloak: "Capa",
  helmet: "Elmo",
  accessory: "Acessório",
  pet: "Pet",
  consumable: "Consumível",
  cosmetic: "Cosmético",
  theme: "Tema",
};

export const rarityLabels: Record<string, string> = {
  common: "Comum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
};

export const rarityClass: Record<string, string> = {
  common: "border-slate-700 bg-slate-900 text-slate-200",
  rare: "border-sky-700 bg-sky-950/30 text-sky-200",
  epic: "border-violet-700 bg-violet-950/30 text-violet-200",
  legendary: "border-amber-500 bg-amber-950/30 text-amber-200",
};

export function itemType(item: ShopItem) {
  const bonus = Number(item.damage_bonus ?? 0) + Number(item.defense_bonus ?? 0) + Number(item.crit_bonus ?? 0);
  return item.item_type ?? (bonus > 0 ? "equipment" : "cosmetic");
}

export function itemSlot(item: ShopItem) {
  return item.battle_slot ?? itemType(item);
}

export function itemRarity(item: ShopItem) {
  return item.rarity ?? (Number(item.price) >= 180 ? "legendary" : Number(item.price) >= 90 ? "epic" : Number(item.price) >= 35 ? "rare" : "common");
}

export function itemEffectText(item: ShopItem) {
  const parts: string[] = [];
  const dmg = Number(item.damage_bonus ?? 0);
  const def = Number(item.defense_bonus ?? 0);
  const crit = Number(item.crit_bonus ?? 0);
  if (dmg > 0) parts.push(`+${Math.round(dmg * 100)}% poder`);
  if (def > 0) parts.push(`+${Math.round(def * 100)}% defesa`);
  if (crit > 0) parts.push(`+${Math.round(crit * 100)}% crítico`);
  if (item.pet_ability) parts.push(item.pet_ability);
  if (item.effect) parts.push(item.effect);
  return parts.join(" · ") || "Visual/colecionável";
}
