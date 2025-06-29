// app/admin/sales/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';


// Định nghĩa kiểu dữ liệu cho một mục trong đơn hàng từ bảng order_items
interface OrderItem {
    id: string; // Temporary ID for frontend list (e.g., Math.random().toString(36).substring(2, 9))
    product_id: string; // Actual product ID from products table
    product_name: string;
    product_price: number;
    quantity: number;
    product_image: string | null; // Cập nhật tên cột (tương ứng product_imag trong DB nếu giữ nguyên)
}

// Định nghĩa kiểu dữ liệu cho thông tin khách hàng từ DB
interface CustomerInfo {
    full_name: string | null;
    email: string | null;
    phone: string;
    address: string | null;
}

// Định nghĩa kiểu dữ liệu cho một tab đơn hàng mới
interface NewOrderTab {
    tabId: string; // Unique ID for the tab
    customerName: string;
    customerEmail: string;
    customerPhone: string; // Tên cột mới
    customerAddress: string; // Tên cột mới
    paymentMethod: string; // Tên cột mới
    items: OrderItem[];
    searchProductTerm: string;
    searchResults: { id: string; name: string; price: number; image: string | null; stock_quantity: number }[];
    customerSearchPhone: string;
    customerMatchingResults: CustomerInfo[];
}

export default function SalesPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const { isLoading: isLoadingSession } = useSessionContext();
    const queryClient = useQueryClient();

    const [userRole, setUserRole] = useState<'user' | 'admin' | 'staff' | null>(null);
    const [currentTabId, setCurrentTabId] = useState<string>(''); // ID of the currently active tab
    const [orderTabs, setOrderTabs] = useState<NewOrderTab[]>([]); // Array to hold multiple order tabs

    // Handlers for managing tabs
    const handleAddTab = useCallback(() => {
        const newTabId = Math.random().toString(36).substring(2, 11);
        const newTab: NewOrderTab = {
            tabId: newTabId,
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            customerAddress: '',
            paymentMethod: 'cash',
            items: [],
            searchProductTerm: '',
            searchResults: [],
            customerSearchPhone: '',
            customerMatchingResults: [],
        };
        setOrderTabs(prevTabs => [...prevTabs, newTab]);
        setCurrentTabId(newTabId);
    }, []);

    const handleRemoveTab = useCallback((tabIdToRemove: string) => {
        if (orderTabs.length === 1) {
            setOrderTabs([
                {
                    tabId: Math.random().toString(36).substring(2, 11),
                    customerName: '',
                    customerEmail: '',
                    customerPhone: '',
                    customerAddress: '',
                    paymentMethod: 'cash',
                    items: [],
                    searchProductTerm: '',
                    searchResults: [],
                    customerSearchPhone: '',
                    customerMatchingResults: [],
                }
            ]);
            setOrderTabs(prevTabs => {
                const newTabs = prevTabs.filter(tab => tab.tabId !== tabIdToRemove);
                if (newTabs.length === 0) {
                    const newEmptyTab: NewOrderTab = {
                        tabId: Math.random().toString(36).substring(2, 11),
                        customerName: '', customerEmail: '', customerPhone: '', customerAddress: '',
                        paymentMethod: 'cash', items: [], searchProductTerm: '', searchResults: [],
                        customerSearchPhone: '', customerMatchingResults: []
                    };
                    setCurrentTabId(newEmptyTab.tabId);
                    return [newEmptyTab];
                }
                setCurrentTabId(newTabs[0].tabId);
                return newTabs;
            });
            return;
        }

        setOrderTabs(prevTabs => prevTabs.filter(tab => tab.tabId !== tabIdToRemove));
        if (currentTabId === tabIdToRemove) {
            const remainingTabs = orderTabs.filter(tab => tab.tabId !== tabIdToRemove);
            if (remainingTabs.length > 0) {
                setCurrentTabId(remainingTabs[0].tabId);
            } else {
                handleAddTab();
            }
        }
    }, [currentTabId, orderTabs, handleAddTab]);

    const handleTabChange = useCallback((tabId: string) => {
        setCurrentTabId(tabId);
    }, []);

    const updateCurrentTab = useCallback((updater: (prevTab: NewOrderTab) => NewOrderTab) => {
        setOrderTabs(prevTabs =>
            prevTabs.map(tab => (tab.tabId === currentTabId ? updater(tab) : tab))
        );
    }, [currentTabId]);


    const currentTab = orderTabs.find(tab => tab.tabId === currentTabId);


    const handleSearchProducts = useCallback(async () => {
        if (!currentTab?.searchProductTerm.trim()) {
            updateCurrentTab(prev => ({ ...prev, searchResults: [] }));
            return;
        }

        const { data, error } = await supabaseClient
            .from('products')
            .select('id, name, price, image, stock_quantity')
            .ilike('name', `%${currentTab.searchProductTerm}%`)
            .limit(10);

        if (error) {
            toast.error(`Lỗi tìm kiếm sản phẩm: ${error.message}`);
            updateCurrentTab(prev => ({ ...prev, searchResults: [] }));
            return;
        }
        updateCurrentTab(prev => ({ ...prev, searchResults: data }));
    }, [currentTab?.searchProductTerm, supabaseClient, updateCurrentTab]);


    const handleAddProductToNewOrder = useCallback((product: { id: string; name: string; price: number; image: string | null; stock_quantity: number }) => {
        if (!currentTab) return;

        if (product.stock_quantity <= 0) {
            toast.error(`Sản phẩm "${product.name}" đã hết hàng.`);
            return;
        }

        const existingItemIndex = currentTab.items.findIndex(item => item.product_id === product.id);

        updateCurrentTab(prev => {
            const updatedItems = [...prev.items];
            if (existingItemIndex > -1) {
                if (updatedItems[existingItemIndex].quantity + 1 > product.stock_quantity) {
                     toast.error(`Không đủ tồn kho cho sản phẩm "${product.name}". Chỉ còn ${product.stock_quantity} sản phẩm.`);
                     return prev;
                }
                updatedItems[existingItemIndex].quantity += 1;
            } else {
                 if (1 > product.stock_quantity) {
                     toast.error(`Không đủ tồn kho cho sản phẩm "${product.name}". Chỉ còn ${product.stock_quantity} sản phẩm.`);
                     return prev;
                 }
                updatedItems.push({
                    id: Math.random().toString(36).substring(2, 9),
                    product_id: product.id,
                    product_name: product.name,
                    product_price: product.price,
                    quantity: 1,
                    product_image: product.image || null,
                });
            }
            return { ...prev, items: updatedItems, searchProductTerm: '', searchResults: [] };
        });
    }, [currentTab, updateCurrentTab]);


    const handleQuantityChange = useCallback((itemId: string, newQuantity: number) => {
        if (!currentTab) return;

        const itemInOrder = currentTab.items.find(i => i.id === itemId);
        const productFromSearch = currentTab.searchResults.find(p => p.id === itemInOrder?.product_id);

        updateCurrentTab(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id === itemId) {
                    if (productFromSearch) {
                        if (newQuantity > productFromSearch.stock_quantity) {
                            toast.error(`Không đủ tồn kho cho sản phẩm "${item.product_name}". Chỉ còn ${productFromSearch.stock_quantity} sản phẩm.`);
                            return { ...item, quantity: productFromSearch.stock_quantity > 0 ? productFromSearch.stock_quantity : 1 };
                        }
                    }
                    return { ...item, quantity: Math.max(1, newQuantity) };
                }
                return item;
            })
        }));
    }, [currentTab, updateCurrentTab]);


    const handleRemoveProductFromOrder = useCallback((itemId: string) => {
        updateCurrentTab(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== itemId)
        }));
    }, [updateCurrentTab]);

    const calculateNewOrderTotal = useCallback(() => {
        return currentTab?.items.reduce((total, item) => total + (item.product_price * item.quantity), 0) || 0;
    }, [currentTab?.items]);


    const handleSearchCustomer = useCallback(async () => {
        if (!currentTab?.customerSearchPhone.trim()) {
            toast.info('Vui lòng nhập một phần số điện thoại để tìm kiếm khách hàng.');
            updateCurrentTab(prev => ({ ...prev, customerMatchingResults: [] }));
            return;
        }

        const searchTerm = currentTab.customerSearchPhone.trim();
        const { data, error } = await supabaseClient
            .from('customers')
            .select('full_name, email, phone, address')
            .ilike('phone', `%${searchTerm}%`);

        if (error) {
            toast.error(`Lỗi tìm kiếm khách hàng: ${error.message}`);
            updateCurrentTab(prev => ({ ...prev, customerMatchingResults: [] }));
            return;
        }

        if (data && data.length > 0) {
            updateCurrentTab(prev => ({ ...prev, customerMatchingResults: data }));
            toast.success(`Tìm thấy ${data.length} khách hàng phù hợp.`);
        } else {
            updateCurrentTab(prev => ({ ...prev, customerMatchingResults: [] }));
            toast.info('Không tìm thấy khách hàng nào với số điện thoại này.');
        }
    }, [currentTab?.customerSearchPhone, supabaseClient, updateCurrentTab]);

    const handleSelectCustomer = useCallback((customer: CustomerInfo) => {
        updateCurrentTab(prev => ({
            ...prev,
            customerName: customer.full_name || '',
            customerEmail: customer.email || '',
            customerPhone: customer.phone || '',
            customerAddress: customer.address || '',
            customerSearchPhone: '',
            customerMatchingResults: [],
        }));
        toast.success(`Đã chọn khách hàng: ${customer.full_name || customer.phone}`);
    }, [updateCurrentTab]);

    // HÀM MỚI: TỰ ĐỘNG ĐIỀN THÔNG TIN KHÁCH HÀNG VÃNG LAI
    const handleSetGuestCustomer = useCallback(() => {
        updateCurrentTab(prev => ({
            ...prev,
            customerName: 'Khách mua tại cửa hàng',
            customerEmail: 'N/A', // Hoặc để trống nếu bạn muốn
            customerPhone: 'N/A', // Hoặc một số điện thoại placeholder unique nếu cần theo dõi
            customerAddress: 'N/A', // Hoặc để trống nếu bạn muốn
            customerSearchPhone: '', // Xóa ô tìm kiếm
            customerMatchingResults: [], // Xóa danh sách kết quả tìm kiếm
        }));
        toast.info('Đã điền thông tin khách hàng vãng lai.');
    }, [updateCurrentTab]);


    // Fetch user role
    const { data: profileData, isLoading: isLoadingProfile } = useQuery({
        queryKey: ['userProfile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('role, full_name, email, phone, address')
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

    useEffect(() => {
        if ((userRole === 'admin' || userRole === 'staff') && orderTabs.length === 0) {
            handleAddTab();
        }
    }, [userRole, orderTabs.length, handleAddTab]);

    const createOrderMutation = useMutation({
        mutationFn: async (payloadData: {
            profile: {
                full_name: string;
                email: string | null;
                phone: string;
                address: string | null;
            };
            checkoutItems: {
                product_id: string;
                product_name: string;
                product_price: number;
                quantity: number;
                product_image: string | null;
            }[];
            paymentMethod: string;
            totalAmount: number;
            userId: string;
            orderSource: string;
        }) => {
            const { data, error } = await supabaseClient.functions.invoke('place-order', {
                body: JSON.stringify(payloadData),
            });

            if (error) {
                if (data && data.error) {
                    throw new Error(data.error);
                }
                throw new Error(error.message || 'Lỗi không xác định khi gọi Edge Function');
            }

            if (data && data.error) {
                throw new Error(data.error);
            }
            
            return data;
        },
        onSuccess: (data) => {
            toast.success(`Đơn hàng ${data.orderId?.substring(0, 8) || 'mới'}... đã được tạo thành công!`);
            setOrderTabs(prevTabs => prevTabs.filter(tab => tab.tabId !== currentTabId));
            if (orderTabs.length === 1) {
                handleAddTab();
            } else if (orderTabs.length > 1) {
                const remainingTabs = orderTabs.filter(tab => tab.tabId !== currentTabId);
                if (remainingTabs.length > 0) {
                    setCurrentTabId(remainingTabs[0].tabId);
                } else {
                    handleAddTab();
                }
            }
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
        onError: (error: Error) => {
            toast.error(`Lỗi tạo đơn hàng mới: ${error.message}`);
        },
    });

    const handleCreateNewOrder = useCallback(() => {
        if (!currentTab || !user || !profileData) return;

        // Cập nhật điều kiện kiểm tra:
        // Cho phép tạo đơn nếu tên khách hàng là "Khách mua tại cửa hàng"
        // HOẶC (tên khách hàng không rỗng VÀ số điện thoại không rỗng)
        const isGuestCustomer = currentTab.customerName.trim() === 'Khách mua tại cửa hàng';
        const isCustomerInfoValid = isGuestCustomer || (currentTab.customerName.trim() && currentTab.customerPhone.trim());

        if (!isCustomerInfoValid || currentTab.items.length === 0) {
            toast.error('Vui lòng nhập tên khách hàng, số điện thoại (hoặc chọn "Khách mua tại cửa hàng") và thêm ít nhất một sản phẩm.');
            return;
        }

        const totalAmount = calculateNewOrderTotal();

        const payloadForEdgeFunction = {
            profile: {
                full_name: currentTab.customerName.trim(),
                email: currentTab.customerEmail.trim() === 'N/A' ? null : currentTab.customerEmail.trim() || null,
                phone: currentTab.customerPhone.trim() === 'N/A' ? '0000000000' : currentTab.customerPhone.trim(), // Đảm bảo số điện thoại không phải 'N/A' khi gửi DB
                address: currentTab.customerAddress.trim() === 'N/A' ? null : currentTab.customerAddress.trim() || null,
            },
            checkoutItems: currentTab.items.map(item => ({
                product_id: item.product_id!,
                product_name: item.product_name,
                product_price: item.product_price,
                quantity: item.quantity,
                product_image: item.product_image,
            })),
            paymentMethod: currentTab.paymentMethod,
            totalAmount: totalAmount,
            userId: user.id,
            orderSource: 'pos',
        };

        createOrderMutation.mutate(payloadForEdgeFunction);
    }, [currentTab, calculateNewOrderTotal, createOrderMutation, user, profileData]);


    // Render Logic
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
                Bạn không có quyền truy cập trang bán hàng trực tiếp.
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 flex flex-col h-screen">
            <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Bán hàng trực tiếp (POS)</h1>

            {/* Tab Navigation */}
            <div className="flex flex-wrap border-b border-gray-200 mb-4 items-end">
                {orderTabs.map((tab) => (
                    <div
                        key={tab.tabId}
                        className={`px-4 py-2 cursor-pointer border-x border-t rounded-t-lg flex items-center gap-2
                            ${currentTabId === tab.tabId ? 'bg-white border-blue-500 text-blue-700 font-semibold' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                        onClick={() => handleTabChange(tab.tabId)}
                    >
                        Đơn hàng {orderTabs.indexOf(tab) + 1}
                        {orderTabs.length > 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveTab(tab.tabId); }}
                                className="ml-2 text-gray-500 hover:text-red-500 text-sm"
                                title="Đóng tab này"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={handleAddTab}
                    className="ml-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg focus:outline-none focus:shadow-outline flex items-center gap-1"
                >
                    <i className="fas fa-plus"></i> Thêm Đơn Mới
                </button>
            </div>

            {/* Current Order Tab Content */}
            {currentTab && (
                <div className="flex-1 bg-white p-8 rounded-lg shadow-md overflow-y-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                        {/* Customer Information & Payment */}
                        <div className="flex flex-col">
                            <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Thông tin Khách hàng & Thanh toán</h3>
                            {/* KHU VỰC TÌM KIẾM KHÁCH HÀNG */}
                            <div className="mb-4">
                                <label htmlFor="customerSearchPhone" className="block text-gray-700 text-sm font-bold mb-2">Tìm khách hàng bằng SĐT:</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        id="customerSearchPhone"
                                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                        value={currentTab.customerSearchPhone}
                                        onChange={(e) => updateCurrentTab(prev => ({ ...prev, customerSearchPhone: e.target.value }))}
                                        onKeyPress={(e) => { if (e.key === 'Enter') handleSearchCustomer(); }}
                                        placeholder="Nhập số điện thoại khách hàng"
                                    />
                                    <button
                                        onClick={handleSearchCustomer}
                                        className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                    >
                                        Tìm
                                    </button>
                                </div>
                                {/* HIỂN THỊ KẾT QUẢ TÌM KIẾM KHÁCH HÀNG */}
                                {currentTab.customerMatchingResults.length > 0 && (
                                    <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto mt-2">
                                        {currentTab.customerMatchingResults.map((customer, index) => (
                                            <div
                                                key={index}
                                                className="flex justify-between items-center p-2 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                                                onClick={() => handleSelectCustomer(customer)}
                                            >
                                                <span>{customer.full_name || 'Khách hàng ẩn danh'} - {customer.phone}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleSelectCustomer(customer); }}
                                                    className="bg-green-500 hover:bg-green-700 text-white text-xs font-bold py-1 px-2 rounded"
                                                >
                                                    Chọn
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* NÚT MỚI: ĐIỀN THÔNG TIN KHÁCH HÀNG VÃNG LAI */}
                            <div className="mb-4 text-right">
                                <button
                                    onClick={handleSetGuestCustomer}
                                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                >
                                    Khách mua tại cửa hàng
                                </button>
                            </div>
                            {/* KẾT THÚC KHU VỰC MỚI */}

                            <div className="mb-4">
                                <label htmlFor="customerName" className="block text-gray-700 text-sm font-bold mb-2">Tên Khách hàng:</label>
                                <input
                                    type="text"
                                    id="customerName"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={currentTab.customerName}
                                    onChange={(e) => updateCurrentTab(prev => ({ ...prev, customerName: e.target.value }))}
                                    required
                                    placeholder="Tên khách hàng"
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="customerPhone" className="block text-gray-700 text-sm font-bold mb-2">Số điện thoại:</label>
                                <input
                                    type="text"
                                    id="customerPhone"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={currentTab.customerPhone}
                                    onChange={(e) => updateCurrentTab(prev => ({ ...prev, customerPhone: e.target.value }))}
                                    required
                                    placeholder="Số điện thoại"
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="customerAddress" className="block text-gray-700 text-sm font-bold mb-2">Địa chỉ:</label>
                                <textarea
                                    id="customerAddress"
                                    rows={2}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={currentTab.customerAddress}
                                    onChange={(e) => updateCurrentTab(prev => ({ ...prev, customerAddress: e.target.value }))}
                                    placeholder="Địa chỉ (tùy chọn)"
                                ></textarea>
                            </div>
                            <div className="mb-4">
                                <label htmlFor="customerEmail" className="block text-gray-700 text-sm font-bold mb-2">Email:</label>
                                <input
                                    type="email"
                                    id="customerEmail"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={currentTab.customerEmail}
                                    onChange={(e) => updateCurrentTab(prev => ({ ...prev, customerEmail: e.target.value }))}
                                    placeholder="Email (tùy chọn)"
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="paymentMethod" className="block text-gray-700 text-sm font-bold mb-2">Phương thức thanh toán:</label>
                                <select
                                    id="paymentMethod"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={currentTab.paymentMethod}
                                    onChange={(e) => updateCurrentTab(prev => ({ ...prev, paymentMethod: e.target.value }))}
                                >
                                    <option value="cash">Tiền mặt</option>
                                    <option value="transfer">Chuyển khoản</option>
                                    <option value="pos">Quẹt thẻ POS</option>
                                </select>
                            </div>
                        </div>

                        {/* Product Search and Order Items List */}
                        <div className="flex flex-col">
                            <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Sản phẩm trong Đơn hàng</h3>
                            <div className="mb-4 flex gap-2">
                                <input
                                    type="text"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    placeholder="Tìm kiếm sản phẩm..."
                                    value={currentTab.searchProductTerm}
                                    onChange={(e) => updateCurrentTab(prev => ({ ...prev, searchProductTerm: e.target.value }))}
                                    onKeyPress={(e) => { if (e.key === 'Enter') handleSearchProducts(); }}
                                />
                                <button
                                    onClick={handleSearchProducts}
                                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                >
                                    Tìm
                                </button>
                            </div>

                            {currentTab.searchResults.length > 0 && (
                                <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto mb-4">
                                    {currentTab.searchResults.map(product => (
                                        <div key={product.id} className="flex justify-between items-center p-2 border-b last:border-b-0 hover:bg-gray-50">
                                            <span>{product.name} - {product.price.toLocaleString('vi-VN')} VND (Tồn: {product.stock_quantity})</span>
                                            <button
                                                onClick={() => handleAddProductToNewOrder(product)}
                                                className="bg-indigo-500 hover:bg-indigo-700 text-white text-xs font-bold py-1 px-2 rounded"
                                            >
                                                Thêm
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <h4 className="text-lg font-semibold mb-2 mt-4">Danh sách sản phẩm ({currentTab.items.length})</h4>
                            {currentTab.items.length > 0 ? (
                                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2 flex-grow">
                                    {currentTab.items.map(item => (
                                        <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                                            <div className="flex items-center gap-2">
                                                {item.product_image && <img src={item.product_image} alt={item.product_name} className="w-10 h-10 object-cover rounded" />}
                                                <span>{item.product_name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                                                    className="w-16 p-1 border rounded text-center"
                                                />
                                                <span className="w-24 text-right">{(item.product_price * item.quantity).toLocaleString('vi-VN')} VND</span>
                                                <button
                                                    onClick={() => handleRemoveProductFromOrder(item.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                    title="Xóa sản phẩm"
                                                >
                                                    <i className="fas fa-times-circle"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-600 flex-grow flex items-center justify-center">Chưa có sản phẩm nào được thêm vào đơn hàng này.</p>
                            )}

                            <div className="mt-4 text-right text-2xl font-bold text-gray-800">
                                Tổng cộng: {calculateNewOrderTotal().toLocaleString('vi-VN')} VND
                            </div>

                            <div className="flex justify-end gap-4 mt-6">
                                <button
                                    onClick={handleCreateNewOrder}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg focus:outline-none focus:shadow-outline"
                                    // Điều kiện disabled đã được cập nhật
                                    disabled={createOrderMutation.isPending || currentTab.items.length === 0 ||
                                              (currentTab.customerName.trim() !== 'Khách mua tại cửa hàng' &&
                                               (!currentTab.customerName.trim() || !currentTab.customerPhone.trim()))
                                            }
                                >
                                    {createOrderMutation.isPending ? 'Đang thanh toán...' : 'Thanh toán (Hoàn thành)'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}