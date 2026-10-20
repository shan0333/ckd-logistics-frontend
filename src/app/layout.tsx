import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import LayoutShell from '@/components/layout/LayoutShell';
import { ICON_URL } from '@/lib/branding';

export const metadata: Metadata = {
  icons: { icon: ICON_URL, apple: ICON_URL },
  title: 'CKD Logistics',
  description: 'Shipment tracking — Origin, Destination, Dashboard & Reports',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 antialiased" suppressHydrationWarning>
        <Toaster position="top-right" />
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
