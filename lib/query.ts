export function checked<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error("Não foi possível carregar os dados do Supabase. Verifique a conexão e as permissões da conta.");
  return result;
}
