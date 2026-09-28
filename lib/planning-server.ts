import { createClient } from '@/lib/supabase/server';
import type { Plan, Module, Routine } from '@/lib/planning';
export async function loadPlanning(s: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const result = await s.from('aq_task_plans').select('*').eq('user_id',userId);
  if (result.error) {
    if (['PGRST205','42P01'].includes(result.error.code)) return { ready: false, plans: [] as Plan[], modules: [] as Module[], routines: [] as Routine[] };
    throw new Error('Não foi possível carregar o planejamento.');
  }
  const [modules,routines]=await Promise.all([s.from('aq_workout_modules').select('id,name,steps').eq('user_id',userId).order('created_at'),s.from('aq_routines').select('*').eq('user_id',userId).order('created_at')]);
  if(modules.error||routines.error) throw new Error('Não foi possível carregar os módulos e recorrências.');
  return {ready:true, plans:result.data as Plan[], modules:modules.data as Module[], routines:routines.data as Routine[]};
}
