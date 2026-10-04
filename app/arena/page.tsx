import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checked } from "@/lib/query";
import { getLevelProgress } from "@/lib/game";
import { ArenaGame } from "@/components/arena-game";

type ArenaItem = { id?: string; name: string; icon: string; damage_bonus: number | string; item_type?: string | null; battle_slot?: string | null; pet_ability?: string | null; rarity?: string | null; effect?: string | null; defense_bonus?: number | string | null; crit_bonus?: number | string | null };

const legacyMonsterMap: Record<string, string> = {
  "training-slime": "level-1-medium",
  "habit-goblin": "level-1-hard",
  "chaos-ogre": "level-2-medium",
  "deadline-dragon": "level-3-boss",
  "level-1-wolf": "level-1-medium",
  "level-1-goblin": "level-1-hard",
  "level-2-ogre": "level-2-medium",
  "level-3-dragon": "level-3-boss",
};

function normalizeArenaVictoryIds(rows: { monster_id: string }[] | null) {
  return [...new Set((rows ?? []).map(row => legacyMonsterMap[row.monster_id] ?? row.monster_id))];
}

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const [xpResult, victoriesResult, consumableUseResult] = await Promise.all([
    supabase.from("xp_transactions").select("amount").eq("user_id", user.id),
    supabase.from("aq_arena_victories").select("monster_id").eq("user_id", user.id),
    supabase.from("aq_consumable_uses").select("item_id").eq("user_id", user.id),
  ]);
  checked(xpResult);
  checked(victoriesResult);

  const equippedWithStats = await supabase
    .from("user_items")
    .select("equipped,items(id,name,icon,damage_bonus,item_type,battle_slot,pet_ability,rarity,effect,defense_bonus,crit_bonus)")
    .eq("user_id", user.id)
    .eq("equipped", true);

  let equippedRows = equippedWithStats.data as { equipped: boolean; items: ArenaItem | ArenaItem[] | null }[] | null;
  if (equippedWithStats.error) {
    const equippedLegacy = await supabase
      .from("user_items")
      .select("equipped,items(id,name,icon,damage_bonus,item_type,battle_slot,pet_ability)")
      .eq("user_id", user.id)
      .eq("equipped", true);
    checked(equippedLegacy);
    equippedRows = equippedLegacy.data as { equipped: boolean; items: ArenaItem | ArenaItem[] | null }[] | null;
  }

  const xpRows = xpResult.data;
  const victories = victoriesResult.data;
  const equipped = equippedRows;
  const xp = (xpRows ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const level = getLevelProgress(xp).level;
  const equippedAll = (equipped ?? []).map(row => Array.isArray(row.items) ? row.items[0] : row.items).filter(Boolean) as ArenaItem[];
  const pets = equippedAll.filter(item => item.item_type === "pet");
  const equippedItems = equippedAll.filter(item => item.item_type !== "pet");
  const usedConsumables = new Set((consumableUseResult.error ? [] : consumableUseResult.data ?? []).map((row) => row.item_id));
  const consumableResult = await supabase
    .from("user_items")
    .select("items(id,name,icon,description,damage_bonus,item_type,battle_slot,rarity,effect,defense_bonus,crit_bonus)")
    .eq("user_id", user.id);
  const consumables = consumableResult.error ? [] : ((consumableResult.data ?? [])
    .map((row) => Array.isArray(row.items) ? row.items[0] : row.items)
    .filter((item) => item && item.item_type === "consumable" && !usedConsumables.has(item.id)) as ArenaItem[]);
  const defeatedMonsterIds = normalizeArenaVictoryIds(victories ?? []);
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">Arena</h1>
            <p className="mt-1 text-sm text-slate-400">Mini game do personagem usando equipamentos e pets da loja.</p>
          </div>
          <Link href="/shop" className="rounded-xl border border-violet-700 px-3 py-2 text-sm font-bold text-violet-200">Loja</Link>
        </div>
        <ArenaGame level={level} equippedItems={equippedItems} pets={pets} consumables={consumables} defeatedMonsterIds={defeatedMonsterIds} />
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="p-6">Carregando arena...</main>}><Content /></Suspense>;
}
