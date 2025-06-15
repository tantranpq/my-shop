"use client";

import { useState, useEffect, useMemo, useRef } from 'react'; // Added useRef
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react'; // Import icons

// --- Định nghĩa Interface cho dữ liệu ---
interface OrderItem {
    product_name: string;
    quantity: number;
    product_price: number;
}

interface Order {
    id: string;
    created_at: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    customer_address: string | null;
    payment_method: string;
    payment_status: string;
    total_amount: number;
    expires_at: string | null; // expires_at for online orders
    order_items: OrderItem[];
}

// Các trạng thái thanh toán thực tế từ database (dùng cho logic và mapping)
// const PAYMENT_STATUSES = ['paid', 'failed', 'refunded', 'pending_online', 'confirmed', 'unconfirmed_cod', 'completed'];

// Các trạng thái có thể cập nhật qua dropdown (giá trị thực tế sẽ được gửi đi)
const UPDATABLE_STATUSES = ['unconfirmed_cod', 'pending_online', 'confirmed', 'paid', 'failed', 'refunded', 'completed'];

// Bản đồ chi tiết trạng thái: văn bản hiển thị và lớp CSS màu sắc
const STATUS_DETAILS: { [key: string]: { text: string; colorClass: string } } = {
    'unconfirmed_cod': { text: 'Chờ xác nhận', colorClass: 'bg-orange-100 text-orange-800' },
    'pending_online': { text: 'Chờ thanh toán', colorClass: 'bg-yellow-100 text-yellow-800' },
    'confirmed': { text: 'Đã xác nhận', colorClass: 'bg-blue-100 text-blue-800' },
    'paid': { text: 'Đã thanh toán', colorClass: 'bg-green-100 text-green-800' },
    'failed': { text: 'Thất bại', colorClass: 'bg-red-100 text-red-800' },
    'refunded': { text: 'Đã hoàn tiền', colorClass: 'bg-gray-100 text-gray-800' },
    'completed': { text: 'Đã hoàn thành', colorClass: 'bg-emerald-100 text-emerald-800' }, // New status
};

// Define filter options for the payment status dropdown to avoid duplicates
const FILTER_STATUS_OPTIONS = [
    { value: 'all', label: 'Tất cả' },
    { value: 'pending_online', label: 'Chờ thanh toán' },
    { value: 'unconfirmed_cod', label: 'Chờ xác nhận' },
    { value: 'paid', label: 'Đã thanh toán' },
    { value: 'confirmed', label: 'Đã xác nhận' },
    { value: 'failed', label: 'Thất bại' },
    { value: 'refunded', label: 'Đã hoàn tiền' },
    { value: 'completed', label: 'Đã hoàn thành' }, // New filter option
];

// Helper function to get the correct value for the dropdown's 'value' prop
const getSelectValueForDropdown = (status: string): string => {
    const normalizedStatus = status.toLowerCase().trim();
    if (normalizedStatus === 'pending_online') {
        return 'pending_online';
    }
    if (normalizedStatus === 'unconfirmed_cod') {
        return 'unconfirmed_cod';
    }
    if (normalizedStatus === 'completed') { // Handle 'completed' status
        return 'completed';
    }
    return status;
};

