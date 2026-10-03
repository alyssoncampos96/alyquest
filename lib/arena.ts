export type ArenaMonster = {
  id: string;
  name: string;
  icon: string;
  description: string;
  hp: number;
  attack: number;
  rewardXp: number;
  rewardCoins: number;
};

export const arenaMonsters: ArenaMonster[] = [
  { id: "training-slime", name: "Slime de Treino", icon: "🟢", description: "Fraco, bom para testar equipamento.", hp: 30, attack: 4, rewardXp: 2, rewardCoins: 2 },
  { id: "habit-goblin", name: "Goblin da Procrastinação", icon: "👺", description: "Rouba tempo quando você deixa tarefas acumularem.", hp: 55, attack: 7, rewardXp: 4, rewardCoins: 4 },
  { id: "chaos-ogre", name: "Ogro da Bagunça", icon: "🧌", description: "Mais resistente; pede bons itens equipados.", hp: 90, attack: 11, rewardXp: 8, rewardCoins: 8 },
  { id: "deadline-dragon", name: "Dragão dos Prazos", icon: "🐉", description: "Chefe da arena. Vença quando estiver forte.", hp: 150, attack: 16, rewardXp: 15, rewardCoins: 15 },
];

export function arenaMonsterById(id: string) {
  return arenaMonsters.find(monster => monster.id === id);
}
