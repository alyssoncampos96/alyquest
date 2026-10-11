import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;
const bucket = 'aq-wardrobe';
const monthlyLimit = 6;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Origem inválida.' }, { status: 403 });
  const key = process.env.WARDROBE_OPENAI_API_KEY;
  if (!key) return Response.json({ error: 'O tratamento de foto ainda não está configurado.' }, { status: 503 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: 'Peça inválida.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
  const { data: item, error: itemError } = await supabase.from('aq_wardrobe_items').select('id,photo_path,processed_path').eq('id', id).eq('user_id', user.id).is('archived_at', null).maybeSingle();
  if (itemError || !item) return Response.json({ error: 'Peça não encontrada.' }, { status: 404 });
  if (item.processed_path) return Response.json({ error: 'Esta foto já foi tratada.' }, { status: 409 });
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const month = `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}`;
  const { count, error: countError } = await supabase.from('aq_wardrobe_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('processed_at', `${month}-01T00:00:00-03:00`);
  if (countError) return Response.json({ error: 'Não consegui conferir o limite mensal.' }, { status: 503 });
  if ((count ?? 0) >= monthlyLimit) return Response.json({ error: 'Limite conservador de seis fotos tratadas neste mês atingido.' }, { status: 429 });
  const { data: source, error: downloadError } = await supabase.storage.from(bucket).download(item.photo_path);
  if (downloadError || !source) return Response.json({ error: 'Não consegui ler a foto original.' }, { status: 503 });
  const form = new FormData();
  form.set('model', 'gpt-image-2.5-flare');
  form.set('background', 'transparent');
  form.set('output_format', 'png');
  form.set('quality', 'low');
  form.set('size', '1024x1024');
  form.set('prompt', 'Create a clean product-catalog cutout of only the single clothing item shown. Remove the bed, floor, person, hangers, hands, props and all background. Preserve the exact garment shape, color, print, texture, seams and visible wear; do not invent details, change the garment or add text. Center it on a fully transparent background with soft natural lighting.');
  form.set('image', source, item.photo_path.split('/').at(-1) ?? 'clothing.jpg');
  let result: Response;
  try { result = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(45000) }); }
  catch { return Response.json({ error: 'O tratamento demorou demais. Tente novamente mais tarde.' }, { status: 504 }); }
  if (!result.ok) return Response.json({ error: 'A IA não conseguiu tratar esta foto. Tente outra imagem.' }, { status: 502 });
  const body = await result.json() as { data?: { b64_json?: string }[] };
  const encoded = body.data?.[0]?.b64_json;
  if (!encoded) return Response.json({ error: 'A IA não devolveu uma imagem.' }, { status: 502 });
  const output = Buffer.from(encoded, 'base64');
  if (output.length > 8 * 1024 * 1024 || output.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return Response.json({ error: 'A imagem tratada veio em um formato inesperado.' }, { status: 502 });
  const path = `${user.id}/${id}/treated.png`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, output, { contentType: 'image/png', upsert: false });
  if (uploadError) return Response.json({ error: 'Não consegui guardar a imagem tratada.' }, { status: 503 });
  const { error: updateError } = await supabase.from('aq_wardrobe_items').update({ processed_path: path, processed_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
  if (updateError) { await supabase.storage.from(bucket).remove([path]); return Response.json({ error: 'Não consegui vincular a imagem tratada à peça.' }, { status: 503 }); }
  return Response.json({ ok: true });
}
