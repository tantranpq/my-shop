"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, X } from 'lucide-react'; // Đảm bảo import X
import Image from 'next/image';

import { Product } from '@/types/product'; // Đảm bảo Product interface đã được cập nhật


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


// --- Constants ---
const PRODUCTS_BUCKET_NAME = 'product-images'; // Make sure this matches your Supabase bucket name
// URL ảnh mặc định cho product.image nếu không có ảnh nào được upload/chọn
const DEFAULT_PRODUCT_IMAGE_PLACEHOLDER = '/not-found.png'; // <-- CẬP NHẬT ĐƯỜNG DẪN NÀY ĐẾN ẢNH PLACEHOLDER CỦA BẠN


// Helper to generate a unique file path for Supabase Storage
function generateFilePath(file: File, folder: string): string {
    const fileExtension = file.name.split('.').pop();
    const uniqueId = uuidv4();
    return `${folder}/${uniqueId}.${fileExtension}`;
}

// --- Component chính AdminProductsPage ---
export default function AdminProductsPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const { isLoading: isLoadingSession } = useSessionContext();
    const queryClient = useQueryClient();

    // State quản lý UI/Error
    const [userRole, setUserRole] = useState<'user' | 'admin' | 'staff' |null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false); // Quản lý mở/đóng form
    const [editingProduct, setEditingProduct] = useState<Product | null>(null); // Sản phẩm đang chỉnh sửa
    const [isSubmitting, setIsSubmitting] = useState(false); // Trạng thái gửi form

    // States cho Image Upload (UPDATED for image and images)
    const [newImageFile, setNewImageFile] = useState<File | null>(null); // File mới cho cột 'image' (ảnh bìa)
    const [existingImageProductUrl, setExistingImageProductUrl] = useState<string | null>(null); // URL của ảnh bìa hiện tại

    const [newGalleryImageFiles, setNewGalleryImageFiles] = useState<File[]>([]); // Các file mới cho cột 'images' (bộ sưu tập)
    const [existingGalleryImageUrls, setExistingGalleryImageUrls] = useState<string[]>([]); // Các URL ảnh bộ sưu tập đã có
    const [imagesToDeleteFromGallery, setImagesToDeleteFromGallery] = useState<string[]>([]); // Các URL ảnh bộ sưu tập đánh dấu để xóa

    const [uploadingImagesStatus, setUploadingImagesStatus] = useState<string | null>(null); // To show upload progress message

    // States cho Phân trang
    const [currentPage, setCurrentPage] = useState(0); // Trang hiện tại (0-indexed)
    const itemsPerPage = 10; // Số sản phẩm trên mỗi trang
    const offset = currentPage * itemsPerPage;
    const limit = itemsPerPage;

    // States cho Tìm kiếm và Lọc
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string[]>(['all']);
    const [stockQuantityFilter, setStockQuantityFilter] = useState<number | ''>('');

    // Debounce effect cho tìm kiếm
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
            setCurrentPage(0);
        }, 500);

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
            setUserRole(profileData.role as 'user' | 'admin'| 'staff');
        }
    }, [profileData]);

    // --- UseQuery để lấy danh sách sản phẩm (có phân trang và tìm kiếm) ---
    const {
        data: productsData,
        isLoading: isLoadingProducts,
        error: productsQueryError,
    } = useQuery<{ products: Product[], totalCount: number | null }, Error>({
        queryKey: ['adminProducts', currentPage, debouncedSearchQuery, categoryFilter, stockQuantityFilter],
        queryFn: async () => {
            if (userRole !== 'admin' && userRole !== 'staff') {
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
                  images,       
                  stock_quantity,
                  category,
                  created_at,
                  updated_at,
                  slug
                `, { count: 'exact' });

            if (debouncedSearchQuery) {
                query = query.or(`name.ilike.%${debouncedSearchQuery}%,description.ilike.%${debouncedSearchQuery}%`);
            }

            if (categoryFilter.length > 0 && !categoryFilter.includes('all')) {
                query = query.in('category', categoryFilter);
            }

            if (stockQuantityFilter !== '' && stockQuantityFilter >= 0) {
                query = query.gte('stock_quantity', stockQuantityFilter);
            }

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            // Ensure `images` is always an array and `image` is always a string
            const productsWithTypeGuards = data ? data.map(p => ({
                ...p,
                images: Array.isArray(p.images) ? p.images : [], // Ensure images is an array
                image: typeof p.image === 'string' && p.image ? p.image : DEFAULT_PRODUCT_IMAGE_PLACEHOLDER // Ensure image is string
            })) : [];

            return { products: productsWithTypeGuards as Product[], totalCount: count };
        },
        enabled: (userRole === 'admin' || userRole === 'staff') && !isLoadingSession && !isLoadingProfile,
        staleTime: 1000 * 60,
        placeholderData: (previousData) => previousData,
    });

    const products = productsData?.products || [];
    const totalProducts = productsData?.totalCount || 0;
    const totalPages = Math.ceil(totalProducts / itemsPerPage);

    // --- UseQuery để lấy tất cả danh mục độc lập ---
    const { data: allCategoriesRaw, isLoading: isLoadingAllCategories } = useQuery<
        { category: string }[],
        Error
    >({
        queryKey: ['allCategories'],
        queryFn: async () => {
            const { data, error } = await supabaseClient
                .from('products')
                .select('category')
                .not('category', 'is', null);
            if (error) throw error;
            return data as { category: string }[];
        },
        enabled: (userRole === 'admin' || userRole === 'staff') && !isLoadingSession && !isLoadingProfile,
        staleTime: 1000 * 60 * 5,
    });

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


    // --- Hàm mở form chỉnh sửa ---
    const openEditForm = useCallback((product: Product) => {
        setEditingProduct(product);
        setNewImageFile(null); // Reset new file for main image
        setExistingImageProductUrl(product.image); // Set existing main image URL

        setNewGalleryImageFiles([]); // Reset new gallery files
        setExistingGalleryImageUrls(product.images || []); // Set existing gallery URLs
        setImagesToDeleteFromGallery([]); // Reset deletions
        setIsFormOpen(true);
    }, []);

    // --- Hàm xử lý đóng form (Reset all form states) ---
    const closeForm = useCallback(() => {
        setIsFormOpen(false);
        setEditingProduct(null);
        setNewImageFile(null);
        setExistingImageProductUrl(null); // Reset
        setNewGalleryImageFiles([]);
        setExistingGalleryImageUrls([]);
        setImagesToDeleteFromGallery([]);
        setUploadingImagesStatus(null);
    }, []);

    // --- Upload file to Supabase Storage ---
    const uploadFile = async (file: File, folder: string): Promise<string | null> => {
        const filePath = generateFilePath(file, folder);
        const { data, error } = await supabaseClient.storage
            .from(PRODUCTS_BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (error) {
            console.error(`Lỗi upload file ${file.name} to ${folder}:`, error);
            toast.error(`Lỗi upload ảnh "${file.name}": ${error.message}`);
            return null;
        }

        const { data: publicUrlData } = supabaseClient.storage
            .from(PRODUCTS_BUCKET_NAME)
            .getPublicUrl(data.path);

        return publicUrlData.publicUrl;
    };

    // --- Delete file from Supabase Storage ---
    const deleteFileFromStorage = async (url: string) => {
        try {
            // Không xóa ảnh placeholder
            if (url === DEFAULT_PRODUCT_IMAGE_PLACEHOLDER) {
                console.log("Skipping deletion of default placeholder image.");
                return;
            }

            const pathSegments = url.split(`${PRODUCTS_BUCKET_NAME}/`);
            if (pathSegments.length < 2) {
                console.warn("Could not extract storage path from URL (unexpected format):", url);
                return;
            }
            const pathInBucket = pathSegments[1];

            const { error } = await supabaseClient.storage.from(PRODUCTS_BUCKET_NAME).remove([pathInBucket]);
            if (error) {
                console.error(`Lỗi xóa ảnh từ Storage: ${url}`, error);
            } else {
                console.log(`Đã xóa ảnh: ${url}`);
            }
        } catch (e) {
            console.error("Lỗi khi chuẩn bị xóa ảnh khỏi Storage:", e);
        }
    };

    // --- Form Submission Handler (significantly updated) ---
    const handleSaveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (userRole !== 'admin' && userRole !== 'staff') {
            toast.error('Bạn không có quyền thực hiện thao tác này.');
            return;
        }

        setIsSubmitting(true);
        setUploadingImagesStatus('Đang chuẩn bị...');

        try {
            const formData = new FormData(event.currentTarget);
            const productData: Partial<Product> = {
                name: formData.get('name') as string,
                description: formData.get('description') as string,
                price: parseFloat(formData.get('price') as string),
                stock_quantity: parseInt(formData.get('stock_quantity') as string),
                category: formData.get('category') as string,
                slug: formData.get('slug') as string,
            };

            let finalImageUrl = existingImageProductUrl; // For the main 'image' column
            let finalGalleryImageUrls: string[] = [...existingGalleryImageUrls]; // For the 'images' array column


            // 1. Handle Main Image Upload (product.image)
            if (newImageFile) {
                setUploadingImagesStatus('Đang tải ảnh bìa...');
                const url = await uploadFile(newImageFile, 'covers'); // Assuming 'covers' is the folder for main images
                if (url) {
                    finalImageUrl = url;
                    // Delete old main image if it was replaced and it's not the default placeholder
                    if (existingImageProductUrl && existingImageProductUrl !== url) {
                        await deleteFileFromStorage(existingImageProductUrl);
                    }
                } else {
                    throw new Error("Tải ảnh bìa lên thất bại.");
                }
            } else if (!existingImageProductUrl && editingProduct?.image) {
                // If user cleared existing main image without selecting new one, and there was an original
                // In this case, we revert to a default placeholder.
                finalImageUrl = DEFAULT_PRODUCT_IMAGE_PLACEHOLDER;
                await deleteFileFromStorage(editingProduct.image); // Delete original if it's not the placeholder
            } else if (!finalImageUrl) {
                // If no new file and no existing URL (e.g., creating a new product without selecting image)
                finalImageUrl = DEFAULT_PRODUCT_IMAGE_PLACEHOLDER;
            }


            // 2. Handle Deletion of Marked Gallery Images
            if (imagesToDeleteFromGallery.length > 0) {
                setUploadingImagesStatus(`Đang xóa ${imagesToDeleteFromGallery.length} ảnh cũ từ bộ sưu tập...`);
                // Remove deleted images from finalGalleryImageUrls array first
                finalGalleryImageUrls = finalGalleryImageUrls.filter(url => !imagesToDeleteFromGallery.includes(url));

                for (const url of imagesToDeleteFromGallery) {
                    await deleteFileFromStorage(url);
                }
            }

            // 3. Handle New Gallery Images Upload
            if (newGalleryImageFiles.length > 0) {
                setUploadingImagesStatus(`Đang tải ${newGalleryImageFiles.length} ảnh bộ sưu tập mới...`);
                const newUrls: string[] = [];
                for (let i = 0; i < newGalleryImageFiles.length; i++) {
                    const file = newGalleryImageFiles[i];
                    setUploadingImagesStatus(`Đang tải ảnh ${i + 1}/${newGalleryImageFiles.length} của bộ sưu tập...`);
                    const url = await uploadFile(file, 'gallery'); // Assuming 'gallery' is the folder for gallery images
                    if (url) {
                        newUrls.push(url);
                    } else {
                        console.warn(`Bỏ qua ảnh "${file.name}" do lỗi tải lên.`);
                    }
                }
                finalGalleryImageUrls.push(...newUrls);
            }

            // Update productData with final image URLs
            productData.image = finalImageUrl; // Assign the non-null string
            productData.images = finalGalleryImageUrls; // Assign the array of strings

            setUploadingImagesStatus('Đang lưu thông tin sản phẩm...');

            // 4. Save product data to database
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

            if (error) {
                throw new Error(`Lỗi khi lưu sản phẩm: ${error.message}`);
            } else {
                toast.success(editingProduct ? 'Cập nhật sản phẩm thành công!' : 'Thêm sản phẩm thành công!');
                queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
                queryClient.invalidateQueries({ queryKey: ['allCategories'] });
                closeForm(); // Close and reset form
            }

        } catch (err: unknown) {
            if (err instanceof Error) {
                console.error('Lỗi trong quá trình lưu sản phẩm:', err);
                toast.error(err.message || 'Đã xảy ra lỗi không xác định.');
            } else {
                console.error('Lỗi không xác định:', err);
                toast.error('Đã xảy ra lỗi không xác định.');
            }
        } finally {

            setIsSubmitting(false);
            setUploadingImagesStatus(null);
        }
    };

    // --- Hàm xử lý xóa sản phẩm (chỉnh sửa để xóa cả image và images) ---
    const handleDeleteProduct = async (productId: string) => {
        if (userRole !== 'admin' ) {
            toast.error('Bạn không có quyền thực hiện thao tác này.');
            return;
        }
        if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này không?')) return;
        

        // Lấy thông tin sản phẩm để xóa ảnh khỏi Storage
        const { data: productToDelete, error: fetchError } = await supabaseClient
            .from('products')
            .select('image, images') // Select both image fields
            .eq('id', productId)
            .single();

        if (fetchError) {
            console.error('Lỗi khi lấy thông tin sản phẩm để xóa ảnh:', fetchError);
            toast.error('Lỗi khi xóa sản phẩm: ' + fetchError.message);
            return;
        }

        // Xóa ảnh bìa (main image)
        if (productToDelete?.image) {
            await deleteFileFromStorage(productToDelete.image);
        }

        // Xóa tất cả ảnh gallery
        if (productToDelete?.images && productToDelete.images.length > 0) {
            for (const imageUrl of productToDelete.images) {
                await deleteFileFromStorage(imageUrl);
            }
        }

        // Xóa sản phẩm khỏi database
        const { error: dbError } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', productId);

        if (dbError) {
            console.error('Lỗi khi xóa sản phẩm khỏi DB:', dbError);
            toast.error('Lỗi khi xóa sản phẩm: ' + dbError.message);
        } else {
            queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
            queryClient.invalidateQueries({ queryKey: ['allCategories'] });
            toast.success('Sản phẩm đã được xóa thành công!');
        }
    };

    useEffect(() => {
        if (!user || (userRole !== 'admin' && userRole !== 'staff')) return;

        const channel = supabaseClient
            .channel('realtime-products')
            .on(
                'postgres_changes',
                {
                    event: '*', // Có thể là 'INSERT', 'UPDATE', 'DELETE' hoặc '*'
                    schema: 'public',
                    table: 'products',
                },
                (payload) => {
                    console.log("📡 Realtime event từ Supabase:", payload);

                    // Refetch dữ liệu sản phẩm để cập nhật UI
                    queryClient.invalidateQueries({
                        queryKey: ['adminProducts'],
                    });
                }
            )
            .subscribe();

        return () => {
            supabaseClient.removeChannel(channel);
        };
    }, [supabaseClient, queryClient, user, userRole]);

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
    if (userRole !== 'admin' && userRole !== 'staff') {
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
                    onClick={() => { closeForm(); setIsFormOpen(true); }} // Use closeForm to reset states
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
                                    defaultValue={String(editingProduct?.name ?? '')}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">Mô tả:</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    defaultValue={String(editingProduct?.description ?? '')}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    rows={3}
                                ></textarea>
                            </div>
                            <div className="mb-4">
                                <label htmlFor="slug" className="block text-gray-700 text-sm font-bold mb-2">Slug:</label>
                                <input
                                    type="text"
                                    id="slug"
                                    name="slug"
                                    defaultValue={String(editingProduct?.slug ?? '')}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="price" className="block text-gray-700 text-sm font-bold mb-2">Giá:</label>
                                <input
                                    type="number"
                                    id="price"
                                    name="price"
                                    defaultValue={editingProduct?.price ?? 0}
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
                                    defaultValue={editingProduct?.stock_quantity ?? 0}
                                    min="0"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>

                            {/* --- Start Main Image Field (product.image) --- */}
                            <div className="mb-6">
                                <label htmlFor="image_upload" className="block text-gray-700 text-sm font-bold mb-2">Ảnh bìa:</label>
                                {/* Display new main image preview */}
                                {newImageFile ? (
                                    <div className="mb-2 relative w-32 h-24 border rounded overflow-hidden group">
                                        <Image src={URL.createObjectURL(newImageFile)} alt="Ảnh bìa mới" layout="fill" objectFit="cover" />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                URL.revokeObjectURL(URL.createObjectURL(newImageFile));
                                                setNewImageFile(null);
                                            }}
                                            className="absolute top-1 right-1 bg-red-500 bg-opacity-75 text-white rounded-full p-1 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                                            aria-label="Xóa ảnh bìa mới"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (existingImageProductUrl && typeof existingImageProductUrl === 'string' && existingImageProductUrl !== DEFAULT_PRODUCT_IMAGE_PLACEHOLDER) ? (
                                    // Display existing main image, allow setting to null (which means placeholder will be used on save)
                                    <div className="mb-2 relative w-32 h-24 border rounded overflow-hidden group">
                                        <Image src={existingImageProductUrl} alt="Ảnh bìa hiện tại" layout="fill" objectFit="cover" />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setExistingImageProductUrl(null); // Mark for removal (will be handled in save logic)
                                            }}
                                            className="absolute top-1 right-1 bg-red-500 bg-opacity-75 text-white rounded-full p-1 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                                            aria-label="Xóa ảnh bìa"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-gray-400 mb-2">Chưa có ảnh bìa hoặc đang sử dụng ảnh mặc định.</p>
                                )}

                                <input
                                    type="file"
                                    id="image_upload"
                                    name="image_upload"
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setNewImageFile(e.target.files[0]);
                                        } else {
                                            setNewImageFile(null);
                                        }
                                    }}
                                    className="block w-full text-sm text-gray-500
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-full file:border-0
                                            file:text-sm file:font-semibold
                                            file:bg-blue-50 file:text-blue-700
                                            hover:file:bg-blue-100"
                                />
                                {!(newImageFile || (editingProduct?.image && typeof editingProduct.image === 'string' && editingProduct.image !== DEFAULT_PRODUCT_IMAGE_PLACEHOLDER) || existingImageProductUrl) && (
                                    <p className="text-red-500 text-xs italic mt-1">Ảnh bìa là bắt buộc (sẽ dùng ảnh mặc định nếu không chọn).</p>
                                )}
                            </div>
                            {/* --- End Main Image Field --- */}


                            {/* --- Start Gallery Images Field --- */}
                            <div className="mb-6">
                                <label htmlFor="gallery_images_upload" className="block text-gray-700 text-sm font-bold mb-2">Bộ sưu tập ảnh:</label>

                                {/* Combined Existing and New Gallery Images Display */}
                                {(existingGalleryImageUrls.filter(url => !imagesToDeleteFromGallery.includes(url)).length > 0 || newGalleryImageFiles.length > 0) && (
                                    <div className="flex flex-wrap gap-2 mb-4 p-2 border rounded-md bg-gray-50">
                                        {/* Existing Images (not marked for deletion) */}
                                        {existingGalleryImageUrls.map((url, index) => (
                                            typeof url === 'string' && !imagesToDeleteFromGallery.includes(url) ? (
                                                <div key={url} className="relative w-24 h-24 border rounded overflow-hidden group">
                                                    <Image src={url} alt={`Gallery ${index}`} layout="fill" objectFit="cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setImagesToDeleteFromGallery(prev => [...prev, url]); // Mark for deletion
                                                        }}
                                                        className="absolute top-1 right-1 bg-red-500 bg-opacity-75 text-white rounded-full p-1 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                                                        aria-label="Xóa ảnh gallery"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : null
                                        ))}
                                        {/* New Images */}
                                        {newGalleryImageFiles.map((file, index) => (
                                            <div key={`new-${index}-${file.name}`} className="relative w-24 h-24 border rounded overflow-hidden group">
                                                <Image src={URL.createObjectURL(file)} alt={`New Gallery ${index}`} layout="fill" objectFit="cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        URL.revokeObjectURL(URL.createObjectURL(file));
                                                        setNewGalleryImageFiles(prev => prev.filter((_, i) => i !== index));
                                                    }}
                                                    className="absolute top-1 right-1 bg-red-500 bg-opacity-75 text-white rounded-full p-1 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                                                    aria-label="Xóa ảnh mới"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <input
                                    type="file"
                                    id="gallery_images_upload"
                                    name="gallery_images_upload"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            setNewGalleryImageFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                        }
                                    }}
                                    className="block w-full text-sm text-gray-500
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-full file:border-0
                                            file:text-sm file:font-semibold
                                            file:bg-blue-50 file:text-blue-700
                                            hover:file:bg-blue-100"
                                />
                            </div>
                            {/* --- End Gallery Images Field --- */}


                            <div className="mb-4">
                                <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">Danh mục:</label>
                                <input
                                    type="text"
                                    id="category"
                                    name="category"
                                    defaultValue={String(editingProduct?.category ?? '')}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <button
                                    type="submit"
                                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                    disabled={isSubmitting || !!uploadingImagesStatus} // Disable if any image task is ongoing
                                >
                                    {isSubmitting ? 'Đang lưu...' : (uploadingImagesStatus || (editingProduct ? 'Cập Nhật Sản Phẩm' : 'Thêm Sản Phẩm'))}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                    disabled={isSubmitting || !!uploadingImagesStatus}
                                >
                                    Hủy
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bảng hiển thị danh sách sản phẩm */}
            {products && products.length === 0 && !debouncedSearchQuery && (categoryFilter.length === 0 || categoryFilter.includes('all')) && stockQuantityFilter === '' ? (
                <p className="text-center text-gray-600 text-lg">Chưa có sản phẩm nào.</p>
            ) : products && products.length === 0 ? (
                <p className="text-center text-gray-600 text-lg">Không tìm thấy sản phẩm nào khớp với tiêu chí tìm kiếm/lọc.</p>
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ảnh bìa</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ảnh bộ sưu tập</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {products?.map((product) => (
                                <tr key={product.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">...{String(product.id).slice(-8)}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{product.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs overflow-hidden text-ellipsis">{product.description ?? 'N/A'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs overflow-hidden text-ellipsis">{product.slug ?? 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.stock_quantity}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category ?? 'N/A'}</td>
                                    {/* Main Image Column - Applied IIFE for robust type inference */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {(() => {
                                            // product.image is guaranteed to be a string or DEFAULT_PRODUCT_IMAGE_PLACEHOLDER from useQuery
                                            if (product.image && typeof product.image === 'string' && product.image !== DEFAULT_PRODUCT_IMAGE_PLACEHOLDER) {
                                                return <Image src={product.image} alt={product.name} width={40} height={40} objectFit="cover" className="rounded" />;
                                            }
                                            return <span className="text-gray-400">Không ảnh</span>;
                                        })()}
                                    </td>
                                    {/* Gallery Images Column - Applied IIFE for robust type inference */}
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {(() => {
                                            if (product.images && product.images.length > 0) {
                                                const imagesToDisplay = product.images.filter(imgUrl => typeof imgUrl === 'string').slice(0, 3);
                                                const remainingImagesCount = product.images.length - 3;
                                                return (
                                                    <div className="flex flex-wrap gap-1">
                                                        {imagesToDisplay.map((imgUrl, idx) => (
                                                            <Image key={idx} src={imgUrl} alt={`${product.name} gallery ${idx}`} width={30} height={30} objectFit="cover" className="rounded" />
                                                        ))}
                                                        {remainingImagesCount > 0 && (
                                                            <span className="text-gray-500 text-xs mt-1">+{remainingImagesCount}</span>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return <span className="text-gray-400">Không có</span>;
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => openEditForm(product)}
                                            className="text-indigo-600 hover:text-indigo-900 mr-4"
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

            {/* Pagination Controls */}
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
                                    className={`flex items-center justify-center px-4 h-10 leading-tight border border-gray-300 hover:bg-gray-100 hover:text-gray-700 ${currentPage === index ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-500 bg-white'
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