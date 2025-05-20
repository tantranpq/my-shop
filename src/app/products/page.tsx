// src/app/products/page.tsx
import React, { Suspense } from "react";
import Navbar from "@/components/Navbar";
import ProductPageClient from "@/app/products/ProductListClient";

export default function ProductsPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <Suspense fallback={<p>Đang tải sản phẩm...</p>}>
          <ProductPageClient />
        </Suspense>
      </main>
    </>
  );
}
