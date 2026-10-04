"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { flushAllSteps } from "./step-save-registry";

const mainItems = [
  { href: "/", icon: "🏠", label: "Início" },
  { href: "/tasks", icon: "✅", label: "Tarefas" },
  { href: "/workouts", icon: "🏋️", label: "Treinos" },
  { href: "/finance", icon: "💳", label: "Finanças" },
  { href: "/more", icon: "☰", label: "Mais" },
];

const moreItems = [
  { href: "/weekly", icon: "📊", label: "Semana" },
  { href: "/journeys", icon: "🗺️", label: "Jornadas" },
  { href: "/daily", icon: "✨", label: "Diárias" },
  { href: "/streak", icon: "🔥", label: "Streak" },
  { href: "/planning", icon: "🌅", label: "Meu dia" },
  { href: "/review", icon: "🌙", label: "Revisão" },
  { href: "/inbox", icon: "📥", label: "Inbox" },
  { href: "/budget", icon: "💰", label: "Orçamento" },
  { href: "/cards", icon: "💳", label: "Faturas" },
  { href: "/focus", icon: "🍅", label: "Foco" },
  { href: "/fasting", icon: "⏱️", label: "Jejum" },
  { href: "/bosses", icon: "👹", label: "Chefes" },
  { href: "/arena", icon: "⚔️", label: "Arena" },
  { href: "/battle-history", icon: "📜", label: "Batalhas" },
  { href: "/shop", icon: "🛍️", label: "Loja" },
  { href: "/inventory", icon: "🎒", label: "Inventário" },
  { href: "/character", icon: "🧙", label: "Personagem" },
  { href: "/achievements", icon: "🏆", label: "Conquistas" },
  { href: "/themes", icon: "🎨", label: "Temas" },
  { href: "/notifications", icon: "🔔", label: "Lembretes" },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const moreActive = moreItems.some((item) => pathname.startsWith(item.href));

  async function go(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    try { await flushAllSteps(); setError(""); setOpen(false); router.push(href); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar."); }
  }

  return <>
    {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)}><div onClick={(e) => e.stopPropagation()} className="absolute inset-x-3 bottom-24 mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-950 p-3 shadow-2xl"><h2 className="px-2 pb-2 text-sm font-black">Mais atalhos</h2><div className="grid max-h-[62vh] grid-cols-3 gap-2 overflow-y-auto pr-1">{moreItems.map((item) => <Link key={item.href} href={item.href} onClick={(e) => go(e, item.href)} className={`rounded-2xl border p-3 text-center text-xs font-bold ${pathname.startsWith(item.href) ? "border-violet-500 bg-violet-950 text-violet-200" : "border-slate-800 bg-slate-900 text-slate-300"}`}><span className="block text-2xl">{item.icon}</span>{item.label}</Link>)}</div></div></div>}
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-800 bg-[#090b16]/95 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur">{error && <p role="alert" className="mx-auto max-w-md p-2 text-xs text-red-300">{error}</p>}<div className="mx-auto grid max-w-md grid-cols-5 px-2 pt-2">{mainItems.map((item) => { const active = item.href === "/more" ? moreActive || open : item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); if (item.href === "/more") return <button key={item.href} onClick={() => setOpen((value) => !value)} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold ${active ? "text-violet-400" : "text-slate-500"}`}><span className="text-xl">{item.icon}</span>{item.label}</button>; return <Link key={item.href} href={item.href} onClick={(e) => go(e, item.href)} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold ${active ? "text-violet-400" : "text-slate-500"}`}><span className="text-xl">{item.icon}</span>{item.label}</Link>; })}</div></nav>
  </>;
}
