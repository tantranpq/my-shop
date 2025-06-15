// app/admin/profile-setup/page.tsx
"use client";
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

export default function AdminProfileSetupPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const router = useRouter();
    const { isLoading: isLoadingSession } = useSessionContext();

    const [fullName, setFullName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [profileLoaded, setProfileLoaded] = useState(false); // Để biết profile đã load xong chưa

    // Fetch user profile để điền vào form và kiểm tra trạng thái hoàn chỉnh
    const { data: profileData, isLoading: isLoadingProfile } = useQuery({
        queryKey: ['adminProfileSetup', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('full_name, role')
                .eq('id', user.id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id && !isLoadingSession,
        staleTime: 0, // Luôn fetch mới nhất
    });

    useEffect(() => {
        if (profileData) {
            setFullName(profileData.full_name || '');
            setProfileLoaded(true);
            // Nếu profile đã đầy đủ, chuyển hướng về dashboard
            if (profileData.full_name) {
                toast.success('Thông tin profile đã hoàn tất!');
                router.replace('/admin/dashboard');
            }
        }
    }, [profileData, router]);

    // Kiểm tra quyền truy cập cho trang này
    const { data: userRoleData, isLoading: isLoadingUserRole } = useQuery({
        queryKey: ['userRoleCheckAdminSetup', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id && !isLoadingSession,
        staleTime: 1000 * 60 * 60,
    });

    useEffect(() => {
        if (!isLoadingSession && !user) {
            // Nếu không có user, chuyển hướng về trang đăng nhập
            toast.info('Bạn cần đăng nhập để truy cập trang này.');
            router.replace('/login');
        } else if (userRoleData && userRoleData.role !== 'admin' && userRoleData.role !== 'staff') {
            // Nếu không phải admin hoặc staff, chuyển hướng
            toast.error('Bạn không có quyền truy cập trang thiết lập profile quản trị.');
            router.replace('/profile'); // Chuyển hướng người dùng không phải admin/staff
        }
    }, [isLoadingSession, user, userRoleData, router]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        if (!fullName.trim()) {
            toast.error('Tên đầy đủ không được để trống.');
            setIsSaving(false);
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ full_name: fullName.trim() })
                .eq('id', user?.id);

            if (error) throw error;

            toast.success('Thông tin profile đã được cập nhật!');
            router.replace('/admin/dashboard'); // Chuyển hướng về dashboard sau khi lưu
        } catch (err: any) {
            console.error('Lỗi khi cập nhật profile:', err.message);
            toast.error('Lỗi khi cập nhật profile: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoadingSession || !user || isLoadingProfile || isLoadingUserRole || !profileLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                Đang tải thông tin profile...
            </div>
        );
    }

    // Nếu userRoleData đã load và không phải admin/staff, đã chuyển hướng ở useEffect.
    if (userRoleData && userRoleData.role !== 'admin' && userRoleData.role !== 'staff') {
        return null;
    }

    // Nếu profile đã đầy đủ, đã chuyển hướng ở useEffect.
    if (profileData && profileData.full_name) {
        return null;
    }

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Hoàn tất thông tin quản trị</h2>
                <p className="text-gray-600 mb-6 text-center">Vui lòng điền đầy đủ tên của bạn để tiếp tục truy cập.</p>
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
    );
}