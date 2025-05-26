// src/app/page.tsx
"use client";

import { useState, useEffect } from 'react';
import '@/app/globals.css';
import Navbar from "@/components/Navbar";
import Link from 'next/link';
import Slider from 'react-slick';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { supabase } from '@/lib/supabase';
import React from 'react';

// --- Interfaces và Hằng Số ---

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  image: string;
  images: string[] | null;
  stock_quantity: number;
  category: string;
  is_featured?: boolean;
  created_at: string;
  updated_at: string;
}

interface CustomArrowProps {
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const heroImages = [
  {
    src: "/banner-1.jpg",
    alt: "Laptop Gaming Hiệu Năng Vượt Trội",
    title: "Sức Mạnh Tuyệt Đối",
    description: "Trải nghiệm chơi game đỉnh cao với các mẫu laptop gaming mới nhất.",
    link: "/products/gaming-laptop"
  },
  {
    src: "/banner-2.jpg",
    alt: "Xây Dựng Cỗ Máy Mơ Ước",
    title: "PC Gaming Tùy Chỉnh Đỉnh Cao",
    description: "PC gaming được lắp ráp tùy chỉnh, tối ưu cho mọi tựa game.",
    link: "/products/pc-gaming"
  },
  {
    src: "/banner-3.jpg",
    alt: "Hoàn Thiện Bộ Gear Của Bạn",
    title: "Phụ Kiện Gaming Độc Đáo",
    description: "Khám phá chuột, bàn phím, tai nghe và nhiều phụ kiện gaming khác.",
    link: "/products/accessories"
  }
];

const CACHE_KEY = 'homePageData';
const CACHE_EXPIRATION_TIME = 3600 * 1000; // 1 giờ

// --- Custom Arrow Components ---

const CustomPrevArrow = (props: CustomArrowProps) => {
  const { className, style, onClick } = props;
  return (
    <div
      className={`${className} custom-slick-arrow slick-prev`}
      style={{
        ...style,
        left: "10px",
        zIndex: 10,
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: "50%",
        padding: "10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClick}
    >
        <FaChevronLeft className="text-white text-xl"/>
    </div>
  );
};

const CustomNextArrow = (props: CustomArrowProps) => {
  const { className, style, onClick } = props;
  return (
    <div
      className={`${className} custom-slick-arrow slick-next`}
      style={{
        ...style,
        right: "10px",
        zIndex: 10,
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: "50%",
        padding: "10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClick}
    >
        <FaChevronRight className="text-white text-xl"/>
    </div>
  );
};

// --- Home Component Chính ---

export default function Home() {
  const [smallCategoryProducts, setSmallCategoryProducts] = useState<{ [key: string]: Product[] }>({});
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const categorySections = [
    { key: 'computer', title: 'Laptop Gaming' },
    { key: 'clothing', title: 'PC Gaming' },

  ];

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768); // breakpoint 'md' của Tailwind
    };

    handleResize(); // Đặt trạng thái ban đầu
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
      const fetchData = async () => {
          setLoading(true);
          setError(null);

          if (typeof window !== 'undefined') {
              const cachedData = localStorage.getItem(CACHE_KEY);
              if (cachedData) {
                  try {
                      const { timestamp, smallCategoryProducts: cachedSmallCategory, featuredProducts: cachedFeatured } = JSON.parse(cachedData);
                      if (Date.now() - timestamp < CACHE_EXPIRATION_TIME) {
                          setSmallCategoryProducts(cachedSmallCategory);
                          setFeaturedProducts(cachedFeatured);
                          setLoading(false);
                          console.log("Dữ liệu đã được tải từ cache!");
                          return;
                      } else {
                          console.log("Cache đã hết hạn, đang fetch dữ liệu mới...");
                          localStorage.removeItem(CACHE_KEY);
                      }
                  } catch (e) {
                      console.error("Lỗi khi đọc hoặc phân tích cú pháp cache:", e);
                      localStorage.removeItem(CACHE_KEY);
                  }
              }
          }

          try {
              const categoriesToFetch = categorySections.map(s => s.key);
              const categoryProductMap: { [key: string]: Product[] } = {};

              for (const category of categoriesToFetch) {
                  const { data: productsData, error: productsError } = await supabase
                      .from('products')
                      .select('*')
                      .eq('category', category)
                      .order('created_at', { ascending: false })
                      .limit(5);

                  if (productsError) {
                      console.error(`Error fetching products for category ${category}:`, productsError.message);
                      throw productsError;
                  }

                  const processedProducts = (productsData || []).map(p => ({
                    ...p,
                    image: p.image || '',
                    images: Array.isArray(p.images) ? p.images : (p.images ? [p.images as string] : null)
                  })) as Product[];
                  categoryProductMap[category] = processedProducts;
              }
              setSmallCategoryProducts(categoryProductMap);

              const { data: featuredData, error: featuredError } = await supabase
                  .from('products')
                  .select('*')
                  .eq('is_featured', true)
                  .order('created_at', { ascending: false })
                  .limit(6);
              if (featuredError) {
                  console.error("Error fetching featured products:", featuredError.message);
                  throw featuredError;
              }
              const processedFeatured = (featuredData || []).map(p => ({
                ...p,
                image: p.image || ''
              })) as Product[];
              setFeaturedProducts(processedFeatured);

              if (typeof window !== 'undefined') {
                  const dataToCache = {
                      timestamp: Date.now(),
                      smallCategoryProducts: categoryProductMap,
                      featuredProducts: processedFeatured,
                  };
                  localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
                  console.log("Dữ liệu mới đã được fetch và lưu vào cache.");
              }

          } catch (error: unknown) {
              console.error("Overall error in fetchData:", error);
              if (error instanceof Error) {
                setError(`Không thể tải dữ liệu trang chủ: ${error.message}. Vui lòng thử lại sau.`);
              } else {
                setError("Không thể tải dữ liệu trang chủ. Vui lòng thử lại sau.");
              }
          } finally {
              setLoading(false);
          }
      };

      fetchData();
  }, []);

  // Cấu hình cho Hero Slider chính
  const heroSliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    fade: true,
    arrows: !isMobile, // Hiển thị mũi tên chỉ khi không phải mobile
    prevArrow: <CustomPrevArrow />,
    nextArrow: <CustomNextArrow />,
    appendDots: (dots: React.ReactNode[]) => (
        <div style={{ position: "absolute", bottom: "5px", width: "100%", textAlign: "center", zIndex: 60 }}>
            <ul style={{ margin: "0px" }}> {dots} </ul>
        </div>
    ),
    customPaging: () => (
        <div className="w-3 h-3 rounded-full bg-white bg-opacity-50 hover:bg-opacity-80 transition-all duration-300 mx-1"></div>
    )
  };

