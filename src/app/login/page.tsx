"use client";
import { useState, Suspense } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Tạo một component riêng biệt để sử dụng useSearchParams
// Điều này giúp tách biệt logic client-side và cho phép bọc nó trong Suspense
function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabaseClient = useSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLoginWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
    } else {
      const returnTo = searchParams.get('returnTo');
      router.push(returnTo || '/products');
    }

    setLoading(false);
  };

  // Chỉ giữ lại hàm cho Google
  const handleSignInWithGoogle = async () => {
    setLoading(true);
    setError(null);

    const { error: authError } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // RẤT QUAN TRỌNG: Thay đổi URL này thành URL mà bạn muốn người dùng được chuyển hướng về
        // sau khi xác thực thành công.
        redirectTo: `${window.location.origin}/profile/setup`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      console.log(`Redirecting to Google for authentication...`);
    }
  };

  return (
    <div className="bg-white p-8 rounded shadow-md w-96">
      <h1 className="text-2xl font-bold mb-6 text-center">Đăng nhập</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleLoginWithEmail}>
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
        <div className="mb-6">
          <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
            Mật khẩu
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
            id="password"
            type="password"
            placeholder="Nhập mật khẩu của bạn"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus-shadow-outline w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          type="submit"
          disabled={loading}
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập bằng Email'}
        </button>
      </form>

      <div className="mt-6 text-center text-gray-500">Hoặc</div>

      {/* Nút đăng nhập/đăng ký bằng Google */}
      <button
        className={`mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus-shadow-outline w-full flex items-center justify-center ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handleSignInWithGoogle} // Gọi hàm chỉ cho Google
        disabled={loading}
      >
        <img src="/google-logo.svg" alt="Google" className="h-5 w-5 mr-2" />
        Đăng nhập bằng Google
      </button>

      {/* Nút Facebook đã bị xóa */}

      <p className="mt-4 text-sm text-center">
        Chưa có tài khoản? <Link href="/register" className="text-blue-500 hover:underline">Đăng ký</Link>
      </p>
    </div>
  );
}

export default function LoginPageWrapper() {
  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <Suspense fallback={<div>Đang tải biểu mẫu đăng nhập...</div>}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}