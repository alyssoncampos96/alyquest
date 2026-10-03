"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAchievementState } from "@/lib/achievement-server";

function refresh() {
  revalidatePath("/");
  revalidatePath("/achievements");
  revalidatePath("/shop");
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  return { supabase, user };
}

export async function claimAchievement(code: string) {
  const { supabase, user } = await requireUser();
  const { achievements } = await loadAchievementState(supabase, user.id);
  const achievement = achievements.find(item => item.code === code);
  if (!achievement || !achievement.unlocked) throw new Error("Conquista ainda não desbloqueada.");
  if (achievement.claimed) return;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("aq_claim_achievement_reward", {
    p_user_id: user.id,
    p_code: achievement.code,
    p_reward_xp: achievement.rewardXp,
    p_reward_coins: achievement.rewardCoins,
  });
  if (error) throw new Error(error.message);
  refresh();
  void data;
}

export async function claimAllAchievements() {
  const { supabase, user } = await requireUser();
  const { achievements } = await loadAchievementState(supabase, user.id);
  const unlocked = achievements.filter(item => item.unlocked && !item.claimed);
  const admin = createAdminClient();
  let claimed = 0;
  let xp = 0;
  let coins = 0;
  for (const achievement of unlocked) {
    const { data, error } = await admin.rpc("aq_claim_achievement_reward", {
      p_user_id: user.id,
      p_code: achievement.code,
      p_reward_xp: achievement.rewardXp,
      p_reward_coins: achievement.rewardCoins,
    });
    if (error) throw new Error(error.message);
    const result = data as { claimed?: boolean; xp?: number; coins?: number } | null;
    if (result?.claimed) {
      claimed += 1;
      xp += Number(result.xp ?? 0);
      coins += Number(result.coins ?? 0);
    }
  }
  refresh();
  void claimed;
  void xp;
  void coins;
}
