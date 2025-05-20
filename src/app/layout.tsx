// app/layout.tsx
"use client";
import "./globals.css";
import { useCart, CartProvider } from "../context/CartContext";
import { supabase } from "../lib/supabase";
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { useState } from 'react';

const Notification = () => {
  const { notification } = useCart();

  if (notification) {
    return (
<div
        className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-md shadow-md z-50"
        style={{ zIndex: 100 }} // Thêm inline style để tăng z-index
      >
        {notification}
      </div>
    );
  }
  return null;
};

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