"use client";
import Navbar from "@/components/Navbar";
export const dynamic = "force-dynamic";
import Image from 'next/image';
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { User, useUser } from '@supabase/auth-helpers-react';
import { useState } from 'react';

export default function CartPage() {
  const { cart, removeFromCart, incrementQuantity, decrementQuantity, clearCart } = useCart();
  const userObject = useUser();
  const user = userObject as User | null;
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Tạo chuỗi truy vấn cho các sản phẩm đã chọn, bao gồm cả số lượng
  const checkoutQueryItems = selectedItems.map(slug => {
      const itemInCart = cart.find(cartItem => cartItem.slug === slug);
      // Nếu tìm thấy sản phẩm trong giỏ hàng, trả về định dạng "slug:quantity"
      // Nếu không, trả về chuỗi rỗng để lọc bỏ sau này
      return itemInCart ? `${itemInCart.slug}:${itemInCart.quantity}` : '';
  }).filter(Boolean).join(','); // Lọc bỏ các chuỗi rỗng và nối lại bằng dấu phẩy

  return (
        <>
      <Navbar />
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Giỏ hàng của bạn</h1>

      {cart.length === 0 ? (
        <p>Giỏ hàng trống.</p>
      ) : (
        <div>
          {cart.map((item) => (
            <div key={item.slug} className="border-b py-2 flex justify-between items-center gap-4">
              <div className="w-20 h-20 rounded overflow-hidden relative">
                {/* Đảm bảo sử dụng Image component đúng cách với 'fill' và 'style' */}
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
                <div className="flex items-center space-x-2">
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
                {/* Định dạng giá tiền */}
                <p className="text-gray-600 text-sm">{item.price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>
              </div>
              <button
                onClick={() => removeFromCart(item.slug)}
                className="text-red-500 hover:bg-red-100 rounded-md px-2 py-1 transition duration-150 ease-in-out"
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
              />
            </div>
          ))}

          {/* Định dạng tổng tiền */}
          <p className="text-lg font-bold mt-4">Tổng cộng: {total.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>

          {!user ? (
            <p className="mt-4">
              Bạn cần <Link href="/login" className="text-blue-500 hover:underline">đăng nhập</Link> hoặc{' '}
              <Link href="/register" className="text-blue-500 hover:underline">đăng ký</Link> để thanh toán.
            </p>
          ) : (
            <Link
              href={{
                pathname: "/checkout",
                query: { items: checkoutQueryItems }, // Sử dụng chuỗi truy vấn mới
              }}
              className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4 block text-center ${selectedItems.length === 0 ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
            >
              Tiến hành thanh toán ({selectedItems.length} sản phẩm)
            </Link>
          )}

          {cart.length > 0 && (
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="text-sm text-gray-600 hover:underline"
                onClick={() => setSelectedItems(cart.map((item) => item.slug))}
                disabled={cart.length === 0}
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                className="text-sm text-gray-600 hover:underline"
                onClick={() => setSelectedItems([])}
                disabled={selectedItems.length === 0}
              >
                Bỏ chọn tất cả
              </button>
            </div>
          )}

          <button
            className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 mt-4 rounded"
            onClick={clearCart}
            disabled={cart.length === 0}
          >
            Xóa toàn bộ
          </button>
        </div>
      )}

      <Link href="/products" className="text-blue-500 mt-4 block hover:underline">
        ← Tiếp tục mua sắm
      </Link>
    </main>
        </>
  );
}
