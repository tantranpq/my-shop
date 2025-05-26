// src/app/page.tsx
"use client";
import { useState, useEffect } from 'react';
import '@/app/globals.css';
import Navbar from "@/components/Navbar";
import Link from 'next/link';
import Slider from 'react-slick';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { supabase } from '@/lib/supabase';
import React from 'react'; // Import React để sử dụng React.CSSProperties và React.ReactNode

// Đảm bảo bạn đã cài đặt react-slick và slick-carousel:
// npm install react-slick slick-carousel
// npm install @types/react-slick (nếu dùng TypeScript)

// Và import CSS của slick vào file global.css của bạn, ví dụ:
// @import "slick-carousel/slick/slick.css";
// @import "slick-carousel/slick/slick-theme.css";


// Định nghĩa Product interface
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  image: string; // Ảnh đại diện chính
  images: string[] | null; // Ảnh phụ (dùng cho trang chi tiết sản phẩm, không dùng cho slider này)
  stock_quantity: number;
  category: string;
  is_featured?: boolean;
  created_at: string;
  updated_at: string;
}

// Định nghĩa props interface cho các mũi tên tùy chỉnh
// Đây là kiểu props mà react-slick truyền vào custom arrow components
interface CustomArrowProps {
  className?: string;
  style?: React.CSSProperties; // Sử dụng React.CSSProperties để có kiểu cho style object
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

// Danh sách các ảnh cho Hero Slider (STATICALLY DEFINED)
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

// Custom Arrow Components (Mũi tên điều hướng cho slider)
const CustomPrevArrow = (props: CustomArrowProps) => {
  const { className, style, onClick } = props;
  return (
    <div
      className={`${className} custom-slick-arrow slick-prev`}
      style={{
        ...style,
        left: "10px", // Vị trí từ lề trái
        zIndex: 10,
        backgroundColor: "rgba(0,0,0,0.5)", // Nền đen trong suốt
        borderRadius: "50%",
        padding: "10px",
        cursor: "pointer",
        display: "flex", // Sử dụng flex để căn giữa icon
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
        right: "10px", // Vị trí từ lề phải
        zIndex: 10,
        backgroundColor: "rgba(0,0,0,0.5)", // Nền đen trong suốt
        borderRadius: "50%",
        padding: "10px",
        cursor: "pointer",
        display: "flex", // Sử dụng flex để căn giữa icon
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClick}
    >
        <FaChevronRight className="text-white text-xl"/>
    </div>
  );
};

// Định nghĩa khóa và thời gian hết hạn cho cache (ví dụ: 1 giờ = 3600 * 1000 ms)
const CACHE_KEY = 'homePageData';
const CACHE_EXPIRATION_TIME = 3600 * 1000; // 1 giờ

export default function Home() {
  const [smallCategoryProducts, setSmallCategoryProducts] = useState<{ [key: string]: Product[] }>({});
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Định nghĩa các category bạn muốn hiển thị và tiêu đề của chúng
  const categorySections = [
    { key: 'computer', title: 'Laptop Gaming' },
    { key: 'clothing', title: 'PC Gaming' },

  ];

  useEffect(() => {
      // Hàm fetchData sẽ chỉ chạy một lần khi component được mount
      const fetchData = async () => {
          setLoading(true);
          setError(null);

          // 1. Cố gắng tải dữ liệu từ localStorage
          if (typeof window !== 'undefined') {
              const cachedData = localStorage.getItem(CACHE_KEY);
              if (cachedData) {
                  try {
                      const { timestamp, smallCategoryProducts: cachedSmallCategory, featuredProducts: cachedFeatured } = JSON.parse(cachedData);

                      // Kiểm tra thời gian hết hạn của cache
                      if (Date.now() - timestamp < CACHE_EXPIRATION_TIME) {
                          setSmallCategoryProducts(cachedSmallCategory);
                          setFeaturedProducts(cachedFeatured);
                          setLoading(false);
                          console.log("Dữ liệu đã được tải từ cache!");
                          return; // Thoát hàm nếu dữ liệu hợp lệ từ cache
                      } else {
                          console.log("Cache đã hết hạn, đang fetch dữ liệu mới...");
                          localStorage.removeItem(CACHE_KEY); // Xóa cache cũ
                      }
                  } catch (e) {
                      console.error("Lỗi khi đọc hoặc phân tích cú pháp cache:", e);
                      localStorage.removeItem(CACHE_KEY); // Xóa cache lỗi
                  }
              }
          }

          // 2. Nếu không có cache hoặc cache đã hết hạn, fetch dữ liệu từ Supabase
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

              // 3. Lưu dữ liệu mới vào localStorage
              if (typeof window !== 'undefined') {
                  const dataToCache = {
                      timestamp: Date.now(),
                      smallCategoryProducts: categoryProductMap,
                      featuredProducts: processedFeatured,
                  };
                  localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
                  console.log("Dữ liệu mới đã được fetch và lưu vào cache.");
              }

          } catch (error: unknown) { // <-- Đã thay đổi từ 'any' sang 'unknown'
              console.error("Overall error in fetchData:", error);
              // Kiểm tra kiểu của error để hiển thị thông báo phù hợp
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
  }, []); // <-- Mảng rỗng đảm bảo useEffect chỉ chạy MỘT LẦN khi component mount

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
    arrows: true,
    prevArrow: <CustomPrevArrow />,
    nextArrow: <CustomNextArrow />,
    appendDots: (dots: React.ReactNode[]) => ( // <-- Đã thay đổi từ 'any' sang React.ReactNode[]
        <div style={{ position: "absolute", bottom: "20px", width: "100%", textAlign: "center", zIndex: 60 }}>
            <ul style={{ margin: "0px" }}> {dots} </ul>
        </div>
    ),
    customPaging: (_i: number) => (
        <div className="w-3 h-3 rounded-full bg-white bg-opacity-50 hover:bg-opacity-80 transition-all duration-300 mx-1"></div>
    )
  };

  // Cấu hình cho các Slider sản phẩm bên trong các banner nhỏ (Mỗi slide 1 sản phẩm)
  const smallProductCarouselSettings = {
    dots: false,
    infinite: true,
    speed: 1000,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    arrows: true,
    prevArrow: <CustomPrevArrow />,
    nextArrow: <CustomNextArrow />,
    fade: true,
  };

  // Hiển thị hiệu ứng loading nếu dữ liệu đang tải
  if (loading) {
      return (
          <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
              <p className="mt-4 text-xl text-gray-700">Đang tải dữ liệu...</p>
          </div>
      );
  }

  // Hiển thị thông báo lỗi nếu có lỗi
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

          {/* Hero Section (Slider chính) */}
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
                      <h2 className="text-4xl md:text-6xl font-bold mb-4 leading-tight text-center">
                        {image.title}
                      </h2>
                      <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-center">
                        {image.description}
                      </p>
                      <Link href={image.link} className="bg-white text-gray-800 px-8 py-3 rounded-full text-lg font-semibold hover:bg-gray-200 transition duration-300 shadow-lg inline-block">
                        Khám phá ngay
                      </Link>
                    </div>
                  </div>
                ))}
              </Slider>
            </div>
          </section>

          {/* Section chứa các Banner nhỏ theo Category (kiểu lưới 2x2) */}
          <section className="py-16">
            <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Sản phẩm theo danh mục</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {categorySections.map((sectionConfig) => (
                smallCategoryProducts[sectionConfig.key] && smallCategoryProducts[sectionConfig.key].length > 0 && (
                  <div key={sectionConfig.key} className="relative rounded-xl overflow-hidden shadow-lg group bg-gray-100 flex flex-col">
                      <h3 className="text-2xl font-bold text-center pt-6 pb-2 text-gray-800">{sectionConfig.title}</h3>
                      <div className="relative w-full pt-[75%] flex-grow">
                          <Slider {...smallProductCarouselSettings}>
                              {smallCategoryProducts[sectionConfig.key].map((product) => (
                                <Link key={product.id} href={`/products/${product.slug}`} className="block relative w-full h-full">
                                    <img
                                        src={product.image}
                                        alt={product.name}
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-end text-white p-4 pb-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <h4 className="text-2xl font-bold text-center mb-2">{product.name}</h4>
                                        <p className="text-lg text-center mb-2">{product.price.toLocaleString('vi-VN')} VNĐ</p>
                                        <span className="bg-white text-gray-800 px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 transition duration-300">
                                          Xem chi tiết
                                        </span>
                                    </div>
                                </Link>
                              ))}
                          </Slider>
                      </div>
                  </div>
                )
              ))}
            </div>
          </section>

          {/* Section Sản phẩm nổi bật */}
          {featuredProducts.length > 0 && (
              <section className="py-16">
                  <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Sản phẩm nổi bật của chúng tôi</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                      {featuredProducts.map((product) => (
                          <div key={product.id} className="bg-gray-100 rounded-lg shadow-md overflow-hidden">
                              <img src={product.image} alt={product.name} className="w-full h-64 object-cover"/>
                              <div className="p-6">
                                  <h3 className="font-bold text-xl mb-2 text-gray-800">{product.name}</h3>
                                  <p className="text-gray-600">{product.description}</p>
                                  <p className="text-gray-900 font-semibold mt-2">{product.price.toLocaleString('vi-VN')} VNĐ</p>
                                  <Link href={`/products/${product.slug}`} className="mt-4 inline-block text-blue-600 hover:underline">Xem chi tiết</Link>
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