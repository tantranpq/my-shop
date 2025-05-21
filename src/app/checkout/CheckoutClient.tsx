"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';

// Import Product interface - Đảm bảo id là string để đồng bộ với CartContext
interface Product {
  id: string; // Đã thay đổi id thành string
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  stock_quantity: number;
  category: string | null;
  created_at: string;
  updated_at: string;
  slug: string | null;
}

interface Profile {
  full_name: string | null;
  phone: string | null;
  address: string | null;
}

type PaymentMethod = 'cod' | 'online';

export default function CheckoutClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const { cart, setCart } = useCart(); // Giữ lại setCart để cập nhật giỏ hàng sau khi đặt

  // Lấy tham số 'items' từ URL. Nó có thể là một slug đơn hoặc nhiều slug cách nhau bởi dấu phẩy.
  const itemsParam = searchParams.get('items');

  const [profile, setProfile] = useState<Profile>({ full_name: '', phone: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');

  // Interface tạm thời cho sản phẩm có số lượng, đảm bảo id là string
  interface ProductWithQuantity {
    id: string; // Đã thay đổi id thành string
    name: string;
    price: number;
    image: string | null;
    slug: string | null;
    quantity: number;
  }

  // State để lưu sản phẩm mua ngay hoặc các sản phẩm đã chọn từ giỏ hàng
  const [checkoutItems, setCheckoutItems] = useState<ProductWithQuantity[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);


  useEffect(() => {
    const fetchCheckoutItemsAndProfile = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      let itemsToCheckout: ProductWithQuantity[] = [];

      console.log("itemsParam from URL:", itemsParam); // Debugging: Kiểm tra tham số 'items' từ URL

      if (itemsParam) {
          const itemPairs = itemsParam.split(','); // Tách chuỗi thành các cặp "slug:quantity"
          for (const pair of itemPairs) {
              const [slug, quantityStr] = pair.split(':'); // Tách từng cặp thành slug và quantity
              const quantity = parseInt(quantityStr, 10); // Chuyển đổi quantity sang số nguyên

              console.log(`Processing pair: ${pair}, Slug: ${slug}, Quantity String: ${quantityStr}, Parsed Quantity: ${quantity}`); // Debugging

              if (slug && !isNaN(quantity) && quantity > 0) {
                  // Fetch product details from DB using the slug
                  const { data: productData, error: productError } = await supabaseClient
                      .from('products')
                      .select('id, name, price, image, slug') // Chỉ chọn các trường cần thiết
                      .eq('slug', slug)
                      .single();

                  console.log(`Supabase fetch result for slug "${slug}":`); // Debugging
                  console.log("Product Data:", productData); // Debugging
                  console.log("Product Error:", productError); // Debugging

                  if (productError || !productData) {
                      setError('Không thể tải thông tin cho sản phẩm: ' + slug + '.');
                      console.error(`Error fetching product ${slug}:`, productError?.message || 'Product not found.');
                      // Không return ở đây để cố gắng tải các sản phẩm khác nếu có
                      continue; // Bỏ qua sản phẩm lỗi và tiếp tục với các sản phẩm khác
                  }

                  itemsToCheckout.push({
                      id: productData.id, // id đã là string, không cần parseInt
                      name: productData.name,
                      price: productData.price,
                      image: productData.image,
                      slug: productData.slug,
                      quantity: quantity // Sử dụng số lượng lấy từ URL
                  });
              } else {
                  console.error(`Invalid item pair in URL: ${pair}`); // Debugging
              }
          }
      }

      if (itemsToCheckout.length === 0) {
        setError('Không có sản phẩm nào để thanh toán.');
      }

      setCheckoutItems(itemsToCheckout);
      setTotalAmount(itemsToCheckout.reduce((sum, item) => sum + item.price * item.quantity, 0));

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('full_name, phone, address')
        .eq('id', user.id)
        .single();

      if (profileError) {
        setError('Không thể tải thông tin cá nhân.');
        console.error(profileError.message);
      } else if (profileData) {
        setProfile(profileData);
      }

      setLoading(false);
    };

    fetchCheckoutItemsAndProfile();
  }, [user?.id, supabaseClient, itemsParam]); // Loại bỏ 'cart' khỏi dependencies vì nó không phải là nguồn chính cho checkoutItems

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const placeOrder = async () => {
    if (!user || checkoutItems.length === 0) {
        setOrderError('Không có sản phẩm nào để đặt hàng hoặc bạn chưa đăng nhập.');
        return;
    }

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

      let expiresAt: string | null = null;
      let paymentStatus: string = 'pending'; // Mặc định là pending cho online, sẽ thay đổi cho COD

      if (paymentMethod === 'online') {
        const oneHourLater = new Date();
        oneHourLater.setHours(oneHourLater.getHours() + 1);
        expiresAt = oneHourLater.toISOString(); // Lưu dưới dạng ISO string
        paymentStatus = 'pending_online'; // Trạng thái rõ ràng hơn cho online pending
      } else if (paymentMethod === 'cod') {
        paymentStatus = 'unconfirmed_cod'; // Trạng thái ban đầu cho COD
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
            payment_method: paymentMethod, // Thêm phương thức thanh toán
            payment_status: paymentStatus, // Thêm trạng thái thanh toán
            expires_at: expiresAt, // Thêm thời gian hết hạn (nếu có)
            total_amount: totalAmount // Lưu tổng tiền vào đơn hàng
          },
        ])
        .select('id')
        .single();

      if (orderError || !orderData?.id) {
        throw new Error('Không thể tạo đơn hàng.');
      }

      const orderId = orderData.id;

      // Tạo order_items
      const items = checkoutItems.map((item) => ({
        order_id: orderId,
        product_id: item.id, // item.id đã là string
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

      // Chỉ xóa các sản phẩm đã được thanh toán khỏi giỏ hàng
      // Lấy danh sách slug của các sản phẩm đã được checkout
      const checkedOutSlugs = checkoutItems.map(item => item.slug);
      // Lọc giỏ hàng hiện tại để loại bỏ các sản phẩm đã được checkout
      const remainingCart = cart.filter(item => !checkedOutSlugs.includes(item.slug));
      setCart(remainingCart); // Cập nhật giỏ hàng trong context và localStorage

      // Chuyển hướng đến trang order-success, kèm theo phương thức thanh toán
      router.push(`/order-success/${orderId}?paymentMethod=${paymentMethod}`);

    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err);
        setOrderError(err.message || 'Đã có lỗi xảy ra.');
      } else {
        console.error('Unknown error:', err);
        setOrderError('Đã có lỗi xảy ra.');
      }
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
    <div className="flex justify-center items-center p-6 bg-gray-100 min-h-screen">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Xác nhận đơn hàng</h1>
        {error && <p className="text-red-500">{error}</p>}
        {orderError && <p className="text-red-500">{orderError}</p>}

        <h2 className="text-lg font-semibold mb-2">Sản phẩm đã chọn:</h2>
        <ul className="mb-4 text-sm">
          {checkoutItems.map((item) => (
            <li key={item.slug}>
              {item.name} × {item.quantity} — {item.price.toLocaleString('vi-VN')} đ
            </li>
          ))}
        </ul>

        {checkoutItems.length === 0 && (
          <p className="text-red-500 mb-4">Không có sản phẩm nào được chọn.</p>
        )}

        <p className="text-lg font-bold mt-4">Tổng cộng: {totalAmount.toLocaleString('vi-VN')} đ</p>


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

          {/* Payment Method Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Phương thức thanh toán</label>
            <div className="flex items-center space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                  className="form-radio text-blue-600"
                />
                <span className="ml-2">Thanh toán khi nhận hàng (COD)</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="online"
                  checked={paymentMethod === 'online'}
                  onChange={() => setPaymentMethod('online')}
                  className="form-radio text-blue-600"
                />
                <span className="ml-2">Thanh toán Online (Chuyển khoản QR)</span>
              </label>
            </div>
          </div>

          <button
            onClick={placeOrder}
            disabled={isPlacingOrder || checkoutItems.length === 0}
            className={`w-full py-2 text-white font-semibold rounded ${isPlacingOrder || checkoutItems.length === 0
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
