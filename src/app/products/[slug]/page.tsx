"use client";

import '@/app/globals.css';
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import React, { useState, useEffect, useCallback } from 'react';
import { Product } from "@/types/product";
import { useParams, useRouter } from 'next/navigation'; // Import useRouter

// Define an interface for the raw data coming from Supabase
// This helps TypeScript understand the structure of the 'data' object
interface SupabaseProductData {
    id: number;
    name: string;
    description: string;
    price: number;
    slug: string;
    image: string;
    // 'images' can be a JSON string, an array of strings, or null
    images: string | string[] | null;
    stock_quantity: number;
}

export default function ProductDetail() {
    const params = useParams();
    const { slug } = params;
    const { addToCart } = useCart();
    const router = useRouter(); // Initialize useRouter
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mainImageIndex, setMainImageIndex] = useState(0);
    const [startIndex, setStartIndex] = useState(0);
    const visibleThumbnailsCount = 3;
    const [showZoomModal, setShowZoomModal] = useState(false);

    // States for notification
    const [notificationMessage, setNotificationMessage] = useState<string>('');
    const [showNotification, setShowNotification] = useState<boolean>(false);

    // Function to show notification
    const triggerNotification = useCallback((message: string) => {
        setNotificationMessage(message);
        setShowNotification(true);
        const timer = setTimeout(() => {
            setShowNotification(false);
            setNotificationMessage('');
        }, 3000); // Notification disappears after 3 seconds
        return () => clearTimeout(timer); // Cleanup on unmount or re-render
    }, []);

    useEffect(() => {
        const fetchProduct = async () => {
            if (!slug) {
                setLoading(false);
                setError("Không tìm thấy slug sản phẩm.");
                return;
            }

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

                // Cast the raw data from Supabase to our defined interface
                const rawProductData: SupabaseProductData = data as SupabaseProductData;

                let parsedImages: string[] | null = null;
                if (rawProductData.images) {
                    if (Array.isArray(rawProductData.images)) {
                        // Fix for line 71: Use a type predicate to inform TypeScript about the item type
                        if (rawProductData.images.every((item): item is string => typeof item === 'string')) {
                            parsedImages = rawProductData.images;
                        } else {
                            console.warn("Cột 'images' trả về mảng nhưng chứa phần tử không phải chuỗi:", rawProductData.images);
                            parsedImages = null;
                        }
                    } else if (typeof rawProductData.images === 'string') {
                        if (rawProductData.images.startsWith('[') && rawProductData.images.endsWith(']')) {
                            try {
                                const tempArray = JSON.parse(rawProductData.images);
                                // Fix for line 82: Use a type predicate here as well
                                if (Array.isArray(tempArray) && tempArray.every((item): item is string => typeof item === 'string')) {
                                    parsedImages = tempArray;
                                } else {
                                    console.warn("Cột 'images' trả về chuỗi JSON không phải mảng chuỗi hợp lệ:", rawProductData.images);
                                    parsedImages = null;
                                }
                            } catch (e) {
                                console.error("Lỗi khi parse chuỗi JSON từ cột 'images':", e, "Giá trị gây lỗi:", rawProductData.images);
                                parsedImages = null;
                            }
                        } else if (rawProductData.images.trim() !== '') {
                            parsedImages = [rawProductData.images];
                        } else {
                            parsedImages = null;
                        }
                    } else {
                        console.warn("Cột 'images' trả về kiểu dữ liệu không mong muốn:", rawProductData.images, typeof rawProductData.images);
                        parsedImages = null;
                    }
                }

                const productData: Product = {
                    id: rawProductData.id,
                    name: rawProductData.name,
                    description: rawProductData.description,
                    price: rawProductData.price,
                    slug: rawProductData.slug,
                    image: rawProductData.image,
                    images: parsedImages,
                    stock_quantity: rawProductData.stock_quantity,
                };

                setProduct(productData);

                if (productData.images && productData.images.length > 0) {
                    setMainImageIndex(0);
                } else if (productData.image) {
                    setMainImageIndex(-1);
                } else {
                    setMainImageIndex(-1);
                }
                setLoading(false);
            } catch (err: unknown) {
                let errorMessage = "Có lỗi xảy ra.";
                if (err instanceof Error) {
                    errorMessage = err.message;
                }
                setError(errorMessage);
                setLoading(false);
            }
        };

        fetchProduct();
    }, [slug]);

    const handlePrevClick = () => {
        if (!product || !product.images || product.images.length === 0) return;

        setMainImageIndex(prevIndex => Math.max(0, prevIndex - 1));
        setStartIndex(prevIndex => Math.max(0, prevIndex - 1));
    };

    const handleNextClick = () => {
        if (!product || !product.images || product.images.length === 0) return;

        setMainImageIndex(prevIndex => Math.min(product.images!.length - 1, prevIndex + 1));
        setStartIndex(prevIndex => Math.min(product.images!.length - visibleThumbnailsCount, prevIndex + 1));
    };

    // Hàm đóng modal
    const closeZoomModal = useCallback(() => {
        setShowZoomModal(false);
    }, []);

    // Xử lý phím Esc để đóng modal
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeZoomModal();
            }
        };

        if (showZoomModal) {
            document.addEventListener('keydown', handleKeyDown);
        } else {
            document.removeEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showZoomModal, closeZoomModal]);


    if (loading) {
        return (
            <>
                <Navbar />
                <main className="p-6 flex justify-center items-center h-[calc(100vh-64px)]">
                    <p className="text-lg text-gray-700">Đang tải chi tiết sản phẩm...</p>
                </main>
            </>
        );
    }

    if (error) {
        return (
            <>
                <Navbar />
                <main className="p-6 text-center">
                    <p className="text-red-500 text-xl font-semibold mb-4">{error}</p>
                    <Link href="/products" className="text-blue-600 hover:underline text-lg">
                        ← Quay lại danh sách sản phẩm
                    </Link>
                </main>
            </>
        );
    }

    if (!product) {
        return (
            <>
                <Navbar />
                <main className="p-6 text-center">
                    <p className="text-gray-700 text-xl font-semibold mb-4">Không tìm thấy sản phẩm.</p>
                    <Link href="/products" className="text-blue-600 hover:underline text-lg">
                        ← Quay lại danh sách sản phẩm
                    </Link>
                </main>
            </>
        );
    }

    const fallbackImageUrl = 'https://placehold.co/600x400/cccccc/333333?text=No+Image';

    // Updated handleBuyNow function
    const handleBuyNow = (productToBuy: Product) => {
        if (!productToBuy.slug) {
            triggerNotification('Không thể mua ngay sản phẩm này (thiếu slug).');
            return;
        }
        // Chuyển hướng đến trang thanh toán với sản phẩm đơn lẻ
        // Định dạng URL: /checkout?items=product_slug:1
        router.push(`/checkout?items=${productToBuy.slug}:1`);
    };

    const currentMainImageUrl = (product.images && mainImageIndex !== -1 && product.images[mainImageIndex])
                                ? product.images[mainImageIndex]
                                : product.image || fallbackImageUrl;

    const visibleThumbnails = product.images
        ? product.images.slice(startIndex, startIndex + visibleThumbnailsCount)
        : [];

    const canScrollPrev = mainImageIndex > 0;
    const canScrollNext = product.images && mainImageIndex < product.images.length - 1;


    return (
        <>
            <Navbar />
            <main className="container mx-auto p-6 max-w-4xl">
                {/* Main product info section */}
                <div className="flex flex-col md:flex-row gap-8 bg-white p-6 rounded-lg shadow-lg">
                    <div className="flex-shrink-0 w-full md:w-1/2">
                        {/* Khung ảnh chính cố định kích thước */}
                        <div className="mb-4 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-100" style={{ height: '400px' }}>
                            <img
                                src={currentMainImageUrl}
                                alt={product.name}
                                className="object-contain w-full h-full cursor-zoom-in"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = fallbackImageUrl;
                                }}
                                onClick={() => setShowZoomModal(true)}
                            />
                        </div>
                        {product.images && product.images.length > 0 && (
                            <div className="relative flex items-center justify-center gap-2">
                                <button
                                    onClick={handlePrevClick}
                                    disabled={!canScrollPrev}
                                    className={`p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors duration-200
                                                ${!canScrollPrev ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>

                                <div className="flex flex-wrap gap-2 justify-center overflow-hidden">
                                    {visibleThumbnails.map((imgUrl, index) => {
                                        const absoluteIndex = startIndex + index;
                                        return (
                                            <img
                                                key={absoluteIndex}
                                                src={imgUrl || fallbackImageUrl}
                                                alt={`${product.name} - ${absoluteIndex + 1}`}
                                                className={`w-20 h-20 object-cover rounded-md cursor-pointer border-2 ${
                                                    mainImageIndex === absoluteIndex ? 'border-blue-500' : 'border-transparent'
                                                } hover:border-blue-400 transition-all duration-200`}
                                                onClick={() => {
                                                    setMainImageIndex(absoluteIndex);
                                                }}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = fallbackImageUrl;
                                                }}
                                            />
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={handleNextClick}
                                    disabled={!canScrollNext}
                                    className={`p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors duration-200
                                                ${!canScrollNext ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
                        <p className="text-2xl font-semibold text-blue-600 mb-4">
                            {product.price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                        </p>
                        {/* Description was here, moved below */}

                        <div className="mb-6">
                            <span className={`text-lg font-medium ${product.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Tồn kho: {product.stock_quantity > 0 ? `${product.stock_quantity} sản phẩm` : 'Hết hàng'}
                            </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <button
                                className={`flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold
                                            hover:bg-blue-700 transition-colors duration-300 shadow-md
                                            ${product.stock_quantity === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={() => {
                                    if (product.stock_quantity > 0) {
                                        addToCart(product);
                                        triggerNotification(`Đã thêm "${product.name}" vào giỏ hàng!`);
                                    }
                                }}
                                disabled={product.stock_quantity === 0}
                            >
                                Thêm vào giỏ hàng
                            </button>

                            <button
                                className={`flex-1 bg-green-600 text-white px-6 py-3 rounded-lg text-lg font-semibold
                                            hover:bg-green-700 transition-colors duration-300 shadow-md
                                            ${product.stock_quantity === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={() => product && handleBuyNow(product)} // Pass product to handleBuyNow
                                disabled={product.stock_quantity === 0}
                            >
                                Mua ngay
                            </button>
                        </div>

                        <Link href="/products" className="block text-center text-blue-600 mt-6 hover:underline text-base">
                            ← Quay lại danh sách sản phẩm
                        </Link>
                    </div>
                </div>

                {/* Product Description Section - Moved here */}
                <div className="bg-white p-6 rounded-lg shadow-lg mt-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Mô tả chi tiết sản phẩm</h2>
                    <p className="text-gray-700 leading-relaxed">
                        {product.description || 'Không có mô tả chi tiết cho sản phẩm này.'}
                    </p>
                </div>
            </main>

            {/* Modal phóng to ảnh */}
            {showZoomModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
                    onClick={closeZoomModal}
                >
                    <div className="relative max-w-screen-lg max-h-screen-lg" onClick={e => e.stopPropagation()}>
                        <img
                            src={currentMainImageUrl}
                            alt={product.name}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                        />
                        <button
                            onClick={closeZoomModal}
                            className="absolute top-4 right-4 text-white text-4xl font-bold bg-gray-800 bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition-opacity duration-200"
                            aria-label="Đóng"
                        >
                            &times;
                        </button>
                    </div>
                </div>
            )}

            {/* Notification Component */}
            {showNotification && (
                <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-fade-in-out">
                    <p className="text-base font-medium">{notificationMessage}</p>
                </div>
            )}
        </>
    );
}
