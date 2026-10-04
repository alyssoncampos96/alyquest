import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checked } from "@/lib/query";
import { getLevelProgress, formatNumber } from "@/lib/game";
import { itemEffectText, itemSlot, slotLabels, type ShopItem } from "@/lib/items";

type OwnedRow = { equipped: boolean; pet_xp?: number; pet_level?: number; items: ShopItem | ShopItem[] | null };
const slots = ["weapon", "armor", "helmet", "boots", "cloak", "accessory", "pet"];

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [xpResult, coinResult, ownedResult, victoryResult, profileResult] = await Promise.all([
    supabase.from("xp_transactions").select("amount,reason,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("coin_transactions").select("amount").eq("user_id", user.id),
    supabase.from("user_items").select("equipped,pet_xp,pet_level,items(*)").eq("user_id", user.id).eq("equipped", true),
    supabase.from("aq_arena_victories").select("monster_id,defeated_at,reward_xp,reward_coins").eq("user_id", user.id).order("defeated_at", { ascending: false }).limit(5),
    supabase.from("profiles").select("current_streak").eq("user_id", user.id).maybeSingle(),
  ]);
  [xpResult, coinResult, ownedResult, victoryResult, profileResult].forEach(checked);

  const xp = (xpResult.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const coins = (coinResult.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const progress = getLevelProgress(xp);
  const ownedRows = (ownedResult.data ?? []) as OwnedRow[];
  const petProgress = ownedRows.find(row => { const item = Array.isArray(row.items) ? row.items[0] : row.items; return item?.item_type === "pet"; });
  const equipped = ownedRows.map((row) => Array.isArray(row.items) ? row.items[0] : row.items).filter(Boolean) as ShopItem[];
  const power = equipped.reduce((sum, item) => sum + Number(item.damage_bonus ?? 0), 0);
  const defense = equipped.reduce((sum, item) => sum + Number(item.defense_bonus ?? 0), 0);
  const crit = equipped.reduce((sum, item) => sum + Number(item.crit_bonus ?? 0), 0);

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-black">Meu Personagem</h1><p className="mt-1 text-sm text-slate-400">Nível, atributos, itens e histórico.</p></div>
          <Link href="/inventory" className="rounded-xl border border-violet-700 px-3 py-2 text-sm font-bold text-violet-200">🎒 Inventário</Link>
        </div>
        <section className="mt-5 overflow-hidden rounded-3xl border border-violet-800 bg-gradient-to-br from-slate-900 to-violet-950">
          <div className="p-5 text-center">
            <div className="text-7xl">🧙🏻‍♂️</div>
            <h2 className="mt-2 text-xl font-black">Aly · Nv. {progress.level}</h2>
            <p className="mt-1 text-sm text-slate-300">🪙 {formatNumber(coins)} · 🔥 {profileResult.data?.current_streak ?? 0} dias de sequência</p>
            <div className="mt-4 h-3 rounded-full bg-slate-950"><div className="h-3 rounded-full bg-violet-500" style={{ width: `${progress.progressPercent}%` }} /></div>
            <p className="mt-1 text-xs text-slate-400">{formatNumber(progress.xpIntoLevel)} / {formatNumber(progress.requirement)} XP para o próximo nível</p>
          </div>
          {petProgress && <div className="border-t border-violet-900 p-3 text-center text-sm">🐾 Pet ativo · nível {petProgress.pet_level ?? 1} · {petProgress.pet_xp ?? 0} XP</div>}
          <div className="grid grid-cols-3 border-t border-violet-900 text-center text-xs">
            <div className="p-3"><p className="text-slate-400">Poder</p><p className="font-black">+{Math.round(power * 100)}%</p></div>
            <div className="border-x border-violet-900 p-3"><p className="text-slate-400">Defesa</p><p className="font-black">+{Math.round(defense * 100)}%</p></div>
            <div className="p-3"><p className="text-slate-400">Crítico</p><p className="font-black">+{Math.round(crit * 100)}%</p></div>
          </div>
        </section>
        <section className="mt-6">
          <h2 className="font-black">Equipamentos</h2>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {slots.map((slot) => {
              const item = equipped.find((candidate) => itemSlot(candidate) === slot);
              return (
                <div key={slot} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3">
                  <div><p className="text-xs text-slate-400">{slotLabels[slot]}</p><p className="font-bold">{item ? `${item.icon} ${item.name}` : "Vazio"}</p>{item && <p className="mt-1 text-xs text-violet-200">{itemEffectText(item)}</p>}</div>
                  {!item && <Link href="/shop" className="text-xs text-violet-300">Comprar</Link>}
                </div>
              );
            })}
          </div>
        </section>
        <section className="mt-6">
          <h2 className="font-black">Histórico recente</h2>
          <div className="mt-3 space-y-2">
            {(victoryResult.data ?? []).map((row) => <div key={`${row.monster_id}-${row.defeated_at}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm"><p className="font-bold">⚔️ {row.monster_id}</p><p className="mt-1 text-xs text-slate-400">+{row.reward_xp} XP · +{row.reward_coins} moeda · {new Date(row.defeated_at).toLocaleDateString("pt-BR")}</p></div>)}
            {!(victoryResult.data ?? []).length && <p className="text-sm text-slate-400">As batalhas vencidas aparecerão aqui.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="p-6">Carregando personagem...</main>}><Content /></Suspense>;
}
