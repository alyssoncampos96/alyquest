"use client";

import { useMemo, useState, useTransition } from "react";
import { claimArenaVictory } from "@/app/arena-actions";
import { arenaMonsters, type ArenaMonster, unlockedArenaMonsters } from "@/lib/arena";

type EquippedItem = { name: string; icon: string; damage_bonus: number | string; item_type?: string | null; battle_slot?: string | null };
type PetItem = EquippedItem & { pet_ability?: string | null };
type BattleLog = { id: string; text: string; tone?: "good" | "bad" | "neutral" };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roll(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function didCrit(chance: number) {
  return Math.random() < chance;
}

export function ArenaGame({ level, equippedItems, pets, defeatedMonsterIds }: { level: number; equippedItems: EquippedItem[]; pets: PetItem[]; defeatedMonsterIds: string[] }) {
  const defeatedSet = useMemo(() => new Set(defeatedMonsterIds), [defeatedMonsterIds]);
  const defeatedCount = defeatedMonsterIds.length;
  const availableMonsters = useMemo(() => unlockedArenaMonsters(defeatedCount).filter(item => !defeatedSet.has(item.id)), [defeatedCount, defeatedSet]);
  const nextLocked = arenaMonsters.find(item => !defeatedSet.has(item.id) && !availableMonsters.some(monster => monster.id === item.id));
  const [monster, setMonster] = useState<ArenaMonster | null>(availableMonsters[0] ?? null);
  const [heroHp, setHeroHp] = useState(0);
  const [monsterHp, setMonsterHp] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState<"win" | "lose" | null>(null);
  const [log, setLog] = useState<BattleLog[]>([]);
  const [reward, setReward] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const rawBonus = equippedItems.reduce((sum, item) => sum + Number(item.damage_bonus ?? 0), 0);
    const petBonus = pets.length * 0.03;
    const bonus = clamp(rawBonus + petBonus, 0, 0.75);
    return {
      bonus,
      petBonus,
      maxHp: 48 + level * 7 + equippedItems.length * 4 + pets.length * 6,
      attackMin: 7 + level + Math.round(bonus * 28),
      attackMax: 13 + level * 2 + Math.round(bonus * 76),
      defense: Math.min(24, equippedItems.length * 2 + pets.length * 2 + Math.round(bonus * 18)),
      critChance: clamp(0.08 + level * 0.005 + rawBonus / 3 + pets.length * 0.03, 0.08, 0.42),
    };
  }, [equippedItems, level, pets.length]);

  function append(text: string, tone: BattleLog["tone"] = "neutral") {
    setLog(items => [{ id: `${Date.now()}-${Math.random()}`, text, tone }, ...items].slice(0, 10));
  }

  function startBattle(target = monster) {
    if (!target) return;
    setMonster(target);
    setHeroHp(stats.maxHp);
    setMonsterHp(target.hp);
    setStarted(true);
    setFinished(null);
    setReward("");
    setError("");
    setLog([{ id: "start", text: `Você entrou na arena contra ${target.name}.`, tone: "neutral" }]);
  }

  function attack() {
    if (!started || finished || pending || !monster) return;
    const heroCrit = didCrit(stats.critChance);
    const baseHeroDamage = roll(stats.attackMin, stats.attackMax);
    const heroDamage = heroCrit ? Math.round(baseHeroDamage * 1.8) : baseHeroDamage;
    const nextMonsterHp = Math.max(0, monsterHp - heroDamage);
    setMonsterHp(nextMonsterHp);
    append(`${heroCrit ? "CRÍTICO! " : ""}Você causou ${heroDamage} de dano em ${monster.name}.`, "good");
    if (nextMonsterHp <= 0) {
      setFinished("win");
      startTransition(async () => {
        try {
          const result = await claimArenaVictory(monster.id);
          setReward(result.claimed ? `Vitória registrada: +${result.xp} XP e +${result.coins} moeda.` : result.message ?? "Esse monstro já foi derrotado.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Não foi possível registrar a vitória.");
        }
      });
      return;
    }
    const monsterCrit = didCrit(monster.critChance);
    const baseIncoming = Math.max(1, roll(monster.attack - 2, monster.attack + 4) - stats.defense);
    const incoming = monsterCrit ? Math.round(baseIncoming * 1.7) : baseIncoming;
    const nextHeroHp = Math.max(0, heroHp - incoming);
    setHeroHp(nextHeroHp);
    append(`${monsterCrit ? "CRÍTICO do oponente! " : ""}${monster.name} causou ${incoming} de dano.`, "bad");
    if (nextHeroHp <= 0) {
      setFinished("lose");
      append("Você recuou para se recuperar. Equipe itens melhores e tente de novo.", "bad");
    }
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="rounded-3xl border border-violet-800 bg-gradient-to-br from-slate-900 to-violet-950 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">Arena</p>
            <h2 className="mt-2 text-xl font-black">Aly vs Monstros</h2>
            <p className="mt-1 text-sm text-slate-300">Cada monstro só pode ser derrotado uma vez. Itens e pets equipados melhoram sua chance.</p>
          </div>
          <div className="text-4xl">🧙🏻‍♂️</div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-400">HP</p><p className="font-bold">{stats.maxHp}</p></div>
          <div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-400">Ataque</p><p className="font-bold">{stats.attackMin}-{stats.attackMax}</p></div>
          <div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-400">Crítico</p><p className="font-bold">{Math.round(stats.critChance * 100)}%</p></div>
          <div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-400">Vitórias</p><p className="font-bold">{defeatedCount}</p></div>
        </div>
      </div>

      {availableMonsters.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {availableMonsters.map(item => (
          <button key={item.id} type="button" onClick={() => startBattle(item)} className={`rounded-2xl border p-3 text-left ${monster?.id === item.id && started ? "border-violet-400 bg-violet-950" : "border-slate-700 bg-slate-900"}`}>
            <div className="flex items-start justify-between gap-2"><span className="text-2xl">{item.icon}</span><span className="rounded-full bg-slate-950 px-2 py-1 text-[10px] uppercase text-slate-300">Nv. {item.level} · {item.tier === "medium" ? "Médio" : item.tier === "hard" ? "Difícil" : "Chefe"}</span></div>
            <span className="mt-2 block text-sm font-bold">{item.name}</span>
            <span className="mt-1 block text-xs text-slate-400">HP {item.hp} · crítico {Math.round(item.critChance * 100)}% · +{item.rewardCoins} 🪙</span>
          </button>
        ))}
      </div> : <div className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-100">Você derrotou todos os monstros disponíveis. Próximos níveis podem ser adicionados na próxima expansão.</div>}

      {nextLocked && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">Próximo bloqueado: {nextLocked.icon} <b>{nextLocked.name}</b>. Derrote mais {Math.max(0, (nextLocked.requiredWins ?? 0) - defeatedCount)} monstro(s) para liberar.</div>}

      {monster && <div className="rounded-3xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">{monster.icon} {monster.name}</h3>
            <p className="mt-1 text-xs text-slate-400">{monster.description}</p>
          </div>
          {!started && <button onClick={() => startBattle()} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold">Entrar</button>}
        </div>
        {started && <div className="mt-4 space-y-3">
          <div>
            <div className="flex justify-between text-xs"><span>Aly</span><span>{heroHp}/{stats.maxHp}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-500" style={{ width: `${heroHp / stats.maxHp * 100}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-xs"><span>{monster.name}</span><span>{monsterHp}/{monster.hp}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-rose-500" style={{ width: `${monsterHp / monster.hp * 100}%` }} /></div>
          </div>
          <button disabled={!!finished || pending} onClick={attack} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">{pending ? "Registrando vitória..." : finished === "win" ? "Vitória!" : finished === "lose" ? "Derrota" : "⚔️ Atacar"}</button>
          {finished === "lose" && <button onClick={() => startBattle(monster)} className="w-full rounded-xl border border-slate-700 py-3 text-sm font-bold">Tentar de novo</button>}
          {reward && <p className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-100">{reward}</p>}
          {error && <p role="alert" className="rounded-xl bg-rose-950 p-3 text-sm text-rose-100">{error}</p>}
        </div>}
      </div>}

      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <h3 className="font-bold">Equipados</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {equippedItems.length ? equippedItems.map(item => <span key={item.name} className="rounded-full bg-slate-800 px-3 py-2 text-xs">{item.icon} {item.name}</span>) : <span className="text-sm text-slate-400">Nenhum item equipado. Vá na Loja para comprar/equipar.</span>}
        </div>
        {!!pets.length && <><h3 className="mt-4 font-bold">Pets</h3><div className="mt-3 flex flex-wrap gap-2">{pets.map(item => <span key={item.name} className="rounded-full bg-violet-900 px-3 py-2 text-xs">{item.icon} {item.name}</span>)}</div></>}
      </section>

      {!!log.length && <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <h3 className="font-bold">Combate</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {log.map(item => <li key={item.id} className={item.tone === "good" ? "text-emerald-300" : item.tone === "bad" ? "text-rose-300" : "text-slate-300"}>{item.text}</li>)}
        </ul>
      </section>}
    </section>
  );
}
