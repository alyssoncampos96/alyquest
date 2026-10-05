"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cleanName, cleanCategory, customCategories } from "@/lib/user-preferences";
import { categories } from "@/lib/planning";
export async function saveDisplayName(form: FormData) {
  const s = await createClient();
  const { data: { user }, error: authError } = await s.auth.getUser();
  if (authError || !user) throw new Error("Entre novamente para continuar.");
  const { error } = await s.auth.updateUser({ data: { display_name: cleanName(form.get("display_name")) } });
  if (error) throw error;
  revalidatePath("/", "layout");
}
export async function addTaskCategory(value: string) {
  const name = cleanCategory(value);
  const s = await createClient();
  const { data: { user }, error: authError } = await s.auth.getUser();
  if (authError || !user) throw new Error("Entre novamente para continuar.");
  const existing = [...categories, ...customCategories(user.user_metadata)];
  const match = existing.find(c => c.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
  if (match) return match;
  const custom = customCategories(user.user_metadata);
  if (custom.length >= 50) throw new Error("Você já tem 50 categorias próprias.");
  const { error } = await s.auth.updateUser({ data: { task_categories: [...custom, name] } });
  if (error) throw new Error("Não foi possível criar a categoria. Tente novamente.");
  revalidatePath("/", "layout");
  return name;
}
