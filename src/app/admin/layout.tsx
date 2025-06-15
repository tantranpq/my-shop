// app/admin/layout.tsx
"use client";
import React, { useState, useEffect } from 'react'; // Import useState, useEffect
import Link from 'next/link';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react'; // Import useSessionContext
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query'; // Import useQuery

// Component Sidebar
// Nhận userRole làm prop
function AdminSidebar({ userRole }: { userRole: 'user' | 'admin' | 'staff' | null }) {
    return (
        <aside className="w-64 bg-gray-800 text-white min-h-screen p-4 flex flex-col">
            <div className="text-2xl font-bold mb-8 text-center text-blue-400">Admin Dashboard</div>
            <nav className="flex-1">
                <ul>
                    {/* Các mục chỉ Admin được xem */}
                    {userRole === 'admin' && (
                        <li className="mb-2">
                            <Link href="/admin/overview" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                                <i className="fas fa-tachometer-alt mr-3"></i>Tổng quan
                            </Link>
                        </li>
                    )}
                    
                    {/* Các mục mà Admin và Staff được xem */}
                    {/* Đơn hàng */}
                    {(userRole === 'admin' || userRole === 'staff') && (
                        <li className="mb-2">
                            <Link href="/admin/orders" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                                <i className="fas fa-file-invoice-dollar mr-3"></i>Đơn hàng
                            </Link>
                        </li>
                    )}

                    {/* Sản phẩm */}
                    {(userRole === 'admin' || userRole === 'staff') && (
                        <li className="mb-2">
                            <Link href="/admin/products" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                                <i className="fas fa-box-open mr-3"></i>Sản phẩm
                            </Link>
                        </li>
                    )}

                    {/* Khách hàng */}
                    {(userRole === 'admin' || userRole === 'staff') && (
                        <li className="mb-2">
                            <Link href="/admin/customers" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                                <i className="fas fa-users mr-3"></i>Khách hàng
                            </Link>
                        </li>
                    )}
                    
                    {/* Thêm các mục navigation mới mà bạn đã liệt kê */}
                    {/* Bán hàng (nếu có trang riêng) */}
                    {(userRole === 'admin' || userRole === 'staff') && (
                        <li className="mb-2">
                            <Link href="/admin/sales" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                                <i className="fas fa-shopping-cart mr-3"></i>Bán hàng
                            </Link>
                        </li>
                    )}

                    {/* Vận chuyển (nếu có trang riêng) */}
                    {(userRole === 'admin' || userRole === 'staff') && (
                        <li className="mb-2">
                            <Link href="/admin/shipping" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                                <i className="fas fa-truck mr-3"></i>Vận chuyển
                            </Link>
                        </li>
                    )}

                    {/* Các mục chỉ Admin được xem (dựa trên ảnh bạn cung cấp) */}
                    {userRole === 'admin' && (
                        <>
                            <li className="mb-2">
                                <Link href="/admin/cashbook" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                                    <i className="fas fa-wallet mr-3"></i>Sổ quỹ
                                </Link>
                            </li>
                            <li className="mb-2">
                                <Link href="/admin/reports" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                                    <i className="fas fa-chart-line mr-3"></i>Báo cáo
                                </Link>
                            </li>
                            {/* KÊNH BÁN HÀNG */}
                            <li className="mb-2">
                                <div className="text-sm uppercase font-semibold text-gray-400 mt-4 mb-2 px-4">KÊNH BÁN HÀNG</div>
                                <Link href="/admin/facebook-channel" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                                    <i className="fab fa-facebook mr-3"></i>Kênh Facebook
                                </Link>
                            </li>
                            <li className="mb-2">
                                <Link href="/admin/applications" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                                    <i className="fas fa-puzzle-piece mr-3"></i>Ứng dụng
                                </Link>
                            </li>
                            <li className="mb-2">
                                <Link href="/admin/settings" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                                    <i className="fas fa-cog mr-3"></i>Cấu hình
                                </Link>
                            </li>
                        </>
                    )}
                </ul>
            </nav>
        </aside>
    );
}

// Component Header (giữ nguyên)
function AdminHeader() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const router = useRouter();

    const handleLogout = async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error('Lỗi đăng xuất:', error.message);
        } else {
            router.push('/login'); // Chuyển hướng về trang đăng nhập sau khi đăng xuất
        }
    };

    return (
        <header className="bg-white shadow-md p-4 flex justify-between items-center">
            <h1 className="text-3xl font-semibold text-gray-800">Dashboard</h1>
            <div className="flex items-center space-x-4">
                {user && (
                    <span className="text-gray-700">Xin chào, {user.email || 'Admin'}</span>
                )}
                <button
                    onClick={handleLogout}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200"
                >
                    <i className="fas fa-sign-out-alt mr-2"></i>Đăng xuất
                </button>
            </div>
        </header>
    );
}

// Admin Layout Component
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const { isLoading: isLoadingSession } = useSessionContext();

    const [userRole, setUserRole] = useState<'user' | 'admin' | 'staff' | null>(null);

    // Fetch vai trò người dùng
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
        staleTime: 1000 * 60 * 60,
    });

    useEffect(() => {
        if (profileData) {
            setUserRole(profileData.role as 'user' | 'admin' | 'staff');
        }
    }, [profileData]);

    // Hiển thị trạng thái tải hoặc không có quyền truy cập tổng quát cho layout
    if (isLoadingSession || isLoadingProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                {isLoadingSession ? "Đang tải phiên đăng nhập..." : "Đang kiểm tra quyền..."}
            </div>
        );
    }

    // Nếu người dùng không phải admin hoặc staff, không cho truy cập layout này
    // Bạn có thể điều chỉnh điều kiện này tùy theo quy định của bạn
    // Ví dụ, nếu bạn muốn chỉ admin mới vào được admin layout, hãy bỏ || userRole !== 'staff'
    if (userRole === null || (userRole !== 'admin' && userRole !== 'staff')) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-red-500">
                Bạn không có quyền truy cập khu vực quản trị.
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* Truyền userRole vào AdminSidebar */}
            <AdminSidebar userRole={userRole} />
            <div className="flex-1 flex flex-col">
                <AdminHeader />
                <main className="p-6 flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}