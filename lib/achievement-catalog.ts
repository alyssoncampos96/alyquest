type Task = { status: string; category?: string | null; completed_at?: string | null; due_date?: string | null };
type Plan = { kind: string; steps?: { done?: boolean; actual?: string }[] };
type Session = { focus_completed?: boolean; break_completed?: boolean };
type Fast = { reward_units?: number; ended_at?: string | null };
type Finance = { kind: string; category?: string | null; amount: number | string; source?: string | null; installment_count?: number | null };
type ArenaVictory = { monster_id?: string | null };

export type Achievement = { code: string; icon: string; title: string; description: string; unlocked: boolean; rewardXp: number; rewardCoins: number };

export function buildAchievements(ctx: {
  tasks: Task[];
  plans: Plan[];
  focus: Session[];
  bosses: number;
  streak: number;
  modules: number;
  links: number;
  routines: number;
  fasts: Fast[];
  finance: Finance[];
  arena: ArenaVictory[];
}) {
  const completed = ctx.tasks.filter(t => t.status === "completed");
  const workouts = completed.filter((_, index) => ctx.plans[index]?.kind === "workout");
  const totalFastUnits = ctx.fasts.reduce((n, f) => n + Number(f.reward_units ?? 0), 0);
  const expenses = ctx.finance.filter(f => f.kind === "expense");
  const income = ctx.finance.filter(f => f.kind === "income");
  const sumExpense = expenses.reduce((n, f) => n + Number(f.amount), 0);
  const categories = new Set(ctx.tasks.map(t => t.category).filter(Boolean));
  const financeCategories = new Set(ctx.finance.map(f => f.category).filter(Boolean));
  const arenaWins = new Set(ctx.arena.map(v => v.monster_id).filter(Boolean));
  const rows: [string, string, string, string, boolean, number, number][] = [
    ["first-task","🥇","Primeira missão","Conclua sua primeira missão.",completed.length>=1,2,2],
    ["ten-tasks","⚔️","Caçador de missões","Conclua 10 missões.",completed.length>=10,10,10],
    ["twenty-five-tasks","🛡️","Rotina em movimento","Conclua 25 missões.",completed.length>=25,20,20],
    ["fifty-tasks","🏰","Construtor de reino","Conclua 50 missões.",completed.length>=50,35,35],
    ["hundred-tasks","👑","Lenda diária","Conclua 100 missões.",completed.length>=100,60,60],
    ["first-focus","🍅","Primeiro foco","Complete um Pomodoro.",ctx.focus.some(s=>s.focus_completed),3,3],
    ["focus-rest","🌿","Pausa respeitada","Complete foco e descanso.",ctx.focus.some(s=>s.focus_completed&&s.break_completed),4,4],
    ["four-focus","🔥","Em chamas","Complete 4 focos.",ctx.focus.filter(s=>s.focus_completed).length>=4,8,8],
    ["twenty-focus","🎧","Zona de concentração","Complete 20 focos.",ctx.focus.filter(s=>s.focus_completed).length>=20,20,20],
    ["first-boss","👹","Boss hunter","Derrote seu primeiro chefe.",ctx.bosses>=1,10,10],
    ["three-bosses","⚡","Quebra-metas","Derrote 3 chefes.",ctx.bosses>=3,25,25],
    ["week-streak","🗓️","Uma semana","Mantenha 7 dias de sequência.",ctx.streak>=7,12,12],
    ["month-streak","🌕","Mês consistente","Mantenha 30 dias de sequência.",ctx.streak>=30,50,50],
    ["all-categories","🧭","Vida organizada","Tenha missões em 5 categorias.",categories.size>=5,10,10],
    ["due-date","📅","Compromisso marcado","Crie missão com prazo.",ctx.tasks.some(t=>t.due_date),3,3],
    ["before-due","⏳","Antes do prazo","Conclua uma missão antes do prazo.",completed.some(t=>t.due_date&&t.completed_at&&new Date(t.completed_at).toISOString().slice(0,10)<t.due_date),8,8],
    ["steps","☑️","Passo a passo","Conclua missão com todas as etapas.",ctx.plans.some(p=>p.steps?.length&&p.steps.every(s=>s.done)),8,8],
    ["workout","🏋️","Primeiro movimento","Conclua seu primeiro treino.",workouts.length>=1,8,8],
    ["five-workouts","💪","Corpo em construção","Conclua 5 treinos.",workouts.length>=5,18,18],
    ["module","🧩","Meu repertório","Crie um módulo de treino.",ctx.modules>0,5,5],
    ["sheet","🔗","Ponte com o trabalho","Importe uma tarefa da planilha.",ctx.links>0,5,5],
    ["routine","🔁","Motor recorrente","Crie uma recorrência.",ctx.routines>0,5,5],
    ["fast-first","⏱️","Primeiro jejum","Registre um jejum concluído.",ctx.fasts.length>=1,4,4],
    ["fast-12","🌙","Janela de 12h","Complete 12 horas de jejum.",totalFastUnits>=3,8,8],
    ["fast-16","☀️","Janela de 16h","Complete 16 horas de jejum.",totalFastUnits>=4,12,12],
    ["fast-24","⭐","Dia limpo","Complete 24 horas de jejum.",totalFastUnits>=6,18,18],
    ["fast-five","🧘","Ritual de jejum","Registre 5 jejuns.",ctx.fasts.length>=5,20,20],
    ["finance-first","💳","Primeiro lançamento","Registre a primeira movimentação financeira.",ctx.finance.length>=1,3,3],
    ["finance-food","🍽️","Alimentação mapeada","Registre uma despesa de alimentação.",expenses.some(e=>e.category==="Alimentação"),4,4],
    ["finance-income","💰","Receita registrada","Registre uma entrada.",income.length>=1,5,5],
    ["finance-installment","🧾","Parcela no radar","Registre uma compra parcelada.",ctx.finance.some(f=>Number(f.installment_count??1)>1),6,6],
    ["finance-gpt","🤖","GPT anotou","Registre uma despesa via GPT.",ctx.finance.some(f=>f.source==="gpt"),8,8],
    ["finance-five","📒","Caderno financeiro","Registre 5 lançamentos.",ctx.finance.length>=5,10,10],
    ["finance-cats","🗂️","Mapa de gastos","Use 4 categorias financeiras.",financeCategories.size>=4,12,12],
    ["finance-500","📉","Consciência de caixa","Mapeie R$500 em despesas.",sumExpense>=500,12,12],
    ["health-five","🫀","Saúde em dia","Conclua 5 missões de Saúde.",completed.filter(t=>t.category==="Saúde").length>=5,12,12],
    ["work-five","💼","Trabalho fluindo","Conclua 5 missões de Trabalho.",completed.filter(t=>t.category==="Trabalho").length>=5,12,12],
    ["college-five","🎓","Faculdade no trilho","Conclua 5 missões de Faculdade.",completed.filter(t=>t.category==="Faculdade").length>=5,12,12],
    ["personal-five","🏡","Vida pessoal cuidada","Conclua 5 missões Pessoais.",completed.filter(t=>t.category==="Pessoal").length>=5,12,12],
    ["money-five","🪙","Financeiro avançando","Conclua 5 missões Financeiras.",completed.filter(t=>t.category==="Financeiro").length>=5,12,12],
    ["ten-planned","📌","Agenda cheia","Tenha 10 missões com prazo.",ctx.tasks.filter(t=>t.due_date).length>=10,12,12],
    ["ten-steps","🪜","Escadaria","Conclua 10 etapas.",ctx.plans.flatMap(p=>p.steps??[]).filter(s=>s.done).length>=10,10,10],
    ["actual-log","📝","Evolução documentada","Registre realizado em um treino.",ctx.plans.some(p=>p.kind==="workout"&&p.steps?.some(s=>String(s.actual??"").trim())),8,8],
    ["multi-domain","🌈","Semana completa","Conclua missões em 3 categorias.",new Set(completed.map(t=>t.category).filter(Boolean)).size>=3,18,18],
    ["planner","🧠","Arquiteto do dia","Tenha 7 missões pendentes organizadas.",ctx.tasks.filter(t=>t.status==="pending").length>=7,8,8],
    ["store-ready","🛍️","Carteira pronta","Acumule progresso suficiente para visitar a loja.",completed.length+ctx.focus.length+totalFastUnits>=20,10,10],
    ["early-system","🚀","Sistema vivo","Use tarefas, finanças e jejum ao menos uma vez.",ctx.tasks.length>0&&ctx.finance.length>0&&ctx.fasts.length>0,25,25],
    ["boss-linked","🎯","Meta conectada","Tenha missões vinculadas a chefes.",ctx.plans.length>0&&ctx.tasks.length>0&&ctx.bosses>=0,5,5],
    ["discipline","🏆","Disciplina composta","Some 100 ações recompensáveis.",completed.length+ctx.focus.filter(s=>s.focus_completed).length+totalFastUnits+ctx.finance.length>=100,80,80],

    ["arena-first","⚔️","Primeira vitória","Derrote seu primeiro monstro na Arena.",arenaWins.size>=1,6,6],
    ["arena-two","🛡️","Dupla vencida","Derrote dois monstros na Arena.",arenaWins.size>=2,10,10],
    ["arena-boss","🐉","Caçador de dragões","Derrote o chefe da Arena.",arenaWins.has("level-3-dragon"),18,18],
    ["level-hundred","💎","Nível 100","Chegue ao nível 100.",false,100,100],
  ];
  return rows.map(([code, icon, title, description, unlocked, rewardXp]) => ({ code, icon, title, description, unlocked, rewardXp, rewardCoins: 1 }));
}
