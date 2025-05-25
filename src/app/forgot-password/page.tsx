// app/forgot-password/page.tsx
"use client";
import { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const supabaseClient = useSupabaseClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      // Quan trọng: Đường dẫn mà người dùng sẽ được chuyển hướng đến sau khi nhấp vào link trong email
      // Họ sẽ được chuyển hướng đến trang này với token và sau đó bạn sẽ xử lý việc cập nhật mật khẩu.
      redirectTo: `https://tanshop.vercel.app/update-password`, 
    });

    if (error) {
      setMessage({ type: 'error', text: 'Lỗi: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Một liên kết đặt lại mật khẩu đã được gửi đến email của bạn!' });
      setEmail(''); // Clear email field after success
    }
    setLoading(false);
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Đặt lại mật khẩu</h1>
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-white ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
            role="alert"
          >
            {message.text}
          </div>
        )}
        <form onSubmit={handleResetPassword}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
              id="email"
              type="email"
              placeholder="Nhập email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button
            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus-shadow-outline w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          <Link href="/login" className="text-blue-500 hover:underline">Quay lại Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}