// --- CountdownTimer Component ---
interface CountdownTimerProps {
    expiresAt: string | null; // ISO string
    paymentMethod: string;
    paymentStatus: string; // Added paymentStatus prop
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ expiresAt, paymentMethod, paymentStatus }) => {
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

    useEffect(() => {
        // Only show countdown for 'online' payment method and if expiresAt is provided
        // Also, stop countdown if paymentStatus is 'paid' or 'completed'
        if (paymentMethod !== 'online' || !expiresAt || paymentStatus === 'paid' || paymentStatus === 'completed') {
            setRemainingSeconds(null); // Reset or hide countdown
            return;
        }

        const expiryDate = new Date(expiresAt);

        const calculateRemaining = () => {
            const now = new Date();
            const diffSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
            setRemainingSeconds(diffSeconds);
        };

        calculateRemaining(); // Initial calculation immediately

        // Update every second
        const timer = setInterval(calculateRemaining, 1000);

        // Cleanup interval on component unmount or prop change
        return () => clearInterval(timer);
    }, [expiresAt, paymentMethod, paymentStatus]); // Re-run effect if expiresAt, paymentMethod, or paymentStatus changes

    // If not an online payment, display N/A
    if (paymentMethod !== 'online') {
        return <span className="text-gray-500">N/A</span>;
    }

    // If paymentStatus is 'paid', display 'Đã thanh toán' (or similar)
    if (paymentStatus === 'paid') {
        return <span className="text-green-600 font-bold">Đã thanh toán</span>;
    }

    // If paymentStatus is 'completed', display 'Đã hoàn thành'
    if (paymentStatus === 'completed') {
        return <span className="text-emerald-600 font-bold">Đã hoàn thành</span>;
    }

    // If remainingSeconds is null (e.g., expiresAt was null initially, or still calculating)
    if (remainingSeconds === null) {
        return <span className="text-gray-500">Đang tính...</span>;
    }

    // If time has run out
    if (remainingSeconds <= 0) {
        return <span className="text-red-600 font-bold">Hết hạn</span>;
    }

    // Format remaining time
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    return (
        <span className="font-medium text-blue-600">
            {formattedMinutes}:{formattedSeconds}
        </span>
    );
};
// --- End CountdownTimer Component ---

// --- MultiSelect Component ---
interface MultiSelectOption {
    value: string;
    label: string;
}

interface MultiSelectProps {
    options: MultiSelectOption[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, selectedValues, onChange, placeholder = "Chọn..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const handleToggleOption = (value: string) => {
        let newSelectedValues: string[];

        if (value === 'all') {
            newSelectedValues = ['all'];
        } else {
            // If 'all' was previously selected, start with only the new value
            if (selectedValues.includes('all')) {
                newSelectedValues = [value];
            } else if (selectedValues.includes(value)) {
                // Deselect the value
                newSelectedValues = selectedValues.filter(v => v !== value);
            } else {
                // Select the value
                newSelectedValues = [...selectedValues, value];
            }

            // If no specific options are selected, default to 'all'
            if (newSelectedValues.length === 0) {
                newSelectedValues = ['all'];
            }
        }
        onChange(newSelectedValues);
    };

