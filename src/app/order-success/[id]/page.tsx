'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import Link from 'next/link';

interface OrderItem {
  id: string;
  created_at: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}

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

export default function OrderSuccessPage() {
  const { id } = useParams();
  const supabase = useSupabaseClient();
  const user = useUser();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) {
        setError('Không tìm thấy ID đơn hàng.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
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

      if (error) {
        console.error('Lỗi khi lấy đơn hàng:', error);
        setError('Không thể tải thông tin đơn hàng.');
      } else {
        setOrder(data as Order);
      }

      setLoading(false);
    };

    fetchOrder();
  }, [id, supabase]);

  if (loading) return <div className="p-6 text-center">Đang tải đơn hàng...</div>;

  if (error || !order) {
    return (
      <div className="p-6 text-center">
        {error || 'Không tìm thấy đơn hàng.'}
        <br />
        <Link href="/cart" className="text-blue-500 underline mt-4 inline-block">Quay lại giỏ hàng</Link>
      </div>
    );
  }

  if (!user || user.id !== order.user_id) {
    return (
      <div className="p-6 text-center">
        Bạn không có quyền xem đơn hàng này.
        <br />
        <Link href="/cart" className="text-blue-500 underline mt-4 inline-block">Quay lại giỏ hàng</Link>
      </div>
    );
  }

  const totalAmount = order.order_items.reduce(
    (sum, item) => sum + item.product_price * item.quantity,
    0
  );

  return (
    <div className="flex justify-center items-center p-6 bg-gray-100 min-h-screen">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-xl">
        <h1 className="text-2xl font-bold mb-4 text-center">Cảm ơn bạn đã đặt hàng!</h1>
        <p className="text-center mb-6">Mã đơn hàng: <strong>{order.id}</strong></p>

        <h2 className="font-semibold mb-2">Thông tin khách hàng</h2>
        <ul className="mb-4 text-sm">
          <li>👤 {order.customer_name}</li>
          <li>📧 {order.customer_email}</li>
          {order.customer_phone && <li>📞 {order.customer_phone}</li>}
          {order.customer_address && <li>🏠 {order.customer_address}</li>}
          <li>📅 {new Date(order.created_at).toLocaleString()}</li>
        </ul>

        <h2 className="font-semibold mb-2">Sản phẩm đã đặt</h2>
        <div className="space-y-2 mb-4">
          {order.order_items.map((item) => (
            <div key={item.id} className="flex justify-between border-b pb-1">
              <div>{item.product_name} × {item.quantity}</div>
              <div>{item.product_price.toLocaleString()} đ</div>
            </div>
          ))}
        </div>

        <div className="text-right font-bold text-lg">
          Tổng cộng: {totalAmount.toLocaleString()} đ
        </div>

        <div className="mt-6 text-center">
          <Link href="/products" className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded">
            Tiếp tục mua sắm
          </Link>
        </div>
      </div>
    </div>
  );
}
