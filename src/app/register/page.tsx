// app/register/page.tsx
"use client";
import { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabaseClient = useSupabaseClient();
  const router = useRouter();

  const handleRegisterWithEmail = async (e: React.FormEvent) => { // Đổi tên hàm cho rõ ràng hơn
    e.preventDefault();
    setLoading(true);
    setError(null);

    // THAY ĐỔI QUAN TRỌNG Ở ĐÂY: Thêm emailRedirectTo
    const { error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        // Sau khi người dùng nhấp vào link xác nhận email, Supabase sẽ chuyển hướng về đây
        // (tên miền gốc của ứng dụng) và sau đó auth-helpers sẽ redirect đến /profile
        emailRedirectTo: `https://tanshop.vercel.app/profile`, 
      },
    });

    if (authError) {
      setError(authError.message);
    } else {
      alert('Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác nhận tài khoản.');
      // Không cần router.push('/profile') ở đây nữa, vì việc redirect sẽ được xử lý bởi Supabase sau khi xác nhận email
      // Tuy nhiên, để UX tốt hơn, bạn có thể chuyển hướng về trang chủ hoặc trang thông báo
      // để người dùng biết là đã gửi mail.
      router.push('/'); // Hoặc một trang /success-register
    }

    setLoading(false);
  };

  const handleSignInWithGoogle = async () => {
    setLoading(true);
    setError(null);

    const { error: authError } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Khi đăng nhập bằng OAuth, người dùng sẽ được chuyển hướng về /profile sau khi xác thực thành công
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

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Đăng ký hoặc Đăng nhập</h1>
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <form onSubmit={handleRegisterWithEmail}> {/* Sửa tên hàm */}
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
            className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus-shadow-outline w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Đang đăng ký...' : 'Đăng ký bằng Email'}
          </button>
        </form>

        <div className="mt-6 text-center text-gray-500">Hoặc</div>

        <button
          className={`mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus-shadow-outline w-full flex items-center justify-center ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleSignInWithGoogle}
          disabled={loading}
        >
          <img src="/google-logo.svg" alt="Google" className="h-5 w-5 mr-2" />
          Đăng nhập/Đăng ký bằng Google
        </button>

        <p className="mt-4 text-sm text-center">
          Đã có tài khoản? <Link href="/login" className="text-blue-500 hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}