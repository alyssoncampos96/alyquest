import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WardrobeScreen } from '@/components/wardrobe-screen';
import type { WardrobeItem } from '@/lib/wardrobe';

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const { data, error } = await supabase.from('aq_wardrobe_items').select('id,name,category,color,condition,occasions,photo_path,processed_path,prefer_original,purchased_on,last_worn_on').eq('user_id', user.id).is('archived_at', null).order('created_at', { ascending: false });
  if (error) return <main className="mx-auto max-w-md px-4 pb-28 pt-6"><h1 className="text-2xl font-black">👕 Guarda-roupa</h1><p role="alert" className="mt-5 rounded-2xl border border-amber-700 p-4 text-amber-200">O guarda-roupa ainda precisa da atualização do Supabase para funcionar.</p></main>;
  const items = (data ?? []) as WardrobeItem[];
  const paths = [...new Set(items.flatMap(item => [item.processed_path, item.photo_path].filter((path): path is string => !!path)))];
  const { data: urls } = paths.length ? await supabase.storage.from('aq-wardrobe').createSignedUrls(paths, 3600) : { data: [] };
  const signed = new Map((urls ?? []).map((entry, index) => [paths[index], entry.signedUrl]));
  return <WardrobeScreen userId={user.id} initialItems={items.map(item => ({ ...item, image_url: signed.get(item.prefer_original ? item.photo_path : item.processed_path ?? item.photo_path) ?? signed.get(item.photo_path) ?? '' }))} aiEnabled={Boolean(process.env.WARDROBE_OPENAI_API_KEY)}/>;
}
