// app/admin/dashboard/page.tsx
"use client"; // Client Component vì có thể cần sử dụng hooks nếu thêm logic sau này

import React from 'react';
// import { useUser } from '@supabase/auth-helpers-react'; // Có thể cần nếu muốn hiển thị tên user
// import { useQuery } from '@tanstack/react-query'; // Có thể cần nếu muốn fetch dữ liệu dashboard

export default function AdminDashboardPage() {
    // const user = useUser(); // Ví dụ: lấy user nếu cần
    // const { data: stats, isLoading } = useQuery(...); // Ví dụ: fetch thống kê

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Tổng quan quản trị</h2>
            <p className="text-gray-700">Chào mừng bạn đến với bảng điều khiển quản trị/nhân viên!</p>
            <p className="text-gray-700 mt-2">Sử dụng thanh bên để điều hướng đến các chức năng khác.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {/* Ví dụ các Card thống kê */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Tổng doanh thu</h3>
                    <p className="text-3xl font-bold text-green-600">123.456.789 VNĐ</p>
                    <p className="text-sm text-gray-500 mt-1">Trong tháng này</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Đơn hàng mới</h3>
                    <p className="text-3xl font-bold text-blue-600">45</p>
                    <p className="text-sm text-gray-500 mt-1">Đang chờ xử lý</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Sản phẩm tồn kho</h3>
                    <p className="text-3xl font-bold text-yellow-600">1230</p>
                    <p className="text-sm text-gray-500 mt-1">Tổng số mặt hàng</p>
                </div>

                {/* Có thể thêm biểu đồ, bảng tóm tắt, v.v. */}
            </div>
        </div>
    );
}