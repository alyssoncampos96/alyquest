import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checked } from "@/lib/query";
import { ItemCard } from "@/components/item-card";
import { itemSlot, slotLabels, type ShopItem } from "@/lib/items";

type OwnedRow = { equipped: boolean; items: ShopItem | ShopItem[] | null };

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: ownedRows }, { data: coinsRows }] = await Promise.all([
    supabase.from("user_items").select("equipped,items(*)").eq("user_id", user.id),
    supabase.from("coin_transactions").select("amount").eq("user_id", user.id),
  ]).then((results) => { results.forEach(checked); return results; });

  const coins = (coinsRows ?? []).reduce((a, r) => a + Number(r.amount), 0);
  const rows = (ownedRows ?? []) as OwnedRow[];
  const owned = rows
    .map((row) => ({ item: Array.isArray(row.items) ? row.items[0] : row.items, equipped: row.equipped }))
    .filter((row) => row.item) as { item: ShopItem; equipped: boolean }[];
  const groups = ["weapon", "armor", "helmet", "boots", "cloak", "accessory", "pet", "consumable", "cosmetic", "theme"];

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md">
        <Link href="/shop" className="text-sm text-violet-300">← Loja</Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">Inventário</h1>
            <p className="mt-1 text-sm text-slate-400">Tudo que você comprou. Equipe ou troque por slot.</p>
          </div>
          <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 font-bold">🪙 {coins}</div>
        </div>
        {!owned.length && <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">Você ainda não comprou itens. Visite a loja para começar.</div>}
        {groups.map((group) => {
          const items = owned.filter((row) => itemSlot(row.item) === group);
          if (!items.length) return null;
          return (
            <section key={group} className="mt-6">
              <h2 className="font-black">{slotLabels[group] ?? group}</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map((row) => <ItemCard key={row.item.id} item={row.item} owned equipped={row.equipped} coins={coins} mode="inventory" />)}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="p-6">Carregando inventário...</main>}><Content /></Suspense>;
}
