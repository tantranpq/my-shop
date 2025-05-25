// app/login/page.tsx
"use client";
import { useState, Suspense, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Component để chứa logic client-side và sử dụng useSearchParams/useUser
function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabaseClient = useSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser(); // Lấy thông tin người dùng hiện tại

  // useEffect để kiểm tra trạng thái đăng nhập
  // Nếu người dùng đã đăng nhập, chuyển hướng họ đi khỏi trang login
  useEffect(() => {
    if (user) {
      const returnTo = searchParams.get('returnTo');
      // Sử dụng router.replace để thay thế entry hiện tại trong lịch sử trình duyệt
      // Điều này ngăn người dùng nhấn Back để quay lại trang login sau khi đã đăng nhập
      router.replace(returnTo || '/profile'); // Chuyển hướng đến /profile hoặc trang đã yêu cầu
    }
  }, [user, router, searchParams]); // Phụ thuộc vào user, router, searchParams

  const handleLogin = async (e: React.FormEvent) => {
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
      // Lấy URL chuyển hướng từ query parameter 'returnTo'
      const returnTo = searchParams.get('returnTo');
      // Chuyển hướng về trang trước đó nếu có, nếu không thì về trang profile
      router.push(returnTo || '/profile');
    }

    setLoading(false);
  };

  const handleSignInWithGoogle = async () => {
    setLoading(true);
    setError(null);

    const { error: authError } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Quan trọng: Sau khi OAuth, Google sẽ redirect về đây, và auth-helpers sẽ xử lý token
        redirectTo: `https://tanshop.vercel.app/profile`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      console.log(`Redirecting to Google for authentication...`);
    }
  };


  // Nếu người dùng đã đăng nhập, không render form mà trả về null
  // (hoặc một loading spinner, nếu quá trình redirect mất một chút thời gian)
  if (user) {
    return null; // Không render gì nếu người dùng đã đăng nhập và đang được redirect
  }

  return (
    <div className="bg-white p-8 rounded shadow-md w-96">
      <h1 className="text-2xl font-bold mb-6 text-center">Đăng nhập</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleLogin}>
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
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>

      {/* Nút Đăng nhập bằng Google */}
      <div className="mt-6 text-center text-gray-500">Hoặc</div>
      <button
        className={`mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus-shadow-outline w-full flex items-center justify-center ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handleSignInWithGoogle}
        disabled={loading}
      >
        <img src="/google-logo.svg" alt="Google" className="h-5 w-5 mr-2" />
        Đăng nhập bằng Google
      </button>

      <p className="mt-4 text-sm text-center">
        Chưa có tài khoản? <Link href="/register" className="text-blue-500 hover:underline">Đăng ký</Link>
      </p>
      <p className="mt-2 text-sm text-center">
        <Link href="/forgot-password" className="text-blue-500 hover:underline">Quên mật khẩu?</Link>
      </p>
    </div>
  );
}

// Wrapper component để bọc LoginFormContent trong Suspense
// Điều này là cần thiết khi sử dụng useSearchParams trong một Client Component
export default function LoginPageWrapper() {
  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      {/* Bọc LoginFormContent trong Suspense. 
        useSearchParams yêu cầu Suspense boundary trong Next.js App Router 
        nếu nó được sử dụng trong một Client Component không được định nghĩa là async.
      */}
      <Suspense fallback={<div>Đang tải trang đăng nhập...</div>}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}