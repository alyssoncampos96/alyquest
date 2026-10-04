"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { arenaMonsterById } from "@/lib/arena";

export async function claimArenaVictory(monsterId: string, battle?: Record<string, unknown>, consumableItemId?: string | null) {
  const monster = arenaMonsterById(monsterId);
  if (!monster) throw new Error("Monstro indisponível.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  const { data, error } = await supabase.rpc("aq_claim_arena_victory_detail", { p_monster_id: monster.id, p_battle: battle ?? {}, p_consumable_item_id: consumableItemId || null });
  if (error && ["42883", "PGRST202"].includes(error.code ?? "")) {
    const fallback = await supabase.rpc("aq_claim_arena_victory", { p_monster_id: monster.id });
    if (fallback.error) throw new Error(fallback.error.message);
    revalidatePath("/");
    revalidatePath("/arena");
    revalidatePath("/shop");
    return fallback.data as { claimed: boolean; xp: number; coins: number; message?: string; pet_xp?: number };
  }
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/arena");
  revalidatePath("/shop");
  revalidatePath("/character");
  return data as { claimed: boolean; xp: number; coins: number; message?: string; battle_id?: string; pet_xp?: number };
}

async function arenaRpc<T>(name: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre novamente para continuar.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === "P0001" ? error.message : "Não foi possível atualizar o HP da Arena.");
  revalidatePath("/arena");
  revalidatePath("/shop");
  return data as T;
}

export type ArenaHealth = { current_hp: number; max_hp: number; next_hp_at: string | null; potions?: number };
export async function getArenaHealth(maxHp: number) {
  return arenaRpc<ArenaHealth>("aq_arena_health_snapshot", { p_max_hp: maxHp });
}
export async function takeArenaDamage(maxHp: number, damage: number) {
  return arenaRpc<ArenaHealth>("aq_arena_take_damage", { p_max_hp: maxHp, p_damage: damage });
}
export async function buyArenaPotion() {
  return arenaRpc<number>("aq_buy_arena_potion", {});
}
export async function buyArenaPotionForm() {
  await buyArenaPotion();
}
export async function drinkArenaPotion(maxHp: number) {
  return arenaRpc<ArenaHealth>("aq_use_arena_potion", { p_max_hp: maxHp });
}
