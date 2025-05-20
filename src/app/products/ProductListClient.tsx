"use client";

import React from "react";
import { Product } from "@/types/product";
import { useCart } from "@/context/CartContext";
import ProductList from "@/components/ProductsList";

interface ProductListClientProps {
  products: Product[];
}

export default function ProductListClient({ products }: ProductListClientProps) {
  const { addToCart } = useCart();

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    console.log(`Đã thêm ${product.name} vào giỏ hàng.`);
  };

  return <ProductList products={products} onAddToCart={handleAddToCart} />;
}
