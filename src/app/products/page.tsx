// src/app/products/page.tsx
import React, { Suspense } from "react";
import Navbar from "@/components/Navbar";
import ProductPageClient from "@/app/products/ProductListClient";
export const metadata = {
  title: 'Products',
  description: 'Sản phẩm bạn cần ở đây',
};
export default function ProductsPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 pb-6">
        <Suspense fallback={<p>Đang tải sản phẩm...</p>}>
          <ProductPageClient />
        </Suspense>
      </main>
    </>
  );
}
