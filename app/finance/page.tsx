export const instant = false;

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateRecurringFinance, saveFinanceCard, saveFinanceRecurring, saveFinanceTransaction, updateFinanceTransaction } from "@/app/finance-actions";
import { financeCategories, money, saoDate } from "@/lib/life-dashboard";

const field = "min-w-0 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400 [color-scheme:dark]";
const methods: Record<string, string> = { pix: "Pix", credit: "Crédito", debit: "Débito", cash: "Dinheiro", bank_transfer: "Transferência", other: "Outro" };
const icons: Record<string, string> = { "Alimentação": "🍽️", Transporte: "🚗", Casa: "🏠", "Saúde": "💚", Lazer: "🎟️", "Educação": "📚", Assinaturas: "🔁", Outros: "◈" };
type Card = { id: string; name: string; closing_day: number | null; due_day: number | null };
type Entry = { id: string; title: string; amount: number | string; kind: string; category: string; occurred_on: string; payment_method: string; installment_number: number; installment_count: number; card_id: string | null; notes: string };
type Recurring = { id: string; title: string; amount: number | string; frequency: string };
type Filters = { month?: string; kind?: string; category?: string; q?: string };

function shiftMonth(month: string, step: number) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + step, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthName(month: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
}
function dateName(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
function Selects({ category, method, cardId, cards }: { category: string; method: string; cardId: string | null; cards: Card[] }) {
  return <>
    <label className="min-w-0 text-xs text-slate-300">Categoria<select name="category" defaultValue={category} className={`mt-1 ${field}`}>{financeCategories.map(c => <option key={c}>{c}</option>)}</select></label>
    <label className="min-w-0 text-xs text-slate-300">Pagamento<select name="payment_method" defaultValue={method} className={`mt-1 ${field}`}>{Object.entries(methods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="block text-xs text-slate-300">Cartão<select name="card_id" defaultValue={cardId ?? ""} className={`mt-1 ${field}`}><option value="">Sem cartão</option>{cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  </>;
}
function EditEntry({ entry: t, cards }: { entry: Entry; cards: Card[] }) {
  return <details className="mt-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
    <summary className="cursor-pointer text-sm font-bold text-emerald-300">Editar lançamento</summary>
    <form action={updateFinanceTransaction} className="mt-4 space-y-3">
      <input type="hidden" name="id" value={t.id}/>
      {t.installment_count > 1 && <p className="rounded-xl bg-amber-950/50 p-2 text-xs text-amber-200">A edição altera apenas a parcela {t.installment_number}/{t.installment_count}.</p>}
      <label className="block text-xs text-slate-300">Descrição<input name="title" required maxLength={180} defaultValue={t.title} className={`mt-1 ${field}`}/></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0 text-xs text-slate-300">Valor (R$)<input name="amount" required inputMode="decimal" defaultValue={String(t.amount).replace(".", ",")} className={`mt-1 ${field}`}/></label>
        <label className="min-w-0 text-xs text-slate-300">Data<input name="occurred_on" required type="date" defaultValue={t.occurred_on} className={`mt-1 ${field}`}/></label>
        <label className="min-w-0 text-xs text-slate-300">Tipo<select name="kind" defaultValue={t.kind} className={`mt-1 ${field}`}><option value="expense">Despesa</option><option value="income">Receita</option></select></label>
        <Selects category={t.category} method={t.payment_method} cardId={t.card_id} cards={cards}/>
      </div>
      <label className="block text-xs text-slate-300">Observações<textarea name="notes" rows={2} defaultValue={t.notes} className={`mt-1 ${field}`}/></label>
      <button className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Salvar alterações</button>
    </form>
  </details>;
}
function EntryCard({ entry: t, cards, today }: { entry: Entry; cards: Card[]; today: string }) {
  return <article className="rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-800 text-xl" aria-hidden>{icons[t.category] ?? "◈"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2"><h4 className="break-words font-bold">{t.title}</h4><b className={`shrink-0 text-sm sm:text-base ${t.kind === "expense" ? "text-rose-300" : "text-emerald-300"}`}>{t.kind === "expense" ? "−" : "+"}{money.format(Number(t.amount))}</b></div>
        <p className="mt-1 text-xs text-slate-400">{t.category} · {methods[t.payment_method] ?? "Outro"}{t.installment_count > 1 ? ` · parcela ${t.installment_number}/${t.installment_count}` : ""}{t.card_id ? ` · ${cards.find(c => c.id === t.card_id)?.name ?? "Cartão"}` : ""}{t.occurred_on > today ? " · previsto" : ""}</p>
      </div>
    </div>
    <EditEntry entry={t} cards={cards}/>
  </article>;
}
async function Content({ filters }: { filters: Filters }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const today = saoDate();
  const month = typeof filters.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(filters.month) ? filters.month : today.slice(0, 7);
  const nextMonth = shiftMonth(month, 1);
  const [cardsResult, txResult, recurringResult] = await Promise.all([
    supabase.from("aq_finance_cards").select("id,name,closing_day,due_day").eq("user_id", user.id).order("created_at"),
    supabase.from("aq_finance_transactions").select("id,title,amount,kind,category,occurred_on,payment_method,installment_number,installment_count,card_id,notes").eq("user_id", user.id).gte("occurred_on", `${month}-01`).lt("occurred_on", `${nextMonth}-01`).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(500),
    supabase.from("aq_finance_recurring").select("id,title,amount,frequency").eq("user_id", user.id).eq("active", true).order("start_on", { ascending: false }),
  ]);
  if (cardsResult.error || txResult.error) return <main className="px-4 pb-28 pt-6"><div className="mx-auto max-w-5xl rounded-2xl border border-amber-800 p-4 text-amber-100">Não foi possível carregar as finanças agora. Tente atualizar a página.</div></main>;
  const cards = (cardsResult.data ?? []) as Card[];
  const transactions = (txResult.data ?? []) as Entry[];
  const recurring = (recurringResult.data ?? []) as Recurring[];
  const income = transactions.filter(t => t.kind === "income").reduce((total, t) => total + Number(t.amount), 0);
  const expense = transactions.filter(t => t.kind === "expense").reduce((total, t) => total + Number(t.amount), 0);
  const credit = transactions.filter(t => t.kind === "expense" && t.payment_method === "credit").reduce((total, t) => total + Number(t.amount), 0);
  const kind = filters.kind === "expense" || filters.kind === "income" ? filters.kind : "all";
  const category = financeCategories.includes(filters.category ?? "") ? filters.category : "all";
  const search = typeof filters.q === "string" ? filters.q.slice(0, 80) : "";
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const visible = transactions.filter(t => (kind === "all" || t.kind === kind) && (category === "all" || t.category === category) && (!query || t.title.toLocaleLowerCase("pt-BR").includes(query)));
  const grouped = new Map<string, Entry[]>();
  for (const entry of visible) grouped.set(entry.occurred_on, [...(grouped.get(entry.occurred_on) ?? []), entry]);

  return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-300">Seu dinheiro, sem mistério</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">Finanças pessoais</h1><p className="mt-2 max-w-lg text-sm text-slate-400">Acompanhe o mês, encontre cada lançamento e ajuste o que precisar.</p></div><a href="#novo-lancamento" className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/40">+ Novo lançamento</a></header>
    <section className="overflow-hidden rounded-[2rem] border border-emerald-700/60 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-5 shadow-2xl shadow-black/20 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-200">Movimento previsto em {monthName(month)}</p><p className={`mt-2 text-4xl font-black tracking-tight ${income - expense < 0 ? "text-rose-300" : "text-white"}`}>{money.format(income - expense)}</p><p className="mt-2 text-xs text-slate-300">Inclui lançamentos futuros e parcelas programadas; não é saldo bancário.</p></div><div className="flex items-center gap-2 text-sm"><Link href={`/finance?month=${shiftMonth(month, -1)}`} aria-label="Mês anterior" className="rounded-xl border border-white/20 px-3 py-2 hover:bg-white/10">←</Link><span className="min-w-28 text-center font-bold capitalize">{monthName(month)}</span><Link href={`/finance?month=${nextMonth}`} aria-label="Próximo mês" className="rounded-xl border border-white/20 px-3 py-2 hover:bg-white/10">→</Link></div></div>
      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4"><div className="rounded-2xl bg-white/5 p-3 sm:p-4"><p className="text-xs text-slate-300">Entradas</p><p className="mt-1 text-sm font-black text-emerald-300 sm:text-xl">{money.format(income)}</p></div><div className="rounded-2xl bg-white/5 p-3 sm:p-4"><p className="text-xs text-slate-300">Saídas</p><p className="mt-1 text-sm font-black text-rose-300 sm:text-xl">{money.format(expense)}</p></div><div className="rounded-2xl bg-white/5 p-3 sm:p-4"><p className="text-xs text-slate-300">No crédito</p><p className="mt-1 text-sm font-black text-white sm:text-xl">{money.format(credit)}</p></div></div>
    </section>
    <nav className="grid grid-cols-2 gap-3"><Link href="/budget" className="rounded-2xl border border-slate-700 bg-slate-900 p-4 hover:border-emerald-500"><span className="text-xl">🎯</span><b className="mt-2 block">Orçamento</b><span className="text-xs text-slate-400">Limites por categoria</span></Link><Link href="/cards" className="rounded-2xl border border-slate-700 bg-slate-900 p-4 hover:border-emerald-500"><span className="text-xl">💳</span><b className="mt-2 block">Faturas</b><span className="text-xs text-slate-400">Cartões e parcelas</span></Link></nav>
    <section id="lancamentos" className="scroll-mt-6"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Extrato</p><h2 className="mt-1 text-2xl font-black">Lançamentos</h2></div><span className="text-sm text-slate-400">{visible.length} de {transactions.length} em {monthName(month)}</span></div>
      <form action="/finance#lancamentos" method="get" className="mt-4 grid gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:grid-cols-[1fr_1fr_1fr_1.5fr_auto]"><label className="text-xs text-slate-400">Mês<input name="month" type="month" defaultValue={month} className={`mt-1 ${field}`}/></label><label className="text-xs text-slate-400">Tipo<select name="kind" defaultValue={kind} className={`mt-1 ${field}`}><option value="all">Todos</option><option value="expense">Despesas</option><option value="income">Receitas</option></select></label><label className="text-xs text-slate-400">Categoria<select name="category" defaultValue={category} className={`mt-1 ${field}`}><option value="all">Todas</option>{financeCategories.map(c => <option key={c}>{c}</option>)}</select></label><label className="text-xs text-slate-400">Buscar<input name="q" defaultValue={search} maxLength={80} placeholder="Descrição" className={`mt-1 ${field}`}/></label><button className="self-end rounded-xl bg-slate-700 px-5 py-3 text-sm font-bold hover:bg-slate-600">Filtrar</button></form>
      <div className="mt-5 space-y-6">{[...grouped].map(([date, rows]) => <div key={date}><h3 className="mb-2 text-sm font-bold capitalize text-slate-300">{dateName(date)}</h3><div className="space-y-2">{rows.map(t => <EntryCard key={t.id} entry={t} cards={cards} today={today}/>)}</div></div>)}{!visible.length && <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center"><p className="text-3xl">📒</p><p className="mt-2 font-bold">Nenhum lançamento encontrado</p><p className="mt-1 text-sm text-slate-400">Experimente outro mês ou remova os filtros.</p><Link href={`/finance?month=${month}#lancamentos`} className="mt-4 inline-block rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold">Limpar filtros</Link></div>}</div>
      {transactions.length === 500 && <p className="mt-4 text-xs text-amber-300">Exibindo os 500 lançamentos mais recentes deste mês.</p>}
    </section>
    <section id="novo-lancamento" className="scroll-mt-6 rounded-3xl border border-emerald-800/60 bg-slate-900 p-5"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Registrar</p><h2 className="mt-1 text-xl font-black">Novo lançamento</h2><form action={saveFinanceTransaction} className="mt-5 space-y-3"><label className="block text-xs text-slate-300">Descrição<input name="title" required maxLength={180} placeholder="Ex.: almoço, mercado, salário" className={`mt-1 ${field}`}/></label><div className="grid grid-cols-2 gap-2"><label className="min-w-0 text-xs text-slate-300">Valor (R$)<input name="amount" required inputMode="decimal" placeholder="0,00" className={`mt-1 ${field}`}/></label><label className="min-w-0 text-xs text-slate-300">Data<input name="occurred_on" required type="date" defaultValue={today} className={`mt-1 ${field}`}/></label><label className="min-w-0 text-xs text-slate-300">Tipo<select name="kind" defaultValue="expense" className={`mt-1 ${field}`}><option value="expense">Despesa</option><option value="income">Receita</option></select></label><Selects category="Alimentação" method="pix" cardId={null} cards={cards}/><label className="min-w-0 text-xs text-slate-300">Parcelas<input name="installments" type="number" min="1" max="120" defaultValue="1" className={`mt-1 ${field}`}/></label></div><label className="block text-xs text-slate-300">Observações<textarea name="notes" rows={2} className={`mt-1 ${field}`}/></label><button className="w-full rounded-xl bg-emerald-500 p-3 font-black text-slate-950">Salvar lançamento</button></form></section>
    <details className="rounded-3xl border border-slate-800 bg-slate-900 p-5"><summary className="cursor-pointer font-bold">💳 Gerenciar cartões ({cards.length})</summary><div className="mt-3 space-y-2 text-sm text-slate-300">{cards.map(c => <p key={c.id}>{c.name} · fecha dia {c.closing_day ?? "—"} · vence dia {c.due_day ?? "—"}</p>)}</div><form action={saveFinanceCard} className="mt-4 space-y-2"><input name="name" required maxLength={80} placeholder="Nome do cartão" className={field}/><div className="grid grid-cols-2 gap-2"><input name="closing_day" type="number" min="1" max="31" placeholder="Fechamento" className={field}/><input name="due_day" type="number" min="1" max="31" placeholder="Vencimento" className={field}/></div><button className="w-full rounded-xl border border-emerald-700 p-3 font-bold text-emerald-200">Salvar cartão</button></form></details>
    <details className="rounded-3xl border border-slate-800 bg-slate-900 p-5"><summary className="cursor-pointer font-bold">🔁 Gastos e receitas recorrentes ({recurring.length})</summary><div className="mt-3 space-y-2">{recurring.map(r => <p key={r.id} className="flex justify-between gap-2 text-sm"><span>{r.title} · {r.frequency === "monthly" ? "mensal" : r.frequency === "weekly" ? "semanal" : "anual"}</span><b>{money.format(Number(r.amount))}</b></p>)}</div><form action={saveFinanceRecurring} className="mt-4 space-y-2"><input name="title" required maxLength={180} placeholder="Ex.: aluguel" className={field}/><div className="grid grid-cols-2 gap-2"><input name="amount" required inputMode="decimal" placeholder="Valor" className={field}/><input name="start_on" required type="date" defaultValue={today} className={field}/><select name="kind" defaultValue="expense" className={field}><option value="expense">Despesa</option><option value="income">Receita</option></select><select name="frequency" defaultValue="monthly" className={field}><option value="monthly">Mensal</option><option value="weekly">Semanal</option><option value="yearly">Anual</option></select><select name="category" defaultValue="Assinaturas" className={field}>{financeCategories.map(c => <option key={c}>{c}</option>)}</select><select name="payment_method" defaultValue="credit" className={field}>{Object.entries(methods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><select name="card_id" defaultValue="" className={field}><option value="">Sem cartão</option>{cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><textarea name="notes" placeholder="Observações" className={`${field} h-20`}/><button className="w-full rounded-xl bg-emerald-600 p-3 font-bold">Salvar recorrência</button></form><form action={generateRecurringFinance} className="mt-4 border-t border-slate-800 pt-4"><p className="text-xs text-slate-400">Gerar lançamentos pendentes até:</p><div className="mt-2 flex gap-2"><input name="until" required type="date" defaultValue={`${today.slice(0, 8)}28`} className={field}/><button className="rounded-xl border border-emerald-700 px-4 text-sm font-bold">Gerar</button></div></form></details>
  </div></main>;
}
export default async function Page({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;
  return <Suspense fallback={<main className="p-6">Carregando financeiro...</main>}><Content filters={filters}/></Suspense>;
}
