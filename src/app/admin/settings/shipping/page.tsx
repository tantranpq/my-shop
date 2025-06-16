// app/admin/settings/shipping/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

// Định nghĩa kiểu dữ liệu cho một cấu hình vận chuyển
interface ShippingSetting {
    id: string; // UUID
    method_name: string;
    is_enabled: boolean;
    price: number | null;
    free_over_amount: number | null;
    estimated_delivery_time: string | null;
    additional_config: Record<string, any> | null;
}

export default function ShippingSettingsPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const { isLoading: isLoadingSession } = useSessionContext();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [userRole, setUserRole] = useState<'user' | 'admin' | 'staff' | null>(null);
    const [editingSetting, setEditingSetting] = useState<ShippingSetting | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);

    // Form states for new/editing provider
    const [methodName, setMethodName] = useState('');
    const [isEnabled, setIsEnabled] = useState(false);
    const [price, setPrice] = useState<number | null>(null);
    const [freeOverAmount, setFreeOverAmount] = useState<number | null>(null);
    const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState('');
    const [additionalConfig, setAdditionalConfig] = useState<string>('{}'); // JSON string

    // Fetch user role
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

    // Fetch shipping settings
    const { data: shippingSettings, isLoading: isLoadingShippingSettings } = useQuery<ShippingSetting[]>({
        queryKey: ['shippingSettings'],
        queryFn: async () => {
            const { data, error } = await supabaseClient
                .from('shipping_settings')
                .select('*');
            if (error) throw error;
            return data;
        },
        enabled: userRole === 'admin',
        staleTime: 1000 * 60 * 5,
    });

    // Mutation for adding/updating a shipping setting
    const saveShippingSettingMutation = useMutation({
        mutationFn: async (setting: Partial<ShippingSetting>) => {
            if (setting.id) { // Update existing
                const { data, error } = await supabaseClient
                    .from('shipping_settings')
                    .update(setting)
                    .eq('id', setting.id)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            } else { // Insert new
                const { data, error } = await supabaseClient
                    .from('shipping_settings')
                    .insert(setting)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            }
        },
        onSuccess: () => {
            toast.success('Lưu cấu hình vận chuyển thành công!');
            queryClient.invalidateQueries({ queryKey: ['shippingSettings'] });
            resetForm();
        },
        onError: (error) => {
            toast.error(`Lỗi khi lưu cấu hình: ${error.message}`);
        },
    });

    // Mutation for deleting a shipping setting
    const deleteShippingSettingMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabaseClient
                .from('shipping_settings')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return true;
        },
        onSuccess: () => {
            toast.success('Xóa cấu hình vận chuyển thành công!');
            queryClient.invalidateQueries({ queryKey: ['shippingSettings'] });
        },
        onError: (error) => {
            toast.error(`Lỗi khi xóa cấu hình: ${error.message}`);
        },
    });

    const resetForm = () => {
        setEditingSetting(null);
        setIsAddingNew(false);
        setMethodName('');
        setIsEnabled(false);
        setPrice(null);
        setFreeOverAmount(null);
        setEstimatedDeliveryTime('');
        setAdditionalConfig('{}');
    };

    const handleEdit = (setting: ShippingSetting) => {
        setEditingSetting(setting);
        setIsAddingNew(false);
        setMethodName(setting.method_name);
        setIsEnabled(setting.is_enabled);
        setPrice(setting.price || null);
        setFreeOverAmount(setting.free_over_amount || null);
        setEstimatedDeliveryTime(setting.estimated_delivery_time || '');
        setAdditionalConfig(JSON.stringify(setting.additional_config || {}, null, 2));
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa cấu hình vận chuyển này không?')) {
            deleteShippingSettingMutation.mutate(id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const parsedAdditionalConfig = JSON.parse(additionalConfig);
            const newSetting: Partial<ShippingSetting> = {
                method_name: methodName,
                is_enabled: isEnabled,
                price: price,
                free_over_amount: freeOverAmount,
                estimated_delivery_time: estimatedDeliveryTime,
                additional_config: parsedAdditionalConfig,
            };

            if (editingSetting) {
                newSetting.id = editingSetting.id;
            }

            saveShippingSettingMutation.mutate(newSetting);
        } catch (error: any) {
            toast.error(`Lỗi định dạng JSON trong cấu hình bổ sung: ${error.message}`);
        }
    };

    // Render Logic
    if (isLoadingSession || isLoadingProfile || isLoadingShippingSettings) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                {isLoadingSession ? "Đang tải phiên đăng nhập..." : isLoadingProfile ? "Đang kiểm tra quyền..." : "Đang tải cấu hình vận chuyển..."}
            </div>
        );
    }

    if (userRole !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-red-500">
                Bạn không có quyền truy cập trang cấu hình vận chuyển.
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Cấu hình Vận chuyển</h1>

            {/* Form Thêm/Chỉnh sửa */}
            {(isAddingNew || editingSetting) && (
                <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md mb-8">
                    <h2 className="text-2xl font-semibold mb-6 text-gray-800 text-center">
                        {editingSetting ? 'Chỉnh sửa Phương thức Vận chuyển' : 'Thêm Phương thức Vận chuyển Mới'}
                    </h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label htmlFor="methodName" className="block text-gray-700 text-sm font-bold mb-2">Tên Phương thức:</label>
                            <input
                                type="text"
                                id="methodName"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={methodName}
                                onChange={(e) => setMethodName(e.target.value)}
                                placeholder="Ví dụ: Giao hàng tiêu chuẩn, Giao hàng nhanh"
                                required
                                disabled={!!editingSetting} // Không cho phép sửa tên method khi chỉnh sửa
                            />
                        </div>

                        <div className="mb-4 flex items-center">
                            <input
                                type="checkbox"
                                id="isEnabled"
                                className="mr-2 leading-tight"
                                checked={isEnabled}
                                onChange={(e) => setIsEnabled(e.target.checked)}
                            />
                            <label htmlFor="isEnabled" className="text-gray-700 text-sm font-bold">Kích hoạt</label>
                        </div>

                        <div className="mb-4">
                            <label htmlFor="price" className="block text-gray-700 text-sm font-bold mb-2">Giá:</label>
                            <input
                                type="number"
                                id="price"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={price || ''}
                                onChange={(e) => setPrice(e.target.value === '' ? null : parseFloat(e.target.value))}
                                placeholder="Ví dụ: 30000"
                            />
                        </div>

                        <div className="mb-4">
                            <label htmlFor="freeOverAmount" className="block text-gray-700 text-sm font-bold mb-2">Miễn phí trên:</label>
                            <input
                                type="number"
                                id="freeOverAmount"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={freeOverAmount || ''}
                                onChange={(e) => setFreeOverAmount(e.target.value === '' ? null : parseFloat(e.target.value))}
                                placeholder="Ví dụ: 200000 (để miễn phí vận chuyển cho đơn hàng trên 200.000)"
                            />
                        </div>

                        <div className="mb-4">
                            <label htmlFor="estimatedDeliveryTime" className="block text-gray-700 text-sm font-bold mb-2">Thời gian giao hàng dự kiến:</label>
                            <input
                                type="text"
                                id="estimatedDeliveryTime"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={estimatedDeliveryTime}
                                onChange={(e) => setEstimatedDeliveryTime(e.target.value)}
                                placeholder="Ví dụ: 3-5 ngày làm việc"
                            />
                        </div>

                        <div className="mb-6">
                            <label htmlFor="additionalConfig" className="block text-gray-700 text-sm font-bold mb-2">Cấu hình Bổ sung (JSON):</label>
                            <textarea
                                id="additionalConfig"
                                rows={5}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline font-mono text-xs"
                                value={additionalConfig}
                                onChange={(e) => setAdditionalConfig(e.target.value)}
                                placeholder='{ "api_key": "...", "warehouse_id": "..." }'
                            ></textarea>
                            <p className="text-xs text-gray-500 mt-1">Sử dụng định dạng JSON hợp lệ. Ví dụ: `&lcub;"carrier": "GHN"&rcub;`</p>
                        </div>

                        <div className="flex items-center justify-between">
                            <button
                                type="submit"
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                disabled={saveShippingSettingMutation.isPending}
                            >
                                {saveShippingSettingMutation.isPending ? 'Đang lưu...' : 'Lưu Cấu hình'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="ml-4 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                            >
                                Hủy
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Danh sách các Phương thức Vận chuyển đã cấu hình */}
            {!isAddingNew && !editingSetting && (
                <>
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => setIsAddingNew(true)}
                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                            Thêm Phương thức Vận chuyển Mới
                        </button>
                    </div>

                    <div className="bg-white p-8 rounded-lg shadow-md">
                        {shippingSettings && shippingSettings.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên Phương thức</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kích hoạt</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giá</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Miễn phí trên</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian giao hàng</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cấu hình Bổ sung</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {shippingSettings.map((setting) => (
                                        <tr key={setting.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{setting.method_name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {setting.is_enabled ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                        Có
                                                    </span>
                                                ) : (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                        Không
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{setting.price ? setting.price : 'Miễn phí'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{setting.free_over_amount ? `Trên ${setting.free_over_amount}` : 'Không có'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{setting.estimated_delivery_time || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <pre className="text-xs overflow-x-auto max-w-xs">{JSON.stringify(setting.additional_config || {}, null, 2)}</pre>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleEdit(setting)}
                                                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                                                >
                                                    Chỉnh sửa
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(setting.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    Xóa
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-center text-gray-600">Chưa có cấu hình vận chuyển nào. Hãy thêm một cái!</p>
                        )}
                    </div>

                    <div className="flex justify-start mt-8">
                        <button
                            type="button"
                            onClick={() => router.push('/admin/settings')}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                            Quay lại Cài đặt
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}