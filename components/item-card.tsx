import { ActionForm } from "@/components/action-form";
import { equipItem, purchaseItem } from "@/app/actions";
import { formatNumber } from "@/lib/game";
import { itemEffectText, itemRarity, itemSlot, itemType, rarityClass, rarityLabels, slotLabels, type ShopItem } from "@/lib/items";

export function ItemCard({ item, owned, equipped, coins, mode = "shop" }: { item: ShopItem; owned: boolean; equipped: boolean; coins: number; mode?: "shop" | "inventory" }) {
  const price = Number(item.price);
  const affordable = coins >= price;
  const type = itemType(item);
  const slot = itemSlot(item);
  const rarity = itemRarity(item);
  const equipable = type === "equipment" || type === "pet";
  return (
    <article className={`rounded-2xl border p-3 ${equipped ? "border-emerald-500 bg-emerald-950/30" : rarityClass[rarity] ?? rarityClass.common}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2"><span className="text-3xl">{item.icon}</span><div><h3 className="text-sm font-black leading-tight">{item.name}</h3><p className="mt-0.5 text-[11px] text-slate-400">{slotLabels[slot] ?? slot} · {rarityLabels[rarity] ?? rarity}</p></div></div>
        {equipped && <span className="rounded-full bg-emerald-700 px-2 py-1 text-[10px] font-bold">ON</span>}
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-slate-300">{item.description}</p>
      <p className="mt-2 rounded-xl bg-slate-950/70 p-2 text-[11px] font-bold text-violet-100">{itemEffectText(item)}</p>
      {mode === "shop" && !owned ? (
        <ActionForm action={purchaseItem.bind(null, item.id)}>
          <button disabled={!affordable} className="mt-3 w-full rounded-xl bg-violet-600 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
            {affordable ? `Comprar · ${formatNumber(price)} 🪙` : `Faltam ${formatNumber(price - coins)} 🪙`}
          </button>
        </ActionForm>
      ) : equipable && owned ? (
        <ActionForm action={equipItem.bind(null, item.id)}>
          <button className={`mt-3 w-full rounded-xl py-2 text-xs font-bold ${equipped ? "bg-emerald-700 text-emerald-100" : "bg-slate-800 text-slate-100"}`}>{equipped ? "Desequipar" : "Equipar"}</button>
        </ActionForm>
      ) : owned ? <p className="mt-3 rounded-xl bg-slate-950/70 py-2 text-center text-xs font-bold text-slate-400">Na coleção</p> : null}
    </article>
  );
}
