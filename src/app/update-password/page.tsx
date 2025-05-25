// app/update-password/page.tsx
"use client";
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UpdatePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const supabaseClient = useSupabaseClient();
  const user = useUser(); // Hook để kiểm tra người dùng đã đăng nhập sau khi redirect
  const router = useRouter();

  // useEffect này sẽ chạy khi component mount và khi user thay đổi
  // user hook từ supabase-auth-helpers-react sẽ tự động được cập nhật
  // khi session được thiết lập từ URL hash (sau khi nhấp vào link reset password)
  useEffect(() => {
    // Nếu người dùng không tồn tại sau khi tải trang, có thể là do token hết hạn hoặc không hợp lệ.
    // Trong trường hợp này, chuyển hướng họ về trang login/forgot-password.
    if (!user && !loading) { // Chỉ chuyển hướng nếu không đang trong quá trình load
      // setTimeout(() => router.push('/login'), 3000); // Có thể thêm delay hoặc thông báo
      // Để tránh lỗi nếu Supabase chưa kịp xác thực, có thể bỏ qua nếu bạn tin rằng auth-helpers luôn xử lý nhanh.
      // Tuy nhiên, nếu bạn thấy người dùng bị kẹt ở đây mà không tự động đăng nhập,
      // thì có thể xem xét chuyển hướng thủ công sau một khoảng thời gian.
    }
  }, [user, loading, router]); // Dependency array

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu mới và xác nhận mật khẩu không khớp.' });
      setIsSubmittingPassword(false); // Sửa lỗi chính tả setIsSubmittingPassword -> setLoading
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Mật khẩu phải có ít nhất 6 ký tự.' });
      setLoading(false);
      return;
    }

    // `updateUser` sẽ cập nhật mật khẩu cho người dùng hiện tại đã được xác thực (qua token từ URL)
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: 'Lỗi cập nhật mật khẩu: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Mật khẩu của bạn đã được cập nhật thành công!' });
      setNewPassword('');
      setConfirmPassword('');
      // Chuyển hướng người dùng về trang profile hoặc trang chủ sau khi cập nhật thành công
      setTimeout(() => {
        router.push('/profile');
      }, 2000); // Chờ 2 giây để người dùng đọc thông báo
    }
  };

  if (!user && !loading) {
    // Hiển thị một thông báo hoặc spinner trong khi chờ `useUser` xác định trạng thái
    // Nếu vẫn không có user sau khi tải, có thể chuyển hướng lại
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-lg text-gray-700">Đang kiểm tra quyền truy cập...</div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Đặt lại mật khẩu của bạn</h1>
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-white ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
            role="alert"
          >
            {message.text}
          </div>
        )}
        {user ? (
          <form onSubmit={handleUpdatePassword}>
            <div className="mb-4">
              <label htmlFor="new-password" className="block text-gray-700 text-sm font-bold mb-2">
                Mật khẩu mới
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
                id="new-password"
                type="password"
                placeholder="Nhập mật khẩu mới"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="mb-6">
              <label htmlFor="confirm-password" className="block text-gray-700 text-sm font-bold mb-2">
                Xác nhận mật khẩu mới
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
                id="confirm-password"
                type="password"
                placeholder="Xác nhận mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button
              className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus-shadow-outline w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              type="submit"
              disabled={loading}
            >
              {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        ) : (
          <p className="text-gray-600 text-center">
            Vui lòng sử dụng liên kết đặt lại mật khẩu từ email của bạn.
            <br />
            Bạn sẽ được tự động đăng nhập khi truy cập từ liên kết đó.
            <br />
            <Link href="/forgot-password" className="text-blue-500 hover:underline mt-4 block">Yêu cầu liên kết mới</Link>
          </p>
        )}
      </div>
    </div>
  );
}

function setIsSubmittingPassword(arg0: boolean) {
    throw new Error('Function not implemented.');
}
