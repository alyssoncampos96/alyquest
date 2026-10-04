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
