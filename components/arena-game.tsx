"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { buyArenaPotion, claimArenaVictory, takeArenaDamage, drinkArenaPotion, type ArenaHealth } from "@/app/arena-actions";
import { arenaMonsters, type ArenaMonster, unlockedArenaMonsters } from "@/lib/arena";

export type EquippedItem = { id?: string; name: string; icon: string; damage_bonus: number | string; item_type?: string | null; battle_slot?: string | null; rarity?: string | null; effect?: string | null; defense_bonus?: number | string | null; crit_bonus?: number | string | null };
type PetItem = EquippedItem & { pet_ability?: string | null };
type ConsumableItem = EquippedItem;
type BattleLog = { id: string; text: string; tone?: "good" | "bad" | "neutral" };
type EnemyUnit = { id: string; name: string; icon: string; hp: number; maxHp: number; attack: number; defense: number; critChance: number };

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function roll(min: number, max: number) { return Math.floor(min + Math.random() * (max - min + 1)); }
function didCrit(chance: number) { return Math.random() < chance; }
function pct(value: number, total: number) { return `${Math.max(0, Math.min(100, (value / total) * 100))}%`; }
function safeText(value: unknown, fallback = "Não foi possível registrar a vitória.") { return typeof value === "string" ? value : value == null ? fallback : JSON.stringify(value); }

function teamFor(monster: ArenaMonster): EnemyUnit[] {
  if (monster.tier !== "boss") return [{ id: monster.id, name: monster.name, icon: monster.icon, hp: monster.hp, maxHp: monster.hp, attack: monster.attack, defense: monster.defense, critChance: monster.critChance }];
  const medium = arenaMonsters.find(item => item.level === monster.level && item.tier === "medium");
  const hard = arenaMonsters.find(item => item.level === monster.level && item.tier === "hard");
  return [medium, hard].filter(Boolean).map((item, index) => ({
    id: `${monster.id}-${item!.tier}`,
    name: item!.name,
    icon: item!.icon,
    hp: Math.round(item!.hp * 1.25),
    maxHp: Math.round(item!.hp * 1.25),
    attack: Math.round(item!.attack * (index === 0 ? 1.05 : 1.15)),
    defense: item!.defense + 2,
    critChance: clamp(item!.critChance + 0.03, 0, 0.38),
  }));
}

