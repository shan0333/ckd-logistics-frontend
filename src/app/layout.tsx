import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import LayoutShell from '@/components/layout/LayoutShell';

export const metadata: Metadata = {
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
