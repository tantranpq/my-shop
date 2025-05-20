// 

"use client";
import { useSearchParams } from 'next/navigation';

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const items = searchParams.get('items');

  return (
    <div>
      <h1>Checkout</h1>
      <p>Items: {items}</p>
    </div>
  );
}