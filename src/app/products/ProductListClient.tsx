"use client";

import '@/app/globals.css';
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Product } from "@/types/product";
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';

// Hàm getProducts luôn tải TẤT CẢ sản phẩm (không lọc theo category ở đây)
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

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const [categorySlidePages, setCategorySlidePages] = useState<Map<string, number>>(new Map());
    const [favoriteProductIds, setFavoriteProductIds] = useState<Set<string>>(new Set());
    // State cho danh mục được chọn
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // --- THÊM STATE VÀ EFFECT ĐỂ THEO DÕI KÍCH THƯỚC MÀN HÌNH ---
    const [windowWidth, setWindowWidth] = useState(0);

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        setWindowWidth(window.innerWidth); // Thiết lập giá trị ban đầu

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // --- TÍNH TOÁN itemsPerSlide DỰA TRÊN KÍCH THƯỚC MÀN HÌNH ---
    const itemsPerSlide = useMemo(() => {
        if (windowWidth >= 1024) { // lg và lớn hơn (ví dụ 4 cột, muốn 8 sản phẩm -> 2 hàng)
            return 8;
        } else if (windowWidth >= 768) { // md (ví dụ 3 cột, muốn 6 sản phẩm -> 2 hàng)
            return 6;
        } else if (windowWidth >= 640) { // sm (ví dụ 2 cột, muốn 4 sản phẩm -> 2 hàng)
            return 4;
        } else { // dưới sm (mobile) (2 cột, muốn 4 sản phẩm -> 2 hàng)
            return 4;
        }
    }, [windowWidth]);


    // --- EFFECT ĐỂ FETCH SẢN PHẨM LẦN ĐẦU & REALTIME SUBSCRIPTION ---
    useEffect(() => {
        async function fetchInitialProducts() {
            try {
                setLoading(true);
                // Gọi getProducts mà không truyền selectedCategory
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

        fetchInitialProducts(); // Fetch lần đầu

        // Đăng ký lắng nghe thay đổi Realtime
        const channel = supabase
            .channel('products_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                (payload) => {
                    console.log('Realtime change received!', payload);
                    fetchInitialProducts();
                }
            )
            .subscribe();

        // Hàm cleanup khi component unmount
        return () => {
            supabase.removeChannel(channel);
        };
    }, [searchTerm]); // Chỉ re-subscribe khi searchTerm thay đổi

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
            const favIds = new Set(data.map(item => item.product_id));
            setFavoriteProductIds(favIds);
        } else {
            setFavoriteProductIds(new Set());
        }
    }, [user]);

    useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

    const handleAddToCart = (product: Product) => {
        if (product.stock_quantity <= 0) {
            toast.error('Sản phẩm này đã hết hàng!');
            return;
        }
        addToCart(product);
        toast.success(`Đã thêm ${product.name} vào giỏ hàng.`);
    };

    const handleBuyNow = (product: Product) => {
        if (product.stock_quantity <= 0) {
            toast.error('Sản phẩm này đã hết hàng. Không thể mua ngay!');
            return;
        }
        if (!product.slug) {
            toast.error('Không thể mua ngay sản phẩm này (thiếu slug).');
            return;
        }
        router.push(`/checkout?items=${product.slug}:1`);
    };

    const handleToggleFavorite = async (product: Product) => {
        if (!user) {
            toast.info('Vui lòng đăng nhập để thêm sản phẩm vào danh sách yêu thích.');
            return;
        }

        const isFavorited = favoriteProductIds.has(product.id);
        const newFavorites = new Set(favoriteProductIds);

        if (isFavorited) {
            newFavorites.delete(product.id);
            setFavoriteProductIds(newFavorites);
            toast.success(`Đã xóa "${product.name}" khỏi danh sách yêu thích.`);

            const { error } = await supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', user.id)
                .eq('product_id', product.id);

            if (error) {
                console.error('Lỗi khi xóa sản phẩm yêu thích:', error);
                toast.error('Có lỗi xảy ra khi xóa sản phẩm yêu thích.');
                setFavoriteProductIds(prev => new Set(prev).add(product.id));
            }
        } else {
            newFavorites.add(product.id);
            setFavoriteProductIds(newFavorites);
            toast.success(`Đã thêm "${product.name}" vào danh sách yêu thích.`);

            const { error } = await supabase
                .from('user_favorites')
                .insert({ user_id: user.id, product_id: product.id });

            if (error) {
                console.error('Lỗi khi thêm sản phẩm yêu thích:', error);
                toast.error('Có lỗi xảy ra khi thêm sản phẩm yêu thích.');
                setFavoriteProductIds(prev => {
                    const revertSet = new Set(prev);
                    revertSet.delete(product.id);
                    return revertSet;
                });
            }
        }
    };

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

    const handleNextSlide = (categoryName: string, totalSlides: number) => {
        setCategorySlidePages(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(categoryName) || 0;
            newMap.set(categoryName, Math.min(current + 1, totalSlides - 1));
            return newMap;
        });
    };

    const handlePrevSlide = (categoryName: string) => {
        setCategorySlidePages(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(categoryName) || 0;
            newMap.set(categoryName, Math.max(current - 1, 0));
            return newMap;
        });
    };

    // Điều chỉnh groupedProducts để lọc sản phẩm sau khi đã tải TẤT CẢ
    const groupedProducts = useMemo(() => {
        const groups: { [key: string]: Product[] } = {};

        // Lọc sản phẩm ở đây dựa trên selectedCategory
        const productsToGroup = selectedCategory
            ? products.filter(p => p.category === selectedCategory)
            : products;

        productsToGroup.forEach(product => {
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
    }, [products, selectedCategory]); // Thêm selectedCategory vào dependencies

    // Lấy danh sách các danh mục duy nhất từ TẤT CẢ sản phẩm (không bị ảnh hưởng bởi selectedCategory)
    const uniqueCategories = useMemo(() => {
        const categories = new Set<string>();
        products.forEach(product => {
            if (product.category && typeof product.category === 'string') {
                categories.add(product.category);
            }
        });
        return Array.from(categories).sort();
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
            <main className="container mx-auto px-6 pb-6">
                {/* Thay đổi cấu trúc div cha để chứa cả H1 và bộ lọc danh mục */}
                <div className="sticky top-16 bg-white z-10 py-4 flex justify-between items-center border-b border-gray-200 -mx-6 px-6">
                    <h1 className="text-3xl font-bold text-gray-800">
                        {searchTerm
                            ? `Kết quả tìm kiếm cho '${searchTerm}'`
                            : ""}
                    </h1>

                    {/* Phần lọc theo danh mục, nằm bên phải và căn giữa theo chiều dọc */}
                    <div className="flex items-center">
                        <label htmlFor="category-select" className="mr-3 font-semibold text-gray-700 whitespace-nowrap">Danh mục:</label>
                        <select
                            id="category-select"
                            className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
                            value={selectedCategory || ""}
                            onChange={(e) => setSelectedCategory(e.target.value === "" ? null : e.target.value)}
                        >
                            <option value="">Tất cả danh mục</option>
                            {uniqueCategories.map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </div>
                    {/* Kết thúc phần lọc theo danh mục */}
                </div>

                {groupedProducts.length > 0 ? (
                    groupedProducts.map((group) => {
                        // Chỉ render nhóm nếu có sản phẩm sau khi lọc
                        if (group.products.length === 0) {
                            return null;
                        }

                        const currentSlide = categorySlidePages.get(group.categoryName) || 0;
                        // totalSlides và productsToShow sẽ tự động cập nhật theo itemsPerSlide
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
                                    <> {/* Thêm Fragment để bọc lại các phần tử */}
                                        <div className="relative"> {/* Giữ nguyên div này cho grid sản phẩm */}
                                            <div
                                                id={`products-in-${group.categoryName.replace(/\s+/g, '-')}`}
                                                // Thay đổi ở đây: giữ nguyên grid-cols-2 và thêm các breakpoint khác
                                                className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8"
                                            >
                                                {productsToShow.map((product) => {
                                                    const isOutOfStock = product.stock_quantity <= 0;
                                                    return (
                                                        <div key={product.id} className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col transform transition-transform duration-300 hover:scale-105 relative">
                                                            <Link href={`/products/${product.slug}`} className="block">
                                                                <img
                                                                    src={product.image || '/not-found.png'}
                                                                    alt={product.name}
                                                                    width={400}
                                                                    height={300}
                                                                    className="w-full h-48 object-cover"
                                                                />
                                                            </Link>
                                                            <button
                                                                onClick={() => handleToggleFavorite(product)}
                                                                className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md text-red-500 hover:scale-110 transition-transform z-20"
                                                                aria-label={favoriteProductIds.has(product.id) ? "Xóa khỏi yêu thích" : "Thêm vào yêu thích"}
                                                            >
                                                                <Heart fill={favoriteProductIds.has(product.id) ? "currentColor" : "none"} className="h-6 w-6" />
                                                            </button>

                                                            <span className={`absolute top-2 left-2 text-white text-xs font-bold rounded-full px-2 py-1 flex items-center justify-center min-w-[50px] h-[24px] z-10 ${isOutOfStock
                                                                ? 'bg-red-600'
                                                                : product.stock_quantity < 10
                                                                    ? 'bg-yellow-500'
                                                                    : 'bg-green-600'
                                                                }`
                                                            }>
                                                                {isOutOfStock ? (
                                                                    'Hết hàng'
                                                                ) : product.stock_quantity < 10 ? (
                                                                    `còn ${product.stock_quantity} SP`
                                                                ) : (
                                                                    'Còn hàng'
                                                                )}
                                                            </span>

                                                            <div className="p-5 flex-grow flex flex-col">
                                                                <h3 className="text-base sm:text-xl font-bold mb-2">
                                                                    <Link href={`/products/${product.slug}`} className="text-gray-900 hover:text-blue-600 transition-colors">
                                                                        {product.name}
                                                                    </Link>
                                                                </h3>
                                                                <p className="text-red-600 font-semibold mb-3 text-base sm:text-lg">
                                                                    {product.price.toLocaleString('vi-VN')} <sup className="underline">đ</sup>
                                                                </p>
                                                                <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0 mt-auto">
                                                                    <button
                                                                        className={`bg-blue-100 text-blue-700 px-2 py-2 text-xs sm:px-3 sm:py-2 sm:text-sm rounded-lg font-medium shadow-md transition-colors duration-200
                                                                            ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500' : 'hover:bg-blue-200'} w-full`}
                                                                        onClick={() => handleAddToCart(product)}
                                                                        disabled={isOutOfStock}
                                                                    >
                                                                        Thêm vào giỏ hàng
                                                                    </button>
                                                                    <button
                                                                        className={`bg-green-100 text-green-700 px-2 py-2 text-xs sm:px-3 sm:py-2 sm:text-sm rounded-lg font-medium shadow-md transition-colors duration-200
                                                                            ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500' : 'hover:bg-green-200'} w-full`}
                                                                        onClick={() => handleBuyNow(product)}
                                                                        disabled={isOutOfStock}
                                                                    >
                                                                        Mua ngay
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {totalSlides > 1 && (
                                            <div className="flex justify-center items-center mt-4 space-x-2">
                                                <button
                                                    onClick={() => handlePrevSlide(group.categoryName)}
                                                    disabled={currentSlide === 0}
                                                    className="p-2 rounded-full bg-gray-800 bg-opacity-50 text-white hover:bg-opacity-75 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
                                                </button>

                                                <span className="text-sm text-gray-600">
                                                    {currentSlide + 1} / {totalSlides}
                                                </span>

                                                <button
                                                    onClick={() => handleNextSlide(group.categoryName, totalSlides)}
                                                    disabled={currentSlide === totalSlides - 1}
                                                    className="p-2 rounded-full bg-gray-800 bg-opacity-50 text-white hover:bg-opacity-75 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
                                                </button>
                                            </div>
                                        )}
                                    </>
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