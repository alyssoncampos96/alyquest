import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
async function ProtectedContent() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return redirect(user ? "/" : "/auth/login"); }
export default function Page() { return <Suspense fallback={<main className="p-6">Carregando...</main>}><ProtectedContent /></Suspense>; }