  // Cấu hình cho các Slider sản phẩm bên trong các banner nhỏ
  const smallProductCarouselSettings = {
    dots: false,
    infinite: true,
    speed: 1000,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    arrows: !isMobile, // Ẩn mũi tên trên mobile
    prevArrow: <CustomPrevArrow />,
    nextArrow: <CustomNextArrow />,
    fade: true,
  };

  if (loading) {
      return (
          <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
              <p className="mt-4 text-xl text-gray-700">Đang tải dữ liệu...</p>
          </div>
      );
  }

  if (error) {
      return (
          <div className="flex justify-center items-center min-h-screen bg-gray-100">
              <p className="text-red-500 text-xl">{error}</p>
          </div>
      );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-[1300px] mx-auto px-4 bg-white">
        <main className="min-h-screen">

          {/* Hero Section (Slider chính của trang chủ) */}
          <section className="relative my-4 rounded-xl overflow-hidden shadow-lg">
            <div className="relative w-full pt-[56.25%]">
              <Slider {...heroSliderSettings}>
                {heroImages.map((image, index) => (
                  <div key={index} className="relative w-full h-full">
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="eager"
                    />
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-4 text-white">
                      <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold mb-2 sm:mb-4 leading-tight text-center">
                        {image.title}
                      </h2>
                      <p className="text-sm sm:text-lg md:text-xl lg:text-2xl mb-4 sm:mb-8 max-w-3xl mx-auto text-center">
                        {image.description}
                      </p>
                      <Link href={image.link} className="bg-white text-gray-800 px-6 py-2 sm:px-8 sm:py-3 rounded-full text-sm sm:text-lg font-semibold hover:bg-gray-200 transition duration-300 shadow-lg inline-block">
                        Khám phá ngay
                      </Link>
                    </div>
                  </div>
                ))}
              </Slider>
            </div>
          </section>

          {/* Section chứa các Banner nhỏ theo Category */}
          <section className="py-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 text-gray-800">Các danh mục hàng đầu</h2>
            <div className="flex flex-wrap -mx-2 sm:-mx-4">
              {categorySections.map((sectionConfig) => (
                smallCategoryProducts[sectionConfig.key] && smallCategoryProducts[sectionConfig.key].length > 0 && (
                  <div key={sectionConfig.key} className="w-1/2 px-2 sm:px-4 mb-4 sm:mb-8">
                    <div className="relative rounded-xl overflow-hidden shadow-lg group bg-gray-100 flex flex-col h-full">
                        <h3 className="text-base sm:text-xl font-bold text-center pt-2 pb-1 text-gray-800">
                          {sectionConfig.title}
                        </h3>
                        <div className="relative w-full pt-[calc(100%*3/4)] md:pt-[75%] flex-grow">
                            <Slider {...smallProductCarouselSettings}>
                                {smallCategoryProducts[sectionConfig.key].map((product) => (
                                  <Link key={product.id} href={`/products/${product.slug}`} className="block relative w-full h-full">
                                      <img
                                          src={product.image}
                                          alt={product.name}
                                          className="absolute inset-0 w-full h-full object-contain bg-gray-200"
                                      />
<div className="absolute inset-0 bg-transparent md:bg-black/60 flex flex-col items-center justify-end text-gray-900
                        p-1 pb-1 md:p-2 md:pb-4 opacity-100 md:opacity-0 md:group-hover:opacity-100
                        transition-opacity duration-300">
    <h4 className="text-xs sm:text-lg font-bold text-center leading-tight mb-0.5
                   bg-orange-300 py-0.5 px-1 rounded"> {/* Vẫn giữ nền vàng cam cho tên sản phẩm */}
      {product.name}
    </h4>
    <p className="text-[10px] sm:text-base text-center mb-1
                  text-red-600 font-bold bg-white"> {/* Bỏ bg-orange-300, py-0.5, px-1, rounded ở đây. Chỉ giữ text-red-600 */}
      {product.price.toLocaleString('vi-VN')} VNĐ
    </p>
    {/* <span className="bg-white text-gray-800 px-1.5 py-0.5 rounded-full text-[9px] sm:text-xs font-semibold hover:bg-gray-200 transition duration-300 inline-block">
      Xem chi tiết
    </span> */}
</div>
                                  </Link>
                                ))}
                            </Slider>
                        </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </section>

          {/* Section Sản phẩm nổi bật */}
          {featuredProducts.length > 0 && (
              <section className="py-8">
                  <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 text-gray-800">Sản phẩm được yêu thích</h2>
                  {/* Thay đổi grid-cols-1 thành grid-cols-2 để hiển thị 2 sản phẩm trên mobile */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8"> {/* Giảm gap cho mobile */}
                      {featuredProducts.map((product) => (
                          <div key={product.id} className="bg-gray-100 rounded-lg shadow-md overflow-hidden">
                              <img src={product.image} alt={product.name} className="w-full h-40 sm:h-64 object-cover"/> {/* Giảm chiều cao ảnh trên mobile */}
                              <div className="p-2 sm:p-6"> {/* Giảm padding trên mobile */}
                                  <h3 className="font-bold text-sm sm:text-xl mb-1 sm:mb-2 text-gray-800 leading-tight">{product.name}</h3> {/* Giảm font, mb và leading */}
                                  <p className="text-xs sm:text-base text-gray-600 line-clamp-2">{product.description}</p> {/* Giảm font, giới hạn dòng */}
                                  <p className="text-sm sm:text-lg text-gray-900 font-semibold mt-1 sm:mt-2">{product.price.toLocaleString('vi-VN')} VNĐ</p> {/* Giảm font, mt */}
                                  <Link href={`/products/${product.slug}`} className="mt-2 inline-block text-blue-600 hover:underline text-xs sm:text-base">Xem chi tiết</Link> {/* Giảm font, mt */}
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="text-center mt-12">
                      <Link href="/products" className="bg-gray-800 text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-gray-700 transition duration-300 shadow-lg inline-block">
                          Xem tất cả sản phẩm
                      </Link>
                  </div>
              </section>
          )}
        </main>
      </div>
    </>
  );
}