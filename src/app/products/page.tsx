"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProductList from '@/components/ProductsList';
import Navbar from '@/components/Navbar';
import { useCart } from '@/context/CartContext';
import { Product } from '@/types/product';

async function getProducts(searchTerm: string | null): Promise<Product[]> {
  let query = supabase.from("products").select("*");
  if (searchTerm) {
    query = query.ilike('name', `%${searchTerm}%`);
  }
  const { data: products, error } = await query;
  if (error) {
    console.error(error);
    return [];
  }
  return products || [];
}

export default function ProductsPage() {
  const { addToCart } = useCart();
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get('search');
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const data = await getProducts(searchTerm);
        setProducts(data);
        setError(null);
      } catch (e) {
        setError("Failed to fetch products");
      }
      setLoading(false);
    }
    fetchProducts();
  }, [searchTerm]);

  const handleAddToCart = (product: Product) => {
    addToCart(product);
  };

  if (loading) return <p>Đang tải sản phẩm...</p>;
  if (error) return <p>Lỗi: {error}</p>;

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">
          {searchTerm ? `Kết quả tìm kiếm cho '${searchTerm}'` : 'Sản phẩm'}
        </h1>
        {products.length > 0 ? (
          <ProductList products={products} onAddToCart={handleAddToCart} />
        ) : (
          <p>Không tìm thấy sản phẩm phù hợp.</p>
        )}
      </main>
    </>
  );
}
