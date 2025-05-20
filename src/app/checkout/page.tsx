"use client";
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
// import CheckoutSearchParamsHandler from '@/components/CheckoutSearchParamsHandler';

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
  // const searchParams = useSearchParams();
  const [selectedItemSlugs] = useState<string[] | null>(null);
  const selectedCartItems = selectedItemSlugs
    ? cart.filter((item) => selectedItemSlugs.includes(item.slug))
    : [];
  const [profile, setProfile] = useState<Profile>({ full_name: null, phone: null, address: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // const handleSearchParams = (items: string[] | null) => {
  //   setSelectedItemSlugs(items);
  // };

  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.id) {
        setLoading(true);
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('full_name, phone, address')
          .eq('id', user.id)
          .single();

        if (error) {
          setError(error.message);
        } else if (data) {
          setProfile(data);
        }
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id, supabaseClient]);

  const placeOrder = async () => {
    if (!user || selectedCartItems.length === 0) return;

    setIsPlacingOrder(true);
    setOrderError(null);
    setOrderSuccess(false);

    try {
      const { error: profileUpdateError } = await supabaseClient
        .from('profiles')
        .upsert({ id: user.id, ...profile })
        .single();

      if (profileUpdateError) {
        console.error('Lỗi khi cập nhật profile:', profileUpdateError);
        setOrderError('Đã có lỗi xảy ra khi cập nhật thông tin cá nhân. Vui lòng thử lại.');
        setIsPlacingOrder(false);
        return;
      }

      const { data: orderData, error: createOrderError } = await supabaseClient
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

      if (createOrderError) {
        console.error('Lỗi khi tạo đơn hàng:', createOrderError);
        setOrderError('Đã có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại.');
        setIsPlacingOrder(false);
        return;
      }

      const orderId = orderData.id;
      const orderItemsToInsert = selectedCartItems.map((item) => ({
        order_id: orderId,
        product_id: item.id,
        product_name: item.name,
        product_price: item.price,
        quantity: item.quantity,
      }));

      const { error: createOrderItemsError } = await supabaseClient
        .from('order_items')
        .insert(orderItemsToInsert);

      if (createOrderItemsError) {
        console.error('Lỗi khi thêm sản phẩm vào đơn hàng:', createOrderItemsError);
        const { error: deleteOrderError } = await supabaseClient
          .from('orders')
          .delete()
          .eq('id', orderId);
        if (deleteOrderError) {
          console.error('Lỗi khi rollback đơn hàng:', deleteOrderError);
        }
        setOrderError('Đã có lỗi xảy ra khi thêm sản phẩm vào đơn hàng. Vui lòng thử lại.');
        setIsPlacingOrder(false);
        return;
      }

      setOrderSuccess(true);
      clearCart();
      router.push(`/order-success/${orderId}`);
      console.log('Đơn hàng đã được lưu thành công với ID:', orderId);

    } catch (error) {
      console.error('Lỗi không xác định:', error);
      setOrderError('Đã có lỗi không xác định xảy ra. Vui lòng thử lại.');
    } finally {
      setIsPlacingOrder(false);
    }
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

        <form onSubmit={(e) => e.preventDefault()}>
          <div className="mb-4">
            <label htmlFor="full_name" className="block text-gray-700 text-sm font-bold mb-2">
              Họ và tên
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
              id="full_name"
              type="text"
              name="full_name"
              value={profile.full_name || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="phone" className="block text-gray-700 text-sm font-bold mb-2">
              Số điện thoại
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
              id="phone"
              type="text"
              name="phone"
              value={profile.phone || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="address" className="block text-gray-700 text-sm font-bold mb-2">
              Địa chỉ giao hàng
            </label>
            <textarea
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
              id="address"
              name="address"
              value={profile.address || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
              required
            />
          </div>
          <button
            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus-shadow-outline w-full ${isPlacingOrder || selectedCartItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={placeOrder}
            disabled={isPlacingOrder || selectedCartItems.length === 0}
          >
            {isPlacingOrder ? 'Đang đặt hàng...' : 'Xác nhận đặt hàng'}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          <Link href="/cart" className="text-blue-500 hover:underline">← Quay lại giỏ hàng</Link>
        </p>
      </div>
    </div>
  );
}