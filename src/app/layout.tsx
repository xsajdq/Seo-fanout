import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SEO Fanout Analyzer',
  description: 'Analiza SEO stron i drzew tematycznych z AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <nav className="bg-slate-900 text-white text-sm">
          <div className="max-w-5xl mx-auto px-4 py-2 flex gap-6">
            <a href="/analyze" className="text-slate-300 hover:text-white transition-colors">
              🔍 Analiza strony
            </a>
            <a href="/domain" className="text-slate-300 hover:text-white transition-colors">
              🌐 Audyt domeny
            </a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
