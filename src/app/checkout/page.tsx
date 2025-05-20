"use client";
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';

interface Profile {
  full_name: string | null;
  phone: string | null;
  address: string | null;
}

export default function CheckoutPage() {
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, clearCart } = useCart();

  const selectedItemSlugs = searchParams.get('items')?.split(',') || [];
  const selectedCartItems = cart.filter((item) => selectedItemSlugs.includes(item.slug));

  const [profile, setProfile] = useState<Profile>({ full_name: '', phone: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      setLoading(true);
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('full_name, phone, address')
        .eq('id', user.id)
        .single();

      if (error) {
        setError('Không thể tải thông tin cá nhân.');
        console.error(error.message);
      } else if (data) {
        setProfile(data);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [user?.id, supabaseClient]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const placeOrder = async () => {
    if (!user || selectedCartItems.length === 0) return;

    setIsPlacingOrder(true);
    setOrderError(null);

    try {
      // Cập nhật thông tin người dùng
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .upsert({ id: user.id, ...profile })
        .single();

      if (profileError) {
        throw new Error('Lỗi khi cập nhật thông tin cá nhân.');
      }

      // Tạo đơn hàng
      const { data: orderData, error: orderError } = await supabaseClient
        .from('orders')
        .insert([
          {
            customer_name: profile.full_name,
            customer_email: user.email || '',
            customer_phone: profile.phone,
            customer_address: profile.address,
            user_id: user.id,
          },
        ])
        .select('id')
        .single();

      if (orderError || !orderData?.id) {
        throw new Error('Không thể tạo đơn hàng.');
      }

      const orderId = orderData.id;

      // Tạo order_items
      const items = selectedCartItems.map((item) => ({
        order_id: orderId,
        product_id: item.id,
        product_name: item.name,
        product_price: item.price,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabaseClient
        .from('order_items')
        .insert(items);

      if (itemsError) {
        // Rollback nếu có lỗi khi insert order_items
        await supabaseClient.from('orders').delete().eq('id', orderId);
        throw new Error('Lỗi khi lưu sản phẩm. Đơn hàng đã bị hủy.');
      }

      clearCart();
      router.push(`/order-success/${orderId}`);
    } catch (err: any) {
      console.error(err);
      setOrderError(err.message || 'Đã có lỗi xảy ra.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (!user) {
    return <div className="p-4">Bạn cần <Link className="text-blue-500 underline" href="/login">đăng nhập</Link> để tiếp tục.</div>;
  }

  if (loading) {
    return <div className="p-4">Đang tải thông tin...</div>;
  }

  return (
    <div className="flex justify-center items-center p-6 bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Xác nhận đơn hàng</h1>
        {error && <p className="text-red-500">{error}</p>}
        {orderError && <p className="text-red-500">{orderError}</p>}

        <h2 className="text-lg font-semibold mb-2">Sản phẩm đã chọn:</h2>
        <ul className="mb-4 text-sm">
          {selectedCartItems.map((item) => (
            <li key={item.slug}>
              {item.name} × {item.quantity} — {item.price.toLocaleString()} đ
            </li>
          ))}
        </ul>

        {selectedCartItems.length === 0 && (
          <p className="text-red-500 mb-4">Không có sản phẩm nào được chọn.</p>
        )}

        <form onSubmit={(e) => e.preventDefault()}>
          <div className="mb-4">
            <label className="block text-sm font-medium">Họ tên</label>
            <input
              name="full_name"
              value={profile.full_name || ''}
              onChange={handleInputChange}
              required
              className="w-full border rounded px-3 py-2 mt-1"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium">Số điện thoại</label>
            <input
              name="phone"
              value={profile.phone || ''}
              onChange={handleInputChange}
              required
              className="w-full border rounded px-3 py-2 mt-1"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium">Địa chỉ giao hàng</label>
            <textarea
              name="address"
              value={profile.address || ''}
              onChange={handleInputChange}
              required
              className="w-full border rounded px-3 py-2 mt-1"
            />
          </div>
          <button
            onClick={placeOrder}
            disabled={isPlacingOrder || selectedCartItems.length === 0}
            className={`w-full py-2 text-white font-semibold rounded ${
              isPlacingOrder || selectedCartItems.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isPlacingOrder ? 'Đang xử lý...' : 'Xác nhận đặt hàng'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link href="/cart" className="text-blue-500 hover:underline">← Quay lại giỏ hàng</Link>
        </div>
      </div>
    </div>
  );
}
