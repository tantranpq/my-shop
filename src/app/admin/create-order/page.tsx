// app/admin/sales/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Định nghĩa kiểu dữ liệu cho một mục trong đơn hàng
interface OrderItem {
    id: string; // ID tạm thời cho danh sách frontend (ví dụ: Math.random().toString(36).substring(2, 9))
    product_id: string; // ID sản phẩm thực tế từ bảng products
    product_name: string;
    product_price: number;
    quantity: number;
    product_image: string | null;
    slug: string; // Mã slug của sản phẩm
    // Đã xóa: unit: string; vì bảng products không có cột này
}

// Định nghĩa kiểu dữ liệu cho một tab đơn hàng mới
interface NewOrderTab {
    tabId: string; // ID duy nhất cho tab
    selectedCustomerId: string | null; // ID của khách hàng đã chọn từ bảng `customers`
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerAddress: string;
    paymentMethod: string; // Phương thức thanh toán (tiền mặt, chuyển khoản, POS)
    items: OrderItem[];
    // Thông tin tìm kiếm sản phẩm
    searchProductTerm: string;
    searchResults: { id: string; name: string; price: number; images: string[] | null; stock_quantity: number; slug: string; }[]; // Đã xóa: unit
    // Thông tin tìm kiếm khách hàng
    customerSearchTerm: string;
    customerSearchResults: { id: string; full_name: string; phone: string; email: string | null; address: string | null }[];
    // Thông tin đơn hàng online/POS
    orderSource: 'phone' | 'facebook' | 'zalo' | 'shopee' | 'lazada' | 'web' | 'other'; // Nguồn đơn hàng
    channelUrl: string; // Đường dẫn URL của kênh (nếu có)
    branchId: string; // ID chi nhánh
    pricePolicy: string; // Chính sách giá
    deliveryDate: string; // Ngày hẹn giao
    deliveryTime: string; // Giờ hẹn giao
    reference: string; // Ghi chú nội bộ/tham chiếu
}

