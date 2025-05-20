"use client";
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import Link from 'next/link';

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  user_id: string;
  order_items: OrderItem[];
}

interface OrderItem {
  id: string;
  created_at: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}

export default function OrderSuccessPage() {
  const { id } = useParams();
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!id) {
        setError('Không tìm thấy ID đơn hàng.');
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data: orderData, error: orderError } = await supabaseClient
        .from('orders')
        .select(`
          id,
          created_at,
          customer_name,
          customer_email,
          customer_phone,
          customer_address,
          user_id,
          order_items (
            id,
            created_at,
            order_id,
            product_id,
            product_name,
            product_price,
            quantity
          )
        `)
        .eq('id', id)
        .single();

      if (orderError) {
        console.error('Lỗi khi lấy chi tiết đơn hàng:', orderError);
        setError('Không thể tải thông tin đơn hàng.');
      } else if (orderData) {
        setOrder(orderData as Order);
      }
      setLoading(false);
    };

    fetchOrderDetails();
  }, [id, supabaseClient]);

  if (loading) {
    return <div>Đang tải thông tin đơn hàng...</div>;
  }

  if (error || !order) {
    return <div>{error || 'Không tìm thấy đơn hàng.'} <Link href="/cart" className="text-blue-500 hover:underline">Quay lại giỏ hàng</Link></div>;
  }

  if (!user || user.id !== order.user_id) {
    return <div>Bạn không có quyền xem đơn hàng này. <Link href="/cart" className="text-blue-500 hover:underline">Quay lại giỏ hàng</Link></div>;
  }

  return (
    <div className="flex justify-center items-center p-6 bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Đơn hàng #{order.id}</h1>
        <p className="mb-2">Ngày đặt hàng: {new Date(order.created_at).toLocaleDateString()} - {new Date(order.created_at).toLocaleTimeString()}</p>
        <h2 className="text-xl font-semibold mb-4">Thông tin giao hàng</h2>
        <p className="mb-1">Họ và tên: {order.customer_name}</p>
        <p className="mb-1">Email: {order.customer_email}</p>
        {order.customer_phone && <p className="mb-1">Số điện thoại: {order.customer_phone}</p>}
        {order.customer_address && <p className="mb-2">Địa chỉ: {order.customer_address}</p>}

        <h2 className="text-xl font-semibold mt-4 mb-2">Sản phẩm đã đặt</h2>
        {order.order_items.map((item) => (
          <div key={item.id} className="border-b py-2 flex items-center justify-between">
            <p>{item.product_name} × {item.quantity}</p>
            <p>{item.product_price} đ</p>
          </div>
        ))}
        <p className="font-bold text-lg mt-4">Tổng cộng: {order.order_items.reduce((sum, item) => sum + item.product_price * item.quantity, 0)} đ</p>

        <div className="mt-6 text-center">
          <Link href="/products" className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus-shadow-outline">
            Tiếp tục mua sắm
          </Link>
        </div>
      </div>
    </div>
  );
}