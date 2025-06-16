// app/checkout/CheckoutClient.tsx
"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';

interface Profile {
  full_name: string | null;
  phone: string | null;
  address: string | null;
  email?: string | null; // Add email to profile if it's used
}

type PaymentMethod = 'cod' | 'online';

export default function CheckoutClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const { cart, setCart } = useCart();

  const itemsParam = searchParams.get('items');

  const [profile, setProfile] = useState<Profile>({ full_name: '', phone: '', address: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');

  interface ProductWithQuantity {
    id: string;
    name: string;
    price: number;
    image: string | null;
    slug: string | null;
    quantity: number;
  }

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

      const itemsToCheckout: ProductWithQuantity[] = [];

      console.log("itemsParam from URL:", itemsParam);

      if (itemsParam) {
          const itemPairs = itemsParam.split(',');
          for (const pair of itemPairs) {
              const [slug, quantityStr] = pair.split(':');
              const quantity = parseInt(quantityStr, 10);

              console.log(`Processing pair: ${pair}, Slug: ${slug}, Quantity String: ${quantityStr}, Parsed Quantity: ${quantity}`);

              if (slug && !isNaN(quantity) && quantity > 0) {
                  const { data: productData, error: productError } = await supabaseClient
                      .from('products')
                      .select('id, name, price, image, slug')
                      .eq('slug', slug)
                      .single();

                  console.log(`Supabase fetch result for slug "${slug}":`);
                  console.log("Product Data:", productData);
                  console.log("Product Error:", productError);

                  if (productError || !productData) {
                      setError('Không thể tải thông tin cho sản phẩm: ' + slug + '.');
                      console.error(`Error fetching product ${slug}:`, productError?.message || 'Product not found.');
                      continue;
                  }

                  itemsToCheckout.push({
                      id: productData.id,
                      name: productData.name,
                      price: productData.price,
                      image: productData.image,
                      slug: productData.slug,
                      quantity: quantity
                  });
              } else {
                  console.error(`Invalid item pair in URL: ${pair}`);
              }
          }
      }

      if (itemsToCheckout.length === 0) {
        setError('Không có sản phẩm nào để thanh toán.');
      }

      setCheckoutItems(itemsToCheckout);
      setTotalAmount(itemsToCheckout.reduce((sum, item) => sum + item.price * item.quantity, 0));

      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('full_name, phone, address')
        .eq('id', user.id)
        .single();

      if (profileError) {
        setError('Không thể tải thông tin cá nhân.');
        console.error(profileError.message);
      } else if (profileData) {
        setProfile({ ...profileData, email: user.email }); // Set email from user object
      }

      setLoading(false);
    };

    fetchCheckoutItemsAndProfile();
  }, [user?.id, supabaseClient, itemsParam, user?.email]); // Add user.email to dependencies

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
      // 1. Chuẩn bị dữ liệu gửi đến Edge Function
      const orderPayload = {
        userId: user.id,
        profile: {
          full_name: profile.full_name,
          phone: profile.phone,
          address: profile.address,
          email: user.email, // Đảm bảo email được truyền
        },
        // SỬA CÁCH ÁNH XẠ Ở ĐÂY ĐỂ KHỚP VỚI HÀM POSTGRESQL VÀ page.tsx
        checkoutItems: checkoutItems.map(item => ({
            product_id: item.id, // Đổi từ 'id' sang 'product_id'
            product_name: item.name, // Đổi từ 'name' sang 'product_name'
            product_price: item.price, // Đổi từ 'price' sang 'product_price'
            quantity: item.quantity,
            // Nếu bạn có trường product_image trong ProductWithQuantity, hãy thêm nó vào đây
            product_image: item.image, // Thêm nếu cần cho RPC của bạn để ghi nhật ký hoặc mục đích khác
        })),
        paymentMethod: paymentMethod,
        totalAmount: totalAmount,
      };

      // 2. Gọi Next.js API Route (làm proxy cho Edge Function)
      const session = await supabaseClient.auth.getSession(); // Lấy session để có access_token

      const response = await fetch('/api/supabase-edge-function', { // Đường dẫn tới Next.js API Route của bạn
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Truyền access_token của người dùng để Edge Function có thể xác thực
          'Authorization': `Bearer ${session.data.session?.access_token || ''}`
        },
        body: JSON.stringify(orderPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        // Ném lỗi nếu có vấn đề từ API Route hoặc Edge Function
        throw new Error(result.error || 'Đã có lỗi xảy ra khi đặt hàng.');
      }

      const orderId = result.orderId;

      // 3. Xóa các sản phẩm đã được thanh toán khỏi giỏ hàng
      const checkedOutSlugs = checkoutItems.map(item => item.slug);
      const remainingCart = cart.filter(item => !checkedOutSlugs.includes(item.slug));
      setCart(remainingCart); // Cập nhật giỏ hàng trong context và localStorage

      // 4. Chuyển hướng đến trang thành công
      router.push(`/order-success/${orderId}?paymentMethod=${paymentMethod}`);

    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err);
        setOrderError(err.message || 'Đã có lỗi xảy ra.');
      } else {
        console.error('Lỗi không xác định:', err);
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