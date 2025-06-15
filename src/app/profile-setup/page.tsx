// app/profile-setup/page.tsx
"use client";
import { useState, useEffect, Suspense } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';

interface Profile {
    full_name: string | null;
    phone: string | null;
    address: string | null;
    role: 'user' | 'admin' | 'staff' | null;
}

function ProfileSetupContent() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const router = useRouter();
    const { isLoading: isLoadingSession } = useSessionContext();

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Fetch user profile để điền vào form và kiểm tra trạng thái hoàn chỉnh
    // **Sửa:** Thay đổi kiểu dữ liệu của data từ Profile thành Profile | null
    const { data: profileData, isLoading: isLoadingProfile } = useQuery<Profile | null, Error>({
        queryKey: ['userProfileSetup', user?.id],
        queryFn: async () => {
            if (!user?.id) return null; // Nếu không có user ID, không fetch và trả về null
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('full_name, phone, address, role')
                .eq('id', user.id)
                .single();
            if (error) {
                // **Sửa:** Xử lý trường hợp không tìm thấy profile (Supabase trả về lỗi PGRST116)
                if (error.code === 'PGRST116') { // Mã lỗi khi không tìm thấy hàng
                    return null; // Trả về null để báo hiệu profile chưa tồn tại hoặc chưa hoàn chỉnh
                }
                throw error; // Ném lại các lỗi khác
            }
            return data;
        },
        enabled: !!user?.id && !isLoadingSession, // Chỉ chạy query khi có user ID và session đã load
        staleTime: 0, // Luôn fetch mới nhất
    });

    useEffect(() => {
        // Nếu session đã tải xong và không có user, chuyển hướng về trang đăng nhập
        if (!isLoadingSession && !user) {
            toast.info('Bạn cần đăng nhập để truy cập trang này.');
            router.replace('/login');
        }
        // Nếu user đã load, session đã load, và profile data đã được fetch (không còn isLoadingProfile và profileData không phải undefined)
        else if (!isLoadingSession && user && !isLoadingProfile && profileData !== undefined) {
            // Khởi tạo các trường form với dữ liệu profile hoặc chuỗi rỗng
            setFullName(profileData?.full_name || '');
            setPhone(profileData?.phone || '');
            setAddress(profileData?.address || '');

            // Logic chuyển hướng chỉ chạy khi profileData không phải là null (tức là có dữ liệu profile)
            if (profileData) {
                // Nếu profile đã đầy đủ thông tin (cho role 'user'), chuyển hướng về trang profile
                if (profileData.full_name && profileData.phone && profileData.address && profileData.role === 'user') {
                    toast.success('Thông tin profile đã hoàn tất!');
                    router.replace('/profile');
                }
                // Nếu vai trò không phải user (là admin/staff), chuyển hướng về dashboard admin
                else if (profileData.role === 'admin' || profileData.role === 'staff') {
                    toast.error('Bạn không có quyền truy cập trang thiết lập profile người dùng thông thường.');
                    router.replace('/admin/dashboard');
                }
            }
            // Nếu profileData là null, nghĩa là người dùng chưa có profile hoặc profile rỗng,
            // khi đó form sẽ hiển thị để họ điền thông tin.
        }
    }, [isLoadingSession, user, isLoadingProfile, profileData, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        if (!fullName.trim() || !phone.trim() || !address.trim()) {
            toast.error('Vui lòng điền đầy đủ tất cả các trường.');
            setIsSaving(false);
            return;
        }

        try {
            // **Quan trọng:** Với Supabase, khi một người dùng mới được tạo, một bản ghi trống trong bảng 'profiles'
            // thường được tạo tự động bởi trigger. Vì vậy, đây thường là thao tác UPDATE.
            // Nếu bạn không có trigger và profile chưa tồn tại, bạn có thể cần kiểm tra và INSERT.
            // Với giả định profile đã tồn tại (dù có thể trống), chúng ta dùng update.
            const { error } = await supabaseClient
                .from('profiles')
                .update({ full_name: fullName.trim(), phone: phone.trim(), address: address.trim() })
                .eq('id', user?.id);

            if (error) throw error;

            toast.success('Thông tin profile đã được cập nhật!');
            router.replace('/profile'); // Chuyển hướng về trang profile sau khi lưu
        } catch (error: unknown) {
    console.error('Lỗi khi cập nhật profile:', error);

    if (error instanceof Error) {
        toast.error('Lỗi khi cập nhật profile: ' + error.message);
    } else {
        toast.error('Lỗi khi cập nhật profile: Lỗi không xác định');
    }

        } finally {
            setIsSaving(false);
        }
    };

    // Hiển thị trạng thái tải cho đến khi session, user và profile data được tải xong.
    if (isLoadingSession || !user || isLoadingProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                Đang tải thông tin profile...
            </div>
        );
    }

    // Nếu profileData đã được tải và không phải null,
    // VÀ profile đã hoàn tất (đối với user) HOẶC user là admin/staff (đã được chuyển hướng),
    // thì không cần render form nữa, vì người dùng đã được điều hướng.
    if (profileData && ((profileData.full_name && profileData.phone && profileData.address && profileData.role === 'user') ||
                       (profileData.role === 'admin' || profileData.role === 'staff'))) {
        return null;
    }

    // Nếu profileData là null (nghĩa là profile chưa tồn tại hoặc rỗng)
    // HOẶC profileData tồn tại nhưng chưa đầy đủ thông tin (đối với role 'user')
    // thì hiển thị form.
    return (
        <>
            <Navbar />
            <div className="flex justify-center items-center min-h-[calc(100vh-64px)] bg-gray-100 p-4"> {/* Giảm chiều cao nếu có Navbar */}
                <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Hoàn tất thông tin cá nhân</h2>
                    <p className="text-gray-600 mb-6 text-center">Vui lòng điền đầy đủ thông tin để sử dụng các tính năng của trang web.</p>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label htmlFor="fullName" className="block text-gray-700 text-sm font-bold mb-2">Tên đầy đủ:</label>
                            <input
                                type="text"
                                id="fullName"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                required
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="phone" className="block text-gray-700 text-sm font-bold mb-2">Số điện thoại:</label>
                            <input
                                type="tel"
                                id="phone"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                required
                            />
                        </div>
                        <div className="mb-6">
                            <label htmlFor="address" className="block text-gray-700 text-sm font-bold mb-2">Địa chỉ:</label>
                            <input
                                type="text"
                                id="address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Đang lưu...' : 'Hoàn tất và Tiếp tục'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}

export default function ProfileSetupPage() {
    return (
        <Suspense fallback={<div>Đang tải trang thiết lập Profile...</div>}>
            <ProfileSetupContent />
        </Suspense>
    );
}