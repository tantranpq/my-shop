// app/profile/page.tsx
"use client";
import { useState, useEffect, Suspense, useCallback, useMemo, useRef } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import axios from 'axios'; // Import axios for API calls
import { v4 as uuidv4 } from 'uuid'; // For generating unique file names

// Định nghĩa các interface cho dữ liệu từ DB
interface ProfileData { // Dữ liệu từ bảng 'profiles'
    full_name: string | null;
    phone: string | null;
    role: 'user' | 'admin' | 'staff' | null;
    avatar_url: string | null; // NEW: Thêm cột avatar_url
}

interface CustomerData { // Dữ liệu từ bảng 'customers'
    id: string; // customer_id (đây sẽ là ID của địa chỉ)
    full_name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null; // This will now be the combined full address string
    profile_id: string | null; // Liên kết với profiles.id (user.id)
    is_default: boolean; // Cột is_default
    province_name: string | null; // Tên tỉnh/thành phố
    district_name: string | null; // Tên quận/huyện
    ward_name: string | null; // Tên phường/xã
    province_id: string | null; // ID tỉnh/thành phố
    district_id: string | null; // ID quận/huyện
    ward_id: string | null; // ID phường/xã
}

// Interface hợp nhất cho Profile hiển thị trên UI
interface UserProfile {
    authId: string; // user.id từ Supabase Auth
    fullName: string; // From profiles
    email: string; // From auth
    phone: string; // From profiles
    customerAddresses: CustomerData[]; // Mảng các địa chỉ từ bảng customers
    role: 'user' | 'admin' | 'staff' | null;
    avatarUrl: string | null; // NEW: Thêm avatarUrl vào UserProfile
}

// Interfaces for external API (provinces.open-api.vn)
interface Province {
    code: number; // Changed to number based on API examples
    name: string;
}

interface District {
    code: number; // Changed to number based on API examples
    name: string;
    parent_code: number; // Province code - Changed to number
}

interface Ward {
    code: number; // Changed to number based on API examples
    name: string;
    parent_code: number; // District code - Changed to number
}

interface Order {
    id: string;
    creator_profile_id: string | null;
    customer_id: string | null;
    total_amount: number;
    payment_method: 'unconfirmed_cod' | 'pending_online' | 'confirmed' | 'paid' | 'failed' | 'refunded' | 'completed';
    status: 'pending' | 'delivery' | 'delivered' | 'returned' | 'cancelled' | string;
    created_at: string;
    expires_at: string | null;
    items: OrderItem[];
}

interface OrderItem {
    product_id: string;
    quantity: number;
    product_price: number;
    product_name: string;
    product_image: string | null;
}

const translatePaymentStatus = (status: Order['payment_method']): string => {
    switch (status) {
        case 'unconfirmed_cod': return 'Chờ xác nhận (COD)';
        case 'pending_online': return 'Chờ thanh toán trực tuyến';
        case 'confirmed': return 'Đã xác nhận';
        case 'paid': return 'Đã thanh toán';
        case 'failed': return 'Thất bại';
        case 'refunded': return 'Đã hoàn tiền';
        case 'completed': return 'Hoàn thành';
        default: return status;
    }
};

const translateOrderStatus = (status: Order['status']): string => {
    switch (status) {
        case 'pending': return 'Chờ xác nhận';
        case 'delivery': return 'Chờ giao hàng';
        case 'delivered': return 'Đã giao';
        case 'returned': return 'Trả hàng';
        case 'cancelled': return 'Đã huỷ';
        default: return status;
    }
};


