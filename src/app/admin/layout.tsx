// app/admin/layout.tsx
"use client";
import React from 'react';
import Link from 'next/link';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';

// Component Sidebar
function AdminSidebar() {
    return (
        <aside className="w-64 bg-gray-800 text-white min-h-screen p-4 flex flex-col">
            <div className="text-2xl font-bold mb-8 text-center text-blue-400">Admin Dashboard</div>
            <nav className="flex-1">
                <ul>
                    <li className="mb-2">
                        <Link href="/admin/overview" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                            <i className="fas fa-tachometer-alt mr-3"></i>Tổng quan
                        </Link>
                    </li>
                    <li className="mb-2">
                        <Link href="/admin/orders" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                            <i className="fas fa-file-invoice-dollar mr-3"></i>Đơn hàng
                        </Link>
                    </li>
                    <li className="mb-2">
                        <Link href="/admin/products" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                            <i className="fas fa-box-open mr-3"></i>Sản phẩm
                        </Link>
                    </li>
                    <li className="mb-2">
                        <Link href="/admin/customers" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                            <i className="fas fa-users mr-3"></i>Khách hàng
                        </Link>
                    </li>
                    <li className="mb-2">
                        <Link href="/admin/reports" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">
                            <i className="fas fa-chart-line mr-3"></i>Báo cáo
                        </Link>
                    </li>
                    {/* Thêm các mục khác nếu cần */}
                </ul>
            </nav>
        </aside>
    );
}

// Component Header
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
    return (
        <div className="flex min-h-screen bg-gray-100">
            <AdminSidebar />
            <div className="flex-1 flex flex-col">
                <AdminHeader />
                <main className="p-6 flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}