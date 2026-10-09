import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Secure Internal Knowledge Hub | Enterprise RAG',
  description: 'Private, grounded AI knowledge assistant for verified company SOPs and documentation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased flex overflow-hidden">
        {children}
      </body>
    </html>
  );
}