function ProfileContent() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { isLoading: isLoadingSession } = useSessionContext();
    const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input

    // State cho thông tin cơ bản (profiles)
    const [editingBasicInfo, setEditingBasicInfo] = useState(false);
    const [fullNameInput, setFullNameInput] = useState('');
    const [phoneInput, setPhoneInput] = useState('');
    const [isSavingBasicInfo, setIsSavingBasicInfo] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null); // NEW: State for selected avatar file
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null); // NEW: State for avatar preview

    // States for address book (customers)
    const [editingAddress, setEditingAddress] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [addressFormFullName, setAddressFormFullName] = useState('');
    const [addressFormPhone, setAddressFormPhone] = useState('');
    const [addressFormStreetHouseNumber, setAddressFormStreetHouseNumber] = useState(''); // Specific field for street/house number
    const [addressFormIsDefault, setAddressFormIsDefault] = useState(false);
    const [isSavingAddress, setIsSavingAddress] = useState(false);

    // States for dropdowns (connected to API)
    // Keep as string because HTML select values are strings, then convert to number for comparison
    const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
    const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
    const [selectedWardId, setSelectedWardId] = useState<string | null>(null);

    // State for custom address deletion
    const [showDeleteAddressConfirm, setShowDeleteAddressConfirm] = useState(false);
    const [addressToDelete, setAddressToDelete] = useState<CustomerData | null>(null);

    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // State để quản lý tab hiện tại
    const [selectedTab, setSelectedTab] = useState<'profile' | 'addresses' | 'orders'>('profile');

    // State cho cảnh báo đổi mật khẩu
    const [showPasswordChangeConfirm, setShowPasswordChangeConfirm] = useState(false);


    // --- API Data Fetching for Provinces, Districts, Wards ---
    const { data: provinces, isLoading: isLoadingProvinces, error: provincesError } = useQuery<Province[], Error>({
        queryKey: ['provinces'],
        queryFn: async () => {
            const { data } = await axios.get('https://provinces.open-api.vn/api/p/');
            return data;
        },
        staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
    });

    const { data: districts, isLoading: isLoadingDistricts, error: districtsError } = useQuery<District[], Error>({
        queryKey: ['districts', selectedProvinceId],
        queryFn: async () => {
            if (!selectedProvinceId) return [];
            // Ensure ID is number for API call if it expects number
            const { data } = await axios.get(`https://provinces.open-api.vn/api/p/${Number(selectedProvinceId)}?depth=2`);
            return data.districts || [];
        },
        enabled: !!selectedProvinceId,
        staleTime: 1000 * 60 * 60, // Cache for 1 hour
    });

    const { data: wards, isLoading: isLoadingWards, error: wardsError } = useQuery<Ward[], Error>({
        queryKey: ['wards', selectedDistrictId],
        queryFn: async () => {
            if (!selectedDistrictId) return [];
            // Ensure ID is number for API call if it expects number
            const { data } = await axios.get(`https://provinces.open-api.vn/api/d/${Number(selectedDistrictId)}?depth=2`);
            return data.wards || [];
        },
        enabled: !!selectedDistrictId,
        staleTime: 1000 * 60 * 60, // Cache for 1 hour
    });


    // Fetch profile data from 'profiles' table
    const { data: profileFromDb, isLoading: isLoadingProfile } = useQuery<ProfileData | null, Error>({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user) return null;
            // NEW: Select avatar_url
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('full_name, phone, role, avatar_url')
                .eq('id', user.id)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }
            return data;
        },
        enabled: !!user && !isLoadingSession,
        staleTime: 1000 * 60 * 5,
    });

    // Fetch customer data from 'customers' table (for addresses)
    const { data: customerFromDb, isLoading: isLoadingCustomer } = useQuery<CustomerData[] | null, Error>({
        queryKey: ['customerAddresses', user?.id],
        queryFn: async () => {
            if (!user) return null;
            // Select all fields, including the new name and ID fields
            const { data, error } = await supabaseClient
                .from('customers')
                .select('id, full_name, phone, email, address, profile_id, is_default, province_name, district_name, ward_name, province_id, district_id, ward_id')
                .eq('profile_id', user.id);
            if (error) {
                if (error.code === 'PGRST116') {
                    return [];
                }
                throw error;
            }
            return data;
        },
        enabled: !!user && !isLoadingSession,
        staleTime: 1000 * 60 * 5,
    });

    // Fetch orders data (kept)
    const { data: orders, isLoading: isLoadingOrders, error: ordersError } = useQuery<Order[], Error>({
        queryKey: ['orders', user?.id],
        queryFn: async () => {
            if (!user) throw new Error('User not logged in.');
            const { data, error } = await supabaseClient
                .from('orders')
                .select(`
                    id,
                    customer_id,
                    total_amount,
                    payment_method,
                    status,
                    created_at,
                    expires_at,
                    creator_profile_id,
                    items
                `);

            if (error) throw error;
            return data.map((order: Order) => ({
  id: order.id,
  customer_id: order.customer_id,
  total_amount: order.total_amount,
  payment_method: order.payment_method,
  status: order.status,
  created_at: order.created_at,
  expires_at: order.expires_at,
  creator_profile_id: order.creator_profile_id,
  items: order.items || [],
}));

        },
        enabled: !!user && !isLoadingSession,
        staleTime: 1000 * 60 * 2,
    });

    // Combine profile data for UI
    const currentUserProfile: UserProfile | null = useMemo(() => {
        if (!user) return null;

        const basicFullName = profileFromDb?.full_name || user.user_metadata?.full_name || '';
        const basicPhone = profileFromDb?.phone || user.user_metadata?.phone || '';
        const basicEmail = user.email || '';
        const basicRole = profileFromDb?.role || 'user';
        const basicAvatarUrl = profileFromDb?.avatar_url || null; // NEW

        // Sort addresses: default first, then by creation date
        const sortedAddresses = (customerFromDb || []).sort((a, b) => {
            if (a.is_default && !b.is_default) return -1;
            if (!a.is_default && b.is_default) return 1;
            // Fallback to a stable sort if both are default/non-default (e.g., by ID or creation date if available)
            return a.id.localeCompare(b.id);
        });

        return {
            authId: user.id,
            fullName: basicFullName,
            email: basicEmail,
            phone: basicPhone,
            customerAddresses: sortedAddresses,
            role: basicRole,
            avatarUrl: basicAvatarUrl, // NEW
        };
    }, [user, profileFromDb, customerFromDb]);


    // Effect để khởi tạo giá trị cho các form input khi dữ liệu profile được tải
    useEffect(() => {
        if (currentUserProfile) {
            setFullNameInput(currentUserProfile.fullName);
            setPhoneInput(currentUserProfile.phone);
            setAvatarPreviewUrl(currentUserProfile.avatarUrl); // NEW: Set initial avatar preview

            // Set initial address form values (if any default address exists)
            if (currentUserProfile.customerAddresses && currentUserProfile.customerAddresses.length > 0) {
                const initialAddress = currentUserProfile.customerAddresses.find(addr => addr.is_default) || currentUserProfile.customerAddresses[0];
                setAddressFormFullName(initialAddress.full_name || '');
                setAddressFormPhone(initialAddress.phone || '');
                setAddressFormIsDefault(initialAddress.is_default);

                // Set dropdown IDs - ensure they are converted to string as select value is string
                setSelectedProvinceId(initialAddress.province_id ? String(initialAddress.province_id) : null);
                setSelectedDistrictId(initialAddress.district_id ? String(initialAddress.district_id) : null);
                setSelectedWardId(initialAddress.ward_id ? String(initialAddress.ward_id) : null);

                // For editing, populate the street/house number
                // Simple logic to extract street/house number from combined address
                let streetHousePart = initialAddress.address || '';
                if (initialAddress.ward_name && streetHousePart.includes(initialAddress.ward_name)) {
                    streetHousePart = streetHousePart.split(`, ${initialAddress.ward_name}`)[0].trim();
                } else if (initialAddress.district_name && streetHousePart.includes(initialAddress.district_name)) {
                    streetHousePart = streetHousePart.split(`, ${initialAddress.district_name}`)[0].trim();
                } else if (initialAddress.province_name && streetHousePart.includes(initialAddress.province_name)) {
                    streetHousePart = streetHousePart.split(`, ${initialAddress.province_name}`)[0].trim();
                }
                setAddressFormStreetHouseNumber(streetHousePart);

                setEditingAddressId(initialAddress.id);
            } else {
                // Reset form for new address entry if no addresses exist
                setAddressFormFullName('');
                setAddressFormPhone('');
                setAddressFormStreetHouseNumber('');
                setSelectedProvinceId(null);
                setSelectedDistrictId(null);
                setSelectedWardId(null);
                setAddressFormIsDefault(false);
                setEditingAddressId(null);
                setEditingAddress(false);
            }
        }
    }, [currentUserProfile]);


    // Handle initial loading and redirection logic
    useEffect(() => {
        if (!isLoadingSession && !user) {
            toast.info('Bạn cần đăng nhập để xem trang này.');
            router.replace('/login');
        } else if (!isLoadingSession && user && !isLoadingProfile && !isLoadingCustomer) {
            if (profileFromDb?.role && (profileFromDb.role === 'admin' || profileFromDb.role === 'staff')) {
                toast.info('Bạn là quản trị viên/nhân viên. Đang chuyển hướng đến khu vực quản trị.');
                router.replace('/admin/dashboard');
            }
        }
    }, [isLoadingSession, user, isLoadingProfile, isLoadingCustomer, profileFromDb, router]);


    // Hàm cập nhật thông tin cơ bản (bảng 'profiles') - Kept
    const handleUpdateBasicInfo = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingBasicInfo(true);
        try {
            if (!user) throw new Error('User not logged in.');

            let avatarUrlToSave = currentUserProfile?.avatarUrl;

            // NEW: Handle avatar upload if a new file is selected
            if (avatarFile) {
                const fileExtension = avatarFile.name.split('.').pop();
                const newFileName = `${user.id}/${uuidv4()}.${fileExtension}`; // Unique path for each user's avatar

                // Upload the new avatar
                const { error: uploadError } = await supabaseClient.storage
                    .from('avatars') // Your storage bucket name
                    .upload(newFileName, avatarFile, {
                        cacheControl: '3600',
                        upsert: true // Overwrite if file with same name exists (though uuid should prevent)
                    });

                if (uploadError) throw new Error(`Lỗi tải ảnh đại diện: ${uploadError.message}`);

                // Get public URL
                const { data: publicUrlData } = supabaseClient.storage
                    .from('avatars')
                    .getPublicUrl(newFileName);

                if (publicUrlData) {
                    avatarUrlToSave = publicUrlData.publicUrl;
                }

                // Optionally, delete old avatar if it exists and a new one was uploaded
                if (currentUserProfile?.avatarUrl) {
                    try {
                        const oldPath = currentUserProfile.avatarUrl.split('/avatars/')[1];
                        if (oldPath && oldPath !== newFileName) {
                            const { error: deleteError } = await supabaseClient.storage
                                .from('avatars')
                                .remove([oldPath]);
                            if (deleteError) console.warn('Không thể xóa ảnh đại diện cũ:', deleteError.message);
                        }
                    } catch (deleteErr) {
                        console.warn('Lỗi khi xử lý xóa ảnh đại diện cũ:', deleteErr);
                    }
                }
            } else if (avatarPreviewUrl === null && currentUserProfile?.avatarUrl) {
                // User explicitly cleared the avatar (preview is null, but there was an old one)
                try {
                    const oldPath = currentUserProfile.avatarUrl.split('/avatars/')[1];
                    if (oldPath) {
                        const { error: deleteError } = await supabaseClient.storage
                            .from('avatars')
                            .remove([oldPath]);
                        if (deleteError) console.warn('Không thể xóa ảnh đại diện cũ:', deleteError.message);
                    }
                } catch (deleteErr) {
                    console.warn('Lỗi khi xử lý xóa ảnh đại diện cũ (khi clear):', deleteErr);
                }
                avatarUrlToSave = null; // Set avatar_url to null in DB
            }


            const updates = {
                full_name: fullNameInput.trim(),
                phone: phoneInput.trim(),
                avatar_url: avatarUrlToSave, // NEW: Include avatar_url in updates
            };

            const { error } = await supabaseClient
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
            setEditingBasicInfo(false);
            setAvatarFile(null); // Clear selected file after saving
            toast.success('Cập nhật thông tin cơ bản thành công!');
        } catch (error: unknown) {
            console.error('Lỗi khi cập nhật thông tin cơ bản:', error);
            if (error instanceof Error) {
                toast.error('Lỗi: ' + error.message);
            } else {
                toast.error('Lỗi khi cập nhật thông tin cơ bản.');
            }
        } finally {
            setIsSavingBasicInfo(false);
        }
    }, [user, fullNameInput, phoneInput, avatarFile, avatarPreviewUrl, currentUserProfile?.avatarUrl, supabaseClient, queryClient]);


    // NEW: Handle file input change for avatar
    const handleAvatarChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            // Basic file type validation (optional, but good practice)
            if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
                toast.error('Chỉ chấp nhận các định dạng ảnh JPEG, PNG, GIF, WEBP.');
                setAvatarFile(null);
                if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input
                return;
            }
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast.error('Kích thước ảnh không được vượt quá 5MB.');
                setAvatarFile(null);
                if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input
                return;
            }

            setAvatarFile(file);
            setAvatarPreviewUrl(URL.createObjectURL(file)); // Create a URL for immediate preview
        } else {
            setAvatarFile(null);
            setAvatarPreviewUrl(null); // No file selected, clear preview
        }
    }, []);

    // NEW: Handle avatar removal click
    const handleRemoveAvatar = useCallback(() => {
        setAvatarFile(null);
        setAvatarPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Clear the actual file input
        }
        toast.info('Ảnh đại diện đã được xóa khỏi lựa chọn. Nhấn "Lưu thay đổi" để áp dụng.');
    }, []);


    // --- Address Management Functions ---
    const handleCloseAddressForm = useCallback(() => {
        setEditingAddress(false);
        setEditingAddressId(null);
        setAddressFormFullName('');
        setAddressFormPhone('');
        setAddressFormStreetHouseNumber('');
        setSelectedProvinceId(null);
        setSelectedDistrictId(null);
        setSelectedWardId(null);
        setAddressFormIsDefault(false);
    }, []);

    const handleAddNewAddress = useCallback(() => {
        handleCloseAddressForm(); // Reset form
        setEditingAddress(true);
        setEditingAddressId(null);
        setAddressFormIsDefault(currentUserProfile?.customerAddresses.length === 0); // First address is default
        setAddressFormFullName(currentUserProfile?.fullName || ''); // Pre-fill with user's profile info
        setAddressFormPhone(currentUserProfile?.phone || ''); // Pre-fill with user's profile info
    }, [handleCloseAddressForm, currentUserProfile]);

    const handleEditAddress = useCallback((address: CustomerData) => {
        setEditingAddress(true);
        setEditingAddressId(address.id);
        setAddressFormFullName(address.full_name || '');
        setAddressFormPhone(address.phone || '');
        setAddressFormIsDefault(address.is_default);

        // Set dropdowns - ensure they are converted to string as select value is string
        setSelectedProvinceId(address.province_id ? String(address.province_id) : null);
        setSelectedDistrictId(address.district_id ? String(address.district_id) : null);
        setSelectedWardId(address.ward_id ? String(address.ward_id) : null);

        // Extract street/house number from combined address
        let streetHousePart = address.address || '';
        if (address.ward_name && streetHousePart.includes(address.ward_name)) {
            streetHousePart = streetHousePart.split(`, ${address.ward_name}`)[0].trim();
        } else if (address.district_name && streetHousePart.includes(address.district_name)) {
            streetHousePart = streetHousePart.split(`, ${address.district_name}`)[0].trim();
        } else if (address.province_name && streetHousePart.includes(address.province_name)) {
            // FIX: Changed from initialAddress to address
            streetHousePart = streetHousePart.split(`, ${address.province_name}`)[0].trim();
        }
        setAddressFormStreetHouseNumber(streetHousePart);

    }, []);


    const handleSaveAddress = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingAddress(true);
        try {
            if (!user) throw new Error('User not logged in.');

            const streetHouseNumber = addressFormStreetHouseNumber.trim();

            if (!addressFormFullName.trim() || !addressFormPhone.trim() || !streetHouseNumber) {
                toast.error('Vui lòng điền đầy đủ Họ tên, Số điện thoại và Số nhà/Tên đường.');
                return;
            }

            if (!selectedProvinceId) {
                toast.error('Vui lòng chọn Tỉnh/Thành phố.');
                return;
            }
            if (!selectedDistrictId) {
                toast.error('Vui lòng chọn Quận/Huyện.');
                return;
            }
            if (!selectedWardId) {
                toast.error('Vui lòng chọn Phường/Xã.');
                return;
            }

            // Get names from selected IDs, ensuring type consistency for comparison
            const selectedProvince = provinces?.find(p => p.code === Number(selectedProvinceId));
            const selectedDistrict = districts?.find(d => d.code === Number(selectedDistrictId));
            const selectedWard = wards?.find(w => w.code === Number(selectedWardId));

            const provinceName = selectedProvince?.name || null;
            const districtName = selectedDistrict?.name || null;
            const wardName = selectedWard?.name || null;

            // More specific error messages if API data lookup fails
            if (!provinceName) {
                toast.error('Không tìm thấy Tỉnh/Thành phố đã chọn. Vui lòng chọn lại.');
                return;
            }
            if (!districtName) {
                toast.error('Không tìm thấy Quận/Huyện đã chọn. Vui lòng chọn lại.');
                return;
            }
            if (!wardName) {
                toast.error('Không tìm thấy Phường/Xã đã chọn. Vui lòng chọn lại.');
                return;
            }

            const fullAddress = `${streetHouseNumber}, ${wardName}, ${districtName}, ${provinceName}`;

            const customerUpdates: Partial<CustomerData> = {
                full_name: addressFormFullName.trim(),
                phone: addressFormPhone.trim(),
                email: user.email,
                address: fullAddress, // Save combined full address string
                profile_id: user.id,
                is_default: addressFormIsDefault,
                province_id: selectedProvinceId, // Store as string to match select value
                district_id: selectedDistrictId, // Store as string to match select value
                ward_id: selectedWardId, // Store as string to match select value
                province_name: provinceName,
                district_name: districtName,
                ward_name: wardName,
            };

            // Logic to handle default address:
            // If the new/edited address is set as default,
            // ensure all other addresses for this profile are set to non-default.
            if (addressFormIsDefault) {
                let query = supabaseClient
                    .from('customers')
                    .update({ is_default: false })
                    .eq('profile_id', user.id);

                // Conditionally add the neq filter only if editing an existing address
                if (editingAddressId) {
                    query = query.neq('id', editingAddressId);
                }

                await query;
            }

            if (editingAddressId) {
                // Update existing address
                const { error } = await supabaseClient
                    .from('customers')
                    .update(customerUpdates)
                    .eq('id', editingAddressId);

                if (error) throw error;
                toast.success('Cập nhật địa chỉ thành công!');
            } else {
                // Add new address
                // If this is the very first address, make it default regardless of checkbox
                if (currentUserProfile?.customerAddresses.length === 0) {
                    customerUpdates.is_default = true;
                }

                const { error } = await supabaseClient
                    .from('customers')
                    .insert(customerUpdates);

                if (error) throw error;
                toast.success('Thêm địa chỉ mới thành công!');
            }

            queryClient.invalidateQueries({ queryKey: ['customerAddresses', user.id] });
            handleCloseAddressForm();
        } catch (error: unknown) {
            console.error('Lỗi khi lưu địa chỉ:', error);
            if (error instanceof Error) {
                toast.error('Lỗi: ' + error.message);
            } else {
                toast.error('Lỗi khi lưu địa chỉ.');
            }
        } finally {
            setIsSavingAddress(false);
        }
    }, [
        user,
        addressFormFullName,
        addressFormPhone,
        addressFormStreetHouseNumber,
        selectedProvinceId,
        selectedDistrictId,
        selectedWardId,
        addressFormIsDefault,
        editingAddressId,
        provinces,
        districts,
        wards,
        supabaseClient,
        queryClient,
        currentUserProfile?.customerAddresses.length,
        handleCloseAddressForm
    ]);

    const handleSetAsDefault = useCallback(async (addressId: string) => {
        setIsSavingAddress(true); // Use saving state for this too
        try {
            if (!user) throw new Error('User not logged in.');

            // Set all addresses of the user to not default
            await supabaseClient
                .from('customers')
                .update({ is_default: false })
                .eq('profile_id', user.id);

            // Set the selected address as default
            const { error } = await supabaseClient
                .from('customers')
                .update({ is_default: true })
                .eq('id', addressId);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['customerAddresses', user.id] });
            toast.success('Địa chỉ đã được đặt làm mặc định!');
        } catch (error: unknown) {
            console.error('Lỗi khi đặt địa chỉ mặc định:', error);
            if (error instanceof Error) {
                toast.error('Lỗi: ' + error.message);
            } else {
                toast.error('Lỗi khi đặt địa chỉ mặc định.');
            }
        } finally {
            setIsSavingAddress(false);
        }
    }, [user, supabaseClient, queryClient]);


    const handleDeleteAddress = useCallback((address: CustomerData) => {
        setAddressToDelete(address);
        setShowDeleteAddressConfirm(true);
    }, []);

    const confirmDeleteAddress = useCallback(async () => {
        if (!addressToDelete || !user) return;

        setIsSavingAddress(true); // Use saving state for this too
        try {
            const wasDefault = addressToDelete.is_default;

            const { error } = await supabaseClient
                .from('customers')
                .delete()
                .eq('id', addressToDelete.id);

            if (error) throw error;

            toast.success('Địa chỉ đã được xóa thành công!');

            // Logic to reassign default if the deleted address was default
            if (wasDefault) {
                // Get remaining addresses
                const remainingAddresses = currentUserProfile?.customerAddresses.filter(
                    (addr) => addr.id !== addressToDelete.id
                ) || [];

                if (remainingAddresses.length > 0) {
                    // Set the first remaining address as the new default
                    const newDefaultAddressId = remainingAddresses[0].id;
                    await supabaseClient
                        .from('customers')
                        .update({ is_default: true })
                        .eq('id', newDefaultAddressId);
                    toast.info('Địa chỉ mặc định đã được cập nhật.');
                }
            }

            queryClient.invalidateQueries({ queryKey: ['customerAddresses', user.id] });
            setShowDeleteAddressConfirm(false);
            setAddressToDelete(null);
        } catch (error: unknown) {
            console.error('Lỗi khi xóa địa chỉ:', error);
            if (error instanceof Error) {
                toast.error('Lỗi: ' + error.message);
            } else {
                toast.error('Lỗi khi xóa địa chỉ.');
            }
        } finally {
            setIsSavingAddress(false);
        }
    }, [addressToDelete, user, supabaseClient, queryClient, currentUserProfile?.customerAddresses]);

    // Order details dialog functions
    const handleOpenOrderDetailsDialog = useCallback((order: Order) => {
        setSelectedOrder(order);
    }, []);

    const handleCloseOrderDetailsDialog = useCallback(() => {
        setSelectedOrder(null);
    }, []);

    // Realtime subscription for orders (kept)
    useEffect(() => {
        if (user?.id) {
            const channel = supabaseClient
                .channel(`orders_for_user_${user.id}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'orders' },
                    (payload) => {
                        console.log('Realtime order change received!', payload);
                        queryClient.invalidateQueries({ queryKey: ['orders', user.id] });
                        if (payload.eventType === 'INSERT') {
                            toast.info("Có đơn hàng mới!");
                        } else if (payload.eventType === 'UPDATE') {
                            toast.info("Đơn hàng đã được cập nhật.");
                        } else if (payload.eventType === 'DELETE') {
                            toast.info("Đơn hàng đã bị xóa.");
                        }
                    }
                )
                .subscribe();

            return () => {
                supabaseClient.removeChannel(channel);
            };
        }
    }, [user?.id, supabaseClient, queryClient]);

    // Realtime subscription for customer addresses (NEW)
    useEffect(() => {
        if (user?.id) {
            const channel = supabaseClient
                .channel(`customer_addresses_for_user_${user.id}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'customers', filter: `profile_id=eq.${user.id}` },
                    (payload) => {
                        console.log('Realtime customer address change received!', payload);
                        queryClient.invalidateQueries({ queryKey: ['customerAddresses', user.id] });
                        if (payload.eventType === 'INSERT') {
                            toast.info("Địa chỉ mới đã được thêm!");
                        } else if (payload.eventType === 'UPDATE') {
                            toast.info("Địa chỉ đã được cập nhật.");
                        } else if (payload.eventType === 'DELETE') {
                            toast.info("Địa chỉ đã bị xóa.");
                        }
                    }
                )
                .subscribe();

            return () => {
                supabaseClient.removeChannel(channel);
            };
        }
    }, [user?.id, supabaseClient, queryClient]);

    // Realtime subscription for profile changes (NEW)
    useEffect(() => {
        if (user?.id) {
            const channel = supabaseClient
                .channel(`profile_for_user_${user.id}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
                    (payload) => {
                        console.log('Realtime profile change received!', payload);
                        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
                        if (payload.eventType === 'UPDATE') {
                            toast.info("Thông tin hồ sơ đã được cập nhật.");
                        }
                    }
                )
                .subscribe();

            return () => {
                supabaseClient.removeChannel(channel);
            };
        }
    }, [user?.id, supabaseClient, queryClient]);


    // Handle loading states for UI
    if (isLoadingSession || isLoadingProfile || isLoadingCustomer || !user || isLoadingProvinces) {
        return (
            <div className="flex justify-center items-center min-h-screen text-lg text-gray-700">
                {isLoadingSession || isLoadingProfile || isLoadingCustomer || isLoadingProvinces ? "Đang tải thông tin cá nhân và dữ liệu địa chỉ..." : "Đang tải dữ liệu..."}
            </div>
        );
    }

    if (!currentUserProfile) {
        return null;
    }

    if (currentUserProfile.role && (currentUserProfile.role === 'admin' || currentUserProfile.role === 'staff')) {
        return null; // Should be redirected by useEffect
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">Thông tin cá nhân của bạn</h1>

            {/* Icon Navigation Bar */}
            <div className="flex justify-center md:justify-around items-center bg-white shadow-lg rounded-lg p-3 mb-8 overflow-x-auto space-x-4 md:space-x-0">
                <button
                    onClick={() => setSelectedTab('profile')}
                    className={`flex flex-col items-center p-2 rounded-lg transition-colors duration-200 ${selectedTab === 'profile' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <i className="fas fa-user text-2xl mb-1"></i>
                    <span className="text-xs font-semibold whitespace-nowrap">Hồ sơ</span>
                </button>
                <button
                    onClick={() => setSelectedTab('addresses')}
                    className={`flex flex-col items-center p-2 rounded-lg transition-colors duration-200 ${selectedTab === 'addresses' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <i className="fas fa-map-marker-alt text-2xl mb-1"></i>
                    <span className="text-xs font-semibold whitespace-nowrap">Sổ địa chỉ</span>
                </button>
                <button
                    onClick={() => setSelectedTab('orders')}
                    className={`flex flex-col items-center p-2 rounded-lg transition-colors duration-200 ${selectedTab === 'orders' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <i className="fas fa-history text-2xl mb-1"></i>
                    <span className="text-xs font-semibold whitespace-nowrap">Đơn mua</span>
                </button>
                <button
                    onClick={() => setShowPasswordChangeConfirm(true)}
                    className="flex flex-col items-center p-2 rounded-lg transition-colors duration-200 text-gray-600 hover:bg-gray-100"
                >
                    <i className="fas fa-key text-2xl mb-1"></i>
                    <span className="text-xs font-semibold whitespace-nowrap">Đổi mật khẩu</span>
                </button>
            </div>

            {/* Conditional Content Rendering */}
            {selectedTab === 'profile' && (
                /* THÔNG TIN CƠ BẢN */
                <div className="bg-white shadow-lg rounded-xl p-6 md:p-8 mb-8 border border-gray-200">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 pb-4 border-b border-gray-200">
                        <h2 className="text-2xl font-semibold text-gray-800 flex items-center mb-4 md:mb-0">
                            <i className="fas fa-user text-blue-600 mr-3 text-2xl"></i>Thông tin cơ bản
                        </h2>
                        {!editingBasicInfo ? (
                            <button
                                type="button"
                                onClick={() => setEditingBasicInfo(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg shadow-md transition-all duration-200 flex items-center text-sm md:text-base"
                            >
                                <i className="fas fa-edit mr-2"></i>Chỉnh sửa
                            </button>
                        ) : (
                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingBasicInfo(false);
                                        setAvatarFile(null); // Clear pending avatar changes
                                        setAvatarPreviewUrl(currentUserProfile?.avatarUrl); // Revert preview to current avatar
                                        setFullNameInput(currentUserProfile?.fullName || '');
                                        setPhoneInput(currentUserProfile?.phone || '');
                                    }}
                                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-5 rounded-lg shadow-md transition-all duration-200 flex items-center text-sm md:text-base"
                                    disabled={isSavingBasicInfo}
                                >
                                    <i className="fas fa-times mr-2"></i>Hủy
                                </button>
                                <button
                                    type="submit"
                                    onClick={handleUpdateBasicInfo}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm md:text-base"
                                    disabled={isSavingBasicInfo}
                                >
                                    <i className="fas fa-save mr-2"></i>{isSavingBasicInfo ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        )}
                    </div>
                    <form onSubmit={handleUpdateBasicInfo}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Avatar Section */}
                            <div className="col-span-1 md:col-span-2 flex flex-col items-center py-4 px-6 rounded-lg bg-blue-50/50 border border-blue-100 shadow-sm">
                                <label htmlFor="avatarUpload" className="block text-gray-700 text-base font-semibold mb-3">Ảnh đại diện:</label>
                                <div className="relative w-36 h-36 rounded-full overflow-hidden border-4 border-blue-400 shadow-lg group">
                                    {avatarPreviewUrl ? (
                                        <img
                                            src={avatarPreviewUrl}
                                            alt="Ảnh đại diện"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-6xl">
                                            <i className="fas fa-user-circle"></i>
                                        </div>
                                    )}
                                    {editingBasicInfo && (
                                        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <label
                                                htmlFor="avatarUpload"
                                                className="cursor-pointer text-white text-4xl hover:text-blue-300 transition-colors mx-2"
                                                title="Chọn ảnh mới"
                                            >
                                                <i className="fas fa-camera"></i>
                                            </label>
                                            {avatarPreviewUrl && (
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveAvatar}
                                                    className="text-white text-4xl hover:text-red-300 transition-colors mx-2"
                                                    title="Xóa ảnh"
                                                >
                                                    <i className="fas fa-trash-alt"></i>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {editingBasicInfo && (
                                    <input
                                        type="file"
                                        id="avatarUpload"
                                        ref={fileInputRef}
                                        accept="image/jpeg,image/png,image/gif,image/webp"
                                        onChange={handleAvatarChange}
                                        className="hidden" // Hide the default file input
                                    />
                                )}
                            </div>

                            {/* Full Name */}
                            <div className="flex flex-col md:flex-row md:items-center bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                                <i className="fas fa-user text-gray-600 mr-4 text-2xl md:text-xl flex-shrink-0 mb-2 md:mb-0"></i>
                                <div className="flex-1">
                                    <label htmlFor="fullName" className="block text-gray-700 text-sm font-semibold mb-1">Tên đầy đủ:</label>
                                    {editingBasicInfo ? (
                                        <input
                                            type="text"
                                            id="fullName"
                                            value={fullNameInput}
                                            onChange={(e) => setFullNameInput(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                            placeholder="Nhập tên đầy đủ của bạn"
                                            required
                                        />
                                    ) : (
                                        <p className="text-gray-800 text-lg font-medium">{currentUserProfile?.fullName || 'Chưa cập nhật'}</p>
                                    )}
                                </div>
                            </div>

                            {/* Email */}
                            <div className="flex flex-col md:flex-row md:items-center bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                                <i className="fas fa-envelope text-gray-600 mr-4 text-2xl md:text-xl flex-shrink-0 mb-2 md:mb-0"></i>
                                <div className="flex-1">
                                    <label htmlFor="email" className="block text-gray-700 text-sm font-semibold mb-1">Email:</label>
                                    <p id="email" className="text-gray-800 text-lg font-medium">{currentUserProfile?.email || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="flex flex-col md:flex-row md:items-center bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                                <i className="fas fa-phone text-gray-600 mr-4 text-2xl md:text-xl flex-shrink-0 mb-2 md:mb-0"></i>
                                <div className="flex-1">
                                    <label htmlFor="phone" className="block text-gray-700 text-sm font-semibold mb-1">Số điện thoại:</label>
                                    {editingBasicInfo ? (
                                        <input
                                            type="tel"
                                            id="phone"
                                            value={phoneInput}
                                            onChange={(e) => setPhoneInput(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                            placeholder="Nhập số điện thoại"
                                            required
                                        />
                                    ) : (
                                        <p className="text-gray-800 text-lg font-medium">{currentUserProfile?.phone || 'Chưa cập nhật'}</p>
                                    )}
                                </div>
                            </div>

                            {/* Role */}
                            <div className="flex flex-col md:flex-row md:items-center bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                                <i className="fas fa-user-tag text-gray-600 mr-4 text-2xl md:text-xl flex-shrink-0 mb-2 md:mb-0"></i>
                                <div className="flex-1">
                                    <label htmlFor="role" className="block text-gray-700 text-sm font-semibold mb-1">Vai trò:</label>
                                    <p id="role" className="text-gray-800 text-lg font-medium capitalize">{currentUserProfile?.role || 'user'}</p>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Address Book Section */}
            {selectedTab === 'addresses' && (
                <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h2 className="text-2xl font-semibold text-gray-700 flex items-center">
                            <i className="fas fa-map-marker-alt text-blue-500 mr-3 text-2xl"></i>Sổ địa chỉ
                        </h2>
                        <button
                            type="button"
                            onClick={handleAddNewAddress}
                            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center"
                        >
                            <i className="fas fa-plus mr-2"></i>Thêm địa chỉ mới
                        </button>
                    </div>

                    <div className="space-y-4">
                        {currentUserProfile?.customerAddresses && currentUserProfile.customerAddresses.length > 0 ? (
                            currentUserProfile.customerAddresses.map((addr) => (
                                <div key={addr.id} className="border border-gray-200 rounded-lg p-4 shadow-sm relative">
                                    {addr.is_default && (
                                        <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                            Mặc định
                                        </span>
                                    )}
                                    <p className="text-lg font-semibold text-gray-800">{addr.full_name}</p>
                                    <p className="text-gray-600">SĐT: {addr.phone}</p>
                                    {/* Display full address from combined string */}
                                    <p className="text-gray-600">Địa chỉ: {addr.address || 'N/A'}</p>
                                    <div className="mt-3 flex space-x-2">
                                        <button
                                            onClick={() => handleEditAddress(addr)}
                                            className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold py-1 px-3 rounded-lg shadow-sm transition-colors duration-200"
                                        >
                                            Chỉnh sửa
                                        </button>
                                        {!addr.is_default && (
                                            <button
                                                onClick={() => handleSetAsDefault(addr.id)}
                                                className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold py-1 px-3 rounded-lg shadow-sm transition-colors duration-200"
                                                disabled={isSavingAddress}
                                            >
                                                Đặt làm mặc định
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteAddress(addr)}
                                            className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1 px-3 rounded-lg shadow-sm transition-colors duration-200"
                                            disabled={isSavingAddress}
                                        >
                                            Xóa
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600 text-center py-4">Bạn chưa có địa chỉ nào được lưu.</p>
                        )}
                    </div>
                </div>
            )}

            {selectedTab === 'orders' && (
                /* ĐƠN MUA */
                <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h2 className="text-2xl font-semibold text-gray-700 flex items-center">
                            <i className="fas fa-history text-blue-500 mr-3 text-2xl"></i>Đơn mua
                        </h2>
                    </div>

                    {isLoadingOrders ? (
                        <div className="text-center py-8">
                            <i className="fas fa-spinner fa-spin text-blue-500 text-3xl"></i>
                            <p className="mt-2 text-gray-600">Đang tải đơn hàng của bạn...</p>
                        </div>
                    ) : ordersError ? (
                        <div className="text-center py-8 text-red-600">
                            <p>Lỗi khi tải đơn hàng: {ordersError.message}</p>
                            <p>Vui lòng thử lại sau.</p>
                        </div>
                    ) : orders && orders.length > 0 ? (
                        <div className="space-y-4">
                            {orders.map((order) => (
                                <div key={order.id} className="border border-gray-200 rounded-lg p-4 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-lg font-bold text-gray-800">Mã đơn hàng: #{order.id.substring(0, 8)}</p>
                                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                            order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {translateOrderStatus(order.status)}
                                        </span>
                                    </div>
                                    <p className="text-gray-600">Tổng tiền: {order.total_amount.toLocaleString('vi-VN')} VNĐ</p>
                                    <p className="text-gray-600">Phương thức thanh toán: {translatePaymentStatus(order.payment_method)}</p>
                                    <p className="text-gray-600">Ngày đặt: {new Date(order.created_at).toLocaleString('vi-VN')}</p>
                                    <div className="mt-3">
                                        <button
                                            onClick={() => handleOpenOrderDetailsDialog(order)}
                                            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold py-1 px-3 rounded-lg shadow-sm transition-colors duration-200"
                                        >
                                            Xem chi tiết
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-600 text-center py-4">Bạn chưa có đơn hàng nào.</p>
                    )}
                </div>
            )}

            {/* Modal for Add/Edit Address Form */}
            {editingAddress && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
                    <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
                        <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                            {editingAddressId ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}
                        </h3>
                        <form onSubmit={handleSaveAddress} className="space-y-4">
                            <div>
                                <label htmlFor="addressFullName" className="block text-gray-700 text-sm font-bold mb-2">Họ và tên người nhận:</label>
                                <input
                                    type="text"
                                    id="addressFullName"
                                    value={addressFormFullName}
                                    onChange={(e) => setAddressFormFullName(e.target.value)}
                                    className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Nguyễn Văn A"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="addressPhone" className="block text-gray-700 text-sm font-bold mb-2">Số điện thoại người nhận:</label>
                                <input
                                    type="tel"
                                    id="addressPhone"
                                    value={addressFormPhone}
                                    onChange={(e) => setAddressFormPhone(e.target.value)}
                                    className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="0xxxxxxxxx"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="addressFormStreetHouseNumber" className="block text-gray-700 text-sm font-bold mb-2">Số nhà, tên đường, thôn/xóm:</label>
                                <input
                                    type="text"
                                    id="addressFormStreetHouseNumber"
                                    value={addressFormStreetHouseNumber}
                                    onChange={(e) => setAddressFormStreetHouseNumber(e.target.value)}
                                    className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ví dụ: Số 123, đường ABC"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="province" className="block text-gray-700 text-sm font-bold mb-2">Tỉnh/Thành phố:</label>
                                <select
                                    id="province"
                                    value={selectedProvinceId || ''}
                                    onChange={(e) => {
                                        setSelectedProvinceId(e.target.value);
                                        setSelectedDistrictId(null); // Reset district when province changes
                                        setSelectedWardId(null); // Reset ward when province changes
                                    }}
                                    className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                    disabled={isLoadingProvinces}
                                >
                                    <option value="">{isLoadingProvinces ? 'Đang tải...' : 'Chọn Tỉnh/Thành phố'}</option>
                                    {provinces?.map((province) => (
                                        <option key={province.code} value={String(province.code)}> {/* Ensure value is string */}
                                            {province.name}
                                        </option>
                                    ))}
                                </select>
                                {provincesError && <p className="text-red-500 text-xs mt-1">Lỗi tải tỉnh/thành phố: {provincesError.message}</p>}
                            </div>
                            <div>
                                <label htmlFor="district" className="block text-gray-700 text-sm font-bold mb-2">Quận/Huyện:</label>
                                <select
                                    id="district"
                                    value={selectedDistrictId || ''}
                                    onChange={(e) => {
                                        setSelectedDistrictId(e.target.value);
                                        setSelectedWardId(null); // Reset ward when district changes
                                    }}
                                    className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                    disabled={!selectedProvinceId || isLoadingDistricts}
                                >
                                    <option value="">{isLoadingDistricts ? 'Đang tải...' : 'Chọn Quận/Huyện'}</option>
                                    {districts?.map((district) => (
                                        <option key={district.code} value={String(district.code)}> {/* Ensure value is string */}
                                            {district.name}
                                        </option>
                                    ))}
                                </select>
                                {districtsError && <p className="text-red-500 text-xs mt-1">Lỗi tải quận/huyện: {districtsError.message}</p>}
                            </div>
                            <div>
                                <label htmlFor="ward" className="block text-gray-700 text-sm font-bold mb-2">Phường/Xã:</label>
                                <select
                                    id="ward"
                                    value={selectedWardId || ''}
                                    onChange={(e) => setSelectedWardId(e.target.value)}
                                    className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                    disabled={!selectedDistrictId || isLoadingWards}
                                >
                                    <option value="">{isLoadingWards ? 'Đang tải...' : 'Chọn Phường/Xã'}</option>
                                    {wards?.map((ward) => (
                                        <option key={ward.code} value={String(ward.code)}> {/* Ensure value is string */}
                                            {ward.name}
                                        </option>
                                    ))}
                                </select>
                                {wardsError && <p className="text-red-500 text-xs mt-1">Lỗi tải phường/xã: {wardsError.message}</p>}
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="isDefaultAddress"
                                    checked={addressFormIsDefault}
                                    onChange={(e) => setAddressFormIsDefault(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="isDefaultAddress" className="ml-2 block text-sm text-gray-900">Đặt làm địa chỉ mặc định</label>
                            </div>

                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseAddressForm}
                                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isSavingAddress || isLoadingProvinces || isLoadingDistricts || isLoadingWards}
                                >
                                    {isSavingAddress ? 'Đang lưu...' : (editingAddressId ? 'Cập nhật Địa chỉ' : 'Thêm Địa chỉ')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Order Details (kept) */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
                    <div className="bg-white p-8 rounded-lg shadow-xl max-w-lg w-full mx-4">
                        <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Chi tiết đơn hàng #{selectedOrder.id.substring(0, 8)}</h3>
                        <div className="space-y-4">
                            <p className="text-gray-700"><span className="font-semibold">Tổng tiền:</span> {selectedOrder.total_amount.toLocaleString('vi-VN')} VNĐ</p>
                            <p className="text-gray-700"><span className="font-semibold">Phương thức thanh toán:</span> {translatePaymentStatus(selectedOrder.payment_method)}</p>
                            <p className="text-gray-700"><span className="font-semibold">Trạng thái:</span> {translateOrderStatus(selectedOrder.status)}</p>
                            <p className="text-gray-700"><span className="font-semibold">Ngày đặt:</span> {new Date(selectedOrder.created_at).toLocaleString('vi-VN')}</p>
                            {selectedOrder.expires_at && (
                                <p className="text-gray-700"><span className="font-semibold">Hết hạn vào:</span> {new Date(selectedOrder.expires_at).toLocaleString('vi-VN')}</p>
                            )}

                            <h4 className="text-xl font-semibold text-gray-800 mt-6 mb-3">Sản phẩm:</h4>
                            {selectedOrder.items && selectedOrder.items.length > 0 ? (
                                <ul className="border rounded-lg divide-y divide-gray-200">
                                    {selectedOrder.items.map((item, index) => (
                                        <li key={index} className="flex items-center py-3 px-4">
                                            {item.product_image && (
                                                <img src={item.product_image} alt={item.product_name} className="w-16 h-16 object-cover rounded-md mr-4" />
                                            )}
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-800">{item.product_name}</p>
                                                <p className="text-gray-600 text-sm">Số lượng: {item.quantity}</p>
                                                <p className="text-gray-600 text-sm">Đơn giá: {item.product_price.toLocaleString('vi-VN')} VNĐ</p>
                                            </div>
                                            <p className="font-bold text-gray-800">{(item.quantity * item.product_price).toLocaleString('vi-VN')} VNĐ</p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-600">Không có sản phẩm nào trong đơn hàng này.</p>
                            )}
                        </div>
                        <div className="flex justify-end mt-6">
                            <button
                                type="button"
                                onClick={handleCloseOrderDetailsDialog}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Change Confirmation Modal (kept) */}
            {showPasswordChangeConfirm && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
                    <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Xác nhận đổi mật khẩu</h3>
                        <p className="text-gray-700 text-center mb-6">
                            Bạn sẽ được chuyển hướng đến trang cập nhật mật khẩu. Bạn có chắc chắn muốn tiếp tục không?
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                type="button"
                                onClick={() => setShowPasswordChangeConfirm(false)}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPasswordChangeConfirm(false);
                                    router.push('/update-password');
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Address Confirmation Modal */}
            {showDeleteAddressConfirm && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
                    <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Xác nhận Xóa địa chỉ</h3>
                        <p className="text-gray-700 text-center mb-6">
                            Bạn có chắc chắn muốn xóa địa chỉ này không? Hành động này không thể hoàn tác.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDeleteAddressConfirm(false);
                                    setAddressToDelete(null); // Clear the address to delete
                                }}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteAddress}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isSavingAddress}
                            >
                                {isSavingAddress ? 'Đang xóa...' : 'Xác nhận Xóa'}
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