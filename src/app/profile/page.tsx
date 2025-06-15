// app/profile/page.tsx
"use client";
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Define Profile and other interfaces outside component
interface Profile {
    full_name: string | null;
    phone: string | null;
    address: string | null;
    role: 'user' | 'admin' | 'staff' | null;
}

interface Order {
    id: string;
    user_id: string;
    total_amount: number;
    payment_status: 'unconfirmed_cod' | 'pending_online' | 'confirmed' | 'paid' | 'failed' | 'refunded' | 'completed';
    created_at: string;
    expires_at: string | null;
    order_items: OrderItem[];
}

interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    quantity: number;
    product_price: number;
    product_name: string;
    product_image: string | null;
}

const translatePaymentStatus = (status: Order['payment_status']): string => {
    switch (status) {
        case 'unconfirmed_cod':
            return 'Chờ xác nhận (COD)';
        case 'pending_online':
            return 'Chờ thanh toán trực tuyến';
        case 'confirmed':
            return 'Đã xác nhận';
        case 'paid':
            return 'Đã thanh toán';
        case 'failed':
            return 'Thất bại';
        case 'refunded':
            return 'Đã hoàn tiền';
        case 'completed':
            return 'Hoàn thành';
        default:
            return status;
    }
};

function ProfileContent() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { isLoading: isLoadingSession } = useSessionContext();

    const [editing, setEditing] = useState(false);
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Fetch profile data
    const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery<Profile | null, Error>({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user) return null; // If no user, fetch returns null
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('full_name, phone, address, role')
                .eq('id', user.id)
                .single();
            if (error) {
                // If profile doesn't exist (PGRST116), return null to indicate no profile found
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error; // Other errors should be thrown
            }
            return data;
        },
        enabled: !!user && !isLoadingSession, // Query runs only if user is logged in and session is loaded
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Fetch orders data
    const { data: orders, isLoading: isLoadingOrders, error: ordersError } = useQuery<Order[], Error>({
        queryKey: ['orders', user?.id],
        queryFn: async () => {
            if (!user) throw new Error('User not logged in.');
            const { data, error } = await supabaseClient
                .from('orders')
                .select(`
                    *,
                    order_items (
                        id, product_id, quantity, product_price, product_name, product_image
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!user && !isLoadingSession,
        staleTime: 1000 * 60 * 2, // 2 minutes
    });

    // Update form fields when profile data changes
    useEffect(() => {
        if (profile) { // Check if profile is not null/undefined before accessing its properties
            setFullName(profile.full_name || '');
            setPhone(profile.phone || '');
            setAddress(profile.address || '');
        }
    }, [profile]);

    // Handle initial loading and redirection logic
    useEffect(() => {
        if (!isLoadingSession && !user) {
            toast.info('Bạn cần đăng nhập để xem trang này.');
            router.replace('/login');
        } else if (!isLoadingSession && user && !isLoadingProfile) {
            if (profile === undefined) {
                console.warn("Unexpected: profile is undefined after isLoadingProfile is false.");
                return;
            }

            if (!profile || !profile.full_name || !profile.phone || !profile.address) {
                if (profile?.role === 'user' || !profile?.role) {
                    toast.info('Vui lòng hoàn tất thông tin cá nhân của bạn.');
                    router.replace('/profile-setup');
                }
            } else if (profile.role && (profile.role === 'admin' || profile.role === 'staff')) {
                toast.info('Bạn là quản trị viên/nhân viên. Đang chuyển hướng đến khu vực quản trị.');
                router.replace('/admin/dashboard');
            }
        }
    }, [isLoadingSession, user, isLoadingProfile, profile, router]);


    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (!user) throw new Error('User not logged in.');

            const updates: Partial<Profile> = {
                full_name: fullName.trim(),
                phone: phone.trim(),
                address: address.trim(),
            };

            const { error } = await supabaseClient
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
            setEditing(false);
            toast.success('Cập nhật profile thành công!');
        } catch (error: any) {
            console.error('Lỗi khi cập nhật profile:', error.message);
            toast.error('Lỗi khi cập nhật profile: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenOrderDetailsDialog = useCallback((order: Order) => {
        setSelectedOrder(order);
    }, []);

    const handleCloseOrderDetailsDialog = useCallback(() => {
        setSelectedOrder(null);
    }, []);

    // --- CORE RENDERING LOGIC AND TYPE NARROWING ---

    // 1. Handle initial loading states
    if (isLoadingSession || !user || isLoadingProfile) {
        return (
            <div className="flex justify-center items-center min-h-screen text-lg text-gray-700">
                {isLoadingSession ? "Đang tải phiên đăng nhập..." : "Đang tải thông tin profile..."}
            </div>
        );
    }

    // 2. Handle 'profile' being `undefined` (should not happen if isLoadingProfile is false)
    if (profile === undefined) {
        console.error("Critical Error: 'profile' is undefined after isLoadingProfile is false. This should not happen.");
        return (
            <div className="flex justify-center items-center min-h-screen text-lg text-red-500">
                Đã xảy ra lỗi không mong muốn khi tải profile. Vui lòng thử lại.
            </div>
        );
    }

    // Now, TypeScript knows `profile` is of type `Profile | null`.

    // 3. Handle 'profile' being `null` (no profile found for the user)
    if (profile === null) {
        return null; // Redirection to /profile-setup is handled by useEffect
    }

    // Now, TypeScript knows `profile` is of type `Profile`.

    // 4. Handle role-based redirection (admin/staff)
    if (profile.role && (profile.role === 'admin' || profile.role === 'staff')) {
        return null; // Redirection to /admin/dashboard is handled by useEffect
    }

    // 5. Handle incomplete profile (missing full_name, phone, address)
    if (!profile.full_name || !profile.phone || !profile.address) {
        console.warn("Incomplete profile detected, should have redirected.");
        return null; // Redirection to /profile-setup is handled by useEffect
    }

    // ***** FINAL TYPE NARROWING FOR RENDERING *****
    // At this point, we are certain that `profile` is a complete Profile object.
    type NonNullableProfile = Profile & {
        full_name: string;
        phone: string;
        address: string;
        role: 'user' | null; // Keep role as 'user' | null
    };
    const currentUserProfile: NonNullableProfile = profile as NonNullableProfile;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">Thông tin cá nhân của bạn</h1>

            {/* Profile Section */}
            <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-2xl font-semibold text-gray-700 flex items-center">
                        <i className="fas fa-user text-blue-500 mr-3 text-2xl"></i>Thông tin cơ bản
                    </h2>
                    {!editing ? (
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center"
                        >
                            <i className="fas fa-edit mr-2"></i>Chỉnh sửa
                        </button>
                    ) : (
                        <div className="flex space-x-3">
                            <button
                                type="button"
                                onClick={() => { setEditing(false); /* Reset fields if needed */ }}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center"
                                disabled={isSaving}
                            >
                                <i className="fas fa-times mr-2"></i>Hủy
                            </button>
                            <button
                                type="submit"
                                onClick={handleUpdateProfile}
                                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                disabled={isSaving}
                            >
                                <i className="fas fa-save mr-2"></i>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    )}
                </div>

                <form onSubmit={handleUpdateProfile}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Full Name */}
                        <div className="flex items-center bg-gray-50 p-3 rounded-lg shadow-sm">
                            <i className="fas fa-user text-gray-600 mr-3 text-xl"></i>
                            <div className="flex-1">
                                <label htmlFor="fullName" className="block text-gray-700 text-sm font-semibold mb-1">Tên đầy đủ:</label>
                                {editing ? (
                                    <input
                                        type="text"
                                        id="fullName"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                ) : (
                                    <p className="text-lg text-gray-900 font-medium">{currentUserProfile.full_name}</p>
                                )}
                            </div>
                        </div>

                        {/* Email */}
                        <div className="flex items-center bg-gray-50 p-3 rounded-lg shadow-sm">
                            <i className="fas fa-envelope text-gray-600 mr-3 text-xl"></i>
                            <div className="flex-1">
                                <label htmlFor="email" className="block text-gray-700 text-sm font-semibold mb-1">Email:</label>
                                <p className="text-lg text-gray-900 font-medium">{user?.email}</p>
                            </div>
                        </div>

                        {/* Phone Number */}
                        <div className="flex items-center bg-gray-50 p-3 rounded-lg shadow-sm">
                            <i className="fas fa-phone text-gray-600 mr-3 text-xl"></i>
                            <div className="flex-1">
                                <label htmlFor="phone" className="block text-gray-700 text-sm font-semibold mb-1">Số điện thoại:</label>
                                {editing ? (
                                    <input
                                        type="tel"
                                        id="phone"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                ) : (
                                    <p className="text-lg text-gray-900 font-medium">{currentUserProfile.phone}</p>
                                )}
                            </div>
                        </div>

                        {/* Address */}
                        <div className="flex items-center bg-gray-50 p-3 rounded-lg shadow-sm">
                            <i className="fas fa-map-marker-alt text-gray-600 mr-3 text-xl"></i>
                            <div className="flex-1">
                                <label htmlFor="address" className="block text-gray-700 text-sm font-semibold mb-1">Địa chỉ:</label>
                                {editing ? (
                                    <input
                                        type="text"
                                        id="address"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                ) : (
                                    <p className="text-lg text-gray-900 font-medium">{currentUserProfile.address}</p>
                                )}
                            </div>
                        </div>
                    </div>
                    {editing && (
                        <button type="submit" hidden aria-hidden="true"></button>
                    )}
                </form>

                {/* New Password Change Section */}
                <div className="mt-6 border-t pt-4">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                        <i className="fas fa-lock text-blue-500 mr-2 text-xl"></i>Bảo mật tài khoản
                    </h3>
                    <p className="text-gray-600 mb-4">Bạn có thể thay đổi mật khẩu của mình để bảo mật tài khoản tốt hơn.</p>
                    <button
                        onClick={() => router.push('/update-password')}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center"
                    >
                        <i className="fas fa-key mr-2"></i>Đổi mật khẩu
                    </button>
                </div>

            </div>

            {/* Order History Section */}
            <div className="bg-white shadow-lg rounded-lg p-6">
                <div className="flex items-center mb-6 border-b pb-4">
                    <h2 className="text-2xl font-semibold text-gray-700 flex items-center">
                        <i className="fas fa-history text-blue-500 mr-3 text-2xl"></i>Lịch sử đơn hàng
                    </h2>
                </div>
                {isLoadingOrders ? (
                    <p className="text-gray-600">Đang tải lịch sử đơn hàng...</p>
                ) : ordersError ? (
                    <p className="text-red-500">Lỗi khi tải đơn hàng: {ordersError.message}</p>
                ) : (
                    <>
                        {orders && orders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã đơn hàng</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày đặt</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng tiền</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {orders.map((order) => (
                                            <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{order.id.substring(0, 8)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(order.created_at).toLocaleDateString('vi-VN')}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.total_amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                        ${order.payment_status === 'completed' || order.payment_status === 'paid' || order.payment_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                        order.payment_status === 'failed' || order.payment_status === 'refunded' ? 'bg-red-100 text-red-800' :
                                                        'bg-yellow-100 text-yellow-800'}`}>
                                                        {translatePaymentStatus(order.payment_status)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <button
                                                        onClick={() => handleOpenOrderDetailsDialog(order)}
                                                        className="text-indigo-600 hover:text-indigo-900 flex items-center"
                                                    >
                                                        <i className="fas fa-eye mr-1"></i>Xem chi tiết
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-600 flex items-center">
                                <i className="fas fa-shopping-bag text-blue-500 mr-2 text-xl"></i>Bạn chưa có đơn hàng nào.
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* Order Details Dialog */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
                            <i className="fas fa-shopping-bag mr-3 text-blue-500"></i>Chi tiết đơn hàng #<span className="font-mono text-gray-600">{selectedOrder.id.substring(0, 8)}</span>
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-lg">
                            <div className="flex items-center text-gray-700">
                                <i className="fas fa-calendar-alt mr-2 text-blue-500"></i>
                                <strong>Ngày đặt:</strong> {new Date(selectedOrder.created_at).toLocaleDateString('vi-VN')}
                            </div>
                            <div className="flex items-center text-gray-700">
                                <i className="fas fa-money-bill-wave mr-2 text-green-500"></i>
                                <strong>Tổng tiền:</strong> {selectedOrder.total_amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                            </div>
                            <div className="flex items-center text-gray-700">
                                <i className="fas fa-info-circle mr-2 text-purple-500"></i>
                                <strong>Trạng thái:</strong> <span className={`ml-1 px-2 inline-flex text-sm leading-5 font-semibold rounded-full
                                    ${selectedOrder.payment_status === 'completed' || selectedOrder.payment_status === 'paid' || selectedOrder.payment_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                    selectedOrder.payment_status === 'failed' || selectedOrder.payment_status === 'refunded' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'}`}>
                                    {translatePaymentStatus(selectedOrder.payment_status)}
                                </span>
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-3 flex items-center border-t pt-4">
                            <i className="fas fa-box-open mr-2 text-orange-500"></i>Sản phẩm:
                        </h3>
                        <ul className="space-y-4">
                            {selectedOrder.order_items.map((item) => (
                                <li key={item.id} className="flex items-center space-x-4 p-3 border rounded-lg bg-gray-50 hover:shadow-md transition-shadow duration-150">
                                    {item.product_image && (
                                        <img
                                            src={item.product_image}
                                            alt={item.product_name}
                                            className="w-20 h-20 object-cover rounded-md border border-gray-200"
                                        />
                                    )}
                                    <div className="flex-grow">
                                        <p className="font-bold text-gray-900 text-lg">{item.product_name}</p>
                                        <p className="text-md text-gray-700">Số lượng: <span className="font-medium text-blue-600">{item.quantity}</span></p>
                                        <p className="text-md text-gray-700 font-medium">Giá: {item.product_price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>
                                    </div>
                                    <div className="text-right text-lg font-bold text-green-700">
                                        {(item.product_price * item.quantity).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-8 flex justify-end">
                            <button
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75 transition duration-150 ease-in-out flex items-center"
                                onClick={handleCloseOrderDetailsDialog}
                            >
                                <i className="fas fa-times mr-2"></i>Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div>Đang tải trang Profile...</div>}>
            <Navbar />
            <ProfileContent />
        </Suspense>
    );
}