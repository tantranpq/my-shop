"use client";

import '@/app/globals.css';
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import React, { useState, useEffect } from 'react';
import { Product } from "@/types/product";

interface ProductDetailPageProps {
    params: { slug: string };
}

export default function ProductDetail({ params }: ProductDetailPageProps) {
    const { slug } = params;
    const { addToCart } = useCart();
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                setLoading(true);
                const { data, error: fetchError } = await supabase
                    .from("products")
                    .select("*")
                    .eq("slug", slug)
                    .single();

                if (fetchError) {
                    setError("Không thể tải sản phẩm.");
                    setLoading(false);
                    return;
                }

                if (!data) {
                    setError("Không tìm thấy sản phẩm.");
                    setLoading(false);
                    return;
                }

                setProduct(data);
                setLoading(false);
            } catch (err: any) {
                setError(err.message || "Có lỗi xảy ra.");
                setLoading(false);
            }
        };

        fetchProduct();
    }, [slug]);

    if (loading) {
        return (
            <>
                <Navbar />
                <main className="p-6">
                    <p>Đang tải chi tiết sản phẩm...</p>
                </main>
            </>
        );
    }

    if (error) {
        return (
            <>
                <Navbar />
                <main className="p-6">
                    <p className="text-red-500">{error}</p>
                    <Link href="/products" className="text-blue-500 mt-4 block hover:underline">
                        ← Quay lại danh sách
                    </Link>
                </main>
            </>
        );
    }

    if (!product) {
        return (
            <>
                <Navbar />
                <main className="p-6">
                    <p>Không tìm thấy sản phẩm.</p>
                    <Link href="/products" className="text-blue-500 mt-4 block hover:underline">
                        ← Quay lại danh sách
                    </Link>
                </main>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <main className="p-6">
                <img src={product.image} alt={product.name} className="w-80 h-80 rounded-lg mb-4" />
                <h1 className="text-2xl font-bold">{product.name}</h1>
                <p className="text-lg text-gray-600">{product.price} vnđ</p>
                <button
                    className="bg-blue-500 text-white px-4 py-2 mt-4 rounded hover:bg-blue-600 transition"
                    onClick={() => {
                        addToCart(product);
                    }}
                >
                    Thêm vào giỏ hàng
                </button>
                <Link href="/products" className="text-blue-500 mt-4 block hover:underline">
                    ← Quay lại danh sách
                </Link>
            </main>
        </>
    );
}
