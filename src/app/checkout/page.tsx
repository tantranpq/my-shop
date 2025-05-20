"use client";
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import CheckoutSearchParamsHandler from '@/components/CheckoutSearchParamsHandler'; // Import component mới

interface Profile {
  full_name: string | null;
  phone: string | null;
  address: string | null;
}

export default function CheckoutPage() {
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const router = useRouter();
  const { cart, clearCart } = useCart();
  const [selectedItemSlugs, setSelectedItemSlugs] = useState<string[] | null>(null);
  const selectedCartItems = selectedItemSlugs
    ? cart.filter((item) => selectedItemSlugs.includes(item.slug))
    : [];
  const [profile, setProfile] = useState<Profile>({ full_name: null, phone: null, address: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const handleSearchParams = (items: string[] | null) => {
    setSelectedItemSlugs(items);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      // ... phần fetch profile của bạn
    };
    fetchProfile();
  }, [user?.id, supabaseClient]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // ... phần handleInputChange của bạn
  };

  const placeOrder = async () => {
    // ... phần placeOrder của bạn (sử dụng selectedCartItems)
  };

  if (loading) {
    return <div>Đang tải thông tin...</div>;
  }

  if (!user) {
    return <div>Bạn cần phải đăng nhập để thanh toán. <Link href="/login">Đăng nhập</Link></div>;
  }

  if (orderSuccess) {
    return <div>Đặt hàng thành công! Mã đơn hàng của bạn là: ...</div>;
  }

  return (
    <div className="flex justify-center items-center p-6 bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Xác nhận thông tin giao hàng</h1>
        <CheckoutSearchParamsHandler onSearchParams={handleSearchParams} /> {/* Render component mới */}
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {orderError && <p className="text-red-500 mb-4">{orderError}</p>}

        <h2 className="text-xl font-semibold mb-4">Sản phẩm bạn chọn</h2>
        {selectedCartItems.map((item) => (
          <div key={item.slug} className="mb-2">
            {item.name} × {item.quantity} - {item.price} đ
          </div>
        ))}
        {selectedCartItems.length > 0 && <hr className="mb-4" />}
        {selectedCartItems.length === 0 && <p className="mb-4">Không có sản phẩm nào được chọn.</p>}

        {/* ... phần form và button đặt hàng */}
      </div>
    </div>
  );
}