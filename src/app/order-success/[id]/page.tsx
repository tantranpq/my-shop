'use client';

import { useParams, useSearchParams } from 'next/navigation'; // Import useSearchParams
import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import Image from 'next/image'; // Import Image component

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
  payment_method: 'cod' | 'online'; // Thêm trường payment_method
  total_amount: number; // Thêm trường total_amount
  order_items: OrderItem[];
}

export default function OrderSuccessPage() {
  const { id } = useParams();
  const searchParams = useSearchParams(); // Sử dụng useSearchParams để lấy query param
  const paymentMethod = searchParams.get('paymentMethod'); // Lấy paymentMethod từ URL
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
        // Thêm payment_method và total_amount vào select
        .select(`
          id,
          created_at,
          customer_name,
          customer_email,
          customer_phone,
          customer_address,
          user_id,
          payment_method,
          total_amount,
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

  // Đảm bảo rằng chỉ người dùng đã đặt hàng mới có thể xem
  // Hoặc bạn có thể bỏ qua check này nếu muốn admin cũng xem được
  if (!user || user.id !== order.user_id) {
    return (
      <div className="p-6 text-center">
        Bạn không có quyền xem đơn hàng này.
        <br />
        <Link href="/cart" className="text-blue-500 underline mt-4 inline-block">Quay lại giỏ hàng</Link>
      </div>
    );
  }

  // totalAmount giờ đã được lấy trực tiếp từ order.total_amount
  // Nếu bạn vẫn muốn tính lại từ order_items, bạn có thể giữ lại đoạn code cũ:
  // const calculatedTotalAmount = order.order_items.reduce(
  //   (sum, item) => sum + item.product_price * item.quantity,
  //   0
  // );

  return (
    <div className="flex justify-center items-center p-6 bg-gray-100 min-h-screen">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-xl">
        <h1 className="text-2xl font-bold mb-4 text-center">Cảm ơn bạn đã đặt hàng!</h1>
        <p className="text-center mb-6">Mã đơn hàng: <strong>#{order.id}</strong></p>

        {/* Thông báo và hướng dẫn dựa trên phương thức thanh toán */}
        {paymentMethod === 'cod' && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
            <p className="font-bold">Đơn hàng của bạn đã được tiếp nhận.</p>
            <p>Chúng tôi sẽ gọi điện thoại để xác nhận đơn hàng sớm nhất.</p>
          </div>
        )}

        {paymentMethod === 'online' && (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
            <p className="font-bold">Đơn hàng của bạn đã được tạo.</p>
            <p>Vui lòng hoàn tất thanh toán trong vòng **1 giờ** để đơn hàng không bị hủy.</p>
          </div>
        )}

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

        <div className="text-right font-bold text-lg mb-6">
          Tổng cộng: {order.total_amount.toLocaleString()} đ {/* Hiển thị total_amount từ order */}
        </div>

        {/* Hiển thị chi tiết thanh toán Online nếu phương thức là 'online' */}
        {paymentMethod === 'online' && (
          <div className="mt-6 p-4 border border-gray-200 rounded-md bg-yellow-50 text-center">
            <h2 className="text-xl font-bold mb-3 text-gray-800">Thông tin chuyển khoản</h2>
            <p className="mb-4">
              Vui lòng chuyển khoản tổng số tiền <span className="font-bold text-lg text-blue-700">{order.total_amount.toLocaleString()} đ</span> vào tài khoản sau:
            </p>
            <div className="flex justify-center mb-6">
              <Image
                src="/images/qr-code-placeholder.png" // Đặt đường dẫn chính xác đến ảnh QR của bạn
                alt="Mã QR thanh toán"
                width={200}
                height={200}
                quality={100}
                className="rounded-md shadow-sm"
              />
            </div>
            <p className="text-sm text-gray-700">
              Ngân hàng: **TÊN NGÂN HÀNG CỦA BẠN**<br />
              Số tài khoản: **SỐ TÀI KHOẢN CỦA BẠN**<br />
              Tên chủ tài khoản: **TÊN CHỦ TÀI KHOẢN CỦA BẠN**<br />
              Nội dung chuyển khoản: **MA_DON_HANG_{order.id}** (Quan trọng để xác nhận!)
            </p>
            <p className="text-red-600 font-semibold mt-3">
              Đơn hàng sẽ tự động hủy nếu không nhận được thanh toán sau 1 giờ.
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/products" className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded">
            Tiếp tục mua sắm
          </Link>
        </div>
      </div>
    </div>
  );
}