"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, XCircle } from 'lucide-react'; // Thêm XCircle cho nút đóng modal
import NextImage from 'next/image';

// --- Định nghĩa Interface cho dữ liệu ---
interface OrderItem {
    product_name: string;
    quantity: number;
    product_price: number;
    product_image: string;
}

// Interface cho Customer (từ bảng 'customers')
interface Customer {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
}

// Interface cho cấu trúc dữ liệu trả về trực tiếp từ Supabase select
interface RawSupabaseOrderData {
    id: string;
    created_at: string;
    payment_method: string;
    status: string | null;
    payment_status: string;
    total_amount: number;
    expires_at: string | null;
    customer: Customer | null;
    items: OrderItem[];
}

// Interface Order mà chúng ta sẽ sử dụng trong ứng dụng (sau khi xử lý dữ liệu từ Supabase)
interface Order {
    id: string;
    created_at: string;
    customer: Customer | null;
    payment_method: string;
    status: string | null; // Trạng thái vòng đời của đơn hàng
    payment_status: string; // Trạng thái thanh toán
    total_amount: number;
    expires_at: string | null;
    order_items: OrderItem[];
}

// --- Hằng số và Mapping cho Trạng thái Đơn hàng (Order Lifecycle Status) ---
const UPDATABLE_ORDER_STATUSES = ['pending', 'delivery', 'delivered', 'returned', 'cancelled', 'unknown'];

const ORDER_STATUS_DETAILS: { [key: string]: { text: string; colorClass: string } } = {
    'pending': { text: 'Chờ xác nhận', colorClass: 'bg-orange-100 text-orange-800' },
    'delivery': { text: 'Chờ giao hàng', colorClass: 'bg-blue-100 text-blue-800' },
    'delivered': { text: 'Đã giao', colorClass: 'bg-green-100 text-green-800' },
    'returned': { text: 'Trả hàng', colorClass: 'bg-gray-100 text-gray-800' },
    'cancelled': { text: 'Đã huỷ', colorClass: 'bg-red-100 text-red-800' },
    'unknown': { text: 'Không rõ trạng thái', colorClass: 'bg-gray-100 text-gray-800' },
};

const FILTER_ORDER_STATUS_OPTIONS = [
    { value: 'all', label: 'Tất cả' },
    { value: 'pending', label: 'Chờ xác nhận' },
    { value: 'delivery', label: 'Chờ giao hàng' },
    { value: 'delivered', label: 'Đã giao' },
    { value: 'returned', label: 'Trả hàng' },
    { value: 'cancelled', label: 'Đã huỷ' },
    { value: 'unknown', label: 'Không rõ trạng thái' },
];

// Helper function cho dropdown Trạng thái Đơn hàng
const getSelectValueForOrderStatusDropdown = (status: string | null): string => {
    if (!status) return 'unknown';
    const normalizedStatus = status.toLowerCase().trim();
    if (UPDATABLE_ORDER_STATUSES.includes(normalizedStatus)) {
        return normalizedStatus;
    }
    return 'unknown';
};

// --- Hằng số và Mapping cho Trạng thái Thanh toán (Payment Status) ---
const UPDATABLE_PAYMENT_STATUSES = ['pending_online', 'confirmed', 'paid', 'failed', 'refunded', 'unconfirmed_cod', 'completed', 'unknown'];

const PAYMENT_STATUS_DROPDOWN_OPTIONS: { [key: string]: { text: string; colorClass: string } } = {
    'pending_online': { text: 'Chờ thanh toán online', colorClass: 'bg-orange-100 text-orange-800' },
    'unconfirmed_cod': { text: 'Chưa xác nhận COD', colorClass: 'bg-yellow-100 text-yellow-800' },
    'confirmed': { text: 'Đã xác nhận', colorClass: 'bg-blue-100 text-blue-800' },
    'paid': { text: 'Đã thanh toán', colorClass: 'bg-green-100 text-green-800' },
    'failed': { text: 'Thanh toán thất bại', colorClass: 'bg-red-100 text-red-800' },
    'refunded': { text: 'Đã hoàn tiền', colorClass: 'bg-gray-100 text-gray-800' },
    'completed': { text: 'Hoàn tất đơn hàng', colorClass: 'bg-purple-100 text-purple-800' },
    'unknown': { text: 'Không rõ trạng thái', colorClass: 'bg-gray-100 text-gray-800' },
};



