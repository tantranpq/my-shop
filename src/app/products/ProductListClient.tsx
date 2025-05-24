"use client";

import '@/app/globals.css';
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import React, { useState, useMemo, useCallback } from 'react';
import { Product } from "@/types/product"; // Product import đúng
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { useUser } from '@supabase/auth-helpers-react';

// QUAN TRỌNG: Đảm bảo rằng 'id' của sản phẩm trong bảng 'products' của bạn là kiểu UUID (string)
// và 'product_id' trong bảng 'user_favorites' cũng là kiểu UUID (string).
// Đồng thời, đảm bảo 'image' trong Product interface là 'string | null' trong file "@/types/product".

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
    const router = useRouter();
    const searchTerm = searchParams.get("search");
    const user = useUser();

    const [products, setProducts] = React.useState<Product[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const [categorySlidePages, setCategorySlidePages] = useState<Map<string, number>>(new Map());
    // State để lưu trữ ID của các sản phẩm yêu thích của người dùng hiện tại
    // Set này sẽ lưu trữ string (UUID)
    const [favoriteProductIds, setFavoriteProductIds] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);


    const itemsPerSlide = 8;

    React.useEffect(() => {
        async function fetchProducts() {
            try {
                setLoading(true);
                const data = await getProducts(searchTerm);
                setProducts(data);
                setError(null);
            } catch (err: unknown) {
                let errorMessage = "Không thể tải sản phẩm.";
                if (err instanceof Error) {
                    errorMessage = err.message;
                }
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        }

        fetchProducts();
    }, [searchTerm]);

    // Hàm để tải các sản phẩm yêu thích của người dùng từ DB
    const fetchFavorites = useCallback(async () => {
        if (user) {
            const { data, error } = await supabase
                .from('user_favorites')
                .select('product_id')
                .eq('user_id', user.id);

            if (error) {
                console.error('Lỗi khi tải sản phẩm yêu thích:', error);
                return;
            }
            // Đảm bảo product_id được thêm vào Set dưới dạng string (UUID)
            const favIds = new Set(data.map(item => item.product_id)); // Bỏ 'as string' vì TypeScript đã biết product_id là string nếu bảng đúng
            setFavoriteProductIds(favIds);
        } else {
            setFavoriteProductIds(new Set());
        }
    }, [user]); // Bỏ 'supabase' khỏi dependencies vì nó là một đối tượng tĩnh từ lib, không cần thiết để thêm vào đây

    // Effect để tải các sản phẩm yêu thích lần đầu và khi người dùng thay đổi
    React.useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

    // Effect để tự động ẩn thông báo sau 2 giây
    React.useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                setMessage(null);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [message]);


    const handleAddToCart = (product: Product) => {
        addToCart(product);
        setMessage({ type: 'success', text: `Đã thêm ${product.name} vào giỏ hàng.` });
    };

    // Hàm xử lý khi nhấn nút "Mua ngay"
    const handleBuyNow = (product: Product) => {
        if (!product.slug) {
            setMessage({ type: 'error', text: 'Không thể mua ngay sản phẩm này (thiếu slug).' });
            return;
        }
        router.push(`/checkout?items=${product.slug}:1`);
    };

    // Hàm để chuyển đổi trạng thái yêu thích của một sản phẩm
    const handleToggleFavorite = async (product: Product) => {
        if (!user) {
            setMessage({ type: 'info', text: 'Vui lòng đăng nhập để thêm sản phẩm vào danh sách yêu thích.' });
            return;
        }

        const isFavorited = favoriteProductIds.has(product.id);
        const newFavorites = new Set(favoriteProductIds);

        if (isFavorited) {
            newFavorites.delete(product.id);
            setFavoriteProductIds(newFavorites);
            setMessage({ type: 'success', text: `Đã xóa "${product.name}" khỏi danh sách yêu thích.` });

            const { error } = await supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', user.id)
                .eq('product_id', product.id);

            if (error) {
                console.error('Lỗi khi xóa sản phẩm yêu thích:', error);
                setMessage({ type: 'error', text: 'Có lỗi xảy ra khi xóa sản phẩm yêu thích.' });
                // Hoàn tác cập nhật UI nếu có lỗi
                setFavoriteProductIds(prev => new Set(prev).add(product.id));
            }
        } else {
            newFavorites.add(product.id);
            setFavoriteProductIds(newFavorites);
            setMessage({ type: 'success', text: `Đã thêm "${product.name}" vào danh sách yêu thích.` });

            const { error } = await supabase
                .from('user_favorites')
                .insert({ user_id: user.id, product_id: product.id });

            if (error) {
                console.error('Lỗi khi thêm sản phẩm yêu thích:', error);
                setMessage({ type: 'error', text: 'Có lỗi xảy ra khi thêm sản phẩm yêu thích.' });
                // Hoàn tác cập nhật UI nếu có lỗi
                setFavoriteProductIds(prev => {
                    const revertSet = new Set(prev);
                    revertSet.delete(product.id);
                    return revertSet;
                });
            }
        }
    };

    // Hàm để chuyển đổi trạng thái thu gọn của một danh mục
    const toggleCategory = (categoryName: string) => {
        setCollapsedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryName)) {
                newSet.delete(categoryName);
            } else {
                newSet.add(categoryName);
            }
            return newSet;
        });
    };

    // Hàm chuyển slide tiếp theo cho một danh mục cụ thể
    const handleNextSlide = (categoryName: string, totalSlides: number) => {
        setCategorySlidePages(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(categoryName) || 0;
            newMap.set(categoryName, Math.min(current + 1, totalSlides - 1));
            return newMap;
        });
    };

    // Hàm chuyển slide trước đó cho một danh mục cụ thể
    const handlePrevSlide = (categoryName: string) => {
        setCategorySlidePages(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(categoryName) || 0;
            newMap.set(categoryName, Math.max(current - 1, 0));
            return newMap;
        });
    };

    // Group products by category and sort them
    const groupedProducts = useMemo(() => {
        const groups: { [key: string]: Product[] } = {};
        products.forEach(product => {
            const categoryName: string = (typeof product.category === 'string' && product.category !== '')
                ? product.category
                : 'Chưa phân loại';
            if (!groups[categoryName]) {
                groups[categoryName] = [];
            }
            groups[categoryName].push(product);
        });

        const sortedCategoryNames = Object.keys(groups).sort((a, b) => {
            if (a === 'Chưa phân loại') return 1;
            if (b === 'Chưa phân loại') return -1;
            return a.localeCompare(b);
        });

        return sortedCategoryNames.map(category => ({
            categoryName: category,
            products: groups[category]
        }));
    }, [products]);


    if (loading) return (
        <>
            <main className="p-6">
                <p className="text-center text-gray-600">Đang tải sản phẩm...</p>
            </main>
        </>
    );

    if (error) return (
        <>
            <main className="p-6">
                <p className="text-red-500 text-center">{error}</p>
            </main>
        </>
    );

    return (
        <>
            <main className="container mx-auto p-6">
                <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">
                    {searchTerm
                        ? `Kết quả tìm kiếm cho '${searchTerm}'`
                        : "Tất cả Sản phẩm"}
                </h1>

                {message && (
                    <div
                        className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white z-50
                            ${message.type === 'success' ? 'bg-green-500' :
                                message.type === 'error' ? 'bg-red-500' :
                                    'bg-blue-500'}`}
                        role="alert"
                    >
                        <div className="flex items-center justify-between">
                            <span>{message.text}</span>
                            <button onClick={() => setMessage(null)} className="ml-4 text-white font-bold">
                                &times;
                            </button>
                        </div>
                    </div>
                )}

                {groupedProducts.length > 0 ? (
                    groupedProducts.map((group) => {
                        const currentSlide = categorySlidePages.get(group.categoryName) || 0;
                        const totalSlides = Math.ceil(group.products.length / itemsPerSlide);
                        const productsToShow = group.products.slice(
                            currentSlide * itemsPerSlide,
                            (currentSlide + 1) * itemsPerSlide
                        );

                        return (
                            <div key={group.categoryName} className="mb-10">
                                <div className="flex justify-between items-center mb-6 border-b-2 border-gray-200 pb-2">
                                    <h2 className="text-2xl font-semibold text-gray-700">
                                        {group.categoryName}
                                    </h2>
                                    <button
                                        onClick={() => toggleCategory(group.categoryName)}
                                        className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                                        aria-expanded={!collapsedCategories.has(group.categoryName)}
                                        aria-controls={`products-in-${group.categoryName.replace(/\s+/g, '-')}`}
                                    >
                                        {collapsedCategories.has(group.categoryName) ? (
                                            <ChevronDown className="h-6 w-6 text-gray-600" />
                                        ) : (
                                            <ChevronUp className="h-6 w-6 text-gray-600" />
                                        )}
                                    </button>
                                </div>
                                {!collapsedCategories.has(group.categoryName) && (
                                    <div className="relative">
                                        <div
                                            id={`products-in-${group.categoryName.replace(/\s+/g, '-')}`}
                                            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8"
                                        >
                                            {productsToShow.map((product) => (
                                                <div key={product.id} className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col transform transition-transform duration-300 hover:scale-105 relative">
                                                    <Link href={`/products/${product.slug}`} className="block">
                                                        <img
                                                            src={product.image || 'https://placehold.co/400x300/cccccc/333333?text=No+Image'}
                                                            alt={product.name}
                                                            width={400}
                                                            height={300}
                                                            className="w-full h-48 object-cover"
                                                        />
                                                    </Link>
                                                    {/* Heart icon for favorite */}
                                                    <button
                                                        onClick={() => handleToggleFavorite(product)}
                                                        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md text-red-500 hover:scale-110 transition-transform z-20"
                                                        aria-label={favoriteProductIds.has(product.id) ? "Xóa khỏi yêu thích" : "Thêm vào yêu thích"}
                                                    >
                                                        <Heart fill={favoriteProductIds.has(product.id) ? "currentColor" : "none"} className="h-6 w-6" />
                                                    </button>

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
                                                        <p className="text-red-600 font-semibold mb-3 text-lg">
                                                            {product.price.toLocaleString('vi-VN')} <sup className="underline">đ</sup>
                                                        </p>
                                                        <div className="flex space-x-2 mt-auto">
                                                            <button
                                                                className="flex-1 bg-blue-100 text-blue-700 px-3 py-2 text-sm rounded-lg font-medium hover:bg-blue-200 transition-colors shadow-md"
                                                                onClick={() => handleAddToCart(product)}
                                                            >
                                                                Thêm vào giỏ hàng
                                                            </button>
                                                            <button
                                                                className="flex-1 bg-green-100 text-green-700 px-3 py-2 text-sm rounded-lg font-medium hover:bg-green-200 transition-colors shadow-md"
                                                                onClick={() => handleBuyNow(product)}
                                                            >
                                                                Mua ngay
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {totalSlides > 1 && (
                                            <>
                                                <button
                                                    onClick={() => handlePrevSlide(group.categoryName)}
                                                    disabled={currentSlide === 0}
                                                    className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gray-800 bg-opacity-50 text-white hover:bg-opacity-75 transition-colors z-10 disabled:opacity-30 disabled:cursor-not-allowed ml-2"
                                                >
                                                    <ChevronLeft className="h-8 w-8" />
                                                </button>
                                                <button
                                                    onClick={() => handleNextSlide(group.categoryName, totalSlides)}
                                                    disabled={currentSlide === totalSlides - 1}
                                                    className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gray-800 bg-opacity-50 text-white hover:bg-opacity-75 transition-colors z-10 disabled:opacity-30 disabled:cursor-not-allowed mr-2"
                                                >
                                                    <ChevronRight className="h-8 w-8" />
                                                </button>
                                                <div className="flex justify-center items-center mt-4 space-x-2">
                                                    <span className="text-sm text-gray-600">
                                                        {currentSlide + 1} / {totalSlides}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    searchTerm ? (
                        <p className="text-center text-gray-600 text-lg">{`Không tìm thấy sản phẩm nào phù hợp với từ khóa '${searchTerm}'`}</p>
                    ) : (
                        <p className="text-center text-gray-600 text-lg">Chưa có sản phẩm nào để hiển thị.</p>
                    )
                )}
            </main>
        </>
    );
}