"use client";
export const dynamic = "force-dynamic";
import Image from 'next/image';
import { useCart } from "@/context/CartContext";
import Link from "next/link";

export default function CartPage() {
  const { cart, removeFromCart, clearCart } = useCart();

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Giỏ hàng của bạn</h1>

      {cart.length === 0 ? (
        <p>Giỏ hàng trống.</p>
      ) : (
        <div>
          {cart.map((item) => (
            <div key={item.slug} className="border-b py-2 flex justify-between items-center">
              <div className="w-20 h-20 rounded overflow-hidden relative"> {/* Thêm relative để container của Image hoạt động với layout="fill" */}
                <Image
                  src={item.image}
                  alt={item.name}
                  layout="fill"
                  objectFit="cover"
                  className="rounded" // Có thể áp dụng thêm class rounded nếu muốn
                />
              </div>
              <div className="flex-grow">
                <p className="font-semibold">{item.name} × {item.quantity}</p>
                <p className="text-gray-600 text-sm">{item.price} đ</p>
              </div>
              <button
                onClick={() => removeFromCart(item.slug)}
                className="text-red-500 hover:bg-red-100 rounded-md px-2 py-1 transition duration-150 ease-in-out"
              >
                Xóa
              </button>
            </div>
          ))}

          <p className="text-lg font-bold mt-4">Tổng cộng: {total} đ</p>

          <button
            className="bg-gray-500 text-white px-4 py-2 mt-4 rounded"
            onClick={clearCart}
          >
            Xóa toàn bộ
          </button>
        </div>
      )}

      <Link href="/products" className="text-blue-500 mt-4 block hover:underline">
        ← Tiếp tục mua sắm
      </Link>
    </main>
  );
}
