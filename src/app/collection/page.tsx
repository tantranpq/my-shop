"use client";

import '@/app/globals.css';
import Navbar from "@/components/Navbar";
// import { supabase } from "@/lib/supabase";
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { Product } from "@/types/product";
import { useCart } from "@/context/CartContext";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation'; // Import useRouter
export const metadata = {
  title: 'Collection',
  description: 'Sản phẩm yêu thích của bạn',
};
export default function CollectionPage() {
    const user = useUser();
    const supabaseClient = useSupabaseClient();
    const { addToCart } = useCart();
    const queryClient = useQueryClient();
    const router = useRouter(); // Initialize useRouter
    const pathname = usePathname();
    const [error] = useState<string | null>(null);

    // Sử dụng useQuery để fetch sản phẩm yêu thích
    const { data: favoriteProducts = [], isLoading: loading, error: queryError, refetch } = useQuery<Product[], Error>({
        queryKey: ['favoriteProducts', user?.id],
        queryFn: async () => {
            console.log('[CollectionPage] favoriteProducts queryFn re-executed for user:', user?.id); // LOG 1: Khi queryFn chạy
            if (!user) {
                console.log('[CollectionPage] No user logged in, returning empty favorites.');
                return [];
            }

            const { data: favoriteIdsData, error: favError } = await supabaseClient
                .from('user_favorites')
                .select('product_id')
                .eq('user_id', user.id);

            if (favError) {
                console.error("[CollectionPage] Lỗi khi tải ID sản phẩm yêu thích:", favError);
                throw new Error("Không thể tải danh sách sản phẩm yêu thích của bạn.");
            }

            const productIds = favoriteIdsData.map(item => item.product_id);
            console.log('[CollectionPage] Fetched favorite product IDs:', productIds); // LOG 2: IDs sản phẩm yêu thích đã lấy

            if (productIds.length === 0) {
                console.log('[CollectionPage] No favorite product IDs found.');
                return [];
            }

            const { data: productsData, error: productsError } = await supabaseClient
                .from('products')
                .select('*')
                .in('id', productIds);

            if (productsError) {
                console.error("[CollectionPage] Lỗi khi tải chi tiết sản phẩm yêu thích:", productsError);
                throw new Error("Không thể tải chi tiết sản phẩm yêu thích.");
            }
            console.log('[CollectionPage] Fetched detailed favorite products:', productsData); // LOG 3: Chi tiết sản phẩm yêu thích đã lấy
            return productsData as Product[];
        },
        enabled: !!user,
        staleTime: 0, // Đã thay đổi: Dữ liệu luôn được coi là cũ, sẽ luôn re-fetch khi mount/focus
        refetchOnWindowFocus: true, // Vẫn re-fetch khi tab được focus lại
    });

    // useEffect để lắng nghe Realtime Updates từ Supabase
    useEffect(() => {
        if (user) {
            console.log('[CollectionPage] Realtime listener setup for user:', user.id); // LOG 4: Khi listener được thiết lập
            const channel = supabaseClient
                .channel('user_favorites_changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'user_favorites', filter: `user_id=eq.${user.id}` },
                    (payload) => {
                        console.log('[CollectionPage] Realtime change detected, invalidating query and refetching:', payload); // LOG 5: Khi có sự kiện Realtime
                        queryClient.invalidateQueries({ queryKey: ['favoriteProducts', user.id] });
                        refetch(); // Gọi refetch để tải lại dữ liệu mới nhất ngay lập tức
                        console.log('[CollectionPage] Refetch triggered by Realtime event.'); // LOG 6: Xác nhận refetch đã được gọi
                    }
                )
                .subscribe();

            return () => {
                console.log('[CollectionPage] Realtime listener unsubscribed.'); // LOG 7: Khi listener bị hủy
                channel.unsubscribe();
            };
        }
    }, [user, supabaseClient, queryClient, refetch]);

    // Thêm useEffect này để log trạng thái sản phẩm yêu thích sau khi tải
    useEffect(() => {
        if (!loading && !queryError) {
            console.log('[CollectionPage] Current favorite products state after load/refetch:', favoriteProducts);
        }
    }, [loading, queryError, favoriteProducts]);


    // Hàm xử lý thêm sản phẩm vào giỏ hàng
    const handleAddToCart = (product: Product) => {
        addToCart(product);
        console.log(`Đã thêm ${product.name} vào giỏ hàng.`);
    };

    // Hàm xử lý "Mua ngay"
    const handleBuyNow = (product: Product) => {
        // Bỏ qua bước thêm vào giỏ hàng và chuyển thẳng đến trang thanh toán
        console.log(`Đã nhấn "Mua ngay" cho sản phẩm ${product.name}. Chuyển hướng đến trang thanh toán với số lượng 1.`);
        // Chuyển hướng đến trang thanh toán, truyền slug của sản phẩm và số lượng 1
        // Định dạng chuỗi truy vấn phải là "slug:quantity"
        router.push(`/checkout?items=${product.slug}:1`);
    };

    if (loading) {
        return (
            <>
                <Navbar />
                <main className="max-w-2xl mx-auto p-6 text-center">
                    <p className="text-gray-600">Đang tải sản phẩm yêu thích...</p>
                </main>
            </>
        );
    }

    if (queryError || error) {
        return (
            <>
                <Navbar />
                <main className="max-w-2xl mx-auto p-6 text-center">
                    <p className="text-red-500">{queryError?.message || error}</p>
                    <Link href="/" className="text-blue-500 mt-4 block hover:underline">
                        ← Quay lại trang chủ
                    </Link>
                </main>
            </>
        );
    }

    if (!user) {
        return (
            <>
                <Navbar />
                <main className="max-w-2xl mx-auto p-6 text-center">
                    <h1 className="text-2xl font-bold mb-4">Bộ sưu tập của bạn</h1>
                    <p className="text-gray-700">Vui lòng đăng nhập để xem các sản phẩm yêu thích của bạn.</p>
                    <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`} className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Đăng nhập
                    </Link>
                </main>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <main className="container mx-auto p-6">
                <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Sản phẩm yêu thích của bạn</h1>

                {favoriteProducts.length === 0 ? (
                    <p className="text-center text-gray-600 text-lg">Bạn chưa có sản phẩm yêu thích nào.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {favoriteProducts.map((product) => (
                            <div key={product.id} className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col transform transition-transform duration-300 hover:scale-105">
                                <Link href={`/products/${product.slug}`} className="block">
                                    <img
                                        src={product.image || 'https://placehold.co/400x300/cccccc/333333?text=No+Image'}
                                        alt={product.name}
                                        width={400}
                                        height={300}
                                        className="w-full h-48 object-cover"
                                    />
                                </Link>
                                <span className={`absolute top-2 left-2 text-white text-xs font-bold rounded-full px-2 py-1 flex items-center justify-center min-w-[50px] h-[24px] z-10 ${product.stock_quantity <= 0
                                    ? 'bg-red-600' // Hết hàng: nền đỏ
                                    : product.stock_quantity < 10
                                        ? 'bg-yellow-500' // Còn ít (<10): nền vàng cam (hoặc bạn có thể dùng 'bg-red-500' nếu muốn cảnh báo mạnh hơn)
                                        : 'bg-green-600' // Còn hàng (>=10): nền xanh lá
                                    }`
                                }>
                                    {product.stock_quantity <= 0 ? (
                                        'Hết hàng'
                                    ) : product.stock_quantity < 10 ? (
                                        `còn ${product.stock_quantity} SP` // Rút gọn "sản phẩm còn lại" thành "SP" để vừa badge nhỏ
                                    ) : (
                                        'Còn hàng'
                                    )}
                                </span>
                                <div className="p-5 flex-grow flex flex-col">
                                    <h3 className="text-xl font-bold mb-2">
                                        <Link href={`/products/${product.slug}`} className="text-gray-900 hover:text-blue-600 transition-colors">
                                            {product.name}
                                        </Link>
                                    </h3>
                                    <p className="text-gray-800 font-semibold mb-3 text-lg">
                                        {product.price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                                    </p>
                                    <p className="text-sm text-gray-600 flex-grow mb-4">
                                        {typeof product.description === 'string' && product.description !== null && product.description !== ''
                                            ? `${product.description.substring(0, 100)}...`
                                            : 'Không có mô tả cho sản phẩm này.'}
                                    </p>
                                    <div className="flex flex-col space-y-2 mt-auto"> {/* Added flex container for buttons */}
                                        <button
                                            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md"
                                            onClick={() => handleAddToCart(product)}
                                        >
                                            Thêm vào giỏ hàng
                                        </button>
                                        <button
                                            className="bg-green-500 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-600 transition-colors shadow-md"
                                            onClick={() => handleBuyNow(product)}
                                        >
                                            Mua ngay
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </>
    );
}
