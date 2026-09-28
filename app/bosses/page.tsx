import { FormDialog } from '@/components/form-dialog';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { checked } from '@/lib/query';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { loadPlanning } from '@/lib/planning-server';
import { BossCard } from '@/components/boss-card';
import { BossForm } from '@/components/boss-form';
import { formatNumber } from '@/lib/game';
async function Content(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/auth/login');
 const [br,eq,tr,planning]=await Promise.all([s.from('bosses').select('*').eq('user_id',user.id).order('created_at'),s.from('user_items').select('equipped, items(name,damage_bonus)').eq('user_id',user.id).eq('equipped',true),s.from('tasks').select('id,title,boss_id,status').eq('user_id',user.id),loadPlanning(s,user.id)]);checked(br);checked(eq);checked(tr);
 const bonus=(eq.data??[]).reduce((sum,row)=>sum+Number((Array.isArray(row.items)?row.items[0]:row.items)?.damage_bonus??0),0);
 return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-black">Chefes & metas</h1>{planning.ready&&<FormDialog label="+ Criar chefe"><BossForm/></FormDialog>}</div><p className="mt-1 text-sm text-slate-400">Bônus de dano: {formatNumber(Math.min(bonus,.5)*100)}%.</p>

 <div className="mt-6 space-y-5">{(br.data??[]).map(b=><section key={b.id}><BossCard boss={b}/>{b.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{b.description}</p>}{b.due_date&&<p className="mt-2 text-xs text-slate-400">Prazo: {new Date(`${b.due_date}T12:00:00`).toLocaleDateString('pt-BR')}</p>}<div className="mt-2 rounded-2xl border border-slate-700 p-4"><p className="text-sm font-semibold">Missões vinculadas</p><ul className="mt-2 space-y-2 text-sm text-slate-400">{(tr.data??[]).filter(t=>t.boss_id===b.id).map(t=><li key={t.id}>{t.status==='completed'?'✓':'○'} {t.title}</li>)}</ul>{!(tr.data??[]).some(t=>t.boss_id===b.id)&&<p className="mt-2 text-sm text-slate-400">Nenhuma missão vinculada.</p>}<Link href="/tasks" className="mt-3 block text-sm text-violet-300">Vincular uma missão nova ou existente →</Link></div>{planning.ready&&!b.defeated_at&&<details className="mt-2"><summary className="cursor-pointer p-2 text-sm text-violet-300">Editar chefe</summary><BossForm boss={b}/></details>}</section>)}</div>
 <section className="mt-6 rounded-3xl border border-slate-700 bg-slate-900 p-5"><h2 className="font-bold">Dano e recompensas</h2><p className="mt-2 text-sm text-slate-400">Missões vinculadas causam dano pelas horas estimadas (mínimo 0,5), com bônus de equipamentos limitado a 50%. Concluir o chefe concede as recompensas configuradas no banco. Etapas não duplicam as recompensas da missão.</p></section>
 </div></main>;
}
export default function Page(){return <Suspense fallback={<main className="p-6">Carregando chefes...</main>}><Content/></Suspense>;}
