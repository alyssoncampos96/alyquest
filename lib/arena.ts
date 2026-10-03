export type ArenaMonster = {
  id: string;
  level: number;
  tier: "medium" | "hard" | "boss";
  name: string;
  icon: string;
  description: string;
  hp: number;
  attack: number;
  critChance: number;
  rewardXp: number;
  rewardCoins: number;
  requiredWins?: number;
};

export const arenaMonsters: ArenaMonster[] = [
  { id: "level-1-wolf", level: 1, tier: "medium", name: "Lobo da Distração", icon: "🐺", description: "Rápido, mas ainda é um bom primeiro desafio.", hp: 42, attack: 6, critChance: 0.08, rewardXp: 3, rewardCoins: 1, requiredWins: 0 },
  { id: "level-1-goblin", level: 1, tier: "hard", name: "Goblin da Procrastinação", icon: "👺", description: "Bate mais forte quando você deixa tarefas acumularem.", hp: 65, attack: 9, critChance: 0.12, rewardXp: 5, rewardCoins: 1, requiredWins: 0 },
  { id: "level-2-ogre", level: 2, tier: "medium", name: "Ogro da Bagunça", icon: "🧌", description: "Resistente; pede bons equipamentos.", hp: 95, attack: 12, critChance: 0.12, rewardXp: 8, rewardCoins: 1, requiredWins: 2 },
  { id: "level-2-mage", level: 2, tier: "hard", name: "Mago do Caos", icon: "🧙", description: "Usa crítico com frequência e pune descuido.", hp: 115, attack: 14, critChance: 0.18, rewardXp: 10, rewardCoins: 1, requiredWins: 2 },
  { id: "level-3-dragon", level: 3, tier: "boss", name: "Dragão dos Prazos", icon: "🐉", description: "Chefe formado pelos dois últimos desafios.", hp: 170, attack: 18, critChance: 0.2, rewardXp: 16, rewardCoins: 1, requiredWins: 4 },
];

export function arenaMonsterById(id: string) {
  return arenaMonsters.find(monster => monster.id === id);
}

export function unlockedArenaMonsters(defeatedCount: number) {
  return arenaMonsters.filter(monster => defeatedCount >= (monster.requiredWins ?? 0));
}
