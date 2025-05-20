"use client";

import { useSearchParams } from 'next/navigation';
import React from "react";
import { supabase } from "@/lib/supabase";
import { Product } from "@/types/product";
import ProductList from "@/components/ProductsList";
import { useCart } from "@/context/CartContext";

async function getProducts(searchTerm: string | null): Promise<Product[]> {
  let query = supabase.from("products").select("*");
  if (searchTerm) {
    query = query.ilike("name", `%${searchTerm}%`);
  }
  const { data: products, error } = await query;
  if (error) {
    console.error("Lỗi khi tải sản phẩm:", error);
    return [];
  }
  return products;
}

export default function ProductPageClient() {
  const { addToCart } = useCart();
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get("search");

  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchProducts() {
      try {
        const data = await getProducts(searchTerm);
        setProducts(data);
        setError(null);
      } catch {
        setError("Failed to fetch products");
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [searchTerm]);

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    console.log(`Đã thêm ${product.name} vào giỏ hàng.`);
  };

  if (loading) return <p>Đang tải sản phẩm...</p>;
  if (error) return <p>{error}</p>;

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">
        {searchTerm
          ? `Kết quả tìm kiếm cho '${searchTerm}'`
          : "Sản phẩm"}
      </h1>
      {products.length > 0 ? (
        <ProductList products={products} onAddToCart={handleAddToCart} />
      ) : (
        searchTerm && (
          <p>
            Không tìm thấy sản phẩm nào phù hợp với từ khóa 
            '{searchTerm}'
          </p>
        )
      )}
    </>
  );
}
