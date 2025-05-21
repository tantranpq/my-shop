"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react'; // Import icons

// --- Interfaces for Product Data ---
interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image: string | null; // Tên cột trong DB và trong frontend
    stock_quantity: number;
    category: string | null;
    created_at: string;
    updated_at: string;
    slug: string | null; // <-- Đã thêm slug
}

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


// --- Component chính AdminProductsPage ---
export default function AdminProductsPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const { isLoading: isLoadingSession } = useSessionContext();
    const queryClient = useQueryClient();

    // State quản lý UI/Error
    // const [error, setError] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false); // Quản lý mở/đóng form
    const [editingProduct, setEditingProduct] = useState<Product | null>(null); // Sản phẩm đang chỉnh sửa
    const [isSubmitting, setIsSubmitting] = useState(false); // Trạng thái gửi form

    // States cho Image Upload
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    // States cho Phân trang
    const [currentPage, setCurrentPage] = useState(0); // Trang hiện tại (0-indexed)
    const itemsPerPage = 10; // Số sản phẩm trên mỗi trang
    const offset = currentPage * itemsPerPage;
    const limit = itemsPerPage;

    // States cho Tìm kiếm và Lọc
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string[]>(['all']); // Changed to array for multi-select
    const [stockQuantityFilter, setStockQuantityFilter] = useState<number | ''>(''); // New state for stock quantity filter

    // Debounce effect cho tìm kiếm
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
            setCurrentPage(0); // Reset về trang đầu khi có tìm kiếm mới
        }, 500); // 500ms delay

        return () => {
            clearTimeout(handler);
        };
    }, [searchQuery]);

    // --- UseQuery để lấy vai trò người dùng ---
    const { data: profileData, isLoading: isLoadingProfile, error: profileError } = useQuery({
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
            setUserRole(profileData.role as 'user' | 'admin');
        }
    }, [profileData]);

    // --- UseQuery để lấy danh sách sản phẩm (có phân trang và tìm kiếm) ---
    const {
        data: productsData,
        isLoading: isLoadingProducts,
        error: productsQueryError,
    } = useQuery< { products: Product[], totalCount: number | null }, Error>({
        queryKey: ['adminProducts', currentPage, debouncedSearchQuery, categoryFilter, stockQuantityFilter], // Add new filters to queryKey
        queryFn: async () => {
            if (userRole !== 'admin') {
                throw new Error('Bạn không có quyền xem sản phẩm.');
            }
            console.log("Fetching products as admin with TanStack Query...");

            let query = supabaseClient
                .from('products')
                .select(`
                  id,
                  name,
                  description,
                  price,
                  image,
                  stock_quantity,
                  category,
                  created_at,
                  updated_at,
                  slug
                `, { count: 'exact' });

            // Áp dụng tìm kiếm nếu có
            if (debouncedSearchQuery) {
                query = query.or(`name.ilike.%${debouncedSearchQuery}%,description.ilike.%${debouncedSearchQuery}%`);
            }

            // Apply category filter (multi-select)
            if (categoryFilter.length > 0 && !categoryFilter.includes('all')) {
                query = query.in('category', categoryFilter);
            }

            // Apply stock quantity filter
            if (stockQuantityFilter !== '' && stockQuantityFilter >= 0) {
                query = query.gte('stock_quantity', stockQuantityFilter);
            }

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return { products: data as unknown as Product[], totalCount: count };
        },
        enabled: userRole === 'admin' && !isLoadingSession && !isLoadingProfile,
        staleTime: 1000 * 60,
        placeholderData: (previousData) => previousData,
    });

    // Extract products and totalCount from productsData
    const products = productsData?.products || [];
    const totalProducts = productsData?.totalCount || 0;
    const totalPages = Math.ceil(totalProducts / itemsPerPage);

    // --- NEW: UseQuery để lấy tất cả danh mục độc lập ---
    const { data: allCategoriesRaw, isLoading: isLoadingAllCategories } = useQuery<
        { category: string }[],
        Error
    >({
        queryKey: ['allCategories'],
        queryFn: async () => {
            const { data, error } = await supabaseClient
                .from('products')
                .select('category')
                .not('category', 'is', null); // Removed .distinct() from here

            if (error) throw error;
            return data as { category: string }[];
        },
        enabled: userRole === 'admin' && !isLoadingSession && !isLoadingProfile,
        staleTime: 1000 * 60 * 5, // Categories don't change often, longer stale time
    });

    // Extract unique categories for the filter dropdown from allCategoriesRaw
    const uniqueCategoriesOptions: MultiSelectOption[] = useMemo(() => {
        const categories = new Set<string>();
        if (allCategoriesRaw && Array.isArray(allCategoriesRaw)) {
            allCategoriesRaw.forEach(item => {
                if (item.category) {
                    categories.add(item.category);
                }
            });
        }
        const sortedCategories = Array.from(categories).sort();
        return [{ value: 'all', label: 'Tất cả' }, ...sortedCategories.map(cat => ({ value: cat, label: cat }))];
    }, [allCategoriesRaw]);


    // --- Hàm xử lý thêm/cập nhật sản phẩm ---
    const handleSaveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user?.id || userRole !== 'admin') {
            toast.error('Bạn không có quyền thực hiện thao tác này.');
            return;
        }

        setIsSubmitting(true);

        const formData = new FormData(event.currentTarget);
        const productData: Partial<Product> = {
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            price: parseFloat(formData.get('price') as string),
            stock_quantity: parseInt(formData.get('stock_quantity') as string),
            category: formData.get('category') as string,
            slug: formData.get('slug') as string, // <-- Lấy slug từ form
        };

        let imageUrlToSave: string | null = null;

        // Xử lý upload ảnh nếu có file mới được chọn
        if (selectedImageFile) {
            setUploadingImage(true);
            const fileExtension = selectedImageFile.name.split('.').pop();
            const fileName = `${uuidv4()}.${fileExtension}`;
            const filePath = `product_images/${fileName}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('product-images')
                .upload(filePath, selectedImageFile, {
                    cacheControl: '3600',
                    upsert: false,
                });

            setUploadingImage(false);

            if (uploadError) {
                console.error('Lỗi khi tải ảnh lên:', uploadError);
                toast.error('Lỗi khi tải ảnh lên: ' + uploadError.message);
                setIsSubmitting(false);
                return;
            }

            const { data: publicUrlData } = supabaseClient.storage
                .from('product-images')
                .getPublicUrl(filePath);

            imageUrlToSave = publicUrlData.publicUrl;
        } else if (editingProduct && editingProduct.image) {
            imageUrlToSave = editingProduct.image;
        } else {
            imageUrlToSave = null;
        }

        productData.image = imageUrlToSave;

        let error;
        if (editingProduct) {
            ({ error } = await supabaseClient
                .from('products')
                .update(productData)
                .eq('id', editingProduct.id));
        } else {
            ({ error } = await supabaseClient
                .from('products')
                .insert([productData]));
        }

        setIsSubmitting(false);

        if (error) {
            console.error('Lỗi khi lưu sản phẩm:', error);
            toast.error('Lỗi khi lưu sản phẩm: ' + error.message);
        } else {
            queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
            queryClient.invalidateQueries({ queryKey: ['allCategories'] }); // Invalidate allCategories to update filter options
            setIsFormOpen(false);
            setEditingProduct(null);
            setSelectedImageFile(null);
            toast.success('Sản phẩm đã được lưu thành công!');
        }
    };

    // --- Hàm xử lý xóa sản phẩm ---
    const handleDeleteProduct = async (productId: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này không?')) return;
        if (!user?.id || userRole !== 'admin') {
            toast.error('Bạn không có quyền thực hiện thao tác này.');
            return;
        }

        const { error: dbError, data: productToDelete } = await supabaseClient
            .from('products')
            .select('image')
            .eq('id', productId)
            .single();

        if (dbError) {
            console.error('Lỗi khi lấy thông tin sản phẩm để xóa ảnh:', dbError);
            toast.error('Lỗi khi xóa sản phẩm: ' + dbError.message);
            return;
        }

        // Xóa ảnh khỏi Supabase Storage nếu có
        if (productToDelete && productToDelete.image) {
            try {
                const imageUrl = productToDelete.image;
                const pathInBucket = imageUrl.split('public/product-images/')[1];

                if (pathInBucket) {
                    const { error: storageError } = await supabaseClient.storage
                        .from('product-images')
                        .remove([pathInBucket]);

                    if (storageError) {
                        console.error('Lỗi khi xóa ảnh khỏi Storage:', storageError);
                    }
                }
            } catch (e) {
                console.error("Lỗi khi phân tích URL ảnh để xóa:", e);
            }
        }

        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) {
            console.error('Lỗi khi xóa sản phẩm khỏi DB:', error);
            toast.error('Lỗi khi xóa sản phẩm: ' + error.message);
        } else {
            queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
            queryClient.invalidateQueries({ queryKey: ['allCategories'] }); // Invalidate allCategories to update filter options
            toast.success('Sản phẩm đã được xóa thành công!');
        }
    };

    // --- Render logic dựa trên trạng thái ---
    if (isLoadingSession || isLoadingProfile || isLoadingProducts || isLoadingAllCategories) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                {isLoadingSession ? "Đang tải phiên đăng nhập..." : isLoadingProfile ? "Đang kiểm tra quyền..." : "Đang tải sản phẩm và danh mục..."}
            </div>
        );
    }

    if (profileError) {
        return <div className="min-h-screen flex items-center justify-center text-xl text-red-500">Lỗi: {profileError.message}</div>;
    }
    if (productsQueryError) {
        return <div className="min-h-screen flex items-center justify-center text-xl text-red-500">Lỗi khi tải sản phẩm: {productsQueryError.message}</div>;
    }
    if (userRole !== 'admin') {
        return <div className="min-h-screen flex items-center justify-center text-xl text-red-500">Bạn không có quyền truy cập trang quản trị này.</div>;
    }

    // --- Render giao diện khi không có lỗi và đã tải xong ---
    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Quản lý Sản phẩm</h1>

            <div className="flex justify-between items-center mb-4">
                {/* Input tìm kiếm */}
                <input
                    type="text"
                    placeholder="Tìm kiếm sản phẩm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="shadow appearance-none border rounded w-1/3 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
                {/* Nút thêm sản phẩm mới */}
                <button
                    onClick={() => { setIsFormOpen(true); setEditingProduct(null); setSelectedImageFile(null); }}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                >
                    Thêm Sản phẩm mới
                </button>
            </div>

            {/* Các bộ lọc */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Lọc theo Danh mục */}
                <div>
                    <label htmlFor="categoryFilter" className="block text-gray-700 text-sm font-bold mb-2">Danh mục</label>
                    <MultiSelect
                        options={uniqueCategoriesOptions}
                        selectedValues={categoryFilter}
                        onChange={setCategoryFilter}
                        placeholder="Chọn danh mục"
                    />
                </div>

                {/* Lọc theo Tồn kho tối thiểu */}
                <div>
                    <label htmlFor="stockQuantityFilter" className="block text-gray-700 text-sm font-bold mb-2">Tồn kho tối thiểu</label>
                    <input
                        type="number"
                        id="stockQuantityFilter"
                        value={stockQuantityFilter}
                        onChange={(e) => setStockQuantityFilter(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder="Số lượng tối thiểu"
                        min="0"
                    />
                </div>
            </div>


            {/* Form thêm/chỉnh sửa sản phẩm (Modal/Overlay) */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-4">
                            {editingProduct ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản phẩm mới'}
                        </h2>
                        <form onSubmit={handleSaveProduct}>
                            <div className="mb-4">
                                <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Tên sản phẩm:</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    defaultValue={editingProduct?.name || ''}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">Mô tả:</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    defaultValue={editingProduct?.description || ''}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    rows={3}
                                ></textarea>
                            </div>
                            {/* Input cho Slug */}
                            <div className="mb-4">
                                 <label htmlFor="slug" className="block text-gray-700 text-sm font-bold mb-2">Slug:</label>
                                <input
                                    type="text"
                                    id="slug"
                                    name="slug"
                                    defaultValue={editingProduct?.slug || ''}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                            </div>
                            {/* Hết Input cho Slug */}
                            <div className="mb-4">
                                <label htmlFor="price" className="block text-gray-700 text-sm font-bold mb-2">Giá:</label>
                                <input
                                    type="number"
                                    id="price"
                                    name="price"
                                    defaultValue={editingProduct?.price || 0}
                                    step="0.01"
                                    min="0"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="stock_quantity" className="block text-gray-700 text-sm font-bold mb-2">Số lượng tồn kho:</label>
                                <input
                                    type="number"
                                    id="stock_quantity"
                                    name="stock_quantity"
                                    defaultValue={editingProduct?.stock_quantity || 0}
                                    min="0"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="image_upload" className="block text-gray-700 text-sm font-bold mb-2">Chọn ảnh:</label>
                                <input
                                    type="file"
                                    id="image_upload"
                                    name="image_upload"
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSelectedImageFile(e.target.files[0]);
                                        } else {
                                            setSelectedImageFile(null);
                                        }
                                    }}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                                {(editingProduct?.image && !selectedImageFile) && (
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-600">Ảnh hiện tại:</p>
                                        <img src={editingProduct.image} alt="Current Product" className="h-20 w-20 object-cover rounded mt-1" />
                                    </div>
                                )}
                                {selectedImageFile && (
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-600">Ảnh mới:</p>
                                        <img src={URL.createObjectURL(selectedImageFile)} alt="Preview" className="h-20 w-20 object-cover rounded mt-1" />
                                    </div>
                                )}
                                {uploadingImage && <p className="text-sm text-blue-600 mt-2">Đang tải ảnh lên...</p>}
                            </div>
                            <div className="mb-4">
                                <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">Danh mục:</label>
                                <input
                                    type="text"
                                    id="category"
                                    name="category"
                                    defaultValue={editingProduct?.category || ''}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <button
                                    type="submit"
                                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                    disabled={isSubmitting || uploadingImage}
                                >
                                    {isSubmitting ? 'Đang lưu...' : (uploadingImage ? 'Đang tải ảnh...' : 'Lưu sản phẩm')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsFormOpen(false);
                                        setEditingProduct(null);
                                        setSelectedImageFile(null);
                                    }}
                                    className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                    disabled={isSubmitting || uploadingImage}
                                >
                                    Hủy
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bảng hiển thị danh sách sản phẩm */}
            {products && products.length === 0 && !debouncedSearchQuery ? (
                <p className="text-center text-gray-600 text-lg">Chưa có sản phẩm nào.</p>
            ) : products && products.length === 0 && debouncedSearchQuery ? (
                <p className="text-center text-gray-600 text-lg">Không tìm thấy sản phẩm nào khớp với: <strong>{debouncedSearchQuery}</strong></p>
            ) : (
                <div className="overflow-x-auto bg-white shadow-md rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên sản phẩm</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mô tả</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giá</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tồn kho</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Danh mục</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ảnh</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {products?.map((product) => (
                                <tr key={product.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">...{String(product.id).slice(-8)}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{product.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs overflow-hidden text-ellipsis">{product.description || 'N/A'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs overflow-hidden text-ellipsis">{product.slug || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.stock_quantity}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {product.image ? (
                                            <img src={product.image} alt={product.name} className="h-10 w-10 object-cover rounded" />
                                        ) : (
                                            <span className="text-gray-400">Không ảnh</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => { setIsFormOpen(true); setEditingProduct(product); setSelectedImageFile(null); }}
                                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                                        >
                                            Sửa
                                        </button>
                                        <button
                                            onClick={() => handleDeleteProduct(product.id)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination controls */}
            {totalPages > 1 && (
                <nav className="flex justify-center mt-4">
                    <ul className="flex items-center -space-x-px h-10 text-base">
                        <li>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                                disabled={currentPage === 0}
                                className="flex items-center justify-center px-4 h-10 ms-0 leading-tight text-gray-500 bg-white border border-e-0 border-gray-300 rounded-s-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Trước
                            </button>
                        </li>
                        {[...Array(totalPages)].map((_, index) => (
                            <li key={index}>
                                <button
                                    onClick={() => setCurrentPage(index)}
                                    className={`flex items-center justify-center px-4 h-10 leading-tight border border-gray-300 hover:bg-gray-100 hover:text-gray-700 ${
                                        currentPage === index ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-500 bg-white'
                                    }`}
                                >
                                    {index + 1}
                                </button>
                            </li>
                        ))}
                        <li>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                                disabled={currentPage === totalPages - 1}
                                className="flex items-center justify-center px-4 h-10 leading-tight text-gray-500 bg-white border border-gray-300 rounded-e-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Tiếp
                            </button>
                        </li>
                    </ul>
                </nav>
            )}
        </div>
    );
}
