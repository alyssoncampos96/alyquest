export type ArenaTier = "medium" | "hard" | "boss";

export type ArenaMonster = {
  id: string;
  level: number;
  tier: ArenaTier;
  name: string;
  icon: string;
  description: string;
  hp: number;
  attack: number;
  defense: number;
  critChance: number;
  rewardXp: number;
  rewardCoins: number;
  requiredWins: number;
};

const mediumNames = [
  ["Lobo", "da Distração", "🐺"], ["Rato", "da Bagunça", "🐀"], ["Morcego", "do Cansaço", "🦇"], ["Aranha", "da Procrastinação", "🕷️"], ["Golem", "da Rotina", "🗿"],
  ["Serpente", "da Ansiedade", "🐍"], ["Corvo", "do Esquecimento", "🐦‍⬛"], ["Ogro", "do Acúmulo", "🧌"], ["Sombra", "da Preguiça", "🌑"], ["Guarda", "do Caos", "💂"],
];
const hardNames = [
  ["Goblin", "da Procrastinação", "👺"], ["Bruxa", "das Pendências", "🧙‍♀️"], ["Cavaleiro", "do Prazo", "🛡️"], ["Mago", "do Caos", "🧙"], ["Minotauro", "da Pressa", "🐂"],
  ["Espectro", "da Autossabotagem", "👻"], ["Titã", "da Desordem", "🦾"], ["Quimera", "das Desculpas", "🐲"], ["Sentinela", "do Sono", "🤖"], ["Dragão", "do Perfeccionismo", "🐉"],
];
const realms = ["Hábitos", "Foco", "Saúde", "Finanças", "Estudos", "Trabalho", "Coragem", "Disciplina", "Clareza", "Consistência"];

function pick(list: string[][], index: number) {
  return list[index % list.length];
}

function makeMonster(level: number, tier: ArenaTier): ArenaMonster {
  const base = tier === "medium" ? pick(mediumNames, level - 1) : pick(hardNames, level - 1);
  const realm = realms[Math.floor((level - 1) / 10) % realms.length];
  const requiredBase = (level - 1) * 3;
  if (tier === "boss") {
    return {
      id: `level-${level}-boss`,
      level,
      tier,
      name: `Duelo dos Guardiões de ${realm}`,
      icon: "🐉",
      description: "Os dois últimos inimigos atacam juntos. Você precisa derrubar os dois para vencer.",
      hp: 90 + level * 18,
      attack: 15 + Math.ceil(level * 2.4),
      defense: 6 + Math.floor(level * 0.8),
      critChance: Math.min(0.34, 0.14 + level * 0.002),
      rewardXp: 10 + level * 4,
      rewardCoins: 1,
      requiredWins: requiredBase + 2,
    };
  }
  const hard = tier === "hard";
  return {
    id: `level-${level}-${tier}`,
    level,
    tier,
    name: `${base[0]} ${base[1]}`,
    icon: base[2],
    description: hard ? "Inimigo forte da fase. Ele bate mais pesado e tem mais chance de crítico." : "Desafio médio para avançar na fase.",
    hp: (hard ? 62 : 44) + level * (hard ? 13 : 10),
    attack: (hard ? 10 : 7) + Math.ceil(level * (hard ? 1.85 : 1.45)),
    defense: (hard ? 4 : 2) + Math.floor(level * (hard ? 0.55 : 0.35)),
    critChance: Math.min(hard ? 0.28 : 0.2, (hard ? 0.11 : 0.07) + level * 0.0015),
    rewardXp: (hard ? 5 : 3) + level * (hard ? 2 : 1),
    rewardCoins: 1,
    requiredWins: requiredBase,
  };
}

export const arenaMonsters: ArenaMonster[] = Array.from({ length: 100 }, (_, i) => i + 1).flatMap(level => [
  makeMonster(level, "medium"),
  makeMonster(level, "hard"),
  makeMonster(level, "boss"),
]);

export function arenaMonsterById(id: string) {
  return arenaMonsters.find(monster => monster.id === id);
}

export function unlockedArenaMonsters(defeatedCount: number) {
  return arenaMonsters.filter(monster => defeatedCount >= monster.requiredWins);
}

export function arenaPhaseForMonster(monster: ArenaMonster) {
  return Math.ceil(monster.level);
}
