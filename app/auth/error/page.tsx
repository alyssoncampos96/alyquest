import Link from "next/link";
export default function Page() { return <main className="p-8"><h1 className="text-2xl font-bold">Não foi possível confirmar o acesso</h1><p>O link pode ter expirado. Solicite outro e tente novamente.</p><Link href="/auth/login">Voltar ao login</Link></main>; }
