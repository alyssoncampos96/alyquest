"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const categories = ["Alimentação", "Transporte", "Casa", "Saúde", "Lazer", "Educação", "Assinaturas", "Outros"];
const methods = ["cash", "pix", "debit", "credit", "bank_transfer", "other"];

async function invoke(name: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre novamente para continuar.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === "P0001" ? error.message : "Não foi possível salvar.");
  revalidatePath("/");
  revalidatePath("/finance");
  revalidatePath("/achievements");
  return data;
}

export async function saveFinanceCard(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const closing = Number(form.get("closing_day") || 0) || null;
  const due = Number(form.get("due_day") || 0) || null;
  await invoke("aq_finance_save_card", { p_id: null, p_name: name, p_closing_day: closing, p_due_day: due });
}

export async function saveFinanceTransaction(form: FormData) {
  const title = String(form.get("title") ?? "").trim();
  const amount = Number(String(form.get("amount") ?? "").replace(",", "."));
  const kind = String(form.get("kind") ?? "expense");
  const category = String(form.get("category") ?? "Outros");
  const occurred = String(form.get("occurred_on") ?? "");
  const method = String(form.get("payment_method") ?? "pix");
  const installments = Number(form.get("installments") ?? 1);
  const cardId = String(form.get("card_id") ?? "") || null;
  if (!title || !Number.isFinite(amount) || amount <= 0 || !["expense", "income"].includes(kind) || !categories.includes(category) || !methods.includes(method) || !/^\d{4}-\d{2}-\d{2}$/.test(occurred)) {
    throw new Error("Confira os dados do lançamento.");
  }
  await invoke("aq_finance_add_transaction", {
    p_title: title,
    p_amount: amount,
    p_kind: kind,
    p_category: category,
    p_occurred_on: occurred,
    p_payment_method: method,
    p_card_id: cardId,
    p_installments: Number.isFinite(installments) && installments > 0 ? installments : 1,
    p_notes: String(form.get("notes") ?? "").slice(0, 1000),
    p_source: "manual",
  });
}

export async function updateFinanceTransaction(form: FormData) {
  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const amount = Number(String(form.get("amount") ?? "").replace(",", "."));
  const kind = String(form.get("kind") ?? "expense");
  const category = String(form.get("category") ?? "Outros");
  const occurred = String(form.get("occurred_on") ?? "");
  const method = String(form.get("payment_method") ?? "pix");
  const cardId = String(form.get("card_id") ?? "") || null;
  const notes = String(form.get("notes") ?? "").slice(0, 1000);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      !title || title.length > 180 || !Number.isFinite(amount) || amount <= 0 || amount > 100000000 ||
      !["expense", "income"].includes(kind) || !categories.includes(category) || !methods.includes(method) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(occurred)) {
    throw new Error("Confira os dados do lançamento.");
  }
  await invoke("aq_finance_update_transaction", {
    p_id: id, p_title: title, p_amount: amount, p_kind: kind, p_category: category,
    p_occurred_on: occurred, p_payment_method: method, p_card_id: cardId, p_notes: notes,
  });
  revalidatePath("/cards");
  revalidatePath("/budget");
  revalidatePath("/weekly");
}

export async function saveFinanceRecurring(form: FormData) {
  const title = String(form.get("title") ?? "").trim();
  const amount = Number(String(form.get("amount") ?? "").replace(",", "."));
  const kind = String(form.get("kind") ?? "expense");
  const category = String(form.get("category") ?? "Outros");
  const startOn = String(form.get("start_on") ?? "");
  const frequency = String(form.get("frequency") ?? "monthly");
  const method = String(form.get("payment_method") ?? "pix");
  const cardId = String(form.get("card_id") ?? "") || null;
  if (!title || !Number.isFinite(amount) || amount <= 0 || !["expense", "income"].includes(kind) || !categories.includes(category) || !methods.includes(method) || !/^\d{4}-\d{2}-\d{2}$/.test(startOn) || !["monthly", "weekly", "yearly"].includes(frequency)) {
    throw new Error("Confira os dados da recorrência.");
  }
  await invoke("aq_finance_save_recurring", {
    p_title: title,
    p_amount: amount,
    p_kind: kind,
    p_category: category,
    p_start_on: startOn,
    p_frequency: frequency,
    p_payment_method: method,
    p_card_id: cardId,
    p_notes: String(form.get("notes") ?? "").slice(0, 1000),
  });
}

export async function generateRecurringFinance(form: FormData) {
  const until = String(form.get("until") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error("Informe até quando gerar.");
  await invoke("aq_finance_generate_recurring", { p_until: until });
}
