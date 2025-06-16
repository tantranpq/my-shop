// app/admin/sales/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
// import { format } from 'date-fns'; // Not strictly needed for POS only view
// import { vi } from 'date-fns/locale'; // Not strictly needed for POS only view

// Định nghĩa kiểu dữ liệu cho một mục trong đơn hàng từ bảng order_items
interface OrderItem {
    id: string; // Temporary ID for frontend list (e.g., Math.random().toString(36).substring(2, 9))
    product_id: string; // Actual product ID from products table
    product_name: string;
    product_price: number;
    quantity: number;
    product_image: string | null; // Cập nhật tên cột (tương ứng product_imag trong DB nếu giữ nguyên)
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
    searchResults: { id: string; name: string; price: number; images: string[] | null; stock_quantity: number }[]; // **Đã sửa: stock_quantity**
}

export default function SalesPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const { isLoading: isLoadingSession } = useSessionContext();
    const queryClient = useQueryClient();

    const [userRole, setUserRole] = useState<'user' | 'admin' | 'staff' | null>(null);
    const [currentTabId, setCurrentTabId] = useState<string>(''); // ID of the currently active tab
    const [orderTabs, setOrderTabs] = useState<NewOrderTab[]>([]); // Array to hold multiple order tabs

    // Handlers for managing tabs - Đặt các hàm useCallback lên đầu để tránh lỗi 'used before declaration'
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
        };
        setOrderTabs(prevTabs => [...prevTabs, newTab]);
        setCurrentTabId(newTabId);
    }, []); // Không có dependencies vì nó không sử dụng state hay props bên ngoài

    const handleRemoveTab = useCallback((tabIdToRemove: string) => {
        if (orderTabs.length === 1) {
            // If only one tab left, just reset it instead of removing
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
                }
            ]);
            setCurrentTabId(orderTabs[0].tabId);
            return;
        }

        setOrderTabs(prevTabs => prevTabs.filter(tab => tab.tabId !== tabIdToRemove));
        // Switch to another tab if the current one is removed
        if (currentTabId === tabIdToRemove) {
            const remainingTabs = orderTabs.filter(tab => tab.tabId !== tabIdToRemove);
            if (remainingTabs.length > 0) {
                setCurrentTabId(remainingTabs[0].tabId);
            }
        }
    }, [currentTabId, orderTabs]); // Added orderTabs to dependencies

    const handleTabChange = useCallback((tabId: string) => {
        setCurrentTabId(tabId);
    }, []);

    // Callbacks to update current tab's state
    const updateCurrentTab = useCallback((updater: (prevTab: NewOrderTab) => NewOrderTab) => {
        setOrderTabs(prevTabs =>
            prevTabs.map(tab => (tab.tabId === currentTabId ? updater(tab) : tab))
        );
    }, [currentTabId]);


    // Helper to get the current active tab's state
    const currentTab = orderTabs.find(tab => tab.tabId === currentTabId);


    // Handlers for new order creation (specific to current tab)
    const handleSearchProducts = useCallback(async () => {
        if (!currentTab?.searchProductTerm.trim()) {
            updateCurrentTab(prev => ({ ...prev, searchResults: [] }));
            return;
        }

        const { data, error } = await supabaseClient
            .from('products')
            .select('id, name, price, images, stock_quantity') // **Đã sửa: stock_quantity**
            .ilike('name', `%${currentTab.searchProductTerm}%`)
            .limit(10);

        if (error) {
            toast.error(`Lỗi tìm kiếm sản phẩm: ${error.message}`);
            updateCurrentTab(prev => ({ ...prev, searchResults: [] }));
            return;
        }
        updateCurrentTab(prev => ({ ...prev, searchResults: data }));
    }, [currentTab?.searchProductTerm, supabaseClient, updateCurrentTab]);


    const handleAddProductToNewOrder = useCallback((product: { id: string; name: string; price: number; images: string[] | null; stock_quantity: number }) => { // **Đã sửa: stock_quantity**
        if (!currentTab) return;

        // Kiểm tra tồn kho trước khi thêm vào đơn hàng
        if (product.stock_quantity <= 0) { // **Đã sửa: stock_quantity**
            toast.error(`Sản phẩm "${product.name}" đã hết hàng.`);
            return;
        }

        const existingItemIndex = currentTab.items.findIndex(item => item.product_id === product.id);

        updateCurrentTab(prev => {
            const updatedItems = [...prev.items];
            if (existingItemIndex > -1) {
                // Kiểm tra nếu số lượng yêu cầu vượt quá tồn kho khả dụng
                if (updatedItems[existingItemIndex].quantity + 1 > product.stock_quantity) { // **Đã sửa: stock_quantity**
                     toast.error(`Không đủ tồn kho cho sản phẩm "${product.name}". Chỉ còn ${product.stock_quantity} sản phẩm.`); // **Đã sửa: stock_quantity**
                     return prev; // Trả về trạng thái trước đó nếu không đủ tồn kho
                }
                updatedItems[existingItemIndex].quantity += 1;
            } else {
                 if (1 > product.stock_quantity) { // Kiểm tra nếu thêm 1 sản phẩm đã vượt quá tồn kho // **Đã sửa: stock_quantity**
                     toast.error(`Không đủ tồn kho cho sản phẩm "${product.name}". Chỉ còn ${product.stock_quantity} sản phẩm.`); // **Đã sửa: stock_quantity**
                     return prev;
                 }
                updatedItems.push({
                    id: Math.random().toString(36).substring(2, 9), // Temporary unique ID for frontend list
                    product_id: product.id,
                    product_name: product.name,
                    product_price: product.price,
                    quantity: 1,
                    product_image: product.images && product.images.length > 0 ? product.images[0] : null,
                });
            }
            return { ...prev, items: updatedItems, searchProductTerm: '', searchResults: [] };
        });
    }, [currentTab, updateCurrentTab]);


    const handleQuantityChange = useCallback((itemId: string, newQuantity: number) => {
        if (!currentTab) return;

        // Cần tìm sản phẩm gốc để lấy thông tin tồn kho chính xác
        // Tốt nhất là fetch lại hoặc có một cache sản phẩm toàn diện.
        // Tạm thời, sẽ tìm trong searchResults của tab hiện tại.
        const itemInOrder = currentTab.items.find(i => i.id === itemId);
        const productFromSearch = currentTab.searchResults.find(p => p.id === itemInOrder?.product_id);

        updateCurrentTab(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id === itemId) {
                    if (productFromSearch && newQuantity > productFromSearch.stock_quantity) { // **Đã sửa: stock_quantity**
                        toast.error(`Không đủ tồn kho cho sản phẩm "${item.product_name}". Chỉ còn ${productFromSearch.stock_quantity} sản phẩm.`); // **Đã sửa: stock_quantity**
                        return { ...item, quantity: productFromSearch.stock_quantity > 0 ? productFromSearch.stock_quantity : 1 }; // Giới hạn số lượng bằng tồn kho
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


    // Fetch user role
    const { data: profileData, isLoading: isLoadingProfile } = useQuery({
        queryKey: ['userProfile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('role, full_name, email, phone, address') // Thêm các trường cần thiết cho profile
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

    // Initialize first tab when component mounts and user role is determined
    useEffect(() => {
        if ((userRole === 'admin' || userRole === 'staff') && orderTabs.length === 0) {
            handleAddTab();
        }
    }, [userRole, orderTabs.length, handleAddTab]); // Thêm handleAddTab vào dependency

    // Mutation to create a new order and update stock using Edge Function
    const createOrderMutation = useMutation({
        mutationFn: async (payloadData: { // Đổi tên thành payloadData để tránh nhầm lẫn
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
        }) => {
            // Call the Edge Function "place-order"
            const { data, error } = await supabaseClient.functions.invoke('place-order', {
                body: JSON.stringify(payloadData), // Gửi payloadData đã định dạng
                // You might need to set headers like 'Content-Type': 'application/json'
                // if your Edge Function expects it explicitly. Supabase usually handles this.
            });

            if (error) {
                // Supabase functions.invoke typically returns error as part of the data object
                // or throws it if the network call itself fails.
                // We'll check for a custom error structure from the Edge Function first
                if (data && data.error) {
                    throw new Error(data.error); // Error from the Edge Function's response body
                }
                throw new Error(error.message || 'Lỗi không xác định khi gọi Edge Function'); // Network or other invoke error
            }

            // Check for application-level errors returned by the Edge Function inside 'data'
            if (data && data.error) {
                throw new Error(data.error);
            }
            
            return data; // The data returned by your Edge Function
        },
        onSuccess: (data) => {
            toast.success(`Đơn hàng ${data.orderId?.substring(0, 8) || 'mới'}... đã được tạo thành công!`); // Assuming your Edge Function returns an orderId
            // Remove the completed tab
            setOrderTabs(prevTabs => prevTabs.filter(tab => tab.tabId !== currentTabId));
            // If no tabs left, add a new empty one, otherwise switch to the next available tab
            if (orderTabs.length === 1) { // If this was the last tab (before filtering)
                handleAddTab();
            } else if (orderTabs.length > 1) {
                // Find the next tab to activate
                const remainingTabs = orderTabs.filter(tab => tab.tabId !== currentTabId);
                if (remainingTabs.length > 0) {
                    setCurrentTabId(remainingTabs[0].tabId);
                } else {
                    // This case should ideally not happen if length > 1, but as a fallback
                    handleAddTab();
                }
            }
            // Invalidate products query cache to reflect new stock (if you have a product list page)
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
        onError: (error: Error) => {
            // Hiển thị lỗi rõ ràng hơn, đặc biệt là lỗi tồn kho từ Edge Function
            toast.error(`Lỗi tạo đơn hàng mới: ${error.message}`);
        },
    });

    const handleCreateNewOrder = useCallback(() => {
        if (!currentTab || !user || !profileData) return; // Đảm bảo user và profileData đã có

        if (!currentTab.customerName.trim() || !currentTab.customerPhone.trim() || currentTab.items.length === 0) {
            toast.error('Vui lòng nhập tên khách hàng, số điện thoại và thêm ít nhất một sản phẩm.');
            return;
        }

        const totalAmount = calculateNewOrderTotal();

        // Chuẩn bị payload theo cấu trúc mà Edge Function mong đợi
        const payloadForEdgeFunction = {
            profile: {
                full_name: currentTab.customerName.trim(),
                email: currentTab.customerEmail.trim() || null,
                phone: currentTab.customerPhone.trim(),
                address: currentTab.customerAddress.trim() || null,
            },
            checkoutItems: currentTab.items.map(item => ({
                product_id: item.product_id!,
                product_name: item.product_name,
                product_price: item.product_price,
                quantity: item.quantity,
                product_image: item.product_image, // Add this if your RPC expects it for logging
            })),
            paymentMethod: currentTab.paymentMethod,
            totalAmount: totalAmount,
            userId: user.id, // Sử dụng user.id từ useUser()
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
                                            <span>{product.name} - {product.price.toLocaleString('vi-VN')} VND (Tồn: {product.stock_quantity})</span> {/* **Đã sửa: stock_quantity** */}
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
                                    disabled={createOrderMutation.isPending || currentTab.items.length === 0 || !currentTab.customerName.trim() || !currentTab.customerPhone.trim()}
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