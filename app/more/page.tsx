import Link from "next/link";

const links = [
  ["🍅", "Foco", "/focus"], ["⏱️", "Jejum", "/fasting"], ["👹", "Chefes", "/bosses"], ["⚔️", "Arena", "/arena"], ["🛍️", "Loja", "/shop"], ["🎒", "Inventário", "/inventory"], ["🧙", "Meu Personagem", "/character"], ["🏆", "Conquistas", "/achievements"], ["🔔", "Lembretes", "/notifications"],
];
export default function Page() {
  return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md"><h1 className="text-2xl font-black">Mais</h1><p className="mt-1 text-sm text-slate-400">Atalhos extras do AlyQuest.</p><div className="mt-5 grid grid-cols-2 gap-3">{links.map(([icon,label,href]) => <Link key={href} href={href} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><span className="text-3xl">{icon}</span><h2 className="mt-2 font-bold">{label}</h2></Link>)}</div></div></main>;
}
