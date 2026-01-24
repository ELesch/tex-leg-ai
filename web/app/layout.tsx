import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'TexLegAI - Texas Legislature Bill Analyzer',
    template: '%s | TexLegAI',
  },
  description:
    'AI-powered tool for browsing, searching, and analyzing Texas Legislature bills',
  keywords: [
    'Texas Legislature',
    'bills',
    'AI',
    'analysis',
    'law',
    'government',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
