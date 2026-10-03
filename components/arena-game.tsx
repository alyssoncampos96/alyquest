"use client";

import { useMemo, useState, useTransition } from "react";
import { claimArenaVictory } from "@/app/arena-actions";
import { arenaMonsters, type ArenaMonster } from "@/lib/arena";

type EquippedItem = { name: string; icon: string; damage_bonus: number | string };
type BattleLog = { id: string; text: string; tone?: "good" | "bad" | "neutral" };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roll(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function ArenaGame({ level, equippedItems }: { level: number; equippedItems: EquippedItem[] }) {
  const [monster, setMonster] = useState<ArenaMonster>(arenaMonsters[0]);
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
    const bonus = clamp(rawBonus, 0, 0.5);
    return {
      bonus,
      maxHp: 44 + level * 6 + equippedItems.length * 3,
      attackMin: 6 + level + Math.round(bonus * 30),
      attackMax: 12 + level * 2 + Math.round(bonus * 70),
      defense: Math.min(18, equippedItems.length * 2 + Math.round(bonus * 20)),
    };
  }, [equippedItems, level]);

  function append(text: string, tone: BattleLog["tone"] = "neutral") {
    setLog(items => [{ id: `${Date.now()}-${Math.random()}`, text, tone }, ...items].slice(0, 8));
  }

  function startBattle(target = monster) {
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
    if (!started || finished || pending) return;
    const heroDamage = roll(stats.attackMin, stats.attackMax);
    const nextMonsterHp = Math.max(0, monsterHp - heroDamage);
    setMonsterHp(nextMonsterHp);
    append(`Você causou ${heroDamage} de dano em ${monster.name}.`, "good");
    if (nextMonsterHp <= 0) {
      setFinished("win");
      startTransition(async () => {
        try {
          const result = await claimArenaVictory(monster.id);
          setReward(result.claimed ? `Vitória registrada: +${result.xp} XP e +${result.coins} moedas.` : "Você já recebeu a recompensa desse monstro hoje.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Não foi possível registrar a vitória.");
        }
      });
      return;
    }
    const incoming = Math.max(1, roll(monster.attack - 2, monster.attack + 3) - stats.defense);
    const nextHeroHp = Math.max(0, heroHp - incoming);
    setHeroHp(nextHeroHp);
    append(`${monster.name} contra-atacou e causou ${incoming} de dano.`, "bad");
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
            <p className="mt-1 text-sm text-slate-300">Use os itens equipados da loja para aumentar seu dano e defesa.</p>
          </div>
          <div className="text-4xl">🧙🏻‍♂️</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-400">HP</p><p className="font-bold">{stats.maxHp}</p></div>
          <div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-400">Ataque</p><p className="font-bold">{stats.attackMin}-{stats.attackMax}</p></div>
          <div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-400">Bônus</p><p className="font-bold">+{Math.round(stats.bonus * 100)}%</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {arenaMonsters.map(item => (
          <button key={item.id} type="button" onClick={() => startBattle(item)} className={`rounded-2xl border p-3 text-left ${monster.id === item.id && started ? "border-violet-400 bg-violet-950" : "border-slate-700 bg-slate-900"}`}>
            <span className="text-2xl">{item.icon}</span>
            <span className="mt-2 block text-sm font-bold">{item.name}</span>
            <span className="mt-1 block text-xs text-slate-400">HP {item.hp} · +{item.rewardCoins} 🪙</span>
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-4">
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
          {finished && <button onClick={() => startBattle(monster)} className="w-full rounded-xl border border-slate-700 py-3 text-sm font-bold">Tentar de novo</button>}
          {reward && <p className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-100">{reward}</p>}
          {error && <p role="alert" className="rounded-xl bg-rose-950 p-3 text-sm text-rose-100">{error}</p>}
        </div>}
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <h3 className="font-bold">Equipados</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {equippedItems.length ? equippedItems.map(item => <span key={item.name} className="rounded-full bg-slate-800 px-3 py-2 text-xs">{item.icon} {item.name}</span>) : <span className="text-sm text-slate-400">Nenhum item equipado. Vá na Loja para comprar/equipar.</span>}
        </div>
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
