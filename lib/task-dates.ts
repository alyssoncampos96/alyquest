import type {Task} from './types';
export function taskDayGroup(task:Task,today:string){return !task.due_date?'unscheduled':task.due_date<today?'overdue':task.due_date===today?'today':'future';}
export function previousExercise(steps:{title:string;actual:string}[],title:string){return steps.find(s=>s.title.trim().toLocaleLowerCase('pt-BR')===title.trim().toLocaleLowerCase('pt-BR')&&s.actual.trim())?.actual??'';}
