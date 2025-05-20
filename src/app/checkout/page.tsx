import React, { Suspense } from 'react';
import CheckoutClient from './CheckoutClient';

export default function CheckoutPage() {
  return (
    <Suspense fallback={<p>Loading checkout...</p>}>
      <CheckoutClient />
    </Suspense>
  );
}
