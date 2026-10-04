import { RewardToast } from '@/components/reward-toast';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BottomNav } from '@/components/bottom-nav';
import { createClient } from '@/lib/supabase/server';

export const instant = false;

export const metadata: Metadata = { title: 'AlyQuest', description: 'Seu RPG pessoal de produtividade.', applicationName: 'AlyQuest', icons: { apple: '/icon-192.png' }, appleWebApp: { capable: true, title: 'AlyQuest', statusBarStyle: 'black-translucent' } };
export const viewport: Viewport = { themeColor: '#080a13', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let theme = 'default';
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('aq_theme_preferences').select('theme').eq('user_id', user.id).maybeSingle();
      theme = data?.theme || 'default';
    }
  } catch {}
  return <html lang="pt-BR"><body className={`theme-${theme} text-white antialiased`}>{children}<RewardToast/><BottomNav/></body></html>;
}
