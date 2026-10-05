export function cleanName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 80) throw new Error("Informe um nome de até 80 caracteres.");
  return name;
}
export function displayName(metadata: Record<string, unknown>) {
  for (const value of [metadata.display_name, metadata.full_name, metadata.name]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Seu personagem";
}
export function cleanCategory(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 80) throw new Error("Informe uma categoria de até 80 caracteres.");
  return name;
}
export function customCategories(metadata: Record<string, unknown>): string[] {
  return Array.isArray(metadata.task_categories) ? metadata.task_categories.filter((v): v is string => typeof v === "string" && !!v.trim() && v.length <= 80).map(v => v.trim()) : [];
}
