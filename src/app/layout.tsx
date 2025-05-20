// app/layout.tsx
import "./globals.css";
import { CartProvider } from "../context/CartContext";
import { supabase } from "../lib/supabase";
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import Notification from '../app/notification';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Store',
  description: 'A sample Next.js store',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionContextProvider
          supabaseClient={supabase} // Khởi tạo trực tiếp
          initialSession={undefined}
        >
          <CartProvider>
            <Notification />
            {children}
          </CartProvider>
        </SessionContextProvider>
      </body>
    </html>
  );
}