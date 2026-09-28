import Link from "next/link";
export default function Page() { return <main className="p-8"><h1 className="text-2xl font-bold">Confira seu e-mail</h1><p>Use o link de confirmação para ativar sua conta.</p><Link href="/auth/login">Voltar ao login</Link></main>; }
