// app/admin/settings/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

export default function AdminSettingsPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const { isLoading: isLoadingSession } = useSessionContext();

    const [userRole, setUserRole] = useState<'user' | 'admin' | 'staff' | null>(null);

    // Fetch user role (for current logged-in user)
    const { data: profileData, isLoading: isLoadingProfile } = useQuery({
        queryKey: ['userProfile', user?.id],
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
        staleTime: 1000 * 60 * 60, // Cache for 1 hour
    });

    useEffect(() => {
        if (profileData) {
            setUserRole(profileData.role as 'user' | 'admin' | 'staff');
        }
    }, [profileData]);

    // Render Logic
    if (isLoadingSession || isLoadingProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                {isLoadingSession ? "Đang tải phiên đăng nhập..." : "Đang kiểm tra quyền..."}
            </div>
        );
    }

    // Only admin can access this page
    if (userRole !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-red-500">
                Bạn không có quyền truy cập trang cấu hình.
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Cấu hình Hệ thống</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Cấu hình chung */}
                <Link href="/admin/settings/general" className="block">
                    <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer h-full flex flex-col justify-between">
                        <div>
                            <div className="text-blue-600 mb-3 text-4xl text-center">
                                <i className="fas fa-cog"></i>
                            </div>
                            <h2 className="text-xl font-semibold mb-2 text-gray-800 text-center">Cấu hình chung</h2>
                            <p className="text-gray-600 text-center">Quản lý thông tin cửa hàng, múi giờ, định dạng...</p>
                        </div>
                    </div>
                </Link>

                {/* Quản lý nhân viên (chỉ admin mới có quyền truy cập) */}
                {userRole === 'admin' && (
                    <Link href="/admin/settings/staff-management" className="block">
                        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer h-full flex flex-col justify-between">
                            <div>
                                <div className="text-green-600 mb-3 text-4xl text-center">
                                    <i className="fas fa-users-cog"></i>
                                </div>
                                <h2 className="text-xl font-semibold mb-2 text-gray-800 text-center">Quản lý nhân viên</h2>
                                <p className="text-gray-600 text-center">Thêm, sửa, xóa và phân quyền nhân viên.</p>
                            </div>
                        </div>
                    </Link>
                )}

                {/* Các mục cấu hình khác có thể thêm sau này */}
                <Link href="/admin/settings/payments" className="block">
                    <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer h-full flex flex-col justify-between">
                        <div>
                            <div className="text-purple-600 mb-3 text-4xl text-center">
                                <i className="fas fa-money-check-alt"></i>
                            </div>
                            <h2 className="text-xl font-semibold mb-2 text-gray-800 text-center">Cấu hình thanh toán</h2>
                            <p className="text-gray-600 text-center">Thiết lập phương thức thanh toán.</p>
                        </div>
                    </div>
                </Link>

                <Link href="/admin/settings/shipping" className="block">
                    <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer h-full flex flex-col justify-between">
                        <div>
                            <div className="text-yellow-600 mb-3 text-4xl text-center">
                                <i className="fas fa-truck-loading"></i>
                            </div>
                            <h2 className="text-xl font-semibold mb-2 text-gray-800 text-center">Cấu hình vận chuyển</h2>
                            <p className="text-gray-600 text-center">Thiết lập các tùy chọn vận chuyển.</p>
                        </div>
                    </div>
                </Link>

                {/* Thêm các mục khác tùy theo nhu cầu */}
                {/* <Link href="/admin/settings/notifications" className="block">
                    <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer">
                        <div className="text-red-600 mb-3 text-4xl text-center">
                            <i className="fas fa-bell"></i>
                        </div>
                        <h2 className="text-xl font-semibold mb-2 text-gray-800 text-center">Cấu hình thông báo</h2>
                        <p className="text-gray-600 text-center">Thiết lập các email, SMS thông báo tự động.</p>
                    </div>
                </Link> */}
            </div>
        </div>
    );
}