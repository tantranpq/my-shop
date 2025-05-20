// app/admin/orders/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Giữ nguyên TanStack Query

// --- Định nghĩa Interface cho dữ liệu ---
interface OrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
}

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  payment_method: string;
  payment_status: string;
  total_amount: number;
  expires_at: string | null;
  order_items: OrderItem[];
}

const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

export default function AdminOrdersPage() {
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const { isLoading: isLoadingSession } = useSessionContext();
  const queryClient = useQueryClient();

  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null);

  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<string>>(new Set());
  const [updateError, setUpdateError] = useState<string | null>(null);

  // --- Logic fetch vai trò người dùng và kiểm tra quyền admin (Giữ nguyên) ---
  const { data: profileData, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !isLoadingSession,
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (profileData) {
      setUserRole(profileData.role as 'user' | 'admin');
    }
  }, [profileData]);

  // --- Logic fetch danh sách đơn hàng (Giữ nguyên) ---
  const {
    data: orders,
    isLoading: isLoadingOrders,
    error: ordersQueryError,
  } = useQuery<Order[], Error>({
    queryKey: ['adminOrders'],
    queryFn: async () => {
      if (userRole !== 'admin') {
        throw new Error('Bạn không có quyền xem đơn hàng.');
      }

      console.log("Fetching orders as admin with TanStack Query...");
      const { data, error } = await supabaseClient
        .from('orders')
        .select(`
          id,
          created_at,
          customer_name,
          customer_email,
          customer_phone,
          customer_address,
          payment_method,
          payment_status,
          total_amount,
          expires_at,
          order_items (
            product_name,
            quantity,
            product_price
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
    enabled: userRole === 'admin' && !isLoadingSession && !isLoadingProfile,
  });


  // --- Hàm xử lý cập nhật trạng thái thanh toán (Giữ nguyên) ---
 const handleUpdatePaymentStatus = async (orderId: string, newStatus: string) => {
  if (!user?.id || userRole !== 'admin') {
    alert('Bạn không có quyền thực hiện thao tác này.');
    return;
  }

  // Thêm ID của đơn hàng này vào Set các đơn hàng đang cập nhật
  setUpdatingOrderIds(prev => new Set(prev).add(orderId));
  setUpdateError(null);

  const { error: updatePaymentError } = await supabaseClient
    .from('orders')
    .update({ payment_status: newStatus })
    .eq('id', orderId);

  // Xóa ID của đơn hàng này khỏi Set sau khi cập nhật xong
  setUpdatingOrderIds(prev => {
    const newSet = new Set(prev);
    newSet.delete(orderId);
    return newSet;
  });

  if (updatePaymentError) {
    console.error('Lỗi khi cập nhật trạng thái thanh toán:', updatePaymentError);
    setUpdateError('Cập nhật trạng thái thất bại: ' + updatePaymentError.message);
  } else {
    queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
    // alert('Cập nhật trạng thái thành công!'); // Có thể bỏ alert nếu muốn trải nghiệm mượt hơn
  }
};

  // --- MỚI: useEffect để lắng nghe Realtime Updates ---
  useEffect(() => {
    // Chỉ lắng nghe khi user là admin và orders data đã được tải (hoặc ít nhất không có lỗi)
    if (userRole === 'admin' && !isLoadingOrders && !ordersQueryError) {
      console.log("Setting up Supabase Realtime listener for orders...");

      // Đăng ký lắng nghe các sự kiện INSERT, UPDATE, DELETE trên bảng 'orders'
      const orderChannel = supabaseClient
        .channel('public:orders') // Tên kênh, có thể là tên bảng nếu bạn muốn lắng nghe tất cả sự kiện
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' }, // Lắng nghe mọi sự kiện trên bảng orders
          (payload) => {
            console.log('Realtime change received:', payload);

            // Khi có thay đổi, invalidate cache của adminOrders để TanStack Query tự động refetch
            queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
            // Hoặc bạn có thể tự update state orders ở đây nếu muốn không refetch toàn bộ
            // Ví dụ:
            // if (payload.eventType === 'INSERT') {
            //   setOrders(prevOrders => [payload.new as Order, ...prevOrders]);
            // } else if (payload.eventType === 'UPDATE') {
            //   setOrders(prevOrders => prevOrders.map(order => order.id === payload.old.id ? payload.new as Order : order));
            // } else if (payload.eventType === 'DELETE') {
            //   setOrders(prevOrders => prevOrders.filter(order => order.id !== payload.old.id));
            // }
          }
        )
        .subscribe(); // Đăng ký kênh để bắt đầu lắng nghe

      // Cleanup function: Hủy đăng ký lắng nghe khi component unmounts hoặc dependencies thay đổi
      return () => {
        console.log("Unsubscribing from Realtime orders channel.");
        orderChannel.unsubscribe();
      };
    }
  }, [userRole, isLoadingOrders, ordersQueryError, queryClient, supabaseClient]); // Dependencies

  // --- Render logic (vẫn giữ nguyên) ---
  if (isLoadingSession || isLoadingProfile || isLoadingOrders) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
        {isLoadingSession ? "Đang tải phiên đăng nhập..." : isLoadingProfile ? "Đang kiểm tra quyền..." : "Đang tải đơn hàng..."}
      </div>
    );
  }

  if (profileError) {
    return <div className="min-h-screen flex items-center justify-center text-xl text-red-500">Lỗi: {profileError.message}</div>;
  }
  if (ordersQueryError) {
    return <div className="min-h-screen flex items-center justify-center text-xl text-red-500">Lỗi khi tải đơn hàng: {ordersQueryError.message}</div>;
  }
  if (userRole !== 'admin') {
     return <div className="min-h-screen flex items-center justify-center text-xl text-red-500">Bạn không có quyền truy cập trang quản trị.</div>;
  }

  // --- Render giao diện khi không có lỗi và đã tải xong (vẫn giữ nguyên) ---
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Quản lý Đơn hàng</h1>

      {updateError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Lỗi:</strong>
          <span className="block sm:inline"> {updateError}</span>
        </div>
      )}

      {/* Đảm bảo orders không null/undefined trước khi map */}
      {orders && orders.length === 0 ? (
        <p className="text-center text-gray-600 text-lg">Chưa có đơn hàng nào.</p>
      ) : (
        <div className="overflow-x-auto bg-white shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Đơn hàng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Khách hàng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng tiền</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái TT</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chi tiết sản phẩm</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders?.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">...{order.id.substring(-10)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(order.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <p className="font-semibold">{order.customer_name}</p>
                    <p className="text-gray-500">{order.customer_email}</p>
                    {order.customer_phone && <p className="text-gray-500">{order.customer_phone}</p>}
                    {order.customer_address && <p className="text-gray-500">{order.customer_address}</p>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.total_amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${order.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                        order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'}`}>
                      {order.payment_status === 'paid' ? 'Đã thanh toán' :
                       order.payment_status === 'pending' ? 'Đang chờ' :
                       order.payment_status === 'failed' ? 'Thất bại' :
                       'Đã hoàn tiền'}
                    </span>
                    <p className="text-gray-500 text-xs mt-1">{order.payment_method}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <ul className="list-disc list-inside text-xs">
                      {order.order_items.map((item, idx) => (
                        <li key={idx}>
                          {item.product_name} ({item.quantity} x {item.product_price.toLocaleString('vi-VN')})
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <select
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={order.payment_status}
                      onChange={(e) => handleUpdatePaymentStatus(order.id, e.target.value)}
                      disabled={updatingOrderIds.has(order.id)}
                    >
                      {PAYMENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status === 'pending' ? 'Đang chờ' :
                           status === 'paid' ? 'Đã thanh toán' :
                           status === 'failed' ? 'Thất bại' :
                           'Đã hoàn tiền'}
                        </option>
                      ))}
                    </select>
                    {updatingOrderIds.has(order.id) && <p className="text-xs text-blue-600 mt-1">Đang cập nhật...</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}