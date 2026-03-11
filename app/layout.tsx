import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DeadWorld — Sobreviva no Fim do Mundo',
  description:
    'Jogo de sobrevivência zumbi online multiplayer. Explore o mapa real da sua cidade, mate zumbis, colete itens e suba no ranking global.',
  keywords: 'jogo zumbi, sobrevivência, multiplayer, mapa real, DeadWorld',
  openGraph: {
    title: 'DeadWorld',
    description: 'Sobreviva no fim do mundo. Jogue agora.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Share+Tech+Mono&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className="bg-black overflow-hidden select-none">{children}</body>
    </html>
  );
}
