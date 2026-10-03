"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { arenaMonsterById } from "@/lib/arena";

export async function claimArenaVictory(monsterId: string) {
  const monster = arenaMonsterById(monsterId);
  if (!monster) throw new Error("Monstro indisponível.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  const { data, error } = await supabase.rpc("aq_claim_arena_victory", { p_monster_id: monster.id });
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/arena");
  revalidatePath("/shop");
  return data as { claimed: boolean; xp: number; coins: number; message?: string };
}
