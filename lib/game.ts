export function getLevelProgress(totalXp: number) {
  let level = 1;
  let requirement = 10;
  let xpIntoLevel = Number.isFinite(totalXp) ? Math.max(0, totalXp) : 0;
  while (xpIntoLevel >= requirement && level < 100) {
    xpIntoLevel -= requirement;
    level += 1;
    requirement = Math.ceil(requirement * 1.3);
  }
  if (level >= 100) return { level: 100, xpIntoLevel, requirement, progressPercent: 100 };
  return { level, xpIntoLevel, requirement, progressPercent: requirement ? Math.min(100,(xpIntoLevel/requirement)*100) : 0 };
}
export function formatNumber(value: number|string|null|undefined){const n=Number(value??0);return Number.isInteger(n)?String(n):n.toFixed(1).replace('.',',');}
export function categoryStyle(category?:string|null){switch(category){case 'Faculdade':return 'bg-violet-950 text-violet-300';case 'Trabalho':return 'bg-blue-950 text-blue-300';case 'Financeiro':return 'bg-emerald-950 text-emerald-300';case 'Saúde':return 'bg-rose-950 text-rose-300';case 'Pessoal':return 'bg-amber-950 text-amber-300';default:return 'bg-slate-800 text-slate-300';}}
