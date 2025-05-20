"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

interface CheckoutSearchParamsHandlerProps {
  onSearchParams: (items: string[] | null) => void;
}

const CheckoutSearchParamsHandler: React.FC<CheckoutSearchParamsHandlerProps> = ({ onSearchParams }) => {
  const searchParams = useSearchParams();
  const selectedItemSlugs = searchParams.get('items')?.split(',') || null;

  useEffect(() => {
    onSearchParams(selectedItemSlugs);
  }, [searchParams, onSearchParams]);

  return null; // Component này không render UI trực tiếp
};

export default CheckoutSearchParamsHandler;