// app/profile/setup/page.tsx
"use client";
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query'; // Import useQueryClient

interface Profile {
    full_name: string | null;
    phone: string | null;
    address: string | null;
}

export default function ProfileSetupPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const router = useRouter();
    const queryClient = useQueryClient(); // Khởi tạo queryClient

    const [profileData, setProfileData] = useState<Profile>({ full_name: '', phone: '', address: '' });
    const [loading, setLoading] = useState(true); // Trạng thái tải ban đầu
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Effect để kiểm tra trạng thái đăng nhập và tải dữ liệu profile nếu có
    useEffect(() => {
        if (!user) {
            // Nếu chưa đăng nhập, chuyển hướng về trang đăng nhập
            router.push(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
            return;
        }

        const fetchProfile = async () => {
            setLoading(true);
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('full_name, phone, address')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 là lỗi "không tìm thấy dữ liệu"
                setMessage({ type: 'error', text: 'Lỗi tải thông tin profile: ' + error.message });
            } else if (data) {
                // Nếu có dữ liệu profile, điền vào form
                setProfileData(data as Profile);
                // Nếu dữ liệu đã đầy đủ, có thể chuyển hướng về trang profile chính
                if (data.full_name && data.phone && data.address) {
                    router.replace('/profile'); // Dùng replace để không thêm vào lịch sử
                }
            }
            setLoading(false);
        };

        fetchProfile();
    }, [user, router, supabaseClient]);

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage(null);

        if (!user) {
            setMessage({ type: 'error', text: 'Bạn chưa đăng nhập.' });
            setIsSubmitting(false);
            return;
        }

        // Kiểm tra các trường bắt buộc
        if (!profileData.full_name || !profileData.phone || !profileData.address) {
            setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ Họ và tên, Số điện thoại và Địa chỉ.' });
            setIsSubmitting(false);
            return;
        }

        const { error } = await supabaseClient
            .from('profiles')
            .upsert({ id: user.id, ...profileData }, { onConflict: 'id' }); // Sử dụng onConflict để đảm bảo upsert đúng

        setIsSubmitting(false);

        if (error) {
            setMessage({ type: 'error', text: 'Lỗi lưu thông tin: ' + error.message });
        } else {
            setMessage({ type: 'success', text: 'Thông tin cá nhân đã được lưu thành công!' });
            queryClient.invalidateQueries({ queryKey: ['userProfile', user.id] }); // Vô hiệu hóa cache cho profile
            router.push('/profile'); // Chuyển hướng về trang profile chính
        }
    };

    // Effect để tự động ẩn thông báo sau 3 giây
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                setMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="text-lg text-gray-700">Đang tải thông tin profile...</div>
            </div>
        );
    }

    return (
        <div className="flex justify-center items-center h-screen bg-gray-100">
            <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center">Hoàn tất hồ sơ cá nhân</h1>
                <p className="text-gray-600 mb-6 text-center">
                    Vui lòng điền đầy đủ thông tin cá nhân để hoàn tất quá trình đăng ký.
                </p>
                {message && (
                    <div
                        className={`mb-4 p-3 rounded-lg text-white ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
                        role="alert"
                    >
                        {message.text}
                    </div>
                )}
                <form onSubmit={handleSaveProfile}>
                    <div className="mb-4">
                        <label htmlFor="full_name" className="block text-gray-700 text-sm font-bold mb-2">
                            Họ và tên <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
                            id="full_name"
                            type="text"
                            placeholder="Nhập họ và tên của bạn"
                            value={profileData.full_name || ''}
                            onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="phone" className="block text-gray-700 text-sm font-bold mb-2">
                            Số điện thoại <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline"
                            id="phone"
                            type="text"
                            placeholder="Nhập số điện thoại của bạn"
                            value={profileData.phone || ''}
                            onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="address" className="block text-gray-700 text-sm font-bold mb-2">
                            Địa chỉ <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus-shadow-outline min-h-[80px]"
                            id="address"
                            placeholder="Nhập địa chỉ của bạn (Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố)"
                            value={profileData.address || ''}
                            onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                            required
                        />
                    </div>
                    <button
                        className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus-shadow-outline w-full ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Đang lưu...' : 'Lưu thông tin'}
                    </button>
                </form>
            </div>
        </div>
    );
}