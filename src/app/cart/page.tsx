// app/cart/page.tsx
"use client";
import Navbar from "@/components/Navbar";
export const dynamic = "force-dynamic";
import Image from 'next/image';
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { User, useUser } from '@supabase/auth-helpers-react';
import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export default function CartPage() {
  const { cart, removeFromCart, incrementQuantity, decrementQuantity, clearCart } = useCart();
  const userObject = useUser();
  const user = userObject as User | null;
  const [selectedItems, setSelectedItems] = useState<string[]>([]); // Lưu trữ slug của các sản phẩm đã chọn
  const pathname = usePathname();

  // Tính tổng số tiền của các sản phẩm đã chọn
  const total = cart.reduce((sum, item) => {
    if (selectedItems.includes(item.slug)) {
      return sum + item.price * item.quantity;
    }
    return sum;
  }, 0);

  // Tạo dữ liệu cho query parameter 'items'
  // Dữ liệu này cần là một chuỗi JSON đã được mã hóa URL
  const checkoutQueryItems = useCallback(() => {
    const itemsToPass = cart
      .filter(item => selectedItems.includes(item.slug)) // Chỉ lấy các sản phẩm đã chọn
      .map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        slug: item.slug, // Truyền slug để đảm bảo tính nhất quán nếu cần
        quantity: item.quantity,
      }));
    const jsonString = JSON.stringify(itemsToPass);
    console.log("CartPage: JSON string to be encoded:", jsonString); // Debug log
    const encodedUrl = encodeURIComponent(jsonString);
    console.log("CartPage: Encoded URL parameter:", encodedUrl);     // Debug log
    return encodedUrl;
  }, [cart, selectedItems]);


  return (
    <>
      <Navbar />
      <main className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Giỏ hàng của bạn</h1>
          {cart.length > 0 && (
            <button
              className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
              onClick={clearCart}
              disabled={cart.length === 0}
            >
              Xóa toàn bộ
            </button>
          )}
        </div>
        {cart.length === 0 ? (
          <p>Giỏ hàng trống.</p>
        ) : (
          <div>
            {cart.map((item) => (
              <div key={item.slug} className="border-b py-2 flex justify-between items-center gap-4">
                <div className="w-20 h-20 rounded overflow-hidden relative flex-shrink-0">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      style={{ objectFit: 'cover' }}
                      className="rounded"
                    />
                  ) : (
                    <img
                      src="https://placehold.co/80x80/cccccc/333333?text=No+Image" // Fallback placeholder
                      alt="No Image"
                      className="w-full h-full object-cover rounded"
                    />
                  )}
                </div>
                <div className="flex-grow">
                  <p className="font-semibold">{item.name}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <button
                      onClick={() => decrementQuantity(item.slug)}
                      className="bg-gray-200 text-gray-600 rounded-md w-6 h-6 flex items-center justify-center hover:bg-gray-300 focus:outline-none"
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => incrementQuantity(item.slug)}
                      className="bg-gray-200 text-gray-600 rounded-md w-6 h-6 flex items-center justify-center hover:bg-gray-300 focus:outline-none"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">{item.price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>
                </div>
                <button
                  onClick={() => removeFromCart(item.slug)}
                  className="text-red-500 hover:bg-red-100 rounded-md px-2 py-1 transition duration-150 ease-in-out flex-shrink-0"
                >
                  Xóa
                </button>
                <input
                  type="checkbox"
                  value={item.slug}
                  checked={selectedItems.includes(item.slug)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedItems([...selectedItems, item.slug]);
                    } else {
                      setSelectedItems(selectedItems.filter((slug) => slug !== item.slug));
                    }
                  }}
                  className="form-checkbox h-5 w-5 text-blue-600 flex-shrink-0"
                />
              </div>
            ))}

            {cart.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <p className="text-lg font-bold">Tổng cộng: {total.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>

                <div className="flex justify-end gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:underline px-2 py-1 rounded"
                    onClick={() => setSelectedItems(cart.map((item) => item.slug))}
                    disabled={cart.length === 0 || selectedItems.length === cart.length}
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:underline px-2 py-1 rounded"
                    onClick={() => setSelectedItems([])}
                    disabled={selectedItems.length === 0}
                  >
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>
            )}

            {/* THÔNG BÁO CHO KHÁCH VÃNG LAI */}
            {!user && selectedItems.length > 0 && ( // Chỉ hiển thị khi chưa đăng nhập và có sản phẩm được chọn
              <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mt-6 mb-4" role="alert">
                <p className="font-bold">Bạn đang mua hàng với tư cách khách.</p>
                <p className="text-sm">Để hưởng các ưu đãi độc quyền và quản lý đơn hàng dễ dàng hơn, vui lòng {' '}
                  <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`} className="font-semibold underline hover:text-yellow-800">đăng nhập</Link> hoặc {' '}
                  <Link href="/register" className="font-semibold underline hover:text-yellow-800">đăng ký</Link> ngay!
                </p>
              </div>
            )}
            
            <Link
              href={{
                pathname: "/checkout",
                query: { items: checkoutQueryItems() }, // Gọi hàm để lấy chuỗi JSON đã mã hóa
              }}
              className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg block text-center mt-6
                ${selectedItems.length === 0 ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`
              }
            >
              Tiến hành thanh toán ({selectedItems.length} sản phẩm)
            </Link>
          </div>
        )}

        <Link href="/products" className="text-blue-500 mt-6 block hover:underline text-center">
          ← Tiếp tục mua sắm
        </Link>
      </main>
    </>
  );
}
