// app/login/page.tsx
"use client";
import { useState, Suspense, useEffect } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react'; // Import useSessionContext
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner'; // Import toast

// Component để chứa logic client-side và sử dụng useSearchParams/useUser
function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabaseClient = useSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();
  const { isLoading: isLoadingSession } = useSessionContext(); // Theo dõi trạng thái session

  // useEffect để kiểm tra trạng thái đăng nhập
  useEffect(() => {
    // Chỉ chạy khi user và session đã tải xong
    if (!isLoadingSession && user) {
      // Fetch profile để lấy role và kiểm tra thông tin đầy đủ
      const fetchUserProfile = async () => {
        const { data: profile, error: profileError } = await supabaseClient
          .from('profiles')
          .select('full_name, phone, address, role')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Lỗi khi tải profile:', profileError);
          // Xử lý lỗi, có thể đăng xuất hoặc chuyển hướng về trang lỗi
          toast.error('Không thể tải thông tin người dùng. Vui lòng thử lại.');
          return;
        }

        const isProfileIncomplete = !profile.full_name || !profile.phone || !profile.address;
        const returnTo = searchParams.get('returnTo');

        if (profile.role === 'admin' || profile.role === 'staff') {
          if (isProfileIncomplete) {
            toast.info('Vui lòng hoàn tất thông tin cá nhân của quản trị viên/nhân viên.');
            router.replace('/admin/profile-setup');
          } else {
            router.replace('/admin/dashboard');
          }
        } else { // 'user'
          if (isProfileIncomplete) {
            toast.info('Vui lòng hoàn tất thông tin cá nhân của bạn.');
            router.replace('/profile-setup'); // Chuyển hướng đến trang thiết lập profile cho user
          } else {
            router.replace(returnTo || '/profile'); // Chuyển hướng đến profile hoặc trang yêu cầu
          }
        }
      };
      fetchUserProfile();
    }
  }, [user, router, searchParams, supabaseClient, isLoadingSession]);

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
      toast.error('Đăng nhập thất bại: ' + authError.message);
    } else {
      // Đăng nhập thành công, useEffect sẽ tự động xử lý chuyển hướng
      toast.success('Đăng nhập thành công!');
    }
    setLoading(false);
  };

  const handleSignInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error: authError } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`, // Đảm bảo URL này khớp với Redirect URL trong Supabase
      },
    });

    if (authError) {
      setError(authError.message);
      toast.error('Đăng nhập bằng Google thất bại: ' + authError.message);
    }
    setLoading(false);
  };

  // Nếu đang tải phiên hoặc đã có user và đang chờ kiểm tra profile, hiển thị loading
  if (isLoadingSession || (user && !user.user_metadata?.profile_checked)) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 text-lg text-gray-700">
        Đang kiểm tra trạng thái đăng nhập...
      </div>
    );
  }

  // Nếu user đã đăng nhập và đã được xử lý chuyển hướng, không cần render form login
  if (user) {
    return null;
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
      <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Đăng nhập</h2>
      {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
      <form onSubmit={handleLogin}>
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email:</label>
          <input
            type="email"
            id="email"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="mb-6">
          <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Mật khẩu:</label>
          <input
            type="password"
            id="password"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
        nếu nó được sử dụng trong Client Component */}
      <Suspense fallback={<div>Đang tải trang đăng nhập...</div>}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}