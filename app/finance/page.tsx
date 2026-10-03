import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateRecurringFinance, saveFinanceCard, saveFinanceRecurring, saveFinanceTransaction } from "@/app/finance-actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const monthStart = today.slice(0, 8) + "01";
const categories = ["Alimentação", "Transporte", "Casa", "Saúde", "Lazer", "Educação", "Assinaturas", "Outros"];

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const [cardsResult, txResult, recurringResult] = await Promise.all([
    supabase.from("aq_finance_cards").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("aq_finance_transactions").select("*,card:aq_finance_cards(name)").eq("user_id", user.id).gte("occurred_on", monthStart).order("occurred_on", { ascending: false }).limit(80),
    supabase.from("aq_finance_recurring").select("*").eq("user_id", user.id).eq("active", true).order("start_on", { ascending: false }),
  ]);
  if (cardsResult.error || txResult.error) {
    return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><h1 className="text-2xl font-black">Financeiro</h1><p className="mt-4 rounded-2xl border border-amber-700 bg-amber-950/40 p-4 text-sm text-amber-100">A tela está pronta, mas o banco ainda precisa receber a migração de finanças.</p></div></main>;
  }
  const cards = cardsResult.data ?? [];
  const transactions = txResult.data ?? [];
  const recurring = recurringResult.error ? [] : recurringResult.data ?? [];
  const expense = transactions.filter(t => t.kind === "expense").reduce((n, t) => n + Number(t.amount), 0);
  const income = transactions.filter(t => t.kind === "income").reduce((n, t) => n + Number(t.amount), 0);
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-black">Financeiro</h1>
        <p className="mt-1 text-sm text-slate-400">Controle pessoal, cartões e parcelas.</p>
        <section className="mt-5 grid grid-cols-3 gap-2">
          {[["Entradas", income], ["Saídas", expense], ["Saldo", income - expense]].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
              <p className="text-xs text-slate-400">{label as string}</p>
              <p className="mt-1 text-sm font-bold">{money.format(value as number)}</p>
            </div>
          ))}
        </section>
        <form action={saveFinanceTransaction} className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-bold">Novo lançamento</h2>
          <input name="title" required maxLength={180} placeholder="Descrição" className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input name="amount" required inputMode="decimal" placeholder="Valor" className="rounded-xl border border-slate-700 bg-slate-950 p-3" />
            <input name="occurred_on" required type="date" defaultValue={today} className="rounded-xl border border-slate-700 bg-slate-950 p-3" />
            <select name="kind" defaultValue="expense" className="rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="expense">Despesa</option><option value="income">Receita</option></select>
            <select name="category" defaultValue="Alimentação" className="rounded-xl border border-slate-700 bg-slate-950 p-3">{categories.map(c => <option key={c}>{c}</option>)}</select>
            <select name="payment_method" defaultValue="pix" className="rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="pix">Pix</option><option value="credit">Crédito</option><option value="debit">Débito</option><option value="cash">Dinheiro</option><option value="bank_transfer">Transferência</option><option value="other">Outro</option></select>
            <input name="installments" type="number" min="1" max="120" defaultValue="1" className="rounded-xl border border-slate-700 bg-slate-950 p-3" />
          </div>
          <select name="card_id" defaultValue="" className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Sem cartão</option>{cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <textarea name="notes" placeholder="Observações" className="mt-3 h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" />
          <button className="mt-3 w-full rounded-xl bg-emerald-600 p-3 font-bold">Salvar lançamento</button>
        </form>
        <form action={saveFinanceCard} className="mt-4 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-bold">Cartão</h2>
          <input name="name" required maxLength={80} placeholder="Nome do cartão" className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input name="closing_day" type="number" min="1" max="31" placeholder="Fechamento" className="rounded-xl border border-slate-700 bg-slate-950 p-3" />
            <input name="due_day" type="number" min="1" max="31" placeholder="Vencimento" className="rounded-xl border border-slate-700 bg-slate-950 p-3" />
          </div>
          <button className="mt-3 w-full rounded-xl border border-violet-700 p-3 font-bold text-violet-200">Salvar cartão</button>
        </form>

        <form action={saveFinanceRecurring} className="mt-4 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-bold">Gasto/receita recorrente</h2>
          <p className="mt-1 text-xs text-slate-400">Para despesas fixas, assinaturas, aluguel, salário e outros lançamentos repetidos.</p>
          <input name="title" required maxLength={180} placeholder="Ex.: Netflix, aluguel, salário" className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input name="amount" required inputMode="decimal" placeholder="Valor" className="rounded-xl border border-slate-700 bg-slate-950 p-3" />
            <input name="start_on" required type="date" defaultValue={today} className="rounded-xl border border-slate-700 bg-slate-950 p-3" />
            <select name="kind" defaultValue="expense" className="rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="expense">Despesa</option><option value="income">Receita</option></select>
            <select name="frequency" defaultValue="monthly" className="rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="monthly">1x por mês</option><option value="weekly">Semanal</option><option value="yearly">Anual</option></select>
            <select name="category" defaultValue="Assinaturas" className="rounded-xl border border-slate-700 bg-slate-950 p-3">{categories.map(c => <option key={c}>{c}</option>)}</select>
            <select name="payment_method" defaultValue="credit" className="rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="pix">Pix</option><option value="credit">Crédito</option><option value="debit">Débito</option><option value="cash">Dinheiro</option><option value="bank_transfer">Transferência</option><option value="other">Outro</option></select>
          </div>
          <select name="card_id" defaultValue="" className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Sem cartão</option>{cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <textarea name="notes" placeholder="Observações" className="mt-3 h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" />
          <button className="mt-3 w-full rounded-xl bg-violet-600 p-3 font-bold">Salvar recorrência</button>
        </form>
        <form action={generateRecurringFinance} className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <h2 className="font-bold">Gerar recorrentes</h2>
          <p className="mt-1 text-xs text-slate-400">Cria os lançamentos recorrentes até a data escolhida, sem duplicar meses já gerados.</p>
          <div className="mt-3 flex gap-2"><input name="until" required type="date" defaultValue={today.slice(0, 8) + "28"} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 p-3" /><button className="rounded-xl border border-violet-700 px-4 font-bold text-violet-200">Gerar</button></div>
        </form>
        <section className="mt-5 space-y-2">
          <h2 className="font-bold">Recorrências ativas</h2>
          {recurring.map(r => <article key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{r.title}</h3><p className="mt-1 text-xs text-slate-400">{r.category} · {r.frequency === "monthly" ? "mensal" : r.frequency === "weekly" ? "semanal" : "anual"} · desde {r.start_on}</p></div><p className={r.kind === "expense" ? "font-bold text-rose-300" : "font-bold text-emerald-300"}>{money.format(Number(r.amount))}</p></div></article>)}
          {!recurring.length && <p className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-400">Nenhuma recorrência ativa.</p>}
        </section>
        <section className="mt-5 space-y-2">
          <h2 className="font-bold">Este mês</h2>
          {transactions.map(t => <article key={t.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{t.title}</h3><p className="mt-1 text-xs text-slate-400">{t.category} · {t.occurred_on}{t.installment_count > 1 ? ` · ${t.installment_number}/${t.installment_count}` : ""}</p></div><p className={t.kind === "expense" ? "font-bold text-rose-300" : "font-bold text-emerald-300"}>{money.format(Number(t.amount))}</p></div></article>)}
          {!transactions.length && <p className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-400">Nenhum lançamento neste mês.</p>}
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<main className="p-6">Carregando financeiro...</main>}><Content /></Suspense>;
}
