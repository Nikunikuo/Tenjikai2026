import type { Metadata } from 'next';
import './globals.css';
const pageMetadata: Metadata = {
  title: 'AIR LOOP — 展示会のための動画プレイヤー',
  description:
    'ローカル動画を、好きな順番でずっと。連続ループと空中操作で楽しむ展示用プレイヤー。',
  openGraph: {
    title: 'AIR LOOP',
    description:
      'YOUR SPACE. YOUR SCREEN. ローカル動画を好きな順番で、ずっと。',
    images: [
      {
        url: '/og.png',
        width: 1536,
        height: 1024,
        alt: 'AIR LOOP — YOUR SPACE. YOUR SCREEN.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AIR LOOP',
    description: '展示会のための連続ループ・空中操作プレイヤー',
    images: ['/og.png'],
  },
};
export function generateMetadata(): Metadata {
  // Set from the exact Sites deployment URL; never infer origins from request headers.
  const origin = process.env.AIR_LOOP_ORIGIN || 'http://localhost:4318';
  return { ...pageMetadata, metadataBase: new URL(origin) };
}
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="dark">
      <body>{children}</body>
    </html>
  );
}
