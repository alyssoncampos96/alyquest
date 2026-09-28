export function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  const base = "https://alyquest.invalid";
  const parsed = new URL(value, base);
  return parsed.origin === base ? parsed.pathname + parsed.search + parsed.hash : "/";
}
