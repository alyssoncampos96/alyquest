import { ActionForm } from "@/components/action-form";
import { redirect } from "next/navigation";
import { checked } from "@/lib/query";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { equipItem, purchaseItem } from "@/app/actions";
import { formatNumber } from "@/lib/game";
import Link from "next/link";

type Item = { id: string; name: string; icon: string; description: string; price: number | string; damage_bonus: number | string };

function ItemCard({ item, owned, equipped, coins }: { item: Item; owned: boolean; equipped: boolean; coins: number }) {
  const price = Number(item.price);
  const bonus = Number(item.damage_bonus ?? 0);
  const affordable = coins >= price;
  return (
    <article className={`rounded-2xl border p-4 ${equipped ? "border-emerald-600 bg-emerald-950/30" : "border-slate-700 bg-slate-900"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-3xl">{item.icon}</div>
        {owned && <span className="rounded-full bg-slate-950 px-2 py-1 text-[10px] font-bold text-emerald-200">{equipped ? "Equipado" : "Comprado"}</span>}
      </div>
      <h2 className="mt-2 text-sm font-bold">{item.name}</h2>
      <p className="mt-1 min-h-10 text-xs text-slate-400">{item.description}</p>
      {bonus > 0 ? <p className="mt-2 text-xs font-bold text-emerald-400">+{formatNumber(bonus * 100)}% dano</p> : <p className="mt-2 text-xs font-bold text-violet-300">Decorativo</p>}
      {!owned ? (
        <ActionForm action={purchaseItem.bind(null, item.id)}>
          <button disabled={!affordable} className="mt-3 w-full rounded-xl bg-violet-600 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
            {affordable ? `Comprar · ${formatNumber(price)} 🪙` : `Faltam ${formatNumber(price - coins)} 🪙`}
          </button>
        </ActionForm>
      ) : bonus > 0 ? (
        <ActionForm action={equipItem.bind(null, item.id)}>
          <button className={`mt-3 w-full rounded-xl py-2 text-xs font-bold ${equipped ? "bg-emerald-700 text-emerald-100" : "bg-slate-800"}`}>{equipped ? "Equipado ✓" : "Equipar"}</button>
        </ActionForm>
      ) : <p className="mt-3 rounded-xl bg-slate-950 py-2 text-center text-xs font-bold text-slate-400">Na coleção</p>}
    </article>
  );
}

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const [{ data: items }, { data: owned }, { data: coinsRows }] = await Promise.all([
    supabase.from("items").select("*").order("price", { ascending: true }),
    supabase.from("user_items").select("item_id,equipped").eq("user_id", user.id),
    supabase.from("coin_transactions").select("amount").eq("user_id", user.id),
  ]).then(results => { results.forEach(checked); return results; });
  const coins = (coinsRows ?? []).reduce((a, r) => a + Number(r.amount), 0);
  const ownership = new Map((owned ?? []).map(r => [r.item_id, r.equipped]));
  const shopItems = (items ?? []) as Item[];
  const equipment = shopItems.filter(item => Number(item.damage_bonus ?? 0) > 0);
  const cosmetics = shopItems.filter(item => Number(item.damage_bonus ?? 0) <= 0);
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Loja</h1>
            <p className="mt-1 text-sm text-slate-400">Troque moedas por equipamentos e colecionáveis.</p>
          </div>
          <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2">🪙 {formatNumber(coins)}</div>
        </div>
        <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-bold">Como ganhar moedas</h2>
          <p className="mt-1 text-sm text-slate-400">Conclua missões, focos, jejuns e resgate conquistas desbloqueadas.</p>
          <Link href="/achievements" className="mt-3 block rounded-xl bg-violet-600 px-4 py-3 text-center text-sm font-bold">🏆 Ver conquistas para resgatar</Link>
        </section>
        <section className="mt-6">
          <h2 className="font-bold">Equipamentos</h2>
          <p className="mt-1 text-xs text-slate-400">Itens equipados aumentam o dano contra chefes. O bônus total segue limitado na tela de chefes.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">{equipment.map(item => <ItemCard key={item.id} item={item} owned={ownership.has(item.id)} equipped={ownership.get(item.id) === true} coins={coins} />)}</div>
        </section>
        {!!cosmetics.length && <section className="mt-6">
          <h2 className="font-bold">Colecionáveis</h2>
          <p className="mt-1 text-xs text-slate-400">Itens para dar mais cara de jogo ao seu personagem.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">{cosmetics.map(item => <ItemCard key={item.id} item={item} owned={ownership.has(item.id)} equipped={ownership.get(item.id) === true} coins={coins} />)}</div>
        </section>}
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="p-6">Carregando...</main>}><Content /></Suspense>;
}
