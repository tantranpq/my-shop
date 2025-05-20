// app/ClientProviders.tsx
'use client';

import { CartProvider } from '../context/CartContext';
import { supabase } from '../lib/supabase';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { useState } from 'react';
import Notification from './notification';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() => supabase);

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={undefined}
    >
      <CartProvider>
        <Notification />
        {children}
      </CartProvider>
    </SessionContextProvider>
  );
}
