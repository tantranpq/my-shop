// app/ClientProviders.tsx
'use client';

import { CartProvider } from '../context/CartContext';
import { supabase } from '../lib/supabase';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // Import TanStack Query
import Notification from './notification';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() => supabase);
  const [queryClient] = useState(() => new QueryClient({ // Khởi tạo QueryClient
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}> {/* Bọc các provider khác trong QueryClientProvider */}
      <SessionContextProvider
        supabaseClient={supabaseClient}
        initialSession={undefined}
      >
        <CartProvider>
          <Notification />
          {children}
        </CartProvider>
      </SessionContextProvider>
    </QueryClientProvider>
  );
}