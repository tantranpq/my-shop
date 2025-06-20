// app/checkout/CheckoutClient.tsx
"use client";

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import { toast } from 'sonner';
import NextImage from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Định nghĩa các interface cho dữ liệu từ DB (cho useQuery)
interface ProfileData { // Dữ liệu từ bảng 'profiles'
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
}

interface CustomerData { // Dữ liệu từ bảng 'customers' (địa chỉ)
  id: string; // customer_id (ID của bản ghi địa chỉ)
  full_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null; // Địa chỉ đầy đủ (số nhà, đường, phường, quận, tỉnh)
  profile_id: string | null; // Liên kết với profiles.id (user.id)
  is_default: boolean; // Đã thêm: Cột is_default
  // NEW: Thêm các cột tên và ID của tỉnh, huyện, xã để lưu từ API
  province_name?: string | null;
  district_name?: string | null;
  ward_name?: string | null;
  province_id?: string | null; // ID tỉnh/thành phố từ API
  district_id?: string | null; // ID quận/huyện từ API
  ward_id?: string | null;       // ID phường/xã từ API
}

// Interface cho state của form (sẽ hiển thị thông tin giao hàng)
interface DeliveryFormState {
  customerId: string | null; // ID của bản ghi customer đang được dùng làm địa chỉ giao hàng
  full_name: string | null;
  phone: string | null;
  email?: string | null;
  // NEW: Individual address components
  detailAddress: string | null; // For house number, street name
  provinceId: string | null;
  districtId: string | null;
  wardId: string | null;
  provinceName: string | null;
  districtName: string | null;
  wardName: string | null;
  // The full `address` string will be derived from these parts for display/DB insertion
  address: string | null; // This will be the *derived* full address string
}

type PaymentMethod = 'cod' | 'online';

interface ProductWithQuantity {
  id: string;
  name: string;
  price: number;
  image: string | null;
  slug: string | null;
  quantity: number;
}

// NEW: Interfaces for geographical data from API (mapped to id:string, name:string)
interface GeoLocation {
  id: string;
  name: string;
}

// NEW: Interface for raw API response items from provinces.open-api.vn
interface ApiGeoLocationRaw {
  code: number;
  name: string;
  codename?: string;
  division_type?: string;
  phone_code?: number;
  districts?: ApiGeoLocationRaw[]; // For province data
  wards?: ApiGeoLocationRaw[];     // For district data
}

// =========================================================================
// Hàm fetchGeoData để sử dụng API thực tế từ provinces.open-api.vn
// =========================================================================
const fetchGeoData = async (type: 'provinces' | 'districts' | 'wards', parentId: string | null = null): Promise<GeoLocation[]> => {
  let url: string;

  try {
    if (type === 'provinces') {
      url = 'https://provinces.open-api.vn/api/p/';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ApiGeoLocationRaw[] = await response.json();
      return data.map((item: ApiGeoLocationRaw) => ({
        id: String(item.code), // API returns 'code' as number, convert to string
        name: item.name,
      }));
    } else if (type === 'districts' && parentId) {
      url = `https://provinces.open-api.vn/api/p/${parentId}?depth=2`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: { districts: ApiGeoLocationRaw[] } = await response.json();
      return data.districts.map((item: ApiGeoLocationRaw) => ({
        id: String(item.code),
        name: item.name,
      }));
    } else if (type === 'wards' && parentId) {
      url = `https://provinces.open-api.vn/api/d/${parentId}?depth=2`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: { wards: ApiGeoLocationRaw[] } = await response.json();
      return data.wards.map((item: ApiGeoLocationRaw) => ({
        id: String(item.code),
        name: item.name,
      }));
    }
  } catch (error) {
    console.error(`Error fetching ${type} data:`, error);
    // Return empty array on error to prevent crashing, or re-throw if needed
    return [];
  }
  return [];
};

// Helper function to extract detail address from a CustomerData object
const extractDetailAddress = (addr: CustomerData): string => {
    let detail = addr.address || '';
    if (addr.province_name) detail = detail.replace(new RegExp(`,\\s*${addr.province_name}$`), '');
    if (addr.district_name) detail = detail.replace(new RegExp(`,\\s*${addr.district_name}$`), '');
    if (addr.ward_name) detail = detail.replace(new RegExp(`,\\s*${addr.ward_name}$`), '');
    return detail.trim().replace(/^,\s*/, ''); // Clean up leading comma if any
};


