type Task={id:string;status:string;due_date?:string|null;completed_at?:string|null};
type Plan={task_id:string;kind:string;steps:{done:boolean;actual:string}[];routine_id?:string|null};
export function extraAchievements(tasks:Task[],plans:Plan[],modules:number,bosses:number,links:number,sessions:{focus_completed:boolean;break_completed:boolean}[],routines:{id:string;resumed_at?:string|null}[]){
 const done=tasks.filter(t=>t.status==='completed');const workouts=done.filter(t=>plans.some(p=>p.task_id===t.id&&p.kind==='workout'));
 const resumed=done.some(t=>{const r=routines.find(r=>r.id===plans.find(p=>p.task_id===t.id)?.routine_id);return !!r?.resumed_at&&!!t.completed_at&&t.completed_at>r.resumed_at;});
 return [
 ['📅','Primeiro compromisso','Crie uma missão com prazo.',tasks.some(t=>t.due_date)],
 ['⏳','Antes do prazo','Conclua uma missão antes da data prevista.',done.some(t=>t.due_date&&t.completed_at&&new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t.completed_at))<t.due_date)],
 ['🌱','De volta ao jogo','Conclua uma ocorrência depois de reativar uma rotina.',resumed],
 ['🏋️','Primeiro movimento','Conclua seu primeiro treino.',workouts.length>0],
 ['🧩','Meu repertório','Crie um módulo de treino próprio.',modules>0],
 ['📝','Evolução documentada','Registre o realizado em um treino concluído.',workouts.some(t=>plans.find(p=>p.task_id===t.id)?.steps.some(s=>s.actual.trim()))],
 ['🌿','Pausa respeitada','Complete um descanso após o foco.',sessions.some(s=>s.focus_completed&&s.break_completed)],
 ['🎯','Uma meta com nome','Crie um chefe pessoal.',bosses>0],
 ['🔗','Ponte com o trabalho','Importe uma tarefa da planilha.',links>0],
 ['☑️','Passo a passo','Conclua uma missão com todas as etapas marcadas.',done.some(t=>{const p=plans.find(p=>p.task_id===t.id);return !!p?.steps.length&&p.steps.every(s=>s.done);})]
 ] as [string,string,string,boolean][];
}
