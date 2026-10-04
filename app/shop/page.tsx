import { redirect } from "next/navigation";
import { checked } from "@/lib/query";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/game";
import Link from "next/link";
import { ItemCard } from "@/components/item-card";
import { itemSlot, itemType, type ShopItem } from "@/lib/items";
import { buyArenaPotionForm } from "@/app/arena-actions";
import { ActionForm } from "@/components/action-form";

type UserItem = { item_id: string; equipped: boolean };

function Section({ title, description, items, ownership, coins }: { title: string; description: string; items: ShopItem[]; ownership: Map<string, boolean>; coins: number }) {
  if (!items.length) return null;
  return <section className="mt-6"><h2 className="font-black">{title}</h2><p className="mt-1 text-xs text-slate-400">{description}</p><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{items.map(item => <ItemCard key={item.id} item={item} owned={ownership.has(item.id)} equipped={ownership.get(item.id) === true} coins={coins} />)}</div></section>;
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
  const ownership = new Map(((owned ?? []) as UserItem[]).map(r => [r.item_id, r.equipped]));
  const shopItems = (items ?? []) as ShopItem[];
  const weapons = shopItems.filter(item => itemType(item) === "equipment" && itemSlot(item) === "weapon");
  const armor = shopItems.filter(item => itemType(item) === "equipment" && ["armor", "helmet"].includes(itemSlot(item)));
  const mobility = shopItems.filter(item => itemType(item) === "equipment" && ["boots", "cloak"].includes(itemSlot(item)));
  const accessories = shopItems.filter(item => itemType(item) === "equipment" && itemSlot(item) === "accessory");
  const pets = shopItems.filter(item => itemType(item) === "pet");
  const consumables = shopItems.filter(item => itemType(item) === "consumable");
  const cosmetics = shopItems.filter(item => ["cosmetic", "theme"].includes(itemType(item)));
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between gap-3">
          <div><h1 className="text-2xl font-black">Loja</h1><p className="mt-1 text-sm text-slate-400">Itens por categoria, raridade e efeito.</p></div>
          <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 font-bold">🪙 {formatNumber(coins)}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2"><Link href="/inventory" className="rounded-xl border border-violet-700 px-3 py-3 text-center text-sm font-bold text-violet-200">🎒 Inventário</Link><Link href="/character" className="rounded-xl border border-violet-700 px-3 py-3 text-center text-sm font-bold text-violet-200">🧙 Personagem</Link></div>
        <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-4"><h2 className="font-bold">Como ganhar moedas</h2><p className="mt-1 text-sm text-slate-400">Conclua missões, focos, jejuns, vença monstros e resgate conquistas.</p><Link href="/achievements" className="mt-3 block rounded-xl bg-violet-600 px-4 py-3 text-center text-sm font-bold">🏆 Ver conquistas</Link></section>
        <Section title="Armas" description="Aumentam dano e deixam a Arena mais rápida." items={weapons} ownership={ownership} coins={coins} />
        <Section title="Armaduras e elmos" description="Aumentam defesa e ajudam em chefes difíceis." items={armor} ownership={ownership} coins={coins} />
        <Section title="Botas e capas" description="Bônus híbridos para sobreviver em fases longas." items={mobility} ownership={ownership} coins={coins} />
        <Section title="Acessórios" description="Pequenos bônus de dano, defesa ou crítico." items={accessories} ownership={ownership} coins={coins} />
        <Section title="Pets" description="Companheiros que ajudam nas batalhas." items={pets} ownership={ownership} coins={coins} />
        <section className="mt-6 rounded-2xl border border-emerald-700 bg-slate-900 p-4">
          <h2 className="font-black">🧪 Poção de vida</h2>
          <p className="mt-1 text-sm text-slate-300">Recupera 25 HP na Arena. Seu HP também regenera 1 ponto por hora.</p>
          <ActionForm action={buyArenaPotionForm} className="mt-3"><button disabled={coins<10} className="w-full rounded-xl bg-emerald-700 p-3 font-bold disabled:opacity-50">Comprar poção · 10 🪙</button></ActionForm>
          <Link href="/arena" className="mt-2 block text-center text-sm text-emerald-300">Ver HP e usar na Arena →</Link>
        </section>
        <Section title="Consumíveis" description="Boosts de batalha e outros itens colecionáveis." items={consumables} ownership={ownership} coins={coins} />
        <Section title="Cosméticos e temas" description="Itens visuais para dar personalidade ao AlyQuest." items={cosmetics} ownership={ownership} coins={coins} />
      </div>
    </main>
  );
}

export default function Page() { return <Suspense fallback={<main className="p-6">Carregando loja...</main>}><Content /></Suspense>; }