export default function CheckoutClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname(); // For returnTo in login redirect
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const { setCart } = useCart(); // GIỮ NGUYÊN CART LOGIC TỪ CODE BẠN CUNG CẤP
  const queryClient = useQueryClient(); // For invalidating queries

  const itemsParam = searchParams.get('items');

  // State cho thông tin giao hàng hiển thị trên form
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryFormState>({
    customerId: null,
    full_name: '',
    phone: '',
    email: '',
    detailAddress: '',
    provinceId: null,
    districtId: null,
    wardId: null,
    provinceName: '',
    districtName: '',
    wardName: '',
    address: '', // Initial derived address
  });

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');

  const [checkoutItems, setCheckoutItems] = useState<ProductWithQuantity[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);

  // States cho modal quản lý địa chỉ
  const [showAddressSelectionModal, setShowAddressSelectionModal] = useState(false);
  const [showAddEditAddressModal, setShowAddEditAddressModal] = useState(false);
  const [currentEditingAddress, setCurrentEditingAddress] = useState<CustomerData | null>(null); // null for new, CustomerData for edit

  // States for add/edit address form (now using IDs and names for dropdowns)
  const [addressFormFullName, setAddressFormFullName] = useState('');
  const [addressFormPhone, setAddressFormPhone] = useState('');
  // NEW: States for selected IDs from API dropdowns
  const [addressFormProvinceId, setAddressFormProvinceId] = useState<string | null>(null);
  const [addressFormDistrictId, setAddressFormDistrictId] = useState<string | null>(null);
  const [addressFormWardId, setAddressFormWardId] = useState<string | null>(null);
  // NEW: States for selected names from API dropdowns (for display and saving)
  const [addressFormProvinceName, setAddressFormProvinceName] = useState('');
  const [addressFormDistrictName, setAddressFormDistrictName] = useState('');
  const [addressFormWardName, setAddressFormWardName] = useState('');

  const [detailAddressInput, setDetailAddressInput] = useState(''); // Đây là phần địa chỉ cụ thể (số nhà, tên đường)
  const [addressFormIsDefault, setAddressFormIsDefault] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Fetch all customer addresses for the logged-in user
  const { data: userAddresses, isLoading: isLoadingUserAddresses } = useQuery<CustomerData[], Error>({
    queryKey: ['userAddresses', user?.id],
    queryFn: async () => {
      if (!user) return []; // Return empty array if no user
      const { data, error } = await supabaseClient
        .from('customers')
        // Đã cập nhật: Chọn cả các cột tên VÀ CÁC CỘT ID MỚI
        .select('id, full_name, phone, email, address, profile_id, is_default, province_name, district_name, ward_name, province_id, district_id, ward_id')
        .eq('profile_id', user.id)
        .order('is_default', { ascending: false }) // Sort to get default first
        .order('id', { ascending: true }); // Secondary sort for consistency

      if (error) {
        if (error.code === 'PGRST116') return []; // No rows found
        throw error;
      }
      return data;
    },
    enabled: !!user, // Only run this query if user is logged in
    staleTime: 0, // IMPORTANT: Set staleTime to 0 to always refetch on mount/remount for fresh data
  });

  // NEW: Fetch Provinces
  const { data: fetchedProvinces, isLoading: isLoadingProvinces } = useQuery<GeoLocation[], Error>({
    queryKey: ['provinces'],
    queryFn: () => fetchGeoData('provinces'),
    staleTime: Infinity, // Provinces don't change often
  });

  // NEW: Fetch Districts based on selected Province (for main form)
  const { data: fetchedDistricts, isLoading: isLoadingDistricts } = useQuery<GeoLocation[], Error>({
    queryKey: ['districts', deliveryInfo.provinceId],
    queryFn: ({ queryKey }) => fetchGeoData('districts', queryKey[1] as string | null),
    enabled: !!deliveryInfo.provinceId,
    staleTime: 0,
  });

  // NEW: Fetch Wards based on selected District (for main form)
  const { data: fetchedWards, isLoading: isLoadingWards } = useQuery<GeoLocation[], Error>({
    queryKey: ['wards', deliveryInfo.districtId],
    queryFn: ({ queryKey }) => fetchGeoData('wards', queryKey[1] as string | null),
    enabled: !!deliveryInfo.districtId,
    staleTime: 0,
  });

  // NEW: Fetch Districts for ADD/EDIT modal
  const { data: fetchedModalDistricts, isLoading: isLoadingModalDistricts } = useQuery<GeoLocation[], Error>({
    queryKey: ['modalDistricts', addressFormProvinceId],
    queryFn: ({ queryKey }) => fetchGeoData('districts', queryKey[1] as string | null),
    enabled: !!addressFormProvinceId,
    staleTime: 0,
  });

  // NEW: Fetch Wards for ADD/EDIT modal
  const { data: fetchedModalWards, isLoading: isLoadingModalWards } = useQuery<GeoLocation[], Error>({
    queryKey: ['modalWards', addressFormDistrictId],
    queryFn: ({ queryKey }) => fetchGeoData('wards', queryKey[1] as string | null),
    enabled: !!addressFormDistrictId,
    staleTime: 0,
  });


  // Handle open/close modals
  const openAddressSelectionModal = useCallback(() => setShowAddressSelectionModal(true), []);
  const closeAddressSelectionModal = useCallback(() => setShowAddressSelectionModal(false), []);

  const openAddAddressForm = useCallback(() => {
    setCurrentEditingAddress(null);
    setAddressFormFullName('');
    setAddressFormPhone('');
    // NEW: Reset selected IDs and names for new address
    setAddressFormProvinceId(null);
    setAddressFormDistrictId(null);
    setAddressFormWardId(null);
    setAddressFormProvinceName('');
    setAddressFormDistrictName('');
    setAddressFormWardName('');
    setDetailAddressInput('');
    setAddressFormIsDefault(false);
    setShowAddEditAddressModal(true);
  }, []);

  const openEditAddressForm = useCallback(async (address: CustomerData) => {
    setCurrentEditingAddress(address);
    setAddressFormFullName(address.full_name || '');
    setAddressFormPhone(address.phone || '');
    setAddressFormIsDefault(address.is_default);

    // NEW: Set selected IDs for dropdowns
    setAddressFormProvinceId(address.province_id || null);
    setAddressFormDistrictId(address.district_id || null);
    setAddressFormWardId(address.ward_id || null);

    // NEW: Set names for display/fallback (if IDs are null or not matching API data yet)
    setAddressFormProvinceName(address.province_name || '');
    setAddressFormDistrictName(address.district_name || '');
    setAddressFormWardName(address.ward_name || '');

    // Extract detail address
    setDetailAddressInput(extractDetailAddress(address));

    setShowAddEditAddressModal(true);
  }, []);

  const closeAddEditAddressModal = useCallback(() => setShowAddEditAddressModal(false), []);


  // Effect to set initial delivery info based on user or guest status
  useEffect(() => {
    // If not logged in, clear delivery info or set to default empty values
    if (!user) {
      setDeliveryInfo({
        customerId: null,
        full_name: '',
        phone: '',
        email: '',
        detailAddress: '',
        provinceId: null,
        districtId: null,
        wardId: null,
        provinceName: '',
        districtName: '',
        wardName: '',
        address: '',
      });
      return;
    }

    // Only proceed if userAddresses is defined (finished fetching)
    if (userAddresses === undefined) {
      return; // Wait for userAddresses to be definitely loaded/resolved
    }

    // Logged-in user: prioritize default address
    if (userAddresses.length > 0) { // userAddresses is now guaranteed to be an array
      const defaultAddress = userAddresses.find(addr => addr.is_default) || userAddresses[0];
      setDeliveryInfo({
        customerId: defaultAddress.id,
        full_name: defaultAddress.full_name || '',
        phone: defaultAddress.phone || '',
        email: defaultAddress.email || user.email || '',
        // Populate new fields for dropdowns
        detailAddress: extractDetailAddress(defaultAddress),
        provinceId: defaultAddress.province_id || null,
        districtId: defaultAddress.district_id || null,
        wardId: defaultAddress.ward_id || null,
        provinceName: defaultAddress.province_name || '',
        districtName: defaultAddress.district_name || '',
        wardName: defaultAddress.ward_name || '',
        address: defaultAddress.address || '', // Full address string from DB
      });

    } else {
      // Logged-in user but no saved addresses or userAddresses is empty array
      setDeliveryInfo({
        customerId: null, // Set to null to indicate no address selected, and prompt user to choose one
        full_name: '',
        phone: '',
        address: '', // Address initially empty for new input
        email: user.email || '',
        detailAddress: '',
        provinceId: null,
        districtId: null,
        wardId: null,
        provinceName: '',
        districtName: '',
        wardName: '',
      });
    }
  }, [user, userAddresses]);

    // NEW: Effect to construct the full address string for deliveryInfo.address
    useEffect(() => {
        const parts = [
            deliveryInfo.detailAddress?.trim(),
            deliveryInfo.wardName?.trim(),
            deliveryInfo.districtName?.trim(),
            deliveryInfo.provinceName?.trim(),
        ].filter(Boolean); // Remove null/empty parts

        const constructedFullAddress = parts.join(', ');
        setDeliveryInfo(prev => ({ ...prev, address: constructedFullAddress }));
    }, [deliveryInfo.detailAddress, deliveryInfo.wardName, deliveryInfo.districtName, deliveryInfo.provinceName]);


  // Parsing itemsParam and calculating total (logic remains the same as your provided code)
  useEffect(() => {
    if (itemsParam) {
      try {
        const decodedItemsParam = decodeURIComponent(itemsParam);
        const parsedItems: ProductWithQuantity[] = JSON.parse(decodedItemsParam);

        if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
          setFetchError('Dữ liệu sản phẩm không hợp lệ hoặc trống.');
          return;
        }

        setCheckoutItems(parsedItems);

        const total = parsedItems.reduce((sum, item) =>
          sum + (typeof item.price === 'number' ? item.price : 0) * (typeof item.quantity === 'number' ? item.quantity : 0),
          0
        );
        setTotalAmount(total);
        setFetchError(null);
      } catch (e) {
        console.error("Lỗi khi phân tích 'items' param:", e);
        setFetchError('Dữ liệu sản phẩm không hợp lệ. Vui lòng quay lại giỏ hàng hoặc trang sản phẩm.');
      }
    } else {
      setFetchError('Không có sản phẩm nào được chọn để thanh toán.');
    }
  }, [itemsParam]);


  const placeOrder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPlacingOrder(true);
    setOrderError(null);

    // Validation for new address components
    if (!deliveryInfo.full_name?.trim() || !deliveryInfo.phone?.trim() ||
        !deliveryInfo.detailAddress?.trim() || !deliveryInfo.provinceId ||
        !deliveryInfo.districtId || !deliveryInfo.wardId) {
      setOrderError('Vui lòng nhập đầy đủ thông tin giao hàng: Họ tên, Số điện thoại, Địa chỉ chi tiết, Tỉnh/Thành phố, Quận/Huyện, Phường/Xã.');
      setIsPlacingOrder(false);
      return;
    }

    const constructedAddress = deliveryInfo.address?.trim(); // This now comes from the useEffect

    if (!constructedAddress) { // Should not happen if previous check passes, but as a safeguard
      setOrderError('Không thể tạo địa chỉ giao hàng đầy đủ. Vui lòng kiểm tra lại thông tin.');
      setIsPlacingOrder(false);
      return;
    }

    if (checkoutItems.length === 0) {
      setOrderError('Không có sản phẩm nào trong đơn hàng.');
      setIsPlacingOrder(false);
      return;
    }

    const p_order_items = checkoutItems.map(item => ({
      product_id: item.id,
      product_name: item.name,
      product_price: item.price,
      quantity: item.quantity,
      product_image: item.image,
    }));

    try {
      // Allow guest users to place orders without a user ID if needed by the RPC.
      // If user is null, user?.id will be undefined, and then converted to null.
      const { data, error } = await supabaseClient.rpc('create_order_with_customer', {
        p_customer_full_name: deliveryInfo.full_name.trim(),
        p_customer_email: deliveryInfo.email?.trim() || null,
        p_customer_phone: deliveryInfo.phone.trim(),
        p_customer_address: constructedAddress, // Use the constructed address here
        p_total_amount: totalAmount,
        p_payment_method: paymentMethod,
        p_order_items: p_order_items,
        p_auth_user_id: user?.id || null, // Updated: Allow null for guest users
        p_selected_customer_id: deliveryInfo.customerId, // Pass the selected customerId (will be null for guests)
        p_order_source: 'web',
        p_creator_profile_id: user?.id || null, // Updated: Allow null for guest users
      });

      if (error) {
        console.error('Lỗi khi đặt hàng:', error);
        if (error.message.includes('Không đủ tồn kho')) {
          toast.error(error.message);
          setOrderError(error.message);
        } else {
          toast.error('Lỗi đặt hàng: ' + error.message);
          setOrderError('Lỗi đặt hàng: ' + error.message);
        }
        return;
      }

      if (data && !data.success) {
        toast.error('Lỗi đặt hàng: ' + data.error);
        setOrderError('Lỗi đặt hàng: ' + data.error);
        return;
      }

      setCart([]);
      toast.success('Đơn hàng của bạn đã được đặt thành công!');
      router.push(`/order-success/${data.orderId}?paymentMethod=${paymentMethod}`);
    } catch (err: unknown) { // Updated to explicitly type err as unknown
      console.error('Lỗi không xác định khi đặt hàng:', err);
      if (err instanceof Error) {
        // If err is an Error object, use its message
        setOrderError('Đã xảy ra lỗi không xác định khi đặt hàng: ' + err.message);
        toast.error('Đã xảy ra lỗi không xác định khi đặt hàng: ' + err.message);
      } else {
        // Otherwise, use a generic error message
        setOrderError('Đã xảy ra lỗi không xác định khi đặt hàng.');
        toast.error('Đã xảy ra lỗi không xác định khi đặt hàng.');
      }
    } finally {
      setIsPlacingOrder(false);
    }
  }, [deliveryInfo, checkoutItems, totalAmount, paymentMethod, user, supabaseClient, setCart, router]);


  // Handle saving new or edited address from modal
  const handleSaveNewOrEditedAddress = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAddress(true);
    try {
      if (!user) { // This check remains because saving to 'customers' table requires a profile_id
        toast.error('Bạn cần đăng nhập để lưu địa chỉ.');
        setIsSavingAddress(false);
        return;
      }

      // NEW: Lấy tên từ các GeoLocation đã chọn (nếu có)
      const selectedProvince = fetchedProvinces?.find(p => p.id === addressFormProvinceId);
      const selectedDistrict = fetchedModalDistricts?.find(d => d.id === addressFormDistrictId); // Use modal-specific fetched districts
      const selectedWard = fetchedModalWards?.find(w => w.id === addressFormWardId); // Use modal-specific fetched wards

      const provinceName = selectedProvince?.name || addressFormProvinceName;
      const districtName = selectedDistrict?.name || addressFormDistrictName;
      const wardName = selectedWard?.name || addressFormWardName;
      const detailPart = detailAddressInput.trim();

      // Construct full address string for display/search purposes
      const fullAddressParts = [
        detailPart,
        wardName,
        districtName,
        provinceName,
      ].filter(Boolean);

      const fullAddress = fullAddressParts.join(', ');

      if (!detailPart || !wardName || !districtName || !provinceName) {
        throw new Error('Vui lòng điền đầy đủ địa chỉ: Số nhà, tên đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố.');
      }

      const addressToSave: Omit<CustomerData, 'id'> = {
        full_name: addressFormFullName.trim(),
        phone: addressFormPhone.trim(),
        email: user.email || null,
        address: fullAddress, // Lưu địa chỉ đầy đủ dưới dạng chuỗi
        profile_id: user!.id,
        is_default: addressFormIsDefault,
        // NEW: LƯU CÁC TÊN VÀ ID VÀO CỘT MỚI
        province_name: provinceName,
        district_name: districtName,
        ward_name: wardName,
        province_id: addressFormProvinceId, // NEW: Save ID
        district_id: addressFormDistrictId, // NEW: Save ID
        ward_id: addressFormWardId,       // NEW: Save ID
      };

      if (!addressToSave.full_name || !addressToSave.phone) {
        throw new Error('Vui lòng điền đầy đủ Họ tên và Số điện thoại.');
      }

      let newAddressId: string | null = currentEditingAddress?.id || null;

      // Logic đặt địa chỉ mặc định
      if (addressToSave.is_default) {
        const { error: unsetError } = await supabaseClient
          .from('customers')
          .update({ is_default: false })
          .eq('profile_id', user!.id)
          .neq('id', newAddressId || '00000000-0000-0000-0000-000000000000'); // Use a dummy ID for new addresses
        if (unsetError) throw unsetError;
      }

      if (newAddressId) {
        const { error } = await supabaseClient
          .from('customers')
          .update(addressToSave)
          .eq('id', newAddressId);
        if (error) throw error;
        toast.success('Cập nhật địa chỉ thành công!');
      } else {
        if (userAddresses && userAddresses.length >= 5) {
          toast.error('Bạn đã đạt giới hạn 5 địa chỉ được lưu. Vui lòng xóa một địa chỉ cũ để thêm địa chỉ mới.');
          setIsSavingAddress(false);
          return;
        }
        // If this is the very first address, make it default
        if (userAddresses && userAddresses.length === 0) {
            addressToSave.is_default = true;
        }

        const { data, error } = await supabaseClient
          .from('customers')
          .insert(addressToSave)
          .select('id');
        if (error) throw error;
        toast.success('Thêm địa chỉ mới thành công!');
        newAddressId = data[0].id;
      }

      queryClient.invalidateQueries({ queryKey: ['userAddresses', user!.id] });
      closeAddEditAddressModal();
      // Sau khi lưu/cập nhật, nếu đó là địa chỉ được chọn cho thanh toán hoặc địa chỉ mặc định mới
      if (newAddressId === deliveryInfo.customerId || addressToSave.is_default || ((userAddresses || []).length === 0 && newAddressId)) {
          const refetchResult = await queryClient.fetchQuery<CustomerData[], Error>({ queryKey: ['userAddresses', user!.id] });
          const updatedAddresses: CustomerData[] = refetchResult || [];

          if (updatedAddresses.length > 0) {
              const selectedAfterSave = updatedAddresses.find((a: CustomerData) => a.id === newAddressId) || updatedAddresses.find((a: CustomerData) => a.is_default) || updatedAddresses[0];
              if (selectedAfterSave) {
                  setDeliveryInfo({
                      customerId: selectedAfterSave.id,
                      full_name: selectedAfterSave.full_name || '',
                      phone: selectedAfterSave.phone || '',
                      email: selectedAfterSave.email || user!.email || '',
                      // Populate new fields
                      detailAddress: extractDetailAddress(selectedAfterSave),
                      provinceId: selectedAfterSave.province_id || null,
                      districtId: selectedAfterSave.district_id || null,
                      wardId: selectedAfterSave.ward_id || null,
                      provinceName: selectedAfterSave.province_name || '',
                      districtName: selectedAfterSave.district_name || '', // Corrected typo here
                      wardName: selectedAfterSave.ward_name || '',
                      address: selectedAfterSave.address || '',
                  });
              }
          } else {
              // Nếu không còn địa chỉ nào sau thao tác (ví dụ: đã xóa địa chỉ cuối cùng), đặt lại thông tin người dùng mặc định
              setDeliveryInfo({
                  customerId: null,
                  full_name: '',
                  phone: '',
                  address: '',
                  email: user.email || '',
                  detailAddress: '',
                  provinceId: null,
                  districtId: null,
                  wardId: null,
                  provinceName: '',
                  districtName: '',
                  wardName: '',
              });
          }
      }
      closeAddressSelectionModal(); // Đóng cả modal chọn địa chỉ nếu đang mở sau khi thêm/sửa địa chỉ
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
  }, [user, addressFormFullName, addressFormPhone, detailAddressInput, addressFormIsDefault, currentEditingAddress, supabaseClient, queryClient, closeAddEditAddressModal, userAddresses, deliveryInfo.customerId, user?.email,
    addressFormProvinceId, addressFormDistrictId, addressFormWardId, fetchedProvinces, fetchedModalDistricts, fetchedModalWards, // NEW dependencies for API data
    addressFormProvinceName, addressFormDistrictName, addressFormWardName
  ]);


    // Handle setting an address as default from selection modal
    const handleSetAddressAsDefault = useCallback(async (addressId: string) => {
        if (!user) return;
        setIsSavingAddress(true); // Using this for general saving state in modals

        try {
            // Unset all other addresses
            const { error: unsetError } = await supabaseClient
                .from('customers')
                .update({ is_default: false })
                .eq('profile_id', user!.id)
                .neq('id', addressId);
            if (unsetError) throw unsetError;

            // Set selected address as default
            const { error: setDefaultError } = await supabaseClient
                .from('customers')
                .update({ is_default: true })
                .eq('id', addressId);
            if (setDefaultError) throw setDefaultError;

            queryClient.invalidateQueries({ queryKey: ['userAddresses', user!.id] });
            toast.success('Địa chỉ mặc định đã được cập nhật!');

            // Update delivery info if this address is newly default
            const newDefault = userAddresses?.find((addr: CustomerData) => addr.id === addressId);
            if (newDefault) {
                setDeliveryInfo({
                    customerId: newDefault.id,
                    full_name: newDefault.full_name || '',
                    phone: newDefault.phone || '',
                    email: newDefault.email || user?.email || '',
                    detailAddress: extractDetailAddress(newDefault),
                    provinceId: newDefault.province_id || null,
                    districtId: newDefault.district_id || null,
                    wardId: newDefault.ward_id || null,
                    provinceName: newDefault.province_name || '',
                    districtName: newDefault.district_name || '',
                    wardName: newDefault.ward_name || '',
                    address: newDefault.address || '',
                });
            }


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
    }, [user, supabaseClient, queryClient, userAddresses, user?.email]);

    // Handle deleting address from selection modal
    const handleDeleteAddressFromSelection = useCallback(async (addressToDelete: CustomerData) => {
        if (!user) return;
        if (!window.confirm(`Bạn có chắc chắn muốn xóa địa chỉ "${addressToDelete.full_name}, ${addressToDelete.address}"?`)) return;

        setIsSavingAddress(true); // Using this for general saving state in modals
        try {
            const wasDefault = addressToDelete.is_default;
            const remainingAddresses = (userAddresses || []).filter(addr => addr.id !== addressToDelete.id);

            // If the deleted address was default AND there are other addresses, set new default
            if (wasDefault && remainingAddresses.length > 0) {
                const newDefaultCandidate = remainingAddresses[0];
                const { error: setDefaultError } = await supabaseClient
                    .from('customers')
                    .update({ is_default: true })
                    .eq('id', newDefaultCandidate.id);
                if (setDefaultError) throw setDefaultError;
            }

            const { error } = await supabaseClient
                .from('customers')
                .delete()
                .eq('id', addressToDelete.id);
            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['userAddresses', user!.id] });
            toast.success('Địa chỉ đã được xóa thành công!');

            // If the deleted address was the one currently selected for delivery, reset delivery info
            if (deliveryInfo.customerId === addressToDelete.id) {
                if (remainingAddresses.length > 0) {
                    const newSelected = wasDefault ? remainingAddresses[0] : remainingAddresses.find((a: CustomerData) => a.is_default) || remainingAddresses[0];
                    setDeliveryInfo({
                        customerId: newSelected.id,
                        full_name: newSelected.full_name || '',
                        phone: newSelected.phone || '',
                        email: newSelected.email || user!.email || '',
                        detailAddress: extractDetailAddress(newSelected),
                        provinceId: newSelected.province_id || null,
                        districtId: newSelected.district_id || null,
                        wardId: newSelected.ward_id || null,
                        provinceName: newSelected.province_name || '',
                        districtName: newSelected.district_name || '',
                        wardName: newSelected.ward_name || '',
                        address: newSelected.address || '',
                    });
                } else {
                    // No addresses left, revert to basic profile info (or empty for guest)
                    setDeliveryInfo({
                        customerId: null,
                        full_name: '',
                        phone: '',
                        address: '', // Reset to empty full address
                        email: user.email || '',
                        detailAddress: '',
                        provinceId: null,
                        districtId: null,
                        wardId: null,
                        provinceName: '',
                        districtName: '',
                        wardName: '',
                    });
                }
            }
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
    }, [user, userAddresses, deliveryInfo.customerId, supabaseClient, queryClient, deliveryInfo, user?.email]);


  // Overall loading state
  const overallLoading = !itemsParam || (!!user && isLoadingUserAddresses) || isLoadingProvinces; // Added isLoadingProvinces

  // NEW: Determine if manual input fields should be shown
  const showManualInput = !user || !deliveryInfo.customerId;


  if (overallLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Đang tải thông tin thanh toán...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4 text-center">
        <p className="text-red-600 text-lg mb-4">{fetchError}</p>
        <Link href="/cart" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Quay lại giỏ hàng
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Xác nhận đơn hàng</h1>
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Chi tiết đơn hàng</h2>
        <div className="space-y-4 mb-6">
          {checkoutItems.length === 0 ? (
            <p className="text-gray-600">Giỏ hàng trống.</p>
          ) : (
            checkoutItems.map((item) => (
              <div key={item.id} className="flex items-center space-x-4 border-b pb-2">
                {item.image && <NextImage src={item.image} alt={item.name} width={48} height={48} className="w-12 h-12 object-cover rounded mr-3" />}
                <div className="flex-grow">
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-sm text-gray-600">Số lượng: {item.quantity}</p>
                </div>
                <p className="font-bold text-lg">{(typeof item.price === 'number' ? item.price : 0).toLocaleString('vi-VN')} VND</p>
              </div>
            ))
          )}
        </div>
        <div className="text-right text-xl font-bold mb-6">
          Tổng cộng: {totalAmount.toLocaleString('vi-VN')} VND
        </div>

        {/* Thêm thẻ form mở ở đây */}
        <form onSubmit={placeOrder}>
          <h2 className="text-xl font-semibold mb-4">Thông tin giao hàng</h2>
          {/* Updated: Conditional rendering based on showManualInput */}
          <div className="mb-6 border p-4 rounded-lg bg-white shadow-sm">
            <h3 className="text-lg font-semibold mb-3">Thông tin người nhận</h3>
            {showManualInput ? (
                // Display input fields for manual entry (guest or logged-in without selected address)
                <div className="space-y-4">
                    <div>
                        <label htmlFor="deliveryFullName" className="block text-gray-700 text-sm font-semibold mb-1">Họ và tên:</label>
                        <input
                        type="text"
                        id="deliveryFullName"
                        value={deliveryInfo.full_name || ''}
                        onChange={(e) => setDeliveryInfo(prev => ({ ...prev, full_name: e.target.value }))}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        />
                    </div>
                    <div>
                        <label htmlFor="deliveryPhone" className="block text-gray-700 text-sm font-semibold mb-1">Số điện thoại:</label>
                        <input
                        type="tel"
                        id="deliveryPhone"
                        value={deliveryInfo.phone || ''}
                        onChange={(e) => setDeliveryInfo(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        />
                    </div>
                    <div>
                        <label htmlFor="deliveryEmail" className="block text-gray-700 text-sm font-semibold mb-1">Email (tùy chọn):</label>
                        <input
                        type="email"
                        id="deliveryEmail"
                        value={deliveryInfo.email || ''}
                        onChange={(e) => setDeliveryInfo(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    {/* Dropdowns for Province, District, Ward and separate Detail Address input */}
                    <div>
                        <label htmlFor="deliveryProvince" className="block text-gray-700 text-sm font-semibold mb-1">Tỉnh/Thành phố:</label>
                        <select
                        id="deliveryProvince"
                        value={deliveryInfo.provinceId || ''}
                        onChange={(e) => {
                            const selectedId = e.target.value || null;
                            const selectedName = e.target.options[e.target.selectedIndex].text;
                            setDeliveryInfo(prev => ({
                                ...prev,
                                provinceId: selectedId,
                                provinceName: selectedName,
                                districtId: null, // Reset district
                                districtName: '',
                                wardId: null, // Reset ward
                                wardName: '',
                            }));
                        }}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        disabled={isLoadingProvinces}
                        >
                        <option value="">{isLoadingProvinces ? 'Đang tải...' : 'Chọn Tỉnh/Thành phố'}</option>
                        {fetchedProvinces?.map((province) => (
                            <option key={province.id} value={province.id}>{province.name}</option>
                        ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="deliveryDistrict" className="block text-gray-700 text-sm font-semibold mb-1">Quận/Huyện:</label>
                        <select
                            id="deliveryDistrict"
                            value={deliveryInfo.districtId || ''}
                            onChange={(e) => {
                                const selectedId = e.target.value || null;
                                const selectedName = e.target.options[e.target.selectedIndex].text;
                                setDeliveryInfo(prev => ({
                                    ...prev,
                                    districtId: selectedId,
                                    districtName: selectedName,
                                    wardId: null, // Reset ward
                                    wardName: '',
                                }));
                            }}
                            className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            disabled={!deliveryInfo.provinceId || isLoadingDistricts}
                        >
                            <option value="">{isLoadingDistricts ? 'Đang tải...' : 'Chọn Quận/Huyện'}</option>
                            {fetchedDistricts?.map((district) => (
                                <option key={district.id} value={district.id}>{district.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="deliveryWard" className="block text-gray-700 text-sm font-semibold mb-1">Phường/Xã:</label>
                        <select
                            id="deliveryWard"
                            value={deliveryInfo.wardId || ''}
                            onChange={(e) => {
                                const selectedId = e.target.value || null;
                                const selectedName = e.target.options[e.target.selectedIndex].text;
                                setDeliveryInfo(prev => ({
                                    ...prev,
                                    wardId: selectedId,
                                    wardName: selectedName,
                                }));
                            }}
                            className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            disabled={!deliveryInfo.districtId || isLoadingWards}
                        >
                            <option value="">{isLoadingWards ? 'Đang tải...' : 'Chọn Phường/Xã'}</option>
                            {fetchedWards?.map((ward) => (
                                <option key={ward.id} value={ward.id}>{ward.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="deliveryDetailAddress" className="block text-gray-700 text-sm font-semibold mb-1">Địa chỉ chi tiết (Số nhà, tên đường, thôn, xóm...):</label>
                        <input
                        type="text"
                        id="deliveryDetailAddress"
                        value={deliveryInfo.detailAddress || ''}
                        onChange={(e) => setDeliveryInfo(prev => ({ ...prev, detailAddress: e.target.value }))}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Số nhà, tên đường, thôn, xóm..."
                        required
                        />
                    </div>
                </div>
            ) : (
                // Display summary of selected address (logged-in with selected address)
                <div className="space-y-2">
                    <p><span className="font-semibold">Người nhận:</span> {deliveryInfo.full_name}</p>
                    <p><span className="font-semibold">Điện thoại:</span> {deliveryInfo.phone}</p>
                    {deliveryInfo.email && <p><span className="font-semibold">Email:</span> {deliveryInfo.email}</p>}
                    <p><span className="font-semibold">Địa chỉ:</span> {deliveryInfo.address}</p>
                </div>
            )}
          </div>

          {user ? ( // If user is logged in, show address selection button
            <button
              type="button"
              onClick={openAddressSelectionModal}
              className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg text-sm transition-colors duration-200 flex items-center justify-center w-full"
              disabled={overallLoading}
            >
              <i className="fas fa-map-marker-alt mr-2"></i>Chọn / Thêm địa chỉ khác
            </button>
          ) : ( // If user is a guest, show login prompt
            <div className="mt-4 p-4 border rounded-lg bg-red-50 text-center text-gray-700">
              <p className="mb-3">Bạn chưa là khách hàng thân thiết. Đăng nhập để hưởng ưu đãi và quản lý địa chỉ dễ dàng hơn.</p>
              <Link href={`/auth?returnTo=${encodeURIComponent(pathname + window.location.search)}`} className="text-blue-600 hover:underline">Đăng nhập ngay</Link>
            </div>
          )}


          <div className="mb-6 mt-6">
            <h2 className="text-xl font-semibold mb-3">Phương thức thanh toán</h2>
            <div className="flex flex-col space-y-2">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                  className="form-radio text-blue-600"
                  disabled={overallLoading}
                />
                <span className="ml-2">Thanh toán khi nhận hàng (COD)</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="online"
                  checked={paymentMethod === 'online'}
                  onChange={() => setPaymentMethod('online')}
                  className="form-radio text-blue-600"
                  disabled={overallLoading}
                />
                <span className="ml-2">Thanh toán Online (Chuyển khoản QR)</span>
              </label>
            </div>
          </div>

          {orderError && <p className="text-red-500 text-sm mb-4">Lỗi: {orderError}</p>}

          <button
            type="submit"
            disabled={isPlacingOrder || checkoutItems.length === 0 ||
                      !deliveryInfo.full_name?.trim() || !deliveryInfo.phone?.trim() ||
                      !deliveryInfo.detailAddress?.trim() || !deliveryInfo.provinceId ||
                      !deliveryInfo.districtId || !deliveryInfo.wardId || overallLoading}
            className={`w-full py-2 text-white font-semibold rounded ${isPlacingOrder || checkoutItems.length === 0 ||
                      !deliveryInfo.full_name?.trim() || !deliveryInfo.phone?.trim() ||
                      !deliveryInfo.detailAddress?.trim() || !deliveryInfo.provinceId ||
                      !deliveryInfo.districtId || !deliveryInfo.wardId || overallLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {isPlacingOrder ? 'Đang xử lý...' : 'Xác nhận đặt hàng'}
          </button>
        </form> {/* Đặt thẻ form đóng ở đây */}
        <div className="mt-4 text-center text-sm">
          <Link href="/cart" className="text-blue-500 hover:underline">← Quay lại giỏ hàng</Link>
        </div>
      </div>

      {/* Address Selection Modal */}
      {showAddressSelectionModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6 border-b pb-3 flex justify-between items-center">
              Chọn địa chỉ giao hàng
              <button onClick={closeAddressSelectionModal} className="text-gray-500 hover:text-gray-700 text-3xl">&times;</button>
            </h3>

            {isLoadingUserAddresses ? (
              <p className="text-center text-gray-600">Đang tải địa chỉ...</p>
            ) : (
              <>
                {userAddresses && userAddresses.length > 0 ? (
                  <div className="space-y-4 mb-6">
                    {userAddresses.map((addr: CustomerData) => (
                      <div key={addr.id} className={`border rounded-lg p-4 transition-colors duration-200 ${deliveryInfo.customerId === addr.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-semibold text-lg text-gray-800">{addr.full_name}</p>
                          {addr.is_default && (
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                              Mặc định
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700">SĐT: {addr.phone}</p>
                        <p className="text-gray-700">Địa chỉ: {addr.address}</p>
                        <div className="mt-3 flex space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                                setDeliveryInfo({
                                    customerId: addr.id,
                                    full_name: addr.full_name || '',
                                    phone: addr.phone || '',
                                    email: addr.email || user?.email || '',
                                    detailAddress: extractDetailAddress(addr),
                                    provinceId: addr.province_id || null,
                                    districtId: addr.district_id || null,
                                    wardId: addr.ward_id || null,
                                    provinceName: addr.province_name || '',
                                    districtName: addr.district_name || '',
                                    wardName: addr.ward_name || '',
                                    address: addr.address || '',
                                });
                                closeAddressSelectionModal();
                                toast.success('Đã chọn địa chỉ giao hàng!');
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded-lg text-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={deliveryInfo.customerId === addr.id}
                          >
                            <i className="fas fa-check mr-1"></i>Chọn
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditAddressForm(addr)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium text-sm flex items-center"
                          >
                            <i className="fas fa-edit mr-1"></i>Chỉnh sửa
                          </button>
                          {!addr.is_default && (
                            <button
                                type="button"
                                onClick={() => handleSetAddressAsDefault(addr.id)}
                                className="text-purple-600 hover:text-purple-900 font-medium text-sm flex items-center"
                                disabled={isSavingAddress}
                            >
                                <i className="fas fa-star mr-1"></i>Đặt làm mặc định
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteAddressFromSelection(addr)}
                            className="text-red-600 hover:text-red-900 font-medium text-sm flex items-center"
                            disabled={isSavingAddress || (!!userAddresses && userAddresses.length <= 1)}
                          >
                            <i className="fas fa-trash-alt mr-1"></i>Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 mb-6 text-center">Bạn chưa có địa chỉ nào được lưu.</p>
                )}
                <button
                  type="button"
                  onClick={openAddAddressForm}
                  className={`w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center
                      ${userAddresses && userAddresses.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={userAddresses && userAddresses.length >= 5}
                >
                  <i className="fas fa-plus mr-2"></i>Thêm địa chỉ mới
                </button>
              </>
            )}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={closeAddressSelectionModal}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Address Modal */}
      {showAddEditAddressModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6 border-b pb-3">
              {currentEditingAddress ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}
            </h3>
            <form onSubmit={handleSaveNewOrEditedAddress}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="addrFormFullName" className="block text-gray-700 text-sm font-semibold mb-1">Họ và tên người nhận:</label>
                  <input
                    type="text"
                    id="addrFormFullName"
                    value={addressFormFullName}
                    onChange={(e) => setAddressFormFullName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="addrFormPhone" className="block text-gray-700 text-sm font-semibold mb-1">Số điện thoại người nhận:</label>
                  <input
                    type="tel"
                    id="addrFormPhone"
                    value={addressFormPhone}
                    onChange={(e) => setAddressFormPhone(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* NEW: Province Dropdown */}
                <div>
                  <label htmlFor="addressFormProvince" className="block text-gray-700 text-sm font-semibold mb-1">Tỉnh/Thành phố:</label>
                  <select
                    id="addressFormProvince"
                    value={addressFormProvinceId || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value || null;
                      setAddressFormProvinceId(selectedId);
                      setAddressFormProvinceName(e.target.options[e.target.selectedIndex].text); // Lấy tên trực tiếp từ option
                      // Reset district and ward when province changes
                      setAddressFormDistrictId(null);
                      setAddressFormDistrictName('');
                      setAddressFormWardId(null);
                      setAddressFormWardName('');
                    }}
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={isLoadingProvinces}
                  >
                    <option value="">{isLoadingProvinces ? 'Đang tải...' : 'Chọn Tỉnh/Thành phố'}</option>
                    {fetchedProvinces?.map((province) => (
                      <option key={province.id} value={province.id}>{province.name}</option>
                    ))}
                  </select>
                </div>
                {/* NEW: District Dropdown (uses fetchedModalDistricts) */}
                <div>
                  <label htmlFor="addressFormDistrict" className="block text-gray-700 text-sm font-semibold mb-1">Quận/Huyện:</label>
                  <select
                    id="addressFormDistrict"
                    value={addressFormDistrictId || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value || null;
                      setAddressFormDistrictId(selectedId);
                      setAddressFormDistrictName(e.target.options[e.target.selectedIndex].text); // Lấy tên trực tiếp từ option
                      // Reset ward when district changes
                      setAddressFormWardId(null);
                      setAddressFormWardName('');
                    }}
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={!addressFormProvinceId || isLoadingModalDistricts} // Use isLoadingModalDistricts
                  >
                    <option value="">{isLoadingModalDistricts ? 'Đang tải...' : 'Chọn Quận/Huyện'}</option>
                    {fetchedModalDistricts?.map((district) => ( // Use fetchedModalDistricts
                      <option key={district.id} value={district.id}>{district.name}</option>
                    ))}
                  </select>
                </div>
                {/* NEW: Ward Dropdown (uses fetchedModalWards) */}
                <div>
                  <label htmlFor="addressFormWard" className="block text-gray-700 text-sm font-semibold mb-1">Phường/Xã:</label>
                  <select
                    id="addressFormWard"
                    value={addressFormWardId || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value || null;
                      setAddressFormWardId(selectedId);
                      setAddressFormWardName(e.target.options[e.target.selectedIndex].text); // Lấy tên trực tiếp từ option
                    }}
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={!addressFormDistrictId || isLoadingModalWards} // Use isLoadingModalWards
                  >
                    <option value="">{isLoadingModalWards ? 'Đang tải...' : 'Chọn Phường/Xã'}</option>
                    {fetchedModalWards?.map((ward) => ( // Use fetchedModalWards
                      <option key={ward.id} value={ward.id}>{ward.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="detailAddress" className="block text-gray-700 text-sm font-semibold mb-1">Địa chỉ chi tiết (Số nhà, tên đường):</label>
                <input
                  type="text"
                  id="detailAddress"
                  value={detailAddressInput}
                  onChange={(e) => setDetailAddressInput(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ví dụ: 123 Đường ABC"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={addressFormIsDefault}
                    onChange={(e) => setAddressFormIsDefault(e.target.checked)}
                    className="form-checkbox text-blue-600"
                  />
                  <span className="ml-2 text-gray-700">Đặt làm địa chỉ mặc định</span>
                </label>
              </div>
              <div className="flex space-x-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={closeAddEditAddressModal}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center"
                  disabled={isSavingAddress}
                >
                  <i className="fas fa-times mr-2"></i>Hủy
                </button>
                <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  disabled={isSavingAddress || isLoadingProvinces || isLoadingModalDistricts || isLoadingModalWards}
                >
                  <i className="fas fa-save mr-2"></i>{isSavingAddress ? 'Đang lưu...' : 'Lưu địa chỉ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}