// app/admin/settings/payment/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

// Định nghĩa kiểu dữ liệu cho một cấu hình thanh toán
interface PaymentSetting {
    id: string; // UUID
    provider_name: string;
    is_enabled: boolean;
    api_key_public: string | null;
    api_key_secret: string | null;
   additional_config: Record<string, unknown> | null; // Đã sửa lỗi 'any'
}

export default function PaymentSettingsPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const { isLoading: isLoadingSession } = useSessionContext();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [userRole, setUserRole] = useState<'user' | 'admin' | 'staff' | null>(null);
    const [editingSetting, setEditingSetting] = useState<PaymentSetting | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);

    // Form states for new/editing provider
    const [providerName, setProviderName] = useState('');
    const [isEnabled, setIsEnabled] = useState(false);
    const [apiKeyPublic, setApiKeyPublic] = useState('');
    const [apiKeySecret, setApiKeySecret] = useState('');
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

    // Fetch payment settings
    const { data: paymentSettings, isLoading: isLoadingPaymentSettings } = useQuery<PaymentSetting[]>({
        queryKey: ['paymentSettings'],
        queryFn: async () => {
            const { data, error } = await supabaseClient
                .from('payment_settings')
                .select('*');
            if (error) throw error;
            return data;
        },
        enabled: userRole === 'admin',
        staleTime: 1000 * 60 * 5,
    });

    // Mutation for adding/updating a payment setting
    const savePaymentSettingMutation = useMutation({
        mutationFn: async (setting: Partial<PaymentSetting>) => {
            if (setting.id) { // Update existing
                const { data, error } = await supabaseClient
                    .from('payment_settings')
                    .update(setting)
                    .eq('id', setting.id)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            } else { // Insert new
                const { data, error } = await supabaseClient
                    .from('payment_settings')
                    .insert(setting)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            }
        },
        onSuccess: () => {
            toast.success('Lưu cấu hình thanh toán thành công!');
            queryClient.invalidateQueries({ queryKey: ['paymentSettings'] });
            resetForm();
        },
        onError: (error: Error) => { // Đã sửa lỗi 'any'
            toast.error(`Lỗi khi lưu cấu hình: ${error.message}`);
        },
    });

    // Mutation for deleting a payment setting
    const deletePaymentSettingMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabaseClient
                .from('payment_settings')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return true;
        },
        onSuccess: () => {
            toast.success('Xóa cấu hình thanh toán thành công!');
            queryClient.invalidateQueries({ queryKey: ['paymentSettings'] });
        },
        onError: (error: Error) => { // Đã sửa lỗi 'any'
            toast.error(`Lỗi khi xóa cấu hình: ${error.message}`);
        },
    });

    const resetForm = () => {
        setEditingSetting(null);
        setIsAddingNew(false);
        setProviderName('');
        setIsEnabled(false);
        setApiKeyPublic('');
        setApiKeySecret('');
        setAdditionalConfig('{}');
    };

    const handleEdit = (setting: PaymentSetting) => {
        setEditingSetting(setting);
        setIsAddingNew(false); // Không phải thêm mới khi chỉnh sửa
        setProviderName(setting.provider_name);
        setIsEnabled(setting.is_enabled);
        setApiKeyPublic(setting.api_key_public || '');
        setApiKeySecret(setting.api_key_secret || '');
        setAdditionalConfig(JSON.stringify(setting.additional_config || {}, null, 2));
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa cấu hình thanh toán này không?')) {
            deletePaymentSettingMutation.mutate(id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const parsedAdditionalConfig = JSON.parse(additionalConfig);
            const newSetting: Partial<PaymentSetting> = {
                provider_name: providerName,
                is_enabled: isEnabled,
                api_key_public: apiKeyPublic || null,
                api_key_secret: apiKeySecret || null,
                additional_config: parsedAdditionalConfig,
            };

            if (editingSetting) {
                newSetting.id = editingSetting.id;
            }

            savePaymentSettingMutation.mutate(newSetting);
        } catch (error) { // Đã sửa lỗi 'any' và thêm kiểm tra
            if (error instanceof Error) {
                toast.error(`Lỗi định dạng JSON trong cấu hình bổ sung: ${error.message}`);
            } else {
                toast.error('Lỗi định dạng JSON không xác định.');
            }
        }
    };

    // Render Logic
    if (isLoadingSession || isLoadingProfile || isLoadingPaymentSettings) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                {isLoadingSession ? "Đang tải phiên đăng nhập..." : isLoadingProfile ? "Đang kiểm tra quyền..." : "Đang tải cấu hình thanh toán..."}
            </div>
        );
    }

    if (userRole !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-red-500">
                Bạn không có quyền truy cập trang cấu hình thanh toán.
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Cấu hình Thanh toán</h1>

            {/* Form Thêm/Chỉnh sửa */}
            {(isAddingNew || editingSetting) && (
                <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md mb-8">
                    <h2 className="text-2xl font-semibold mb-6 text-gray-800 text-center">
                        {editingSetting ? 'Chỉnh sửa Cổng Thanh toán' : 'Thêm Cổng Thanh toán Mới'}
                    </h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label htmlFor="providerName" className="block text-gray-700 text-sm font-bold mb-2">Tên Cổng Thanh toán:</label>
                            <input
                                type="text"
                                id="providerName"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={providerName}
                                onChange={(e) => setProviderName(e.target.value)}
                                placeholder="Ví dụ: Stripe, PayPal, VNPAY"
                                required
                                disabled={!!editingSetting} // Không cho phép sửa tên provider khi chỉnh sửa
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
                            <label htmlFor="apiKeyPublic" className="block text-gray-700 text-sm font-bold mb-2">API Key Public:</label>
                            <input
                                type="text"
                                id="apiKeyPublic"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={apiKeyPublic}
                                onChange={(e) => setApiKeyPublic(e.target.value)}
                                placeholder="pk_live_..."
                            />
                        </div>

                        <div className="mb-6">
                            <label htmlFor="apiKeySecret" className="block text-gray-700 text-sm font-bold mb-2">API Key Secret:</label>
                            <input
                                type="password" // Sử dụng type="password" để ẩn giá trị
                                id="apiKeySecret"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={apiKeySecret}
                                onChange={(e) => setApiKeySecret(e.target.value)}
                                placeholder="sk_live_..."
                            />
                            <p className="text-xs text-gray-500 mt-1">Lưu ý: Khóa bí mật nhạy cảm và cần được bảo vệ cẩn thận.</p>
                        </div>

                        <div className="mb-6">
                            <label htmlFor="additionalConfig" className="block text-gray-700 text-sm font-bold mb-2">Cấu hình Bổ sung (JSON):</label>
                            <textarea
                                id="additionalConfig"
                                rows={5}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline font-mono text-xs"
                                value={additionalConfig}
                                onChange={(e) => setAdditionalConfig(e.target.value)}
                                placeholder='{ &quot;webhook_secret&quot;: &quot;whsec_...&quot;, &quot;merchant_id&quot;: &quot;your_merchant_id&quot; }' // Đã sửa lỗi no-unescaped-entities
                            ></textarea>
                            <p className="text-xs text-gray-500 mt-1">Sử dụng định dạng JSON hợp lệ. Ví dụ: `&lcub;&quot;currency&quot; : &quot;VND&quot;&rcub;`</p> {/* Đã sửa lỗi no-unescaped-entities và Unexpected token */}
                        </div>


                        <div className="flex items-center justify-between">
                            <button
                                type="submit"
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                disabled={savePaymentSettingMutation.isPending}
                            >
                                {savePaymentSettingMutation.isPending ? 'Đang lưu...' : 'Lưu Cấu hình'}
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

            {/* Danh sách các Cổng Thanh toán đã cấu hình */}
            {!isAddingNew && !editingSetting && (
                <>
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => setIsAddingNew(true)}
                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                            Thêm Cổng Thanh toán Mới
                        </button>
                    </div>

                    <div className="bg-white p-8 rounded-lg shadow-md">
                        {paymentSettings && paymentSettings.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên Cổng</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kích hoạt</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Public</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cấu hình Bổ sung</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {paymentSettings.map((setting) => (
                                        <tr key={setting.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{setting.provider_name}</td>
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
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{setting.api_key_public ? `${setting.api_key_public.substring(0, 10)}...` : 'N/A'}</td>
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
                            <p className="text-center text-gray-600">Chưa có cấu hình thanh toán nào. Hãy thêm một cái!</p>
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