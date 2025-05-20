// app/layout.tsx
"use client";
import "./globals.css";
import { CartProvider } from "../context/CartContext";
import { supabase } from "../lib/supabase";
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { useState } from 'react';
import Notification from '../app/notification'; 

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [supabaseClient] = useState(() => supabase);

  return (
    <html lang="en">
      <body>
        <SessionContextProvider
          supabaseClient={supabaseClient}
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