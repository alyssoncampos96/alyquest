import { createClient } from '@/lib/supabase/server';
import type { Plan, Module, Routine } from '@/lib/planning';
export async function loadPlanning(s: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const result = await s.from('aq_task_plans').select('*').eq('user_id',userId);
  if (result.error) {
    if (['PGRST205','42P01'].includes(result.error.code)) return { links:[] as {task_id:string;project:string;source_status:string}[], previous:[] as import("./planning").Step[], ready: false, plans: [] as Plan[], modules: [] as Module[], routines: [] as Routine[] };
    throw new Error('Não foi possível carregar o planejamento.');
  }
  const [modules,routines,links,history]=await Promise.all([s.from('aq_workout_modules').select('id,name,steps').eq('user_id',userId).order('created_at'),s.from('aq_routines').select('*').eq('user_id',userId).order('created_at'),s.from('aq_sheet_links').select('task_id,project,source_status').eq('user_id',userId),s.from('tasks').select('id,completed_at').eq('user_id',userId).eq('status','completed').order('completed_at',{ascending:false})]);
  if(modules.error||routines.error||links.error||history.error) throw new Error('Não foi possível carregar os módulos e recorrências.');
  return {ready:true, links:links.data??[], previous:(history.data??[]).flatMap(t=>(result.data as Plan[]).find(p=>p.task_id===t.id)?.steps??[]), plans:result.data as Plan[], modules:modules.data as Module[], routines:routines.data as Routine[]};
}
