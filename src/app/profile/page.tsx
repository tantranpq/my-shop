"use client";
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Link from "next/link";

interface Profile {
  full_name: string | null;
  phone: string | null;
  address: string | null;
}

export default function ProfilePage() {
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>({ full_name: null, phone: null, address: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.id) {
        setLoading(true);
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('full_name, phone, address')
          .eq('id', user.id)
          .single();

        if (error) {
          setError(error.message);
        } else if (data) {
          setProfile(data);
        }
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id, supabaseClient]);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabaseClient
      .from('profiles')
      .upsert({ id: user?.id, ...profile })
      .single();

    if (error) {
      setError(error.message);
    } else {
      router.push('/cart'); // Chuyển hướng về trang giỏ hàng sau khi cập nhật
    }

    setLoading(false);
  };

  if (loading) {
    return <div>Đang tải thông tin profile...</div>;
  }

  if (!user) {
    return <div>Bạn cần phải đăng nhập để xem trang này.</div>;
  }

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Thông tin cá nhân</h1>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={updateProfile}>
          <div className="mb-4">
            <label htmlFor="full_name" className="block text-gray-700 text-sm font-bold mb-2">
              Họ và tên
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
              id="full_name"
              type="text"
              value={profile.full_name || ''}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="phone" className="block text-gray-700 text-sm font-bold mb-2">
              Số điện thoại
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
              id="phone"
              type="text"
              value={profile.phone || ''}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </div>
          <div className="mb-6">
            <label htmlFor="address" className="block text-gray-700 text-sm font-bold mb-2">
              Địa chỉ
            </label>
            <textarea
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
              id="address"
              value={profile.address || ''}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
            />
          </div>
          <button
            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus-shadow-outline w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          <Link href="/cart" className="text-blue-500 hover:underline">← Quay lại giỏ hàng</Link>
        </p>
      </div>
    </div>
  );
}