export function ArenaGame({ level, equippedItems, pets, consumables, defeatedMonsterIds, initialHealth, initialPotions }: { level: number; equippedItems: EquippedItem[]; pets: PetItem[]; consumables: ConsumableItem[]; defeatedMonsterIds: string[]; initialHealth: ArenaHealth; initialPotions: number }) {
  const defeatedSet = useMemo(() => new Set(defeatedMonsterIds), [defeatedMonsterIds]);
  const defeatedCount = defeatedMonsterIds.length;
  const availableMonsters = useMemo(() => unlockedArenaMonsters(defeatedCount).filter(item => !defeatedSet.has(item.id)).slice(0, 8), [defeatedCount, defeatedSet]);
  const nextLocked = arenaMonsters.find(item => !defeatedSet.has(item.id) && !availableMonsters.some(monster => monster.id === item.id));
  const [monster, setMonster] = useState<ArenaMonster | null>(availableMonsters[0] ?? null);
  const [heroHp, setHeroHp] = useState(initialHealth.current_hp);
  const [nextHpAt, setNextHpAt] = useState(initialHealth.next_hp_at);
  const [potions, setPotions] = useState(initialPotions);
  const [clock, setClock] = useState(Date.now());
  const [enemies, setEnemies] = useState<EnemyUnit[]>([]);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState<"win" | "lose" | null>(null);
  const [log, setLog] = useState<BattleLog[]>([]);
  const [reward, setReward] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [selectedConsumableId, setSelectedConsumableId] = useState("");
  const [heroPulse, setHeroPulse] = useState(false);
  const [enemyPulse, setEnemyPulse] = useState<string | null>(null);

  const stats = useMemo(() => {
    const rawPower = equippedItems.reduce((sum, item) => sum + Number(item.damage_bonus ?? 0), 0);
    const rawDefense = equippedItems.reduce((sum, item) => sum + Number(item.defense_bonus ?? 0), 0);
    const rawCrit = equippedItems.reduce((sum, item) => sum + Number(item.crit_bonus ?? 0), 0);
    const petBonus = pets.reduce((sum, item) => sum + Number(item.damage_bonus ?? 0.03), 0);
    const selectedConsumable = consumables.find((item) => item.id === selectedConsumableId);
    const consumableBonus = selectedConsumable ? 0.18 + Number(selectedConsumable.damage_bonus ?? 0) : 0;
    const bonus = clamp(rawPower + petBonus + consumableBonus, 0, 1.35);
    return {
      bonus,
      selectedConsumable,
      maxHp: 55 + level * 8 + equippedItems.length * 6 + pets.length * 8 + Math.round(rawDefense * 80),
      attackMin: 7 + level + Math.round(bonus * 34),
      attackMax: 14 + level * 2 + Math.round(bonus * 92),
      defense: Math.min(65, equippedItems.length * 2 + pets.length * 2 + Math.round(bonus * 16 + rawDefense * 70)),
      critChance: clamp(0.08 + level * 0.004 + rawPower / 3.5 + rawCrit + pets.length * 0.025, 0.08, 0.55),
    };
  }, [consumables, equippedItems, level, pets, selectedConsumableId]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!nextHpAt || heroHp >= stats.maxHp || clock < new Date(nextHpAt).getTime()) return;
    const gained = 1 + Math.floor((clock - new Date(nextHpAt).getTime()) / 3_600_000);
    const updatedHp = Math.min(stats.maxHp, heroHp + gained);
    setHeroHp(updatedHp);
    setNextHpAt(updatedHp === stats.maxHp ? null : new Date(new Date(nextHpAt).getTime() + gained * 3_600_000).toISOString());
  }, [clock, heroHp, nextHpAt, stats.maxHp]);

  const nextRecovery = nextHpAt && heroHp < stats.maxHp
    ? Math.max(0, Math.ceil((new Date(nextHpAt).getTime() - clock) / 60_000))
    : null;

  function append(text: string, tone: BattleLog["tone"] = "neutral") {
    setLog(items => [{ id: `${Date.now()}-${Math.random()}`, text, tone }, ...items].slice(0, 12));
  }

  function startBattle(target = monster) {
    if (!target) return;
    if (heroHp <= 0) { setError("Seu HP está zerado. Aguarde recuperar 1 HP ou use uma poção."); return; }
    const nextTeam = teamFor(target);
    setMonster(target);
    setEnemies(nextTeam);
    setStarted(true);
    setFinished(null);
    setReward("");
    setError("");
    setHeroPulse(false);
    setEnemyPulse(null);
    setLog([{ id: "start", text: target.tier === "boss" ? `Duelo iniciado: dois inimigos entraram juntos na fase ${target.level}.` : `Você entrou na arena contra ${target.name}.`, tone: "neutral" }]);
  }

  function attack() {
    if (!started || finished || pending || !monster) return;
    const target = enemies.find(enemy => enemy.hp > 0);
    if (!target) return;
    const heroCrit = didCrit(stats.critChance);
    const baseHeroDamage = Math.max(1, roll(stats.attackMin, stats.attackMax) - Math.floor(target.defense / 2));
    const heroDamage = heroCrit ? Math.round(baseHeroDamage * 1.85) : baseHeroDamage;
    const nextEnemies = enemies.map(enemy => enemy.id === target.id ? { ...enemy, hp: Math.max(0, enemy.hp - heroDamage) } : enemy);
    setEnemies(nextEnemies);
    setHeroPulse(true); setEnemyPulse(target.id); setTimeout(() => { setHeroPulse(false); setEnemyPulse(null); }, 360);
    append(`${heroCrit ? "CRÍTICO! " : ""}Você causou ${heroDamage} de dano em ${target.name}.`, "good");
    if (nextEnemies.every(enemy => enemy.hp <= 0)) {
      setFinished("win");
      startTransition(async () => {
        try {
          const result = await claimArenaVictory(monster.id, {
            monster_id: monster.id,
            monster_name: monster.name,
            tier: monster.tier,
            level: monster.level,
            hero_hp: heroHp,
            enemies: nextEnemies.map(({ id, name, hp, maxHp }) => ({ id, name, hp, maxHp })),
            log: [`${heroCrit ? "CRÍTICO! " : ""}Você causou ${heroDamage} de dano em ${target.name}.`, ...log.map((item) => item.text)].slice(0, 20),
            equipment: equippedItems.map((item) => item.name),
            pets: pets.map((item) => item.name),
            consumable: stats.selectedConsumable?.name ?? null,
          }, stats.selectedConsumable?.id ?? null);
          setReward(result.claimed ? `Vitória registrada: +${result.xp} XP e +${result.coins} moeda${pets.length && Number(result.pet_xp) > 0 ? `; +${result.pet_xp} XP para pet` : ""}.` : safeText(result.message, "Esse monstro já foi derrotado."));
        } catch (err) {
          setError(err instanceof Error ? err.message : safeText(err));
        }
      });
      return;
    }

    let incomingTotal = 0;
    const attackers = nextEnemies.filter(enemy => enemy.hp > 0);
    for (const enemy of attackers) {
      const monsterCrit = didCrit(enemy.critChance);
      const baseIncoming = Math.max(1, roll(enemy.attack - 2, enemy.attack + 4) - stats.defense);
      const incoming = monsterCrit ? Math.round(baseIncoming * 1.7) : baseIncoming;
      incomingTotal += incoming;
      append(`${monsterCrit ? "CRÍTICO do oponente! " : ""}${enemy.name} causou ${incoming} de dano.`, "bad");
    }
    startTransition(async () => {
      try {
        const state = await takeArenaDamage(stats.maxHp, incomingTotal);
        setHeroHp(state.current_hp);
        setNextHpAt(state.next_hp_at);
        if (state.current_hp <= 0) {
          setFinished("lose");
          append("Seu HP zerou. Ele volta 1 ponto por hora, ou você pode usar uma poção.", "bad");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : safeText(err));
      }
    });
  }

  function buyPotion() {
    startTransition(async () => {
      try { setPotions(await buyArenaPotion()); setError(""); setReward("Poção comprada por 10 moedas."); }
      catch (err) { setError(err instanceof Error ? err.message : safeText(err)); }
    });
  }

  function drinkPotion() {
    startTransition(async () => {
      try {
        const state = await drinkArenaPotion(stats.maxHp);
        setHeroHp(state.current_hp);
        setNextHpAt(state.next_hp_at);
        setPotions(state.potions ?? 0);
        setError("");
        setReward(`Poção usada: HP ${state.current_hp}/${stats.maxHp}.`);
      } catch (err) { setError(err instanceof Error ? err.message : safeText(err)); }
    });
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="rounded-3xl border border-violet-800 bg-gradient-to-br from-slate-900 to-violet-950 p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">Arena</p><h2 className="mt-2 text-xl font-black">Aly vs Monstros</h2><p className="mt-1 text-sm text-slate-300">Fases com inimigo médio, difícil e duelo final. Cada vitória vale uma vez.</p></div>
          <div className="text-4xl">🧙🏻‍♂️</div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-400">HP</p><p className="font-bold">{heroHp}/{stats.maxHp}</p></div>
          <div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-400">Ataque</p><p className="font-bold">{stats.attackMin}-{stats.attackMax}</p></div>
          <div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-400">Def/Crít</p><p className="font-bold">{stats.defense}/{Math.round(stats.critChance * 100)}%</p></div>
          <div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-400">Vitórias</p><p className="font-bold">{defeatedCount}</p></div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-800 bg-slate-900 p-4 text-sm">
        <h3 className="font-bold">💚 Vida do personagem</h3>
        <p className="mt-1 text-slate-300">O dano permanece entre batalhas. Recupera 1 HP por hora{nextRecovery !== null ? ` · próximo ponto em ${Math.floor(nextRecovery / 60)}h ${String(nextRecovery % 60).padStart(2,"0")}min` : ""}.</p>
        <p className="mt-2 font-semibold">Poções: {potions} · cada uma recupera 25 HP</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button disabled={pending} onClick={buyPotion} className="rounded-xl border border-emerald-600 p-2 font-bold disabled:opacity-50">Comprar · 10 🪙</button>
          <button disabled={pending || !potions || heroHp >= stats.maxHp} onClick={drinkPotion} className="rounded-xl bg-emerald-700 p-2 font-bold disabled:opacity-50">Usar poção</button>
        </div>
        {reward && !started && <p className="mt-2 text-emerald-300">{reward}</p>}
        {error && !started && <p role="alert" className="mt-2 text-red-300">{error}</p>}
      </div>

      {availableMonsters.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {availableMonsters.map(item => (
          <button key={item.id} type="button" onClick={() => startBattle(item)} className={`rounded-2xl border p-3 text-left ${monster?.id === item.id && started ? "border-violet-400 bg-violet-950" : "border-slate-700 bg-slate-900"}`}>
            <div className="flex items-start justify-between gap-2"><span className="text-2xl">{item.icon}</span><span className="rounded-full bg-slate-950 px-2 py-1 text-[10px] uppercase text-slate-300">Fase {item.level} · {item.tier === "medium" ? "Médio" : item.tier === "hard" ? "Difícil" : "Duelo"}</span></div>
            <span className="mt-2 block text-sm font-bold">{item.name}</span>
            <span className="mt-1 block text-xs text-slate-400">HP {item.tier === "boss" ? "duplo" : item.hp} · DEF {item.defense} · crítico {Math.round(item.critChance * 100)}%</span>
          </button>
        ))}
      </div> : <div className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-100">Você derrotou todos os monstros disponíveis.</div>}

      {nextLocked && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">Próximo bloqueado: {nextLocked.icon} <b>{nextLocked.name}</b>. Derrote mais {Math.max(0, nextLocked.requiredWins - defeatedCount)} monstro(s) para liberar.</div>}

      {monster && <div className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900">
        <div className="border-b border-slate-800 bg-[radial-gradient(circle_at_top,#334155,#020617_65%)] p-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Fase {monster.level}: {monster.name}</h3><p className="mt-1 text-xs text-slate-300">{monster.description}</p></div>{!started && <button onClick={() => startBattle()} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold">Entrar</button>}</div>
          <div className="relative mt-5 flex min-h-64 items-end rounded-2xl border border-slate-700 bg-gradient-to-b from-emerald-950/60 to-slate-950 p-3 shadow-inner sm:p-4">
            <div className="absolute inset-x-4 bottom-12 h-1 rounded-full bg-emerald-900/70" />
            <div className="relative z-10 grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)] items-end gap-2">
              <div className="min-w-0">
                <div className={`mb-2 text-center text-5xl transition-transform duration-300 sm:text-6xl ${heroPulse ? "translate-x-5 scale-110" : ""}`} aria-label="Personagem Aly">🧙🏻‍♂️</div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/90 p-2 text-[11px]"><div className="flex flex-wrap justify-between gap-x-1"><span>Aly</span><span>{heroHp}/{stats.maxHp}</span></div><div className="mt-1 h-2 rounded bg-slate-800"><div className="h-2 rounded bg-emerald-500" style={{ width: pct(heroHp, stats.maxHp) }} /></div></div>
              </div>
              <div className="flex min-w-0 items-end justify-end gap-1 sm:gap-2">
                {(enemies.length ? enemies : teamFor(monster)).map(enemy => <div key={enemy.id} className={`min-w-0 flex-1 text-center transition-transform duration-300 sm:max-w-28 ${enemyPulse === enemy.id ? "-translate-x-3 scale-110" : ""} ${enemy.hp <= 0 ? "opacity-30 grayscale" : ""}`}><div className="mb-2 text-5xl sm:text-6xl" aria-label={enemy.name}>{enemy.icon}</div><div className="rounded-xl border border-slate-700 bg-slate-950/90 p-2 text-[11px]"><div className="truncate" title={enemy.name}>{enemy.name}</div><div className="mt-1 h-2 rounded bg-slate-800"><div className="h-2 rounded bg-rose-500" style={{ width: pct(enemy.hp, enemy.maxHp) }} /></div><div className="mt-1 text-slate-400">{enemy.hp}/{enemy.maxHp}</div></div></div>)}
              </div>
            </div>
          </div>
        </div>
        {started && <div className="p-4">
          {!finished && consumables.length > 0 && <label className="mb-3 block text-xs text-slate-300">Consumível nesta batalha<select value={selectedConsumableId} onChange={(event) => setSelectedConsumableId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"><option value="">Nenhum</option>{consumables.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name} · boost de batalha</option>)}</select></label>}
          <button disabled={!!finished || pending} onClick={attack} className="w-full rounded-2xl bg-emerald-600 py-3 font-black disabled:bg-slate-700">{finished === "win" ? "Vitória!" : finished === "lose" ? "Derrota" : pending ? "Registrando..." : "⚔️ Atacar"}</button>
          {finished === "lose" && <button onClick={() => startBattle(monster)} className="mt-2 w-full rounded-2xl border border-violet-700 py-3 font-bold text-violet-200">Tentar de novo</button>}
          {reward && <p className="mt-3 rounded-xl bg-emerald-950 p-3 text-sm text-emerald-200">{reward}</p>}
          {error && <p className="mt-3 rounded-xl bg-red-950 p-3 text-sm text-red-200">{error}</p>}
          <div className="mt-4 space-y-2">{log.map(item => <p key={item.id} className={`rounded-xl border p-2 text-xs ${item.tone === "good" ? "border-emerald-900 text-emerald-300" : item.tone === "bad" ? "border-red-900 text-red-300" : "border-slate-800 text-slate-300"}`}>{item.text}</p>)}</div>
        </div>}
      </div>}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm">
        <h3 className="font-bold">Equipados</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">{equippedItems.map(item => <span key={item.name} className="rounded-full bg-slate-950 px-3 py-2">{item.icon} {item.name}</span>)}{pets.map(item => <span key={item.name} className="rounded-full bg-fuchsia-950 px-3 py-2">{item.icon} {item.name}</span>)}{!equippedItems.length && !pets.length && <span className="text-slate-400">Nenhum item equipado.</span>}</div>{consumables.length > 0 && <p className="mt-3 text-xs text-slate-400">Consumíveis disponíveis: {consumables.length}. Eles são gastos quando uma vitória é registrada.</p>}
      </div>
    </section>
  );
}
