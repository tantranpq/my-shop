// app/update-password/page.tsx
"use client";
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Import Link để sử dụng cho nút "Yêu cầu liên kết mới"

export default function UpdatePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false); // Biến để quản lý trạng thái tải khi gửi form
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const supabaseClient = useSupabaseClient();
  const user = useUser(); // Hook để kiểm tra người dùng đã đăng nhập sau khi redirect từ email
  const router = useRouter();

  // useEffect này sẽ chạy khi component mount và khi user thay đổi.
  // user hook từ supabase-auth-helpers-react sẽ tự động được cập nhật
  // khi session được thiết lập từ URL hash (sau khi nhấp vào link reset password).
  useEffect(() => {
    // Nếu người dùng không tồn tại sau khi tải trang và không trong trạng thái loading,
    // điều đó có thể chỉ ra rằng token hết hạn hoặc không hợp lệ.
    // Trong trường hợp này, chúng ta có thể hiển thị thông báo hoặc chuyển hướng.
    // Đối với UX tốt hơn, có thể để người dùng thấy trang "Đang kiểm tra quyền truy cập..."
    // hoặc một form đơn giản yêu cầu lại link nếu session không được thiết lập.
    // Logic hiện tại sẽ hiển thị form cập nhật mật khẩu nếu `user` có giá trị.
    // Nếu `user` là null, nó sẽ hiển thị thông báo lỗi và link yêu cầu lại.
  }, [user, loading, router]); // Dependency array

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); // Bắt đầu trạng thái tải
    setMessage(null); // Xóa thông báo cũ

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu mới và xác nhận mật khẩu không khớp.' });
      setLoading(false); // Dừng trạng thái tải
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Mật khẩu phải có ít nhất 6 ký tự.' });
      setLoading(false); // Dừng trạng thái tải
      return;
    }

    // `updateUser` sẽ cập nhật mật khẩu cho người dùng hiện tại
    // (người đã được xác thực thông qua token từ URL khi truy cập trang này)
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword,
    });

    setLoading(false); // Dừng trạng thái tải sau khi hoàn thành request

    if (error) {
      setMessage({ type: 'error', text: 'Lỗi cập nhật mật khẩu: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Mật khẩu của bạn đã được cập nhật thành công!' });
      setNewPassword(''); // Xóa trường mật khẩu
      setConfirmPassword(''); // Xóa trường xác nhận mật khẩu
      // Chuyển hướng người dùng về trang profile hoặc trang chủ sau khi cập nhật thành công
      setTimeout(() => {
        router.push('/profile');
      }, 2000); // Chờ 2 giây để người dùng đọc thông báo
    }
  };

  // Hiển thị một thông báo hoặc spinner trong khi chờ `useUser` xác định trạng thái
  // Điều này xảy ra ngay khi trang tải, trước khi Supabase helpers kịp xử lý token từ URL
  if (!user && !loading) {
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
        {/* Chỉ hiển thị form đặt lại mật khẩu nếu `user` đã được xác định */}
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
          // Hiển thị thông báo nếu người dùng không được xác thực trên trang này
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