export default function SalesPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser(); // Thông tin người dùng hiện tại (nhân viên)
    const { isLoading: isLoadingSession } = useSessionContext();
    const queryClient = useQueryClient();

    const [userRole, setUserRole] = useState<'user' | 'admin' | 'staff' | null>(null);
    const [openTabs, setOpenTabs] = useState<NewOrderTab[]>([]); // Mảng chứa các tab đơn hàng đang mở
    const [activeTabId, setActiveTabId] = useState<string | null>(null); // ID của tab đang hoạt động

    // Hàm khởi tạo dữ liệu mặc định cho một tab đơn hàng mới
    const initialNewOrderTab = useCallback((staffFullName: string): NewOrderTab => ({
        tabId: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, // Unique ID cho tab
        selectedCustomerId: null, // Ban đầu không có khách hàng nào được chọn
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        paymentMethod: 'cod', // Phương thức thanh toán mặc định
        items: [],
        searchProductTerm: '',
        searchResults: [],
        customerSearchTerm: '',
        customerSearchResults: [],
        orderSource: 'phone', // Nguồn đơn hàng mặc định
        channelUrl: '',
        branchId: 'default_branch_id', // Thay thế bằng ID chi nhánh mặc định của bạn
        pricePolicy: 'retail_price', // Chính sách giá mặc định
        deliveryDate: '',
        deliveryTime: '',
        reference: '',
    }), []);

    // Query để lấy thông tin profile của người dùng (bao gồm vai trò)
    const { data: profileData, isLoading: isLoadingProfile } = useQuery({
        queryKey: ['userProfile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('role, full_name')
                .eq('id', user.id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id && !isLoadingSession, // Chỉ chạy query khi có user và session đã tải
        staleTime: 1000 * 60 * 60, // Cache query trong 1 giờ
    });

    // Cập nhật vai trò người dùng sau khi profileData được fetch
    useEffect(() => {
        if (profileData) {
            setUserRole(profileData.role as 'user' | 'admin' | 'staff');
        }
    }, [profileData]);

    // Khởi tạo tab đầu tiên khi component mount và vai trò người dùng đã được xác định
    useEffect(() => {
        if (!isLoadingSession && !isLoadingProfile && userRole && openTabs.length === 0) {
            if (userRole === 'admin' || userRole === 'staff') {
                const staffFullName = profileData?.full_name || user?.user_metadata?.full_name || '';
                const newTab = initialNewOrderTab(staffFullName);
                setOpenTabs([newTab]);
                setActiveTabId(newTab.tabId);
            }
        }
    }, [isLoadingSession, isLoadingProfile, userRole, profileData, openTabs.length, user?.user_metadata?.full_name, initialNewOrderTab]);

    // Lấy thông tin tab hiện tại đang hoạt động
    const currentTab = activeTabId ? openTabs.find(tab => tab.tabId === activeTabId) : null;

    // Callback để cập nhật state của tab hiện tại
    const updateTab = useCallback((updater: (prev: NewOrderTab) => NewOrderTab) => {
        setOpenTabs(prevTabs =>
            prevTabs.map(tab =>
                tab.tabId === activeTabId ? updater(tab) : tab
            )
        );
    }, [activeTabId]);

    // Thêm một tab đơn hàng mới
    const addTab = useCallback(() => {
        const staffFullName = profileData?.full_name || user?.user_metadata?.full_name || '';
        const newTab = initialNewOrderTab(staffFullName);
        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.tabId);
    }, [initialNewOrderTab, profileData, user]);

    // Xóa một tab đơn hàng
    const removeTab = useCallback((tabId: string) => {
        setOpenTabs(prev => {
            const updatedTabs = prev.filter(tab => tab.tabId !== tabId);
            if (updatedTabs.length === 0) {
                // Nếu không còn tab nào, tạo một tab mới trống
                const staffFullName = profileData?.full_name || user?.user_metadata?.full_name || '';
                const newTab = initialNewOrderTab(staffFullName);
                setActiveTabId(newTab.tabId);
                return [newTab];
            } else if (activeTabId === tabId) {
                // Nếu tab đang hoạt động bị xóa, chuyển sang tab đầu tiên còn lại
                setActiveTabId(updatedTabs[0].tabId);
            }
            return updatedTabs;
        });
    }, [activeTabId, initialNewOrderTab, profileData, user]);

    // Tính tổng tiền của đơn hàng hiện tại
    const calculateNewOrderTotal = useCallback(() => {
        return currentTab?.items.reduce((total, item) => total + (item.product_price * item.quantity), 0) || 0;
    }, [currentTab]);

    // Xử lý tìm kiếm khách hàng
    const handleCustomerSearch = useCallback(async () => {
        if (!currentTab?.customerSearchTerm.trim()) {
            updateTab(prev => ({ ...prev, customerSearchResults: [] }));
            return;
        }

        const searchTerm = `%${currentTab.customerSearchTerm.trim()}%`;
        // Tìm kiếm trong bảng 'customers' theo tên, SĐT hoặc email
        const { data, error } = await supabaseClient
            .from('customers')
            .select('id, full_name, phone, email, address')
            .or(`full_name.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm}`)
            .limit(10);

        if (error) {
            toast.error(`Lỗi tìm kiếm khách hàng: ${error.message}`);
            updateTab(prev => ({ ...prev, customerSearchResults: [] }));
            return;
        }
        updateTab(prev => ({ ...prev, customerSearchResults: data || [] }));
    }, [currentTab?.customerSearchTerm, supabaseClient, updateTab]);

    // Xử lý chọn khách hàng từ kết quả tìm kiếm
    const handleSelectCustomer = useCallback((customer: NewOrderTab['customerSearchResults'][0]) => {
        updateTab(prev => ({
            ...prev,
            selectedCustomerId: customer.id, // Lưu ID của khách hàng đã chọn
            customerName: customer.full_name,
            customerPhone: customer.phone,
            customerEmail: customer.email || '',
            customerAddress: customer.address || '',
            customerSearchTerm: customer.full_name, // Hiển thị tên khách hàng đã chọn trong ô tìm kiếm
            customerSearchResults: [] // Xóa kết quả tìm kiếm sau khi chọn
        }));
    }, [updateTab]);

    // Xử lý tìm kiếm sản phẩm
    const handleProductSearch = useCallback(async () => {
        if (!currentTab?.searchProductTerm.trim()) {
            updateTab(prev => ({ ...prev, searchResults: [] }));
            return;
        }

        const { data, error } = await supabaseClient
            .from('products')
            .select('id, name, price, images, stock_quantity, slug') // Đã sửa: Lấy 'slug', bỏ 'unit'
            .ilike('name', `%${currentTab.searchProductTerm}%`)
            .limit(10);

        if (error) {
            toast.error(`Lỗi tìm kiếm sản phẩm: ${error.message}`);
            updateTab(prev => ({ ...prev, searchResults: [] }));
            return;
        }
        updateTab(prev => ({ ...prev, searchResults: data || [] }));
    }, [currentTab?.searchProductTerm, supabaseClient, updateTab]);

    // Xử lý thêm sản phẩm vào đơn hàng
    const handleAddProductToOrder = useCallback((product: NewOrderTab['searchResults'][0]) => {
        updateTab(prev => {
            const existingItemIndex = prev.items.findIndex(item => item.product_id === product.id);
            const updatedItems = [...prev.items];

            // Kiểm tra tồn kho trước khi thêm
            if (product.stock_quantity <= 0) {
                toast.error(`Sản phẩm "${product.name}" đã hết hàng.`);
                return prev;
            }

            if (existingItemIndex > -1) {
                // Nếu sản phẩm đã có trong đơn, tăng số lượng
                if (updatedItems[existingItemIndex].quantity + 1 > product.stock_quantity) {
                    toast.error(`Không đủ tồn kho cho sản phẩm "${product.name}". Chỉ còn ${product.stock_quantity} sản phẩm.`);
                    return prev;
                }
                updatedItems[existingItemIndex].quantity += 1;
            } else {
                // Thêm sản phẩm mới vào đơn hàng
                if (1 > product.stock_quantity) {
                    toast.error(`Không đủ tồn kho cho sản phẩm "${product.name}". Chỉ còn ${product.stock_quantity} sản phẩm.`);
                    return prev;
                }
                updatedItems.push({
                    id: Math.random().toString(36).substring(2, 9), // ID tạm thời cho frontend
                    product_id: product.id,
                    product_name: product.name,
                    product_price: product.price,
                    quantity: 1,
                    product_image: product.images && product.images.length > 0 ? product.images[0] : null,
                    slug: product.slug, // Dùng product.slug
                });
            }
            return { ...prev, items: updatedItems, searchProductTerm: '', searchResults: [] };
        });
    }, [updateTab]);

    // Xử lý thay đổi số lượng sản phẩm trong đơn hàng
    const handleQuantityChange = useCallback((itemId: string, newQuantity: number) => {
        updateTab(prev => {
            const updatedItems = prev.items.map(item => {
                if (item.id === itemId) {
                    // Tìm sản phẩm gốc để kiểm tra tồn kho chính xác
                    // Lưu ý: searchResults chỉ có những sản phẩm đã tìm gần đây.
                    // Để chính xác hơn, bạn có thể cần fetch lại stock từ DB hoặc có cache sản phẩm tốt hơn.
                    const productInSearch = prev.searchResults.find(p => p.id === item.product_id);
                    const currentStock = productInSearch ? productInSearch.stock_quantity : Infinity; // Giả sử vô hạn nếu không tìm thấy tồn kho

                    if (newQuantity > currentStock) {
                        toast.error(`Không đủ tồn kho cho sản phẩm "${item.product_name}". Chỉ còn ${currentStock} sản phẩm.`);
                        return { ...item, quantity: currentStock > 0 ? currentStock : 1 }; // Giới hạn số lượng bằng tồn kho hoặc 1
                    }
                    return { ...item, quantity: Math.max(1, newQuantity) };
                }
                return item;
            });
            return { ...prev, items: updatedItems };
        });
    }, [updateTab]);

    // Xử lý xóa sản phẩm khỏi đơn hàng
    const handleRemoveProductFromOrder = useCallback((itemId: string) => {
        updateTab(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== itemId)
        }));
    }, [updateTab]);

    // Mutation để tạo đơn hàng mới thông qua Stored Procedure
    const createOrderMutation = useMutation({
        mutationFn: async (payload: any) => {
            // Gọi Stored Procedure public.create_order_with_customer
            const { data, error: rpcError } = await supabaseClient.rpc('create_order_with_customer', {
                p_customer_full_name: payload.customer.full_name,
                p_customer_phone: payload.customer.phone,
                p_customer_email: payload.customer.email,
                p_customer_address: payload.customer.address,
                p_selected_customer_id: payload.customer.selected_id, // Truyền selectedCustomerId nếu có
                p_auth_user_id: payload.customer.auth_user_id, // Null cho khách vãng lai, hoặc id nếu được liên kết
                p_order_items: payload.order_items,
                p_payment_method: payload.payment_method,
                p_total_amount: payload.total_amount,
                p_order_source: payload.order_source,
                p_creator_profile_id: payload.creator_profile_id, // User ID của nhân viên tạo đơn
            });

            if (rpcError) {
                console.error('Error calling create_order_with_customer RPC:', rpcError);
                throw new Error(rpcError.message || 'Lỗi không xác định khi tạo đơn hàng.');
            }
            if (data && !data.success) { // Nếu Stored Proc trả về lỗi logic nghiệp vụ
                throw new Error(data.error);
            }
            return data;
        },
        onSuccess: (data) => {
            toast.success(`Đơn hàng ${data.orderId || ''} đã được tạo thành công!`);
            // Invalidate các query cache liên quan để cập nhật dữ liệu mới nhất
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            // Xóa tab hiện tại sau khi tạo đơn thành công
            if (currentTab) {
                removeTab(currentTab.tabId);
            }
        },
        onError: (error: Error) => {
            toast.error(`Lỗi tạo đơn hàng: ${error.message}`);
        },
    });

    // Xử lý khi nhấn nút "Tạo đơn hàng"
    const handleCreateNewOrder = useCallback(() => {
        if (!user || !currentTab) return; // Đảm bảo user và currentTab đã có

        // Kiểm tra validation cơ bản
        if (!currentTab.customerName.trim() || !currentTab.customerPhone.trim() || currentTab.items.length === 0) {
            toast.error('Vui lòng nhập tên khách hàng, số điện thoại và thêm ít nhất một sản phẩm.');
            return;
        }

        const totalAmount = calculateNewOrderTotal();

        // Chuẩn bị payload theo cấu trúc mà Stored Procedure mong đợi
        const payload = {
            customer: {
                selected_id: currentTab.selectedCustomerId, // ID của khách hàng đã chọn (có thể là null)
                full_name: currentTab.customerName.trim(),
                phone: currentTab.customerPhone.trim(),
                email: currentTab.customerEmail.trim() || null,
                address: currentTab.customerAddress.trim() || null,
                auth_user_id: null, // Trong luồng POS này, ban đầu khách hàng không có auth_user_id (backend sẽ liên kết nếu tìm thấy)
            },
            order_items: currentTab.items.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.product_price,
                product_name: item.product_name,
                // product_image: item.product_image, // Stored Proc hiện tại không nhận product_image trong order_items
                // Bỏ unit vì không có cột trong DB
                // Nếu muốn lưu slug/sku vào order_items, bạn cần cập nhật SP để nhận thêm trường này.
                // Ví dụ: sku: item.slug,
            })),
            payment_method: currentTab.paymentMethod,
            total_amount: totalAmount,
            order_source: currentTab.orderSource, // Lấy từ trạng thái form (ví dụ: 'phone', 'facebook')
            creator_profile_id: user.id, // ID của nhân viên đang đăng nhập là người tạo đơn
        };

        createOrderMutation.mutate(payload);

    }, [user, currentTab, calculateNewOrderTotal, createOrderMutation]);

    // Render Logic
    if (isLoadingSession || isLoadingProfile) {
        return <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">Đang tải...</div>;
    }

    if (userRole !== 'admin' && userRole !== 'staff') {
        return <div className="min-h-screen flex items-center justify-center text-xl text-red-500">Bạn không có quyền truy cập trang này.</div>;
    }

    return (
        <div className="container mx-auto p-4 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Tạo đơn hàng Online</h1>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-300 mb-6 overflow-x-auto whitespace-nowrap">
                {openTabs.map(tab => (
                    <div
                        key={tab.tabId}
                        className={`py-2 px-4 cursor-pointer flex items-center gap-2 ${activeTabId === tab.tabId ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'}`}
                        onClick={() => setActiveTabId(tab.tabId)}
                    >
                        Đơn hàng {openTabs.indexOf(tab) + 1}
                        {openTabs.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); removeTab(tab.tabId); }} className="ml-2 text-red-500 hover:text-red-700">
                                <i className="fas fa-times-circle"></i>
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={addTab}
                    className="ml-4 py-2 px-4 bg-gray-200 text-gray-700 rounded-t-md hover:bg-gray-300 flex items-center gap-1"
                >
                    <i className="fas fa-plus"></i> Thêm tab
                </button>
            </div>

            {currentTab && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 bg-white p-8 rounded-lg shadow-md">
                    {/* Left Column: Customer & Product Info */}
                    <div className="lg:col-span-2 flex flex-col">
                        {/* Customer Information */}
                        <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Thông tin khách hàng</h3>
                        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <label htmlFor="customerSearch" className="block text-gray-700 text-sm font-bold w-full sm:w-1/4 flex-shrink-0">
                                Tìm khách hàng:
                            </label>
                            <div className="relative flex-1 w-full">
                                <input
                                    type="text"
                                    id="customerSearch"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 pr-10 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    placeholder="Tìm theo SĐT, tên, email..."
                                    value={currentTab.customerSearchTerm}
                                    onChange={(e) => {
                                        updateTab(prev => ({ ...prev, customerSearchTerm: e.target.value }));
                                    }}
                                    onKeyPress={(e) => { if (e.key === 'Enter') handleCustomerSearch(); }}
                                />
                                <button
                                    onClick={handleCustomerSearch}
                                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-600 hover:text-gray-900"
                                >
                                    <i className="fas fa-search"></i>
                                </button>
                                {currentTab.customerSearchResults.length > 0 && (
                                    <div className="absolute z-10 bg-white border border-gray-300 rounded-md mt-1 w-full shadow-lg max-h-48 overflow-y-auto">
                                        {currentTab.customerSearchResults.map(customer => (
                                            <div
                                                key={customer.id}
                                                className="p-2 border-b last:border-b-0 hover:bg-gray-100 cursor-pointer"
                                                onClick={() => handleSelectCustomer(customer)}
                                            >
                                                <p className="font-semibold">{customer.full_name}</p>
                                                <p className="text-sm text-gray-600">{customer.phone} {customer.email && ` - ${customer.email}`}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <select
                                value={currentTab.orderSource}
                                onChange={(e) => updateTab(prev => ({ ...prev, orderSource: e.target.value as NewOrderTab['orderSource'] }))}
                                className="w-full sm:w-auto py-2 px-3 border rounded shadow focus:outline-none focus:shadow-outline"
                            >
                                <option value="phone">Điện thoại</option>
                                <option value="facebook">Facebook</option>
                                <option value="zalo">Zalo</option>
                                <option value="shopee">Shopee</option>
                                <option value="lazada">Lazada</option>
                                <option value="web">Website</option>
                                <option value="other">Khác</option>
                            </select>
                        </div>

                        {/* Customer details - always editable for flexibility */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label htmlFor="customerName" className="block text-gray-700 text-sm font-bold mb-2">Tên Khách hàng:</label>
                                <input
                                    type="text"
                                    id="customerName"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={currentTab.customerName}
                                    onChange={(e) => updateTab(prev => ({ ...prev, customerName: e.target.value }))}
                                    required
                                    placeholder="Tên khách hàng"
                                />
                            </div>
                            <div>
                                <label htmlFor="customerPhone" className="block text-gray-700 text-sm font-bold mb-2">Số điện thoại:</label>
                                <input
                                    type="text"
                                    id="customerPhone"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={currentTab.customerPhone}
                                    onChange={(e) => updateTab(prev => ({ ...prev, customerPhone: e.target.value }))}
                                    required
                                    placeholder="Số điện thoại"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="customerAddress" className="block text-gray-700 text-sm font-bold mb-2">Địa chỉ:</label>
                                <textarea
                                    id="customerAddress"
                                    rows={2}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={currentTab.customerAddress}
                                    onChange={(e) => updateTab(prev => ({ ...prev, customerAddress: e.target.value }))}
                                    placeholder="Địa chỉ (tùy chọn)"
                                ></textarea>
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="customerEmail" className="block text-gray-700 text-sm font-bold mb-2">Email:</label>
                                <input
                                    type="email"
                                    id="customerEmail"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={currentTab.customerEmail}
                                    onChange={(e) => updateTab(prev => ({ ...prev, customerEmail: e.target.value }))}
                                    placeholder="Email (tùy chọn)"
                                />
                            </div>
                        </div>

                        {/* Product Information */}
                        <h3 className="text-xl font-semibold mb-4 mt-6 text-gray-800 border-b pb-2">Thông tin sản phẩm</h3>

                        <div className="mb-4 flex gap-2">
                            <input
                                type="text"
                                id="productSearch" // Thêm ID cho input search sản phẩm
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                placeholder="Tìm kiếm sản phẩm theo tên, mã SKU (slug), barcode..." // Đã sửa placeholder
                                value={currentTab.searchProductTerm}
                                onChange={(e) => updateTab(prev => ({ ...prev, searchProductTerm: e.target.value }))}
                                onKeyPress={(e) => { if (e.key === 'Enter') handleProductSearch(); }}
                            />
                            <button
                                onClick={handleProductSearch}
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                            >
                                <i className="fas fa-search"></i>
                            </button>
                        </div>

                        {currentTab.searchResults.length > 0 && (
                            <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto mb-4">
                                {currentTab.searchResults.map(product => (
                                    <div key={product.id} className="flex justify-between items-center p-2 border-b last:border-b-0 hover:bg-gray-50">
                                        <div className="flex items-center gap-2">
                                            {product.images && product.images.length > 0 && (
                                                <img src={product.images[0]} alt={product.name} className="w-8 h-8 object-cover rounded" />
                                            )}
                                            <span>{product.name} ({product.slug}) - {product.price.toLocaleString('vi-VN')} VND (Tồn: {product.stock_quantity})</span> {/* Đã sửa: dùng product.slug */}
                                        </div>
                                        <button
                                            onClick={() => handleAddProductToOrder(product)}
                                            className="bg-indigo-500 hover:bg-indigo-700 text-white text-xs font-bold py-1 px-2 rounded"
                                        >
                                            Thêm
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex-1 border border-gray-200 rounded-md overflow-hidden flex flex-col">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã SKU (Slug)</th> {/* Đã sửa text header */}
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên sản phẩm</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số lượng</th> {/* Đã xóa cột 'Đơn vị' */}
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Đơn giá</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thành tiền</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200 flex-1 overflow-y-auto max-h-80">
                                    {currentTab.items.length > 0 ? (
                                        currentTab.items.map(item => (
                                            <tr key={item.id}>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.slug}</td> {/* Đã sửa: dùng item.slug */}
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 flex items-center gap-2">
                                                    {item.product_image && <img src={item.product_image} alt={item.product_name} className="w-8 h-8 object-cover rounded" />}
                                                    {item.product_name}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                                                        className="w-16 p-1 border rounded text-center"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">{item.product_price.toLocaleString('vi-VN')} VND</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">{(item.product_price * item.quantity).toLocaleString('vi-VN')} VND</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => handleRemoveProductFromOrder(item.id)}
                                                        className="text-red-500 hover:text-red-700"
                                                        title="Xóa sản phẩm"
                                                    >
                                                        <i className="fas fa-times-circle"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-gray-600"> {/* Đã sửa colspan */}
                                                <div className="flex flex-col items-center justify-center">
                                                    <svg className="w-16 h-16 text-gray-300 mb-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-8a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zm1-5a1 1 0 011-1h.01a1 1 0 110 2H11a1 1 0 01-1-1z" clipRule="evenodd"></path>
                                                    </svg>
                                                    Đơn hàng của bạn chưa có sản phẩm nào
                                                    <button
                                                        onClick={() => (document.getElementById('productSearch') as HTMLInputElement)?.focus()}
                                                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                                    >
                                                        Thêm sản phẩm ngay
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 flex justify-between items-center border-t pt-4">
                            <button className="text-blue-600 hover:underline flex items-center gap-1">
                                <i className="fas fa-plus"></i> Thêm dịch vụ khác (F9)
                            </button>
                            <div className="text-xl font-bold text-gray-800">
                                Tổng tiền ({currentTab.items.length} sản phẩm): {calculateNewOrderTotal().toLocaleString('vi-VN')} VND
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Order Details */}
                    <div className="lg:col-span-1 flex flex-col">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Thông tin đơn hàng</h3>
                        <div className="mb-4">
                            <label htmlFor="orderId" className="block text-gray-700 text-sm font-bold mb-2">Mã đơn hàng:</label>
                            <input type="text" id="orderId" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 bg-gray-100 cursor-not-allowed" value={'Tự động tạo'} readOnly />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="branch" className="block text-gray-700 text-sm font-bold mb-2">Chi nhánh:</label>
                            <select
                                id="branch"
                                value={currentTab.branchId}
                                onChange={(e) => updateTab(prev => ({ ...prev, branchId: e.target.value }))}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            >
                                {/* Thay thế bằng ID chi nhánh thực tế */}
                                <option value="default_branch_id">Chi nhánh mặc định</option>
                                <option value="branch_2">Chi nhánh 2</option>
                            </select>
                        </div>
                        <div className="mb-4">
                            <label htmlFor="pricePolicy" className="block text-gray-700 text-sm font-bold mb-2">Chính sách giá:</label>
                            <select
                                id="pricePolicy"
                                value={currentTab.pricePolicy}
                                onChange={(e) => updateTab(prev => ({ ...prev, pricePolicy: e.target.value }))}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            >
                                <option value="retail_price">Giá bán lẻ</option>
                                <option value="wholesale_price">Giá bán buôn</option>
                                <option value="promotion_price">Giá khuyến mãi</option>
                            </select>
                        </div>
                        <div className="mb-4">
                            <label htmlFor="deliveryDate" className="block text-gray-700 text-sm font-bold mb-2">Ngày hẹn giao:</label>
                            <input
                                type="date"
                                id="deliveryDate"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={currentTab.deliveryDate}
                                onChange={(e) => updateTab(prev => ({ ...prev, deliveryDate: e.target.value }))}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="deliveryTime" className="block text-gray-700 text-sm font-bold mb-2">Giờ hẹn giao:</label>
                            <input
                                type="time"
                                id="deliveryTime"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={currentTab.deliveryTime}
                                onChange={(e) => updateTab(prev => ({ ...prev, deliveryTime: e.target.value }))}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="channelUrl" className="block text-gray-700 text-sm font-bold mb-2">Đường dẫn đơn hàng trên kênh:</label>
                            <input
                                type="url"
                                id="channelUrl"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={currentTab.channelUrl}
                                onChange={(e) => updateTab(prev => ({ ...prev, channelUrl: e.target.value }))}
                                placeholder="https://..."
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="staffName" className="block text-gray-700 text-sm font-bold mb-2">Nhân viên:</label>
                            <input type="text" id="staffName" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 bg-gray-100 cursor-not-allowed" value={profileData?.full_name || user?.user_metadata?.full_name || ''} readOnly />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="paymentMethod" className="block text-gray-700 text-sm font-bold mb-2">Phương thức thanh toán:</label>
                            <select
                                id="paymentMethod"
                                value={currentTab.paymentMethod}
                                onChange={(e) => updateTab(prev => ({ ...prev, paymentMethod: e.target.value }))}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            >
                                <option value="cod">COD</option>
                                <option value="online">Chuyển khoản</option>
                                <option value="cash">Tiền mặt</option>
                            </select>
                        </div>
                        <div className="mb-4">
                            <label htmlFor="reference" className="block text-gray-700 text-sm font-bold mb-2">Tham chiếu:</label>
                            <textarea
                                id="reference"
                                rows={2}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={currentTab.reference}
                                onChange={(e) => updateTab(prev => ({ ...prev, reference: e.target.value }))}
                                placeholder="Ghi chú nội bộ, mã tham chiếu khách hàng..."
                            ></textarea>
                        </div>

                        <div className="flex justify-end gap-4 mt-auto pt-6 border-t">
                            <button
                                onClick={() => { toast.info('Chức năng Lưu nháp chưa được cài đặt.'); }}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg focus:outline-none focus:shadow-outline"
                            >
                                Lưu nháp
                            </button>
                            <button
                                onClick={handleCreateNewOrder}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg text-lg focus:outline-none focus:shadow-outline"
                                disabled={createOrderMutation.isPending || currentTab.items.length === 0 || !currentTab.customerName.trim() || !currentTab.customerPhone.trim()}
                            >
                                {createOrderMutation.isPending ? 'Đang tạo đơn...' : 'Tạo đơn hàng'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
