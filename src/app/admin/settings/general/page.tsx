// app/admin/settings/general/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner'; // <--- Đã thay đổi import ở đây
import { useRouter } from 'next/navigation';

export default function GeneralSettingsPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const { isLoading: isLoadingSession } = useSessionContext();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [siteName, setSiteName] = useState('');
    const [timezone, setTimezone] = useState('');
    const [dateFormat, setDateFormat] = useState('');
    const [currency, setCurrency] = useState('');
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

    // Fetch general settings
    const { data: generalSettingsData, isLoading: isLoadingSettings } = useQuery({
        queryKey: ['generalSettings'],
        queryFn: async () => {
            const { data, error } = await supabaseClient
                .from('general_settings')
                .select('*')
                .single();
            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            return data;
        },
        enabled: userRole === 'admin',
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    useEffect(() => {
        if (generalSettingsData) {
            setSiteName(generalSettingsData.site_name || '');
            setTimezone(generalSettingsData.timezone || '');
            setDateFormat(generalSettingsData.date_format || '');
            setCurrency(generalSettingsData.currency || '');
        }
    }, [generalSettingsData]);

    // Mutation to update general settings
    const updateSettingsMutation = useMutation({
        mutationFn: async (newSettings: { site_name: string; timezone: string; date_format: string; currency: string }) => {
            const { data, error } = await supabaseClient
                .from('general_settings')
                .upsert(
                    { id: 1, ...newSettings },
                    { onConflict: 'id' }
                )
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.success('Cập nhật cấu hình chung thành công!'); // Vẫn giữ nguyên cú pháp này
            queryClient.invalidateQueries({ queryKey: ['generalSettings'] });
        },
        onError: (error) => {
            toast.error(`Lỗi cập nhật: ${error.message}`); // Vẫn giữ nguyên cú pháp này
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        updateSettingsMutation.mutate({
            site_name: siteName,
            timezone: timezone,
            date_format: dateFormat,
            currency: currency,
        });
    };

    // Render Logic
    if (isLoadingSession || isLoadingProfile || isLoadingSettings) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                {isLoadingSession ? "Đang tải phiên đăng nhập..." : isLoadingProfile ? "Đang kiểm tra quyền..." : "Đang tải cấu hình..."}
            </div>
        );
    }

    // Only admin can access this page
    if (userRole !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-red-500">
                Bạn không có quyền truy cập trang cấu hình chung.
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Cấu hình chung</h1>

            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="siteName" className="block text-gray-700 text-sm font-bold mb-2">Tên cửa hàng/ứng dụng:</label>
                        <input
                            type="text"
                            id="siteName"
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            value={siteName}
                            onChange={(e) => setSiteName(e.target.value)}
                            placeholder="Ví dụ: Cửa hàng ABC"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label htmlFor="timezone" className="block text-gray-700 text-sm font-bold mb-2">Múi giờ:</label>
                        <select
                            id="timezone"
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            required
                        >
                            <option value="">Chọn múi giờ</option>
                            <option value="Asia/Ho_Chi_Minh">(GMT+07:00) Hồ Chí Minh</option>
                            <option value="Asia/Bangkok">(GMT+07:00) Bangkok</option>
                        </select>
                    </div>

                    <div className="mb-6">
                        <label htmlFor="dateFormat" className="block text-gray-700 text-sm font-bold mb-2">Định dạng ngày:</label>
                        <select
                            id="dateFormat"
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            value={dateFormat}
                            onChange={(e) => setDateFormat(e.target.value)}
                            required
                        >
                            <option value="">Chọn định dạng ngày</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY (ví dụ: 25/12/2025)</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY (ví dụ: 12/25/2025)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (ví dụ: 2025-12-25)</option>
                        </select>
                    </div>

                    <div className="mb-6">
                        <label htmlFor="currency" className="block text-gray-700 text-sm font-bold mb-2">Đơn vị tiền tệ:</label>
                        <select
                            id="currency"
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            required
                        >
                            <option value="">Chọn đơn vị tiền tệ</option>
                            <option value="VND">VND (Việt Nam Đồng)</option>
                            <option value="USD">USD (Đô la Mỹ)</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                            disabled={updateSettingsMutation.isPending}
                        >
                            {updateSettingsMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/admin/settings')}
                            className="ml-4 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                            Quay lại
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}