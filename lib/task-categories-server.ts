import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { categories } from "@/lib/planning";
import { customCategories } from "@/lib/user-preferences";
export const loadTaskCategories = cache(async () => {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return categories;
  return [...new Set([...categories, ...customCategories(user.user_metadata)])];
});
