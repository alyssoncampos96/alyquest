/* eslint-disable @next/next/no-img-element -- private, short-lived Supabase URLs should not enter the shared Next image optimizer cache. */
'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { categoryLabels, conditionLabels, occasionLabels, suggestOutfits, wardrobeCategories, wardrobeConditions, wardrobeOccasions, type WardrobeCondition, type WardrobeItem, type WardrobeOccasion } from '@/lib/wardrobe';

const field = 'mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white';
const colors = ['preto', 'branco', 'cinza', 'bege', 'marrom', 'azul-marinho', 'azul', 'verde', 'vermelho', 'amarelo', 'roxo', 'rosa', 'laranja', 'estampado'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function WardrobeScreen({ userId, initialItems }: { userId: string; initialItems: WardrobeItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [occasion, setOccasion] = useState<WardrobeOccasion>('work');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [selectedOccasions, setSelectedOccasions] = useState<WardrobeOccasion[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => setItems(initialItems), [initialItems]);
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const outfits = useMemo(() => suggestOutfits(items, occasion), [items, occasion]);
  const supabase = useMemo(() => createClient(), []);

  function toggleOccasion(value: WardrobeOccasion) {
    setSelectedOccasions(current => current.includes(value) ? current.filter(entry => entry !== value) : [...current, value]);
  }
  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { setError('Escolha uma foto JPG, PNG ou WebP de até 8 MB.'); return; }
    const form = event.currentTarget;
    const values = new FormData(form);
    const id = crypto.randomUUID();
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const photoPath = `${userId}/${id}/original.${extension}`;
    setBusy(true);
    try {
      const { error: uploadError } = await supabase.storage.from('aq-wardrobe').upload(photoPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from('aq_wardrobe_items').insert({
        id, user_id: userId, name: String(values.get('name') ?? '').trim(), category: String(values.get('category')),
        color: String(values.get('color')), condition: String(values.get('condition')), occasions: selectedOccasions,
        photo_path: photoPath, purchased_on: values.get('purchased_on') || null,
      });
      if (insertError) { await supabase.storage.from('aq-wardrobe').remove([photoPath]); throw insertError; }
      form.reset(); setFile(null); setSelectedOccasions([]); setMessage('Peça adicionada ao seu guarda-roupa.');
      router.refresh();
    } catch { setError('Não consegui salvar a peça. Confira sua sessão, conexão e a configuração do guarda-roupa.'); }
    finally { setBusy(false); }
  }
  async function editItem(item: WardrobeItem, values: { condition?: WardrobeCondition; occasions?: WardrobeOccasion[]; last_worn_on?: string | null; archived_at?: string; prefer_original?: boolean }) {
    setError(''); setMessage('');
    const { error: updateError } = await supabase.from('aq_wardrobe_items').update(values).eq('id', item.id).eq('user_id', userId);
    if (updateError) { setError('Não consegui atualizar a peça. Tente novamente.'); return; }
    setEditing(null); setMessage('Peça atualizada.'); router.refresh();
  }
  return <main className="min-h-screen px-4 pb-28 pt-6"><div className="mx-auto max-w-md space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-[.22em] text-violet-300">Seu estilo, suas regras</p><h1 className="mt-1 text-3xl font-black">👕 Guarda-roupa</h1><p className="mt-2 text-sm text-slate-300">Fotografe cada peça, indique onde gosta de usá-la e descubra combinações com o que já tem.</p></header>

    <section className="rounded-3xl border border-violet-800 bg-gradient-to-br from-violet-950/80 to-slate-900 p-4"><h2 className="text-lg font-black">O que vestir?</h2><p className="mt-1 text-xs text-slate-300">Você decide a ocasião; as sugestões usam suas próprias peças e preferências.</p><div className="mt-3 flex flex-wrap gap-2">{wardrobeOccasions.map(value => <button key={value} type="button" aria-pressed={occasion === value} onClick={() => setOccasion(value)} className={`rounded-full border px-3 py-2 text-sm ${occasion === value ? 'border-violet-300 bg-violet-600 font-bold' : 'border-slate-600 bg-slate-950'}`}>{occasionLabels[value]}</button>)}</div>
      {outfits.length ? <div className="mt-4 space-y-3">{outfits.map((outfit, index) => <article key={outfit.items.map(item => item.id).join('-')} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3"><div className="flex items-center justify-between"><h3 className="font-bold">Combinação {index + 1}</h3><span className="text-xs text-violet-300">{occasionLabels[occasion]}</span></div><div className="mt-3 grid grid-cols-3 gap-2">{outfit.items.map(item => <div key={item.id} className="min-w-0"><div className="flex aspect-square items-center justify-center rounded-xl bg-slate-800">{item.image_url && <img src={item.image_url} alt={item.name} className="h-full w-full rounded-xl object-contain"/>}</div><p className="mt-1 truncate text-center text-[11px]">{item.name}</p></div>)}</div><p className="mt-2 text-xs text-slate-400">{outfit.reasons.join(' · ')}</p></article>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Cadastre uma parte de cima, uma de baixo e um calçado para receber ideias. Uma peça única também pode substituir as duas primeiras.</p>}
    </section>

    <details className="rounded-3xl border border-slate-700 bg-slate-900 p-4"><summary className="cursor-pointer text-lg font-black">+ Cadastrar uma peça</summary><form onSubmit={addItem} className="mt-4 space-y-3"><label className="block text-sm">Foto da peça<input type="file" accept="image/jpeg,image/png,image/webp" required onChange={event => setFile(event.target.files?.[0] ?? null)} className={`${field} text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-violet-700 file:px-3 file:py-2 file:text-white`}/></label>{preview && <div className="flex h-48 items-center justify-center rounded-xl bg-slate-800"><img src={preview} alt="Prévia da peça" className="h-full max-w-full object-contain"/></div>}<p className="text-xs text-slate-400">Fotografe uma peça por vez, bem iluminada. A imagem será exibida como você a enviou.</p><label className="block text-sm">Nome<input name="name" required maxLength={100} placeholder="Ex.: camiseta azul de treino" className={field}/></label><div className="grid grid-cols-2 gap-3"><label className="min-w-0 text-sm">Tipo<select name="category" className={field}>{wardrobeCategories.map(value => <option key={value} value={value}>{categoryLabels[value]}</option>)}</select></label><label className="min-w-0 text-sm">Cor principal<select name="color" className={field}>{colors.map(value => <option key={value}>{value}</option>)}</select></label><label className="min-w-0 text-sm">Estado<select name="condition" className={field}>{wardrobeConditions.map(value => <option key={value} value={value}>{conditionLabels[value]}</option>)}</select></label><label className="min-w-0 text-sm">Data da compra (opcional)<input name="purchased_on" type="date" className={field}/></label></div><fieldset><legend className="text-sm">Onde você gosta de usar?</legend><p className="text-xs text-slate-400">Opcional. Se escolher, essas ocasiões guiam as sugestões.</p><div className="mt-2 flex flex-wrap gap-2">{wardrobeOccasions.map(value => <label key={value} className={`rounded-full border px-3 py-2 text-xs ${selectedOccasions.includes(value) ? 'border-violet-400 bg-violet-800' : 'border-slate-600'}`}><input type="checkbox" checked={selectedOccasions.includes(value)} onChange={() => toggleOccasion(value)} className="mr-1"/>{occasionLabels[value]}</label>)}</div></fieldset><button disabled={busy} className="w-full rounded-xl bg-violet-600 px-4 py-3 font-bold disabled:opacity-50">{busy ? 'Salvando…' : 'Guardar peça'}</button></form></details>

    <section><div className="flex items-center justify-between"><h2 className="text-lg font-black">Minhas peças</h2><span className="text-sm text-slate-400">{items.length}</span></div>{items.length ? <div className="mt-3 grid grid-cols-2 gap-3">{items.map(item => <article key={item.id} className="min-w-0 rounded-2xl border border-slate-700 bg-slate-900 p-3"><div className="flex aspect-square items-center justify-center rounded-xl bg-slate-800">{item.image_url && <img src={item.image_url} alt={item.name} className="h-full w-full rounded-xl object-contain"/>}</div><h3 className="mt-2 truncate font-bold">{item.name}</h3><p className="text-xs text-slate-400">{categoryLabels[item.category]} · {item.color}</p><span className="mt-2 inline-block rounded-full bg-slate-800 px-2 py-1 text-[11px]">{conditionLabels[item.condition]}</span><div className="mt-3 space-y-2"><button type="button" onClick={() => setEditing(editing === item.id ? null : item.id)} className="w-full rounded-lg border border-slate-600 px-2 py-2 text-xs">{editing === item.id ? 'Fechar ajustes' : 'Ajustar uso / estado'}</button>{item.processed_path && <button type="button" onClick={() => void editItem(item, { prefer_original: !item.prefer_original })} className="w-full text-xs text-violet-300">{item.prefer_original ? 'Usar imagem anterior' : 'Usar foto original'}</button>}</div>{editing === item.id && <div className="mt-3 space-y-2 border-t border-slate-700 pt-3"><label className="block text-xs">Estado<select className={field} defaultValue={item.condition} onChange={event => void editItem(item, { condition: event.target.value as WardrobeCondition })}>{wardrobeConditions.map(value => <option key={value} value={value}>{conditionLabels[value]}</option>)}</select></label><p className="text-xs text-slate-400">Usar em:</p><div className="flex flex-wrap gap-1">{wardrobeOccasions.map(value => <button key={value} type="button" onClick={() => void editItem(item, { occasions: item.occasions.includes(value) ? item.occasions.filter(entry => entry !== value) : [...item.occasions, value] })} className={`rounded-full border px-2 py-1 text-[11px] ${item.occasions.includes(value) ? 'border-violet-400 bg-violet-900' : 'border-slate-600'}`}>{occasionLabels[value]}</button>)}</div><button type="button" onClick={() => void editItem(item, { last_worn_on: today() })} className="w-full rounded-lg border border-slate-600 p-2 text-xs">Usei hoje</button><button type="button" onClick={() => void editItem(item, { archived_at: new Date().toISOString() })} className="w-full p-2 text-xs text-amber-300">Arquivar peça</button></div>}</article>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">Seu guarda-roupa começa com uma foto.</p>}</section>
    {error && <p role="alert" className="rounded-xl border border-red-800 p-3 text-sm text-red-300">{error}</p>}{message && <p role="status" className="rounded-xl border border-emerald-800 p-3 text-sm text-emerald-300">{message}</p>}
  </div></main>;
}
