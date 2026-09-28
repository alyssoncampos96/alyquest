export const categories = ['Pessoal', 'Trabalho', 'Faculdade', 'Financeiro', 'Saúde'];
export type Step = { id: string; title: string; target: string; actual: string; done: boolean };
export type Module = { id: string; name: string; steps: Step[] };
export type Rule = { frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'; interval: number; weekdays: number[]; start: string; until: string | null; count: number | null };
export type Routine = { id: string; title: string; category: string; priority: string; estimated_hours: number; boss_id: string | null; kind: string; rule: Rule; active: boolean; steps?: Step[]; cursor_date?: string | null; emitted?: number };
export type Plan = { task_id: string; kind: string; steps: Step[]; routine_id: string | null; occurrence_date: string | null };
export const defaults: Module[] = [
  { id: 'running', name: '🏃 Corrida', steps: [{ id: 'run', title: 'Esteira', target: '3 km', actual: '', done: false }] },
  { id: 'arms', name: '💪 Braços', steps: [{ id: 'curl', title: 'Rosca bíceps', target: '3 séries × 12 repetições • carga a definir', actual: '', done: false }, { id: 'triceps', title: 'Tríceps', target: '3 séries × 12 repetições • carga a definir', actual: '', done: false }] },
  { id: 'abs', name: '🔥 Abdominal', steps: [{ id: 'abs', title: 'Abdominal', target: '3 séries × 15 repetições', actual: '', done: false }, { id: 'plank', title: 'Prancha', target: '3 séries × 30 segundos', actual: '', done: false }] },
  { id: 'mobility', name: '🧘 Mobilidade', steps: [{ id: 'mobility', title: 'Mobilidade', target: '10 minutos', actual: '', done: false }] },
];
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function parseSteps(value: unknown): Step[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Use no máximo 100 etapas.');
  const ids = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Etapa inválida.');
    const s = item as Record<string, unknown>;
    if (typeof s.id !== 'string' || !s.id || s.id.length > 100 || ids.has(s.id)) throw new Error('Identificador de etapa inválido.');
    ids.add(s.id);
    if (typeof s.title !== 'string' || !s.title.trim() || s.title.length > 200) throw new Error('Informe o nome de cada etapa.');
    if (typeof s.target !== 'string' || s.target.length > 300 || typeof s.actual !== 'string' || s.actual.length > 500 || typeof s.done !== 'boolean') throw new Error('Dados da etapa inválidos.');
    return { id: s.id, title: s.title.trim(), target: s.target, actual: s.actual, done: s.done };
  });
}
export function parseRule(value: unknown): Rule | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object') throw new Error('Recorrência inválida.');
  const r = value as Rule;
  const validDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(r.frequency) || !Number.isInteger(r.interval) || r.interval < 1 || r.interval > 99 || !validDate(r.start)) throw new Error('Recorrência inválida.');
  if (!Array.isArray(r.weekdays) || r.weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6) || (r.frequency === 'weekly' && !r.weekdays.length)) throw new Error('Escolha os dias da semana.');
  if (r.until !== null && (!validDate(r.until) || r.until < r.start)) throw new Error('A data final deve ser igual ou posterior ao início.');
  if (r.count !== null && (!Number.isInteger(r.count) || r.count < 1 || r.count > 10000)) throw new Error('Quantidade de ocorrências inválida.');
  if (r.until && r.count) throw new Error('Escolha término por data ou quantidade.');
  return { ...r, weekdays: [...new Set(r.weekdays)] };
}
export const field = 'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white';
