"use client";

import '@/app/globals.css';
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import React, { useState, useEffect, useCallback } from 'react';
import { Product } from "@/types/product"; // Ensure this import is correct
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner'; // Import toast for notifications

// Define an interface for the raw data coming from Supabase
// This helps TypeScript understand the structure of the 'data' object
interface SupabaseProductData {
    id: string; // ID is now string
    name: string;
    description: string;
    price: number;
    slug: string;
    image: string;
    images: string | string[] | null; // Can be JSON string, array, or null
    stock_quantity: number;
    // Add other fields if necessary
}

export default function ProductDetail() {
    const params = useParams();
    const { slug } = params;
    const { addToCart } = useCart();
    const router = useRouter();
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mainImageIndex, setMainImageIndex] = useState(0);
    const [startIndex, setStartIndex] = useState(0);
    const visibleThumbnailsCount = 3;
    const [showZoomModal, setShowZoomModal] = useState(false);

    // Thông báo toast sẽ được quản lý bởi `sonner` trực tiếp, không cần state `notificationMessage` và `showNotification` nữa
    // const [notificationMessage, setNotificationMessage] = useState<string>('');
    // const [showNotification, setShowNotification] = useState<boolean>(false);

    // Function to show notification - will use toast from sonner
    // const triggerNotification = useCallback((message: string) => {
    //     setNotificationMessage(message);
    //     setShowNotification(true);
    //     const timer = setTimeout(() => {
    //         setShowNotification(false);
    //         setNotificationMessage('');
    //     }, 3000); // Notification disappears after 3 seconds
    //     return () => clearTimeout(timer); // Cleanup on unmount or re-render
    // }, []);

    const fetchProduct = useCallback(async () => {
        if (!slug) {
            setLoading(false);
            setError("Không tìm thấy slug sản phẩm.");
            return null; // Return null if slug is missing
        }

        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from("products")
                .select("*")
                .eq("slug", slug)
                .single();

            if (fetchError) {
                if (fetchError.code === 'PGRST116') { // Error code for 'no rows found'
                    setError("Sản phẩm không tồn tại hoặc đã bị xóa.");
                } else {
                    setError("Không thể tải sản phẩm.");
                }
                setProduct(null); // Set product to null if not found
                setLoading(false);
                return null;
            }

            if (!data) {
                setError("Không tìm thấy sản phẩm.");
                setProduct(null);
                setLoading(false);
                return null;
            }

            const rawProductData: SupabaseProductData = data as SupabaseProductData;

            let parsedImages: string[] | null = null;
            if (rawProductData.images) {
                if (Array.isArray(rawProductData.images)) {
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
                id: String(rawProductData.id),
                name: rawProductData.name,
                description: rawProductData.description,
                price: rawProductData.price,
                slug: rawProductData.slug,
                image: rawProductData.image,
                images: parsedImages,
                stock_quantity: rawProductData.stock_quantity,
                // Add other fields from your Product interface here
            };

            setProduct(productData);
            setError(null); // Clear any previous errors

            if (productData.images && productData.images.length > 0) {
                setMainImageIndex(0);
            } else if (productData.image) {
                setMainImageIndex(-1);
            } else {
                setMainImageIndex(-1);
            }
            setLoading(false);
            return productData; // Return the fetched product data
        } catch (err: unknown) {
            let errorMessage = "Có lỗi xảy ra.";
            if (err instanceof Error) {
                errorMessage = err.message;
            }
            setError(errorMessage);
            setProduct(null);
            setLoading(false);
            return null;
        }
    }, [slug]);


    useEffect(() => {
        fetchProduct(); // Fetch initial product data

        // Set up Realtime subscription
        if (slug) {
            const channel = supabase
                .channel(`product_${slug}_changes`) // Unique channel for this product's slug
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'products', filter: `slug=eq.${slug}` },
                    (payload) => {
                        console.log('Realtime change for product:', slug, payload);
                        if (payload.eventType === 'UPDATE') {
                            // Re-fetch the product to get the latest data
                            fetchProduct();
                            toast.info("Thông tin sản phẩm đã được cập nhật.");
                        } else if (payload.eventType === 'DELETE') {
                            // If the product is deleted, clear product state and show error
                            setProduct(null);
                            setError("Sản phẩm này đã bị xóa.");
                            setLoading(false);
                            toast.error("Sản phẩm này không còn tồn tại!");
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel); // Clean up subscription on unmount
            };
        }
    }, [slug, fetchProduct]); // Re-subscribe if slug or fetchProduct callback changes

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

    const closeZoomModal = useCallback(() => {
        setShowZoomModal(false);
    }, []);

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


    const fallbackImageUrl = '/not-found.png'; // Use a local placeholder image


    const handleBuyNow = (productToBuy: Product) => {
        if (productToBuy.stock_quantity <= 0) {
            toast.error('Sản phẩm này đã hết hàng. Không thể mua ngay!');
            return;
        }
        if (!productToBuy.slug) {
            toast.error('Không thể mua ngay sản phẩm này (thiếu slug).');
            return;
        }
        router.push(`/checkout?items=${productToBuy.slug}:1`);
    };

    const currentMainImageUrl = (product?.images && mainImageIndex !== -1 && product.images[mainImageIndex])
        ? product.images[mainImageIndex]
        : product?.image || fallbackImageUrl;

    const visibleThumbnails = product?.images
        ? product.images.slice(startIndex, startIndex + visibleThumbnailsCount)
        : [];

    const canScrollPrev = mainImageIndex > 0;
    const canScrollNext = product?.images && mainImageIndex < product.images.length - 1;

    // --- Loading, Error, Not Found States ---
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

    if (!product) { // This will now also handle cases where a product was deleted via realtime
        return (
            <>
                <Navbar />
                <main className="p-6 text-center">
                    <p className="text-gray-700 text-xl font-semibold mb-4">Sản phẩm không tồn tại hoặc đã bị xóa.</p>
                    <Link href="/products" className="text-blue-600 hover:underline text-lg">
                        ← Quay lại danh sách sản phẩm
                    </Link>
                </main>
            </>
        );
    }

    // --- Main Product Display ---
    return (
        <>
            <Navbar />
            <main className="container mx-auto p-6 max-w-4xl">
                <div className="flex flex-col md:flex-row gap-8 bg-white p-6 rounded-lg shadow-lg">
                    <div className="flex-shrink-0 w-full md:w-1/2">
                        {/* Main Image Container */}
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
                        {/* Thumbnail Navigation */}
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
                                                className={`w-20 h-20 object-cover rounded-md cursor-pointer border-2 ${mainImageIndex === absoluteIndex ? 'border-blue-500' : 'border-transparent'
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

                        <div className="mb-6">
                            <span className={`text-lg font-medium ${product.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {product.stock_quantity <= 0 ? (
                                    'Hết hàng'
                                ) : product.stock_quantity < 10 ? (
                                    `${product.stock_quantity} sản phẩm còn lại`
                                ) : (
                                    'Còn hàng'
                                )}
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
                                        toast.success(`Đã thêm "${product.name}" vào giỏ hàng!`);
                                    } else {
                                        toast.error("Sản phẩm đã hết hàng. Không thể thêm vào giỏ hàng.");
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
                                onClick={() => product && handleBuyNow(product)}
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

                {/* Product Description Section */}
                <div className="bg-white p-6 rounded-lg shadow-lg mt-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Mô tả chi tiết sản phẩm</h2>
                    <p className="text-gray-700 leading-relaxed">
                        {product.description || 'Không có mô tả chi tiết cho sản phẩm này.'}
                    </p>
                </div>
            </main>

            {/* Modal for image zoom */}
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

            {/* Sonner toast container (assuming you have this in your root layout or similar) */}
            {/* No need for a custom notification component anymore if using Sonner */}
            {/* {showNotification && (
                <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-fade-in-out">
                    <p className="text-base font-medium">{notificationMessage}</p>
                </div>
            )} */}
        </>
    );
}