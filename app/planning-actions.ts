'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { cleanCategory } from '@/lib/user-preferences';
import { parseRule, parseSteps, categories } from '@/lib/planning';
async function session() { const s=await createClient(); const {data:{user}}=await s.auth.getUser(); if(!user)throw new Error('Entre novamente para continuar.');return s; }
function refresh() { ['/', '/tasks', '/workouts', '/bosses', '/focus', '/shop', '/achievements'].forEach(path=>revalidatePath(path)); }
async function invoke(name:string,args:Record<string,unknown>) {
 const s=await session();const {data,error}=await s.rpc(name,args);
 if(error) {if(['PGRST202','PGRST205','42P01'].includes(error.code))throw new Error('O banco ainda precisa da atualização de planejamento.');throw new Error(error.code==='P0001'?error.message:'Não foi possível salvar. Confira os dados e sua conexão.');}
 refresh();return data;
}
async function missionData(form:FormData) {
 const title=String(form.get('title')??'').trim(),category=cleanCategory(form.get('category')??'Pessoal'),priority=String(form.get('priority')??'medium');
 const hours=Number(form.get('estimated_hours')); const kind=String(form.get('kind')??'task');
 if(!title||title.length>200||!['low','medium','high'].includes(priority)||!Number.isFinite(hours)||hours<=0||hours>1000||!['single','task','workout'].includes(kind))throw new Error('Confira o título, categoria e duração.');
 const rule=parseRule(JSON.parse(String(form.get('rule')??'null')));
 const due=String(form.get('due_date')??'');if(due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))throw new Error('Prazo inválido.');
 return {p_data:{title,category,priority,estimated_hours:hours,boss_id:form.get('boss_id')||null,due_date:due||null,kind,...(form.has('steps')?{steps:parseSteps(JSON.parse(String(form.get('steps')))).map(s=>({...s,done:false,actual:''}))}:{})},p_rule:rule};
}
export async function saveSteps(id:string,steps:unknown,revision=0) { return await invoke('aq_save_steps_v2',{p_task_id:id,p_steps:parseSteps(steps),p_revision:revision}) as {revision:number;xp:number;coins:number}; }
export async function saveModule(id:string|null,name:string,steps:unknown) {
 const clean=parseSteps(steps).map(s=>({...s,actual:'',done:false}));if(!name.trim()||name.trim().length>100||!clean.length)throw new Error('Informe o nome e ao menos um exercício.');
 await invoke('aq_save_module',{p_id:id,p_name:name.trim(),p_steps:clean});
}
export async function saveBoss(id:string|null,form:FormData) {
 const name=String(form.get('name')??'').trim(),category=String(form.get('category')??'Pessoal'),hp=Number(form.get('max_hp'));
 if(!name||name.length>100||!categories.includes(category)||!Number.isFinite(hp)||hp<=0||hp>100000)throw new Error('Confira nome, categoria e HP do chefe.');
 await invoke('aq_save_boss_details',{p_id:id,p_name:name,p_category:category,p_hp:hp,p_description:String(form.get('description')??'').slice(0,2000),p_due_date:form.get('due_date')||null});
}
export async function pauseRoutine(id:string,active:boolean) { await invoke('aq_pause_routine',{p_id:id,p_active:active}); }
export async function materializeRoutines() {
 const s=await session();const {data,error}=await s.rpc('aq_materialize');if(error)throw new Error('Não foi possível atualizar as recorrências.');if(Number(data)>0)refresh();return Number(data);
}

export async function saveMission(id:string|null,form:FormData){await invoke('aq_edit_mission',{p_task_id:id,p_routine_id:null,...await missionData(form),p_scope:form.get('scope')||'one'});}
export async function saveRoutine(id:string,form:FormData){await invoke('aq_edit_mission',{p_task_id:null,p_routine_id:id,...await missionData(form),p_scope:'all'});}
export async function repeatWorkout(id:string){await invoke('aq_repeat_workout',{p_task_id:id});}

export async function finishFocus(id:string,taskIds:string[],other:string,phase:'focus'|'break',focus:number,rest:number) {return await invoke('aq_complete_focus',{p_session_id:id,p_task_ids:taskIds,p_other:other,p_phase:phase,p_focus_minutes:focus,p_break_minutes:rest}) as string;}
