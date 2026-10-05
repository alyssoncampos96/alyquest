export const notificationPhrases = [
  "Bom dia! Seu mapa de missões já está brilhando por aqui.",
  "Passando com energia: tem missão esperando você ganhar XP hoje.",
  "Seu eu do futuro agradece se você olhar essas pendências agora.",
  "A aventura do dia começou. Bora escolher a primeira missão?",
  "Tem tarefa pedindo atenção e recompensa querendo cair na conta.",
  "Hora de abrir o painel e fazer o dia render com estilo.",
  "Seu reino não se organiza sozinho. Mas hoje dá para avançar bonito.",
  "Pequenas missões, grandes combos. Dá uma olhada no que tem hoje.",
  "AlyQuest chamando: seu próximo ponto de XP pode estar a um clique.",
  "Hoje tem chance real de vencer o chefão da procrastinação.",
  "Respira, escolhe uma missão e deixa o placar subir.",
  "Agenda no radar: vem ver o que merece sua atenção agora.",
  "Seu inventário de energia está pronto. Falta só escolher a missão.",
  "Lembrete amigável: tarefa feita vira moeda, XP e paz mental.",
  "O dia está oferecendo XP. Seria deselegante recusar.",
  "Missões pendentes detectadas. Nada dramático, só oportunidade.",
  "Você não precisa fazer tudo agora. Só precisa escolher o próximo passo.",
  "A lista está chamando com educação, mas com brilho nos olhos.",
  "Mais um dia, mais uma chance de deixar o AlyQuest bonito.",
  "Se fosse jogo, essa seria a hora de pegar a missão diária.",
];

export function phraseFor(index: number) {
  return notificationPhrases[Math.abs(index) % notificationPhrases.length];
}

export function formatWeekdays(days: number[]) {
  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return days.map(day => labels[day] ?? "").filter(Boolean).join(", ");
}
