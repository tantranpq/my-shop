"use client";
export const dynamic = "force-dynamic";

import '@/app/globals.css';
import Navbar from "@/components/Navbar";
import { useCart } from "@/context/CartContext";
import ProductList from "@/components/ProductsList";
import { supabase } from "@/lib/supabase";
import { Product } from "@/types/product"; 
import React from "react";

async function getProducts(): Promise<Product[]> {
    const { data: products, error } = await supabase.from("products").select("*");
    if (error) {
        console.error("Lỗi khi tải sản phẩm:", error);
        return [];
    }
    return products;
}

export default function ProductsPage() {
    const { addToCart } = useCart();
    const [products, setProducts] = React.useState<Product[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    React.useEffect(() => {
        async function fetchProducts() {
            try {
                const data = await getProducts();
                setProducts(data);
                setLoading(false);
            } catch (err: any) {
                setError(err);
                setLoading(false);
            }
        }

        fetchProducts();
    }, []);

    const handleAddToCart = (product: Product) => {
        addToCart(product);
        // Có thể thêm logic thông báo hoặc điều hướng sau khi thêm vào giỏ
        console.log(`Đã thêm ${product.name} vào giỏ hàng.`);
    };

    if (loading) {
        return <p>Đang tải sản phẩm...</p>;
    }

    if (error) {
        return <p>Lỗi khi tải sản phẩm: {error.message}</p>;
    }

    return (
        <>
            <Navbar />
            <main className="max-w-6xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-6">Sản phẩm</h1>
                {products && <ProductList products={products} onAddToCart={handleAddToCart} />}
            </main>
        </>
    );
}