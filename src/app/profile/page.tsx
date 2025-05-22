"use client";
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Import the existing Navbar component
import Navbar from '@/components/Navbar'; // Assuming this path is correct based on your project structure

// Make sure to include Font Awesome in your project's HTML file (e.g., public/index.html or _document.tsx for Next.js)
// Example CDN link in <head>: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"></link>

interface Profile {
    full_name: string | null;
    phone: string | null;
    address: string | null;
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

    const [profileData, setProfileData] = useState<Profile>({ full_name: null, phone: null, address: null });
    const [originalProfileData, setOriginalProfileData] = useState<Profile>({ full_name: null, phone: null, address: null }); // To revert changes
    const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
    const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    // States for edit modes
    const [isProfileEditMode, setIsProfileEditMode] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false); // State to control password change modal
    const [showOrders, setShowOrders] = useState(false); // New state for showing/hiding orders

    // New states for password change
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

    // Effect to determine auth loading status
    useEffect(() => {
        if (user !== undefined) {
            setLoadingAuth(false);
        }
    }, [user]);

    // Fetch profile data using useQuery
    const { data: fetchedProfile, isLoading: isLoadingProfile, error: profileError } = useQuery<Profile | null, Error>({
        queryKey: ['userProfile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('full_name, phone, address')
                .eq('id', user.id)
                .single();
            if (error) throw error;
            return data as Profile;
        },
        enabled: !!user?.id && !loadingAuth,
        staleTime: 1000 * 60 * 5,
    });

    // Effect to update profileData and originalProfileData when fetchedProfile changes
    useEffect(() => {
        if (fetchedProfile) {
            setProfileData(fetchedProfile);
            setOriginalProfileData(fetchedProfile); // Store original for revert
        }
    }, [fetchedProfile]);

    // Fetch user orders using useQuery
    const { data: userOrders, isLoading: isLoadingOrders, error: ordersError } = useQuery<Order[], Error>({
        queryKey: ['userOrders', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabaseClient
                .from('orders')
                .select(`
                    id,
                    user_id,
                    total_amount,
                    payment_status,
                    created_at,
                    expires_at,
                    order_items (
                        id,
                        order_id,
                        product_id,
                        quantity,
                        product_price,
                        product_name,
                        product_image
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as unknown as Order[];
        },
        enabled: !!user?.id && !loadingAuth,
        staleTime: 1000 * 60,
    });

    // Real-time listener for order changes
    useEffect(() => {
        if (!user?.id || loadingAuth) return;

        const channel = supabaseClient
            .channel(`public:orders:user_id=eq.${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: ['userOrders', user.id] });
                }
            )
            .subscribe();

        return () => {
            supabaseClient.removeChannel(channel);
        };
    }, [user?.id, supabaseClient, queryClient, loadingAuth]);

    // Handle profile update
    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingProfile(true);
        setMessage(null);

        const { error } = await supabaseClient
            .from('profiles')
            .upsert({ id: user?.id, ...profileData });

        setIsSubmittingProfile(false);

        if (error) {
            setMessage({ type: 'error', text: 'Cập nhật thông tin cá nhân thất bại: ' + error.message });
        } else {
            setMessage({ type: 'success', text: 'Thông tin cá nhân đã được cập nhật thành công!' });
            queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id] });
            setIsProfileEditMode(false); // Exit edit mode on success
        }
    };

    // Handle password change
    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingPassword(true);
        setMessage(null);

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Mật khẩu mới và xác nhận mật khẩu không khớp.' });
            setIsSubmittingPassword(false);
            return;
        }

        if (newPassword.length < 6) { // Supabase default minimum password length
            setMessage({ type: 'error', text: 'Mật khẩu phải có ít nhất 6 ký tự.' });
            setIsSubmittingPassword(false);
            return;
        }

        const { error } = await supabaseClient.auth.updateUser({
            password: newPassword,
        });

        setIsSubmittingPassword(false);
        setNewPassword(''); // Clear fields
        setConfirmPassword(''); // Clear fields

        if (error) {
            setMessage({ type: 'error', text: 'Thay đổi mật khẩu thất bại: ' + error.message });
        } else {
            setMessage({ type: 'success', text: 'Mật khẩu đã được thay đổi thành công!' });
            setIsPasswordModalOpen(false); // Close modal on success
        }
    };

    // Handle order details dialog
    const handleViewOrderDetails = (order: Order) => {
        setSelectedOrder(order);
        setIsOrderDetailsDialogOpen(true);
    };

    const handleCloseOrderDetailsDialog = () => {
        setIsOrderDetailsDialogOpen(false);
        setSelectedOrder(null);
    };

    // Function to close password change modal and clear fields
    const closePasswordModal = useCallback(() => {
        setIsPasswordModalOpen(false);
        setNewPassword('');
        setConfirmPassword('');
        setMessage(null); // Clear any previous messages
    }, []);

    // Effect to automatically hide the message after 3 seconds
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                setMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // Redirect to login if not logged in, but only after auth check is complete
    useEffect(() => {
        if (!loadingAuth && !user) {
            router.push(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
        }
    }, [loadingAuth, user, router]);

    // Function to enter profile edit mode
    const enterProfileEditMode = useCallback(() => {
        setIsProfileEditMode(true);
        // Ensure profileData is reset to original fetched data when entering edit mode
        if (fetchedProfile) {
            setProfileData(fetchedProfile);
            setOriginalProfileData(fetchedProfile);
        }
    }, [fetchedProfile]);

    // Function to cancel profile edit mode
    const cancelProfileEditMode = useCallback(() => {
        setIsProfileEditMode(false);
        setProfileData(originalProfileData); // Revert to original data
    }, [originalProfileData]);

    // Function to toggle order visibility
    const toggleOrderVisibility = useCallback(() => {
        setShowOrders(prev => !prev);
    }, []);

    // Initial loading state for authentication
    if (loadingAuth) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="text-lg text-gray-700">Đang kiểm tra trạng thái đăng nhập...</div>
            </div>
        );
    }

    // If auth check is complete and user is still null, it means not logged in.
    // The previous useEffect will handle the redirect, but this ensures no content is rendered.
    if (!user) {
        return null;
    }

    // Rest of the component render
    if (isLoadingProfile || isLoadingOrders) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="text-lg text-gray-700">Đang tải thông tin...</div>
            </div>
        );
    }

    if (profileError) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="text-red-500 text-lg">Lỗi tải thông tin cá nhân: {profileError.message}</div>
            </div>
        );
    }

    if (ordersError) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="text-red-500 text-lg">Lỗi tải đơn hàng: {ordersError.message}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
            <h1 className="text-4xl font-extrabold mb-8 text-center text-gray-900">Thông tin tài khoản của bạn</h1>

            {message && (
                <div
                    className={`fixed top-6 right-6 p-4 rounded-lg shadow-xl text-white z-50 transition-opacity duration-300 ease-in-out
                        ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
                    role="alert"
                >
                    <div className="flex items-center justify-between">
                        <span className="font-semibold">{message.text}</span>
                        <button onClick={() => setMessage(null)} className="ml-4 text-white text-xl font-bold opacity-75 hover:opacity-100 transition-opacity">
                            &times;
                        </button>
                    </div>
                </div>
            )}

            {/* Action Icons Section */}
            <div className="flex justify-center gap-8 mb-8 flex-wrap"> {/* Added flex-wrap for responsiveness */}
                {/* Icon for Change Profile */}
                <button
                    onClick={enterProfileEditMode}
                    className="flex flex-col items-center text-blue-600 hover:text-blue-800 transition-colors duration-150 p-2 rounded-lg hover:bg-blue-100"
                >
                    <i className="fas fa-user-edit text-4xl mb-2"></i>
                    <span className="text-sm font-semibold text-center">Thay đổi thông tin cá nhân</span>
                </button>

                {/* Icon for Change Password */}
                <button
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="flex flex-col items-center text-green-600 hover:text-green-800 transition-colors duration-150 p-2 rounded-lg hover:bg-green-100"
                >
                    <i className="fas fa-key text-4xl mb-2"></i>
                    <span className="text-sm font-semibold text-center">Thay đổi mật khẩu</span>
                </button>

                {/* Icon for Your Orders */}
                <button
                    onClick={toggleOrderVisibility}
                    className="flex flex-col items-center text-purple-600 hover:text-purple-800 transition-colors duration-150 p-2 rounded-lg hover:bg-purple-100"
                >
                    <i className="fas fa-shopping-bag text-4xl mb-2"></i>
                    <span className="text-sm font-semibold text-center">Đơn hàng của bạn</span>
                </button>
            </div>

            {/* Profile Section - Centered */}
            <div className="flex justify-center mb-8">
                <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 w-full max-w-lg">
                    <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Thông tin cá nhân</h2>
                    {!isProfileEditMode ? (
                        <div>
                            <div className="mb-4">
                                <p className="text-gray-600 text-sm font-semibold mb-2">Họ và tên:</p>
                                <p className="text-blue-700 text-xl font-bold">{profileData.full_name || 'Chưa cập nhật'}</p>
                            </div>
                            <div className="mb-4">
                                <p className="text-gray-600 text-sm font-semibold mb-2">Số điện thoại:</p>
                                <p className="text-blue-700 text-xl font-bold">{profileData.phone || 'Chưa cập nhật'}</p>
                            </div>
                            <div className="mb-6">
                                <p className="text-gray-600 text-sm font-semibold mb-2">Địa chỉ:</p>
                                <p className="text-blue-700 text-xl font-bold">{profileData.address || 'Chưa cập nhật'}</p>
                            </div>
                            {/* Removed redundant buttons here, as they are now icons above */}
                        </div>
                    ) : (
                        <form onSubmit={handleUpdateProfile}>
                            <div className="mb-5">
                                <label htmlFor="full_name" className="block text-gray-700 text-base font-semibold mb-2">
                                    Họ và tên
                                </label>
                                <input
                                    id="full_name"
                                    type="text"
                                    className="shadow-sm appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out"
                                    value={profileData.full_name || ''}
                                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                                />
                            </div>
                            <div className="mb-5">
                                <label htmlFor="phone" className="block text-gray-700 text-base font-semibold mb-2">
                                    Số điện thoại
                                </label>
                                <input
                                    id="phone"
                                    type="text"
                                    className="shadow-sm appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out"
                                    value={profileData.phone || ''}
                                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                />
                            </div>
                            <div className="mb-7">
                                <label htmlFor="address" className="block text-gray-700 text-base font-semibold mb-2">
                                    Địa chỉ
                                </label>
                                <textarea
                                    id="address"
                                    className="shadow-sm appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] resize-y transition duration-150 ease-in-out"
                                    value={profileData.address || ''}
                                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="submit"
                                    className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 w-full transition duration-150 ease-in-out ${isSubmittingProfile ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    disabled={isSubmittingProfile}
                                >
                                    {isSubmittingProfile ? 'Đang lưu...' : 'Lưu thông tin'}
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelProfileEditMode}
                                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75 w-full transition duration-150 ease-in-out"
                                >
                                    Hủy
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Order History Section - Conditional display */}
            {showOrders && (
                <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 mt-8"> {/* Added mt-8 for spacing */}
                    <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Lịch sử đơn hàng</h2>
                    {userOrders && userOrders.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID Đơn hàng</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Ngày đặt</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tổng tiền</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Trạng thái</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {userOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-100 ease-in-out">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">...{order.id.substring(order.id.length - 10)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{new Date(order.created_at).toLocaleString('vi-VN')}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold">{order.total_amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                    ${order.payment_status === 'completed' || order.payment_status === 'paid' || order.payment_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                      order.payment_status === 'pending_online' || order.payment_status === 'unconfirmed_cod' ? 'bg-yellow-100 text-yellow-800' :
                                                      'bg-red-100 text-red-800'}`}>
                                                    {translatePaymentStatus(order.payment_status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <button
                                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors duration-150 ease-in-out"
                                                    onClick={() => handleViewOrderDetails(order)}
                                                >
                                                    Xem chi tiết
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-600 text-center py-4">Bạn chưa có đơn hàng nào.</p>
                    )}
                </div>
            )}

            {/* Password Change Modal */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto transform scale-95 transition-transform duration-200 ease-out">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Thay đổi mật khẩu</h2>
                            <button onClick={closePasswordModal} className="text-gray-500 hover:text-gray-700 text-3xl font-bold transition-colors duration-150">
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleChangePassword}>
                            <div className="mb-5">
                                <label htmlFor="new_password_modal" className="block text-gray-700 text-base font-semibold mb-2">
                                    Mật khẩu mới
                                </label>
                                <input
                                    id="new_password_modal"
                                    type="password"
                                    className="shadow-sm appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-150 ease-in-out"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-7">
                                <label htmlFor="confirm_password_modal" className="block text-gray-700 text-base font-semibold mb-2">
                                    Xác nhận mật khẩu mới
                                </label>
                                <input
                                    id="confirm_password_modal"
                                    type="password"
                                    className="shadow-sm appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-800 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-150 ease-in-out"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="submit"
                                    className={`bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 w-full transition duration-150 ease-in-out ${isSubmittingPassword ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    disabled={isSubmittingPassword}
                                >
                                    {isSubmittingPassword ? 'Đang thay đổi...' : 'Thay đổi mật khẩu'}
                                </button>
                                <button
                                    type="button"
                                    onClick={closePasswordModal}
                                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75 w-full transition duration-150 ease-in-out"
                                >
                                    Hủy
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Order Details Dialog (Custom Modal) */}
            {isOrderDetailsDialogOpen && selectedOrder && (
                <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform scale-95 transition-transform duration-200 ease-out">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Chi tiết đơn hàng <span className="font-mono text-gray-600">#{selectedOrder.id.substring(selectedOrder.id.length - 10)}</span></h2>
                            <button onClick={handleCloseOrderDetailsDialog} className="text-gray-500 hover:text-gray-700 text-3xl font-bold transition-colors duration-150">
                                &times;
                            </button>
                        </div>
                        <div className="mb-6 text-gray-700 space-y-2">
                            <p><strong>Ngày đặt:</strong> {new Date(selectedOrder.created_at).toLocaleString('vi-VN')}</p>
                            <p><strong>Tổng tiền:</strong> <span className="font-semibold text-green-700">{selectedOrder.total_amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</span></p>
                            <p><strong>Trạng thái thanh toán:</strong> <span className="font-semibold">{translatePaymentStatus(selectedOrder.payment_status)}</span></p>
                            {selectedOrder.expires_at && (
                                <p><strong>Ngày hết hạn:</strong> {new Date(selectedOrder.expires_at).toLocaleString('vi-VN')}</p>
                            )}
                        </div>
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Sản phẩm:</h3>
                        <ul className="space-y-4">
                            {selectedOrder.order_items.map((item) => (
                                <li key={item.id} className="flex items-center border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                                    {item.product_image && (
                                        <img
                                            src={item.product_image}
                                            alt={item.product_name}
                                            className="h-16 w-16 object-cover rounded-lg mr-4 flex-shrink-0 shadow-sm"
                                            onError={(e) => { e.currentTarget.src = `https://placehold.co/64x64/E0E0E0/333333?text=No+Image`; }}
                                        />
                                    )}
                                    <div className="flex-grow">
                                        <p className="font-medium text-gray-900 text-lg">{item.product_name} <span className="text-gray-600">x {item.quantity}</span></p>
                                        <p className="text-md text-gray-700 font-medium">
                                            {item.product_price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-8 flex justify-end">
                            <button
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75 transition duration-150 ease-in-out"
                                onClick={handleCloseOrderDetailsDialog}
                            >
                                Đóng
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
            <Navbar /> {/* Render the imported Navbar component here */}
            <ProfileContent />
        </Suspense>
    );
}
