'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';

interface OrderItem {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  product_image?: string | null;
}

// Interface để mô tả cấu trúc dữ liệu trả về từ Supabase SELECT query
interface SupabaseOrderData {
  id: string;
  created_at: string;
  customer_id: string;
  total_amount: number;
  payment_method: 'cod' | 'online';
  order_source: string;
  creator_profile_id: string | null;
  status: string;
  items: OrderItem[];
  // ĐÃ SỬA: Định nghĩa `customers` là một đối tượng hoặc null
  customers: {
    full_name: string;
    email: string;
    phone: string | null;
    address: string | null;
  } | null; // Đã thay đổi từ `{ ... }[]` thành `{ ... } | null`
}

interface Order {
  id: string;
  created_at: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  user_id: string | null; // creator_profile_id
  payment_method: 'cod' | 'online';
  total_amount: number;
  items: OrderItem[];
}

export default function OrderSuccessPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const paymentMethodFromUrl = searchParams.get('paymentMethod');
  const supabase = useSupabaseClient();
  const user = useUser();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) {
        setError('Không tìm thấy ID đơn hàng trong URL.');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          customer_id,
          total_amount,
          payment_method,
          order_source,
          creator_profile_id,
          status,
          items,
          customers (
            full_name,
            email,
            phone,
            address
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Lỗi khi lấy đơn hàng:', fetchError);
        setError('Không thể tải thông tin đơn hàng hoặc đơn hàng không tồn tại.');
        setOrder(null);
      } else if (data) {
        // --- BẮT ĐẦU DEBUG LOG ---
        console.log('Dữ liệu thô từ Supabase (OrderSuccessPage):', data);
        // --- KẾT THÚC DEBUG LOG ---

        const rawData: SupabaseOrderData = data as unknown as SupabaseOrderData;

        // Ánh xạ dữ liệu từ kết quả Supabase sang interface Order
        const fetchedOrder: Order = {
          id: rawData.id,
          created_at: rawData.created_at,
          customer_id: rawData.customer_id,
          total_amount: rawData.total_amount,
          payment_method: rawData.payment_method,
          user_id: rawData.creator_profile_id,
          // ĐÃ SỬA: Truy cập trực tiếp thuộc tính từ đối tượng `customers`
          customer_name: rawData.customers?.full_name || '',
          customer_email: rawData.customers?.email || '',
          customer_phone: rawData.customers?.phone || null,
          customer_address: rawData.customers?.address || null,
          items: rawData.items || [],
        };
        setOrder(fetchedOrder);
        setError(null);
      } else {
        setError('Không tìm thấy đơn hàng.');
        setOrder(null);
      }
      setLoading(false);
    };

    fetchOrder();

    // Setup Realtime subscription
    if (id) {
      const orderChannel = supabase
        .channel(`order_${id}_changes`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
          (payload) => {
            console.log('Realtime order change:', payload);
            if (payload.eventType === 'UPDATE') {
              toast.info('Trạng thái đơn hàng đã được cập nhật.');
              fetchOrder();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(orderChannel);
      };
    }

  }, [id, supabase]);

  if (loading) return <div className="p-6 text-center">Đang tải đơn hàng...</div>;

  if (error || !order) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 text-xl font-semibold mb-4">{error || 'Không tìm thấy đơn hàng.'}</p>
        <Link href="/products" className="text-blue-500 underline mt-4 inline-block">Quay lại mua sắm</Link>
      </div>
    );
  }

  // --- QUYỀN TRUY CẬP ---
  const canViewOrder = user
    ? (order.user_id === user.id)
    : (order.user_id === null);

  if (!canViewOrder) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 text-xl font-semibold mb-4">Bạn không có quyền xem đơn hàng này.</p>
        <Link href="/products" className="text-blue-500 underline mt-4 inline-block">Quay lại mua sắm</Link>
      </div>
    );
  }


  return (
    <div className="flex justify-center items-center p-6 bg-gray-100 min-h-screen">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-xl">
        <h1 className="text-2xl font-bold mb-4 text-center">Cảm ơn bạn đã đặt hàng!</h1>
        <p className="text-center mb-6">Mã đơn hàng: <strong>#{order.id}</strong></p>

        {/* Thông báo và hướng dẫn dựa trên phương thức thanh toán */}
        {order.payment_method === 'cod' && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
            <p className="font-bold">Đơn hàng của bạn đã được tiếp nhận.</p>
            <p>Chúng tôi sẽ gọi điện thoại để xác nhận đơn hàng sớm nhất.</p>
          </div>
        )}

        {order.payment_method === 'online' && (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
            <p className="font-bold">Đơn hàng của bạn đã được tạo.</p>
            <p>Vui lòng hoàn tất thanh toán trong vòng **1 giờ** để đơn hàng không bị hủy.</p>
          </div>
        )}

        {/* Đã đổi tiêu đề thành "Thông tin đơn hàng" */}
        <h2 className="font-semibold mb-2">Thông tin đơn hàng</h2>
        <ul className="mb-4 text-sm">
          {/* Đã sửa: Luôn hiển thị các trường, hiển thị "Không có" nếu giá trị rỗng */}
          <li>👤 Tên khách hàng: {order.customer_name || 'Không có'}</li>
          <li>📧 Email: {order.customer_email || 'Không có'}</li>
          <li>📞 Số điện thoại: {order.customer_phone || 'Không có'}</li>
          <li>🏠 Địa chỉ: {order.customer_address || 'Không có'}</li>
          <li>📅 Thời gian đặt: {new Date(order.created_at).toLocaleString('vi-VN')}</li>
        </ul>

        <h2 className="font-semibold mb-2">Sản phẩm đã đặt</h2>
        <div className="space-y-2 mb-4">
          {order.items.map((item) => (
            <div key={item.product_id} className="flex justify-between border-b pb-1 items-center">
              {item.product_image && (
                <Image src={item.product_image} alt={item.product_name} width={48} height={48} className="w-12 h-12 object-cover rounded mr-2" />
              )}
              <div className="flex-grow">
                {item.product_name} × {item.quantity}
              </div>
              <div>{(typeof item.product_price === 'number' ? item.product_price : 0).toLocaleString('vi-VN')} đ</div>
            </div>
          ))}
        </div>

        <div className="text-right font-bold text-lg mb-6">
          Tổng cộng: {order.total_amount.toLocaleString('vi-VN')} đ
        </div>

        {/* Hiển thị chi tiết thanh toán Online nếu phương thức là 'online' */}
        {order.payment_method === 'online' && (
          <div className="mt-6 p-4 border border-gray-200 rounded-md bg-yellow-50 text-center">
            <h2 className="text-xl font-bold mb-3 text-gray-800">Thông tin chuyển khoản</h2>
            <p className="mb-4">
              Vui lòng chuyển khoản tổng số tiền <span className="font-bold text-lg text-blue-700">{order.total_amount.toLocaleString('vi-VN')} đ</span> vào tài khoản sau:
            </p>
            <div className="flex justify-center mb-6">
              <Image
                src="/images/qr-code-placeholder.png"
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
