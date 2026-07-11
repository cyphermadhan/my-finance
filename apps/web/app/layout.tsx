import '../src/styles/tokens.css';
import '../src/styles/app.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wealth',
  description: 'Family wealth dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body>{children}</body>
    </html>
  );
}
