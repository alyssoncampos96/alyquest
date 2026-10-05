"use client";
import { useState } from "react";
import { addTaskCategory } from "@/app/preference-actions";
import { field } from "@/lib/planning";
export function TaskCategorySelect({ options, initial }: { options: string[]; initial: string }) {
  const [added, setAdded] = useState<string[]>([]);
  const [selected, setSelected] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function add() {
    setPending(true); setError("");
    try {
      const category = await addTaskCategory(name);
      setAdded(current => [...current, category]); setSelected(category);
      setName(""); setCreating(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar a categoria."); }
    finally { setPending(false); }
  }
  return <div className="text-sm"><label>Categoria<select name="category" value={selected} onChange={e => setSelected(e.target.value)} className={field}>{[...new Set([...options, ...added, initial])].map(c => <option key={c}>{c}</option>)}</select></label>
    <button type="button" onClick={() => setCreating(v => !v)} className="mt-2 text-xs text-violet-300">{creating ? "Cancelar" : "+ Criar categoria"}</button>
    {creating && <div className="mt-2 space-y-2"><input aria-label="Nome da nova categoria" value={name} maxLength={80} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (name.trim() && !pending) void add(); } }} placeholder="Ex.: Estudos" className={field}/><button type="button" disabled={pending || !name.trim()} onClick={add} className="rounded-xl bg-violet-600 px-3 py-2 disabled:opacity-50">{pending ? "Criando..." : "Salvar categoria"}</button></div>}
    {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
  </div>;
}