const FILTER_PAYMENT_STATUS_OPTIONS = [
    { value: 'all', label: 'Tất cả' },
    { value: 'pending_online', label: 'Chờ thanh toán online' },
    { value: 'unconfirmed_cod', label: 'Chưa xác nhận COD' },
    { value: 'confirmed', label: 'Đã xác nhận' },
    { value: 'paid', label: 'Đã thanh toán' },
    { value: 'failed', label: 'Thanh toán thất bại' },
    { value: 'refunded', label: 'Đã hoàn tiền' },
    { value: 'completed', label: 'Hoàn tất đơn hàng' },
    { value: 'unknown', label: 'Không rõ trạng thái' },
];

// Helper function cho dropdown Trạng thái Thanh toán
const getSelectValueForPaymentStatusDropdown = (paymentStatus: string | null): string => {
    if (!paymentStatus) return 'unknown';
    const normalizedPaymentStatus = paymentStatus.toLowerCase().trim();
    if (UPDATABLE_PAYMENT_STATUSES.includes(normalizedPaymentStatus)) {
        return normalizedPaymentStatus;
    }
    return 'unknown';
};


// --- CountdownTimer Component ---
interface CountdownTimerProps {
    expiresAt: string | null;
    paymentMethod: string;
    status: string | null;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ expiresAt, paymentMethod, status }) => {
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

    useEffect(() => {
        if (paymentMethod !== 'online' || !expiresAt) {
            setRemainingSeconds(null);
            return;
        }

        const expiryDate = new Date(expiresAt);

        const calculateRemaining = () => {
            const now = new Date();
            const diffSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
            setRemainingSeconds(diffSeconds);
        };

        calculateRemaining();

        const timer = setInterval(calculateRemaining, 1000);

        return () => clearInterval(timer);
    }, [expiresAt, paymentMethod]);

    if (paymentMethod !== 'online') {
        return <span className="text-gray-500">N/A</span>;
    }

    if (remainingSeconds === null) {
        return <span className="text-gray-500">Đang tính...</span>;
    }

    if (remainingSeconds <= 0) {
        return <span className="text-red-600 font-bold">Hết hạn</span>;
    }

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    if (status === 'pending') {
        return (
            <span className="font-medium text-blue-600">
                {formattedHours}:{formattedMinutes}:{formattedSeconds}
            </span>
        );
    }
    else {
        return <span className="text-gray-500">--</span>;
    }
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
            if (selectedValues.includes('all')) {
                newSelectedValues = [value];
            } else if (selectedValues.includes(value)) {
                newSelectedValues = selectedValues.filter(v => v !== value);
            } else {
                newSelectedValues = [...selectedValues, value];
            }

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
                <span className="truncate">{displayLabel}</span>
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
                                readOnly
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
    const [orderStatusFilter, setOrderStatusFilter] = useState<string[]>(['all']);
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<string[]>(['all']);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [customerNameInput, setCustomerNameInput] = useState<string>('');
    const [productNameInput, setProductNameInput] = useState<string>('');
    const [orderIdInput, setOrderIdInput] = useState<string>('');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState<string | 'all'>('all');

    // States cho tính năng xem chi tiết
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

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

    // --- Logic fetch TẤT CẢ danh sách đơn hàng (kết hợp với bảng customers) ---
    const {
        data: orders,
        isLoading: isLoadingOrders,
        error: ordersQueryError,
        refetch
    } = useQuery<Order[], Error>({
        queryKey: ['adminOrders'],
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
                    payment_method,
                    status,  
                    payment_status, 
                    total_amount,
                    expires_at,
                    customer:customer_id ( 
                        id,
                        full_name, 
                        email,
                        phone,
                        address
                    ),
                    items 
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const rawData = data as unknown as RawSupabaseOrderData[];

            const typedData = rawData.map(rawOrder => ({
                id: rawOrder.id,
                created_at: rawOrder.created_at,
                payment_method: rawOrder.payment_method,
                status: rawOrder.status,
                payment_status: rawOrder.payment_status,
                total_amount: rawOrder.total_amount,
                expires_at: rawOrder.expires_at,
                customer: rawOrder.customer,
                order_items: rawOrder.items,
            })) as Order[];

            console.log("Raw orders data from Supabase:", typedData);
            return typedData;
        },
        enabled: (userRole === 'admin' || userRole === 'staff') && !isLoadingSession && !isLoadingProfile,
        placeholderData: (previousData) => previousData,
        staleTime: 1000 * 60,
    });

    // --- Hàm xử lý cập nhật trạng thái đơn hàng (Order Lifecycle Status) ---
    const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
        if (!user?.id || (userRole !== 'admin' && userRole !== 'staff')) {
            alert('Bạn không có quyền thực hiện thao tác này.');
            return;
        }

        setUpdatingOrderIds(prev => new Set(prev).add(orderId));
        setUpdateError(null);

        const { error: updateErrorDb } = await supabaseClient
            .from('orders')
            .update({ status: newStatus === 'unknown' ? null : newStatus })
            .eq('id', orderId);

        setUpdatingOrderIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(orderId);
            return newSet;
        });

        if (updateErrorDb) {
            console.error('Lỗi khi cập nhật trạng thái đơn hàng:', updateErrorDb);
            setUpdateError('Cập nhật trạng thái đơn hàng thất bại: ' + updateErrorDb.message);
        } else {
            queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
            refetch();
        }
    };

    // --- Hàm xử lý cập nhật trạng thái thanh toán (Payment Status) ---
    const handleUpdatePaymentStatus = async (orderId: string, newPaymentStatus: string) => {
        if (!user?.id || (userRole !== 'admin' && userRole !== 'staff')) {
            alert('Bạn không có quyền thực hiện thao tác này.');
            return;
        }

        setUpdatingOrderIds(prev => new Set(prev).add(orderId));
        setUpdateError(null);

        const { error: updateErrorDb } = await supabaseClient
            .from('orders')
            .update({ payment_status: newPaymentStatus === 'unknown' ? null : newPaymentStatus })
            .eq('id', orderId);

        setUpdatingOrderIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(orderId);
            return newSet;
        });

        if (updateErrorDb) {
            console.error('Lỗi khi cập nhật trạng thái thanh toán:', updateErrorDb);
            setUpdateError('Cập nhật trạng thái thanh toán thất bại: ' + updateErrorDb.message);
        } else {
            queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
            refetch();
        }
    };

    // --- Hàm xử lý click vào hàng để xem chi tiết ---
    const handleRowClick = (order: Order) => {
        setSelectedOrder(order);
        setIsDetailModalOpen(true);
    };

    // --- Hàm đóng modal chi tiết ---
    const closeDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedOrder(null);
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
                    refetch();
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

        // Lọc theo trạng thái Đơn hàng (Order Lifecycle Status)
        if (orderStatusFilter.length > 0 && !orderStatusFilter.includes('all')) {
            result = result.filter(order => {
                const normalizedOrderStatus = order.status
                    ? order.status.toLowerCase().trim()
                    : 'unknown';
                return orderStatusFilter.some(filterValue => {
                    return normalizedOrderStatus === filterValue;
                });
            });
        }

        // Lọc theo trạng thái Thanh toán (Payment Status)
        if (paymentStatusFilter.length > 0 && !paymentStatusFilter.includes('all')) {
            result = result.filter(order => {
                const normalizedPaymentStatus = order.payment_status
                    ? order.payment_status.toLowerCase().trim()
                    : 'unknown';
                return paymentStatusFilter.some(filterValue => {
                    return normalizedPaymentStatus === filterValue;
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
            result = result.filter(order => {
                if (order.customer && order.customer.full_name) {
                    return order.customer.full_name.toLowerCase().includes(lowerCaseName);
                }
                return false;
            });
        }

        // Lọc theo tên sản phẩm (client-side)
        if (productNameInput) {
            const lowerCaseProductName = productNameInput.toLowerCase();
            result = result.filter(order =>
                order.order_items.some(item => item.product_name.toLowerCase().includes(lowerCaseProductName))
            );
        }
        console.log("Filtered orders data for rendering:", result);
        return result;
    }, [orders, orderIdInput, orderStatusFilter, paymentStatusFilter, paymentMethodFilter, startDate, endDate, customerNameInput, productNameInput]);

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

                {/* Lọc theo trạng thái Đơn hàng */}
                <div>
                    <label htmlFor="orderStatusFilter" className="block text-gray-700 text-sm font-bold mb-2">Trạng thái Đơn hàng</label>
                    <MultiSelect
                        options={FILTER_ORDER_STATUS_OPTIONS}
                        selectedValues={orderStatusFilter}
                        onChange={setOrderStatusFilter}
                        placeholder="Chọn trạng thái đơn hàng"
                    />
                </div>

                {/* Lọc theo Trạng thái Thanh toán */}
                <div>
                    <label htmlFor="paymentStatusFilter" className="block text-gray-700 text-sm font-bold mb-2">Trạng thái Thanh toán</label>
                    <MultiSelect
                        options={FILTER_PAYMENT_STATUS_OPTIONS}
                        selectedValues={paymentStatusFilter}
                        onChange={setPaymentStatusFilter}
                        placeholder="Chọn trạng thái thanh toán"
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái ĐH</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái TT</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian còn lại</th>
                                {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chi tiết sản phẩm</th> */}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredOrders?.map((order) => {
                                const normalizedOrderStatus = order.status
                                    ? order.status.toLowerCase().trim()
                                    : 'unknown';
                                const orderDisplayDetails = ORDER_STATUS_DETAILS[normalizedOrderStatus] || { text: 'Không rõ trạng thái', colorClass: 'bg-gray-100 text-gray-800' };

                                return (
                                    <tr
                                        key={order.id}
                                        onClick={() => handleRowClick(order)}
                                        className="hover:bg-gray-100 cursor-pointer"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">...{order.id.substring(order.id.length - 10)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {new Date(order.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <p className="font-semibold">{order.customer?.full_name}</p>
                                            {/* Chỉ hiển thị tên và SĐT ở đây, chi tiết đầy đủ trong modal */}
                                            {order.customer?.phone && <p className="text-gray-500">{order.customer.phone}</p>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {order.total_amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {order.payment_method}
                                        </td>
                                        {/* Cột Trạng thái Đơn hàng */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}> {/* Ngăn sự kiện click hàng */}
                                            <select
                                                className={`mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${orderDisplayDetails.colorClass}`}
                                                value={getSelectValueForOrderStatusDropdown(order.status)}
                                                onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                                disabled={updatingOrderIds.has(order.id)}
                                            >
                                                {UPDATABLE_ORDER_STATUSES.map((status) => (
                                                    <option key={status} value={status}>
                                                        {ORDER_STATUS_DETAILS[status]?.text || status}
                                                    </option>
                                                ))}
                                            </select>
                                            {updatingOrderIds.has(order.id) && <p className="text-xs text-blue-600 mt-1">Đang cập nhật...</p>}
                                        </td>
                                        {/* Cột Trạng thái Thanh toán */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}> {/* Ngăn sự kiện click hàng */}
                                            <select
                                                className={`mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${PAYMENT_STATUS_DROPDOWN_OPTIONS[order.payment_status]?.colorClass || 'bg-gray-100 text-gray-800'}`}
                                                value={getSelectValueForPaymentStatusDropdown(order.payment_status)}
                                                onChange={(e) => handleUpdatePaymentStatus(order.id, e.target.value)}
                                                disabled={updatingOrderIds.has(order.id)}
                                            >
                                                {UPDATABLE_PAYMENT_STATUSES.map((pStatus) => (
                                                    <option key={pStatus} value={pStatus}>
                                                        {PAYMENT_STATUS_DROPDOWN_OPTIONS[pStatus]?.text || pStatus}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <CountdownTimer
                                                expiresAt={order.expires_at}
                                                paymentMethod={order.payment_method}
                                                status={order.status}
                                            />
                                        </td>
                                        {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <ul className="list-disc list-inside text-xs">
                                                {order.order_items && order.order_items.map((item, idx) => (
                                                    <li key={idx}>
                                                        {item.product_name} ({item.quantity} x {item.product_price.toLocaleString('vi-VN')})
                                                    </li>
                                                ))}
                                            </ul>
                                        </td> */}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal Chi tiết Đơn hàng */}
            {isDetailModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
                        <button
                            onClick={closeDetailModal}
                            className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
                        >
                            <XCircle size={24} />
                        </button>
                        <div className="p-6">
                            <h2 className="text-2xl font-bold mb-4 text-gray-800">Chi tiết Đơn hàng: #{selectedOrder.id.substring(selectedOrder.id.length - 10)}</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <h3 className="font-semibold text-lg text-gray-700 mb-2">Thông tin Đơn hàng</h3>
                                    <p><strong>ID Đơn hàng:</strong> {selectedOrder.id}</p>
                                    <p><strong>Ngày tạo:</strong> {new Date(selectedOrder.created_at).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'medium' })}</p>
                                    <p><strong>Tổng tiền:</strong> {selectedOrder.total_amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>
                                    <p><strong>Phương thức thanh toán:</strong> {selectedOrder.payment_method}</p>
                                    <p><strong>Trạng thái Đơn hàng:</strong> <span className={`${ORDER_STATUS_DETAILS[getSelectValueForOrderStatusDropdown(selectedOrder.status)]?.colorClass || 'bg-gray-100 text-gray-800'} px-2 py-1 rounded-full text-xs font-semibold`}>
                                        {ORDER_STATUS_DETAILS[getSelectValueForOrderStatusDropdown(selectedOrder.status)]?.text || 'Không rõ trạng thái'}
                                    </span></p>
                                    <p><strong>Trạng thái Thanh toán:</strong> <span className={`${PAYMENT_STATUS_DROPDOWN_OPTIONS[getSelectValueForPaymentStatusDropdown(selectedOrder.payment_status)]?.colorClass || 'bg-gray-100 text-gray-800'} px-2 py-1 rounded-full text-xs font-semibold`}>
                                        {PAYMENT_STATUS_DROPDOWN_OPTIONS[getSelectValueForPaymentStatusDropdown(selectedOrder.payment_status)]?.text || 'Không rõ trạng thái'}
                                    </span></p>
                                    {selectedOrder.payment_method === 'online' && (
                                        <p><strong>Thời gian còn lại:</strong>
                                            <CountdownTimer
                                                expiresAt={selectedOrder.expires_at}
                                                paymentMethod={selectedOrder.payment_method}
                                                status={selectedOrder.status}
                                            />
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg text-gray-700 mb-2">Thông tin Khách hàng</h3>
                                    <p><strong>Tên:</strong> {selectedOrder.customer?.full_name || 'N/A'}</p>
                                    <p><strong>Email:</strong> {selectedOrder.customer?.email || 'N/A'}</p>
                                    <p><strong>Điện thoại:</strong> {selectedOrder.customer?.phone || 'N/A'}</p>
                                    <p><strong>Địa chỉ:</strong> {selectedOrder.customer?.address || 'N/A'}</p>
                                </div>
                            </div>

                            <h3 className="font-semibold text-lg text-gray-700 mb-2">Sản phẩm trong Đơn hàng</h3>
                            {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                                <ul className="list-disc list-inside space-y-1">
                                    {selectedOrder.order_items.map((item, index) => (
                                        <li key={index} className="text-gray-700 list-disc list-inside flex items-center">
                                            {item.product_image && (
                                                <NextImage
                                                    src={item.product_image}
                                                    alt={item.product_name}
                                                    width={48}
                                                    height={48}
                                                    className="w-12 h-12 object-cover rounded mr-3"
                                                />
                                            )}
                                            <span>
                                                {item.product_name} - Số lượng: {item.quantity} - Giá:{' '}
                                                {item.product_price.toLocaleString('vi-VN', {
                                                    style: 'currency',
                                                    currency: 'VND',
                                                })}
                                            </span>
                                        </li>

                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-600">Không có sản phẩm nào trong đơn hàng này.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}