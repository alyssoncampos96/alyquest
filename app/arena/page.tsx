import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checked } from "@/lib/query";
import { getLevelProgress } from "@/lib/game";
import { ArenaGame } from "@/components/arena-game";

type ArenaItem = { name: string; icon: string; damage_bonus: number | string; item_type?: string | null; battle_slot?: string | null; pet_ability?: string | null };

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const [{ data: xpRows }, { data: equipped }, { data: victories }] = await Promise.all([
    supabase.from("xp_transactions").select("amount").eq("user_id", user.id),
    supabase.from("user_items").select("equipped,items(name,icon,damage_bonus,item_type,battle_slot,pet_ability)").eq("user_id", user.id).eq("equipped", true),
    supabase.from("aq_arena_victories").select("monster_id").eq("user_id", user.id),
  ]).then(results => { results.forEach(checked); return results; });
  const xp = (xpRows ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const level = getLevelProgress(xp).level;
  const equippedAll = (equipped ?? []).map(row => Array.isArray(row.items) ? row.items[0] : row.items).filter(Boolean) as ArenaItem[];
  const pets = equippedAll.filter(item => item.item_type === "pet");
  const equippedItems = equippedAll.filter(item => item.item_type !== "pet");
  const defeatedMonsterIds = [...new Set((victories ?? []).map(row => row.monster_id as string))];
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
        <ArenaGame level={level} equippedItems={equippedItems} pets={pets} defeatedMonsterIds={defeatedMonsterIds} />
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="p-6">Carregando arena...</main>}><Content /></Suspense>;
}
