export const instant = false;
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { setTheme } from "@/app/system-actions";
import { soft } from "@/lib/life-dashboard";

const themes=[['default','Padrão','🌌'],['forest','Floresta','🌲'],['cyberpunk','Cyberpunk','🌃'],['medieval','Medieval','🏰'],['gym','Academia','🏋️'],['finance','Financeiro','💳']];
export default async function Page(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/auth/login');const pref=await soft<{theme:string}|null>(supabase.from('aq_theme_preferences').select('theme').eq('user_id',user.id).maybeSingle(),null);return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><h1 className="text-2xl font-black">Temas visuais</h1><p className="mt-1 text-sm text-slate-400">Aplique estilos desbloqueáveis ao AlyQuest.</p><section className="mt-5 grid grid-cols-2 gap-3">{themes.map(([id,label,icon])=><ActionForm key={id} action={setTheme} className="rounded-3xl border border-slate-800 bg-slate-900 p-4"><input type="hidden" name="theme" value={id}/><div className="text-4xl">{icon}</div><h2 className="mt-2 font-black">{label}</h2><p className="mt-1 text-xs text-slate-400">{pref?.theme===id?'Ativo':'Toque para aplicar'}</p><button className="mt-3 w-full rounded-xl border border-violet-700 p-2 text-sm font-bold text-violet-200">Aplicar</button></ActionForm>)}</section></div></main>}
