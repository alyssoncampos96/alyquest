export const lifeAreas = ["Pessoal", "Trabalho", "Faculdade", "Financeiro", "Saúde"];
export const financeCategories = ["Alimentação", "Transporte", "Casa", "Saúde", "Lazer", "Educação", "Assinaturas", "Outros"];
export const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });
export function saoDate(date = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
export function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00-03:00`); d.setDate(d.getDate() + days); return saoDate(d); }
export function currentMonth() { return saoDate().slice(0, 7); }
export function firstDay(month=currentMonth()) { return `${month}-01`; }
export function lastDay(month=currentMonth()) { const [y,m]=month.split("-").map(Number); return saoDate(new Date(Date.UTC(y, m, 0, 15))); }
export function sum<T>(rows: T[], pick: (row: T) => number|string|null|undefined) { return rows.reduce((n,row)=>n+Number(pick(row)??0),0); }
export async function soft<T>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> { try { const result = await promise; return result.error ? fallback : result.data ?? fallback; } catch { return fallback; } }
export function areaEmoji(area: string) { return area === "Saúde" ? "💚" : area === "Trabalho" ? "💼" : area === "Faculdade" ? "🎓" : area === "Financeiro" ? "💳" : "🌟"; }
export function levelFromCount(count: number) { return Math.max(1, Math.floor(count / 5) + 1); }
export function progressPct(value: number, target: number) { return `${Math.max(4, Math.min(100, target ? (value / target) * 100 : 0))}%`; }
