"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="mx-auto max-w-md p-6 pb-28"><h1 className="text-xl font-bold">Não foi possível carregar sua jornada</h1><p className="mt-3">Confira sua conexão e tente novamente. Se o problema continuar, verifique as tabelas e permissões no Supabase.</p><button onClick={reset} className="mt-4 rounded-xl bg-violet-600 p-3">Tentar novamente</button><Link className="ml-4" href="/auth/login">Entrar novamente</Link></main>; }