    const displayLabel = useMemo(() => {
        if (selectedValues.includes('all') || selectedValues.length === 0) {
            return options.find(opt => opt.value === 'all')?.label || placeholder;
        }
        return selectedValues
            .map(val => options.find(opt => opt.value === val)?.label)
            .filter(Boolean)
            .join(', ');
    }, [selectedValues, options, placeholder]);

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{displayLabel}</span> {/* Added truncate for long labels */}
                {isOpen ? <ChevronUp className="h-4 w-4 ml-2 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />}
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                    {options.map((option) => (
                        <div
                            key={option.value}
                            className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleToggleOption(option.value)}
                        >
                            <input
                                type="checkbox"
                                readOnly // Controlled by onClick
                                checked={selectedValues.includes(option.value)}
                                className="mr-2"
                            />
                            <span>{option.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
// --- End MultiSelect Component ---


export default function AdminOrdersPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const { isLoading: isLoadingSession } = useSessionContext();
    const queryClient = useQueryClient();

    const [userRole, setUserRole] = useState<'user' | 'admin' | 'staff' | null>(null);
    const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<string>>(new Set());
    const [updateError, setUpdateError] = useState<string | null>(null);

    // States cho các giá trị input (cập nhật tức thì khi gõ, dùng để lọc client-side)
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<string[]>(['all']); // Initialize with 'all' selected
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [customerNameInput, setCustomerNameInput] = useState<string>('');
    const [productNameInput, setProductNameInput] = useState<string>(''); // Lọc client-side
    const [orderIdInput, setOrderIdInput] = useState<string>(''); // Lọc client-side
    const [paymentMethodFilter, setPaymentMethodFilter] = useState<string | 'all'>('all'); // New state for payment method filter

    // --- Logic fetch vai trò người dùng và kiểm tra quyền admin ---
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

    // --- Logic fetch TẤT CẢ danh sách đơn hàng (không áp dụng bộ lọc nào từ Supabase) ---
    const {
        data: orders, // Đây là dữ liệu thô từ server, chưa được lọc
        isLoading: isLoadingOrders,
        error: ordersQueryError,
        refetch
    } = useQuery<Order[], Error>({
        queryKey: ['adminOrders'], // QueryKey đơn giản, chỉ kích hoạt khi cần thiết
        queryFn: async () => {
            if (userRole !== 'admin' && userRole !== 'staff') {
                throw new Error('Bạn không có quyền xem đơn hàng.');
            }

            console.log("Fetching all orders as admin with TanStack Query...");
            const { data, error } = await supabaseClient
                .from('orders')
                .select(`
                    id,
                    created_at,
                    customer_name,
                    customer_email,
                    customer_phone,
                    customer_address,
                    payment_method,
                    payment_status,
                    total_amount,
                    expires_at,
                    order_items (
                        product_name,
                        quantity,
                        product_price
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            console.log("Raw orders data from Supabase:", data); // Log raw data
            return data as Order[];
        },
        enabled: (userRole === 'admin'|| userRole === 'staff') && !isLoadingSession && !isLoadingProfile,
        placeholderData: (previousData) => previousData, // Giữ dữ liệu cũ trong khi tải mới
        staleTime: 1000 * 60, // Giữ data fresh trong 1 phút trước khi refetch trên mount/focus
    });

    // --- Hàm xử lý cập nhật trạng thái thanh toán ---
    const handleUpdatePaymentStatus = async (orderId: string, newStatus: string) => {
        if (!user?.id || (userRole !== 'admin' && userRole !== 'staff')) {
            alert('Bạn không có quyền thực hiện thao tác này.');
            return;
        }

        setUpdatingOrderIds(prev => new Set(prev).add(orderId));
        setUpdateError(null);

        const { error: updatePaymentError } = await supabaseClient
            .from('orders')
            .update({ payment_status: newStatus })
            .eq('id', orderId);

        setUpdatingOrderIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(orderId);
            return newSet;
        });

        if (updatePaymentError) {
            console.error('Lỗi khi cập nhật trạng thái thanh toán:', updatePaymentError);
            setUpdateError('Cập nhật trạng thái thất bại: ' + updatePaymentError.message);
        } else {
            queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
            refetch(); // Refetch lại data để cập nhật
        }
    };

    // --- useEffect để lắng nghe Realtime Updates ---
    useEffect(() => {
        if (userRole === 'admin' || userRole === 'staff') {
            const channel = supabaseClient
                .channel('public:orders')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'orders'
                }, (payload) => {
                    console.log('Order change:', payload);
                    refetch(); // Gọi refetch để tải lại dữ liệu mới nhất
                })
                .subscribe();

            return () => {
                channel.unsubscribe();
            };
        }
    }, [userRole, supabaseClient, refetch]);

    // --- Hàm lọc trên client-side bằng useMemo ---
    const filteredOrders = useMemo(() => {
        if (!orders) return [];

        let result = orders;

        // Lọc theo ID đơn hàng (client-side)
        if (orderIdInput) {
            const lowerCaseOrderId = orderIdInput.toLowerCase();
            result = result.filter(order => order.id.toLowerCase().includes(lowerCaseOrderId));
        }

        // Lọc theo trạng thái thanh toán (client-side)
        if (paymentStatusFilter.length > 0 && !paymentStatusFilter.includes('all')) {
            result = result.filter(order => {
                const normalizedOrderStatus = order.payment_status.toLowerCase().trim();
                return paymentStatusFilter.some(filterValue => {
                    return normalizedOrderStatus === filterValue;
                });
            });
        }

        // Lọc theo phương thức thanh toán (client-side)
        if (paymentMethodFilter !== 'all') {
            result = result.filter(order => order.payment_method === paymentMethodFilter);
        }

        // Lọc theo ngày bắt đầu (client-side)
        if (startDate) {
            const start = new Date(startDate);
            result = result.filter(order => new Date(order.created_at) >= start);
        }

        // Lọc theo ngày kết thúc (client-side)
        if (endDate) {
            const end = new Date(endDate);
            result = result.filter(order => new Date(order.created_at) <= end);
        }

        // Lọc theo tên khách hàng (client-side)
        if (customerNameInput) {
            const lowerCaseName = customerNameInput.toLowerCase();
            result = result.filter(order => order.customer_name.toLowerCase().includes(lowerCaseName));
        }

        // Lọc theo tên sản phẩm (client-side)
        if (productNameInput) {
            const lowerCaseProductName = productNameInput.toLowerCase();
            result = result.filter(order =>
                order.order_items.some(item => item.product_name.toLowerCase().includes(lowerCaseProductName))
            );
        }
        console.log("Filtered orders data for rendering:", result); // Log filtered data
        return result;
    }, [orders, orderIdInput, paymentStatusFilter, paymentMethodFilter, startDate, endDate, customerNameInput, productNameInput]);

    // Extract unique payment methods for the filter dropdown
    const uniquePaymentMethods = useMemo(() => {
        if (!orders) return [];
        const methods = new Set<string>();
        orders.forEach(order => methods.add(order.payment_method));
        return Array.from(methods);
    }, [orders]);

    // --- Render logic ---
    if (isLoadingSession || isLoadingProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                {isLoadingSession ? "Đang tải phiên đăng nhập..." : "Đang kiểm tra quyền..."}
            </div>
        );
    }

    if (userRole !== 'admin' && userRole !== 'staff') {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-red-500">
                Bạn không có quyền truy cập trang này.
            </div>
        );
    }

    if (ordersQueryError) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-red-500">
                Lỗi tải đơn hàng: {ordersQueryError.message}
            </div>
        );
    }

    // Hiển thị thông báo tải chỉ khi đang tải lần đầu và chưa có dữ liệu
    if (isLoadingOrders && !orders) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                Đang tải đơn hàng...
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Quản lý Đơn hàng</h1>

            {updateError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <strong className="font-bold">Lỗi:</strong>
                    <span className="block sm:inline"> {updateError}</span>
                </div>
            )}

            {/* Các bộ lọc */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Lọc theo ID Đơn hàng */}
                <div>
                    <label htmlFor="orderIdInput" className="block text-gray-700 text-sm font-bold mb-2">ID Đơn hàng</label>
                    <input
                        type="text"
                        id="orderIdInput"
                        value={orderIdInput}
                        onChange={(e) => setOrderIdInput(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder="Nhập ID đơn hàng"
                    />
                </div>

                {/* Lọc theo trạng thái thanh toán */}
                <div>
                    <label htmlFor="paymentStatusFilter" className="block text-gray-700 text-sm font-bold mb-2">Trạng thái TT</label>
                    <MultiSelect
                        options={FILTER_STATUS_OPTIONS}
                        selectedValues={paymentStatusFilter}
                        onChange={setPaymentStatusFilter}
                        placeholder="Chọn trạng thái"
                    />
                </div>

                {/* Lọc theo phương thức thanh toán */}
                <div>
                    <label htmlFor="paymentMethodFilter" className="block text-gray-700 text-sm font-bold mb-2">Phương thức TT</label>
                    <select
                        id="paymentMethodFilter"
                        value={paymentMethodFilter}
                        onChange={(e) => setPaymentMethodFilter(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    >
                        <option value="all">Tất cả</option>
                        {uniquePaymentMethods.map((method) => (
                            <option key={method} value={method}>
                                {method}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Lọc theo ngày bắt đầu */}
                <div>
                    <label htmlFor="startDate" className="block text-gray-700 text-sm font-bold mb-2">Ngày bắt đầu</label>
                    <input
                        type="date"
                        id="startDate"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder="YYYY-MM-DD"
                    />
                </div>

                {/* Lọc theo ngày kết thúc */}
                <div>
                    <label htmlFor="endDate" className="block text-gray-700 text-sm font-bold mb-2">Ngày kết thúc</label>
                    <input
                        type="date"
                        id="endDate"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder="YYYY-MM-DD"
                    />
                </div>

                {/* Lọc theo tên khách hàng */}
                <div>
                    <label htmlFor="customerNameInput" className="block text-gray-700 text-sm font-bold mb-2">Tên khách hàng</label>
                    <input
                        type="text"
                        id="customerNameInput"
                        value={customerNameInput}
                        onChange={(e) => setCustomerNameInput(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder="Nhập tên khách hàng"
                    />
                </div>

                {/* Lọc theo tên sản phẩm */}
                <div>
                    <label htmlFor="productNameInput" className="block text-gray-700 text-sm font-bold mb-2">Tên sản phẩm</label>
                    <input
                        type="text"
                        id="productNameInput"
                        value={productNameInput}
                        onChange={(e) => setProductNameInput(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder="Nhập tên sản phẩm"
                    />
                </div>
            </div>

            {/* Hiển thị danh sách đơn hàng */}
            {filteredOrders && filteredOrders.length === 0 ? (
                <p className="text-center text-gray-600 text-lg">Không có đơn hàng nào.</p>
            ) : (
                <div className="overflow-x-auto bg-white shadow-md rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Đơn hàng</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Khách hàng</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng tiền</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phương thức TT</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái TT</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian còn lại</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chi tiết sản phẩm</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredOrders?.map((order) => {
                                const normalizedStatus = order.payment_status.toLowerCase().trim();
                                const displayDetails = STATUS_DETAILS[normalizedStatus] || { text: order.payment_status, colorClass: 'bg-gray-100 text-gray-800' };

                                return (
                                    <tr key={order.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">...{order.id.substring(order.id.length - 10)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {new Date(order.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <p className="font-semibold">{order.customer_name}</p>
                                            <p className="text-gray-500">{order.customer_email}</p>
                                            {order.customer_phone && <p className="text-gray-500">{order.customer_phone}</p>}
                                            {order.customer_address && <p className="text-gray-500">{order.customer_address}</p>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {order.total_amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {order.payment_method}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${displayDetails.colorClass}`}>
                                                {displayDetails.text}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <CountdownTimer
                                                expiresAt={order.expires_at}
                                                paymentMethod={order.payment_method}
                                                paymentStatus={order.payment_status} // Pass paymentStatus
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <ul className="list-disc list-inside text-xs">
                                                {/* Ensure order_items is an array before mapping */}
                                                {order.order_items && order.order_items.map((item, idx) => (
                                                    <li key={idx}>
                                                        {item.product_name} ({item.quantity} x {item.product_price.toLocaleString('vi-VN')})
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <select
                                                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={getSelectValueForDropdown(order.payment_status)}
                                                onChange={(e) => handleUpdatePaymentStatus(order.id, e.target.value)}
                                                disabled={updatingOrderIds.has(order.id)}
                                            >
                                                {UPDATABLE_STATUSES.map((status) => (
                                                    <option key={status} value={status}>
                                                        {STATUS_DETAILS[status]?.text || status}
                                                    </option>
                                                ))}
                                            </select>
                                            {updatingOrderIds.has(order.id) && <p className="text-xs text-blue-600 mt-1">Đang cập nhật...</p>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
