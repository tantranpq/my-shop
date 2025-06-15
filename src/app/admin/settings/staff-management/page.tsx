// app/admin/settings/staff-management/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser, useSessionContext } from '@supabase/auth-helpers-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UserProfile {
    id: string;
    email: string;
    role: 'user' | 'admin' | 'staff';
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
}

// StaffModal component (Giữ nguyên)
interface StaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (formData: { email?: string; password?: string; full_name: string; role: 'user' | 'admin' | 'staff'; }) => void;
    currentStaff: UserProfile | null;
    isSaving: boolean;
}

const StaffModal: React.FC<StaffModalProps> = ({ isOpen, onClose, onSave, currentStaff, isSaving }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<'user' | 'admin' | 'staff'>('staff');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (currentStaff) {
                setEmail(currentStaff.email);
                setFullName(currentStaff.full_name || '');
                setRole(currentStaff.role);
                setPassword('');
            } else {
                setEmail('');
                setFullName('');
                setRole('staff');
                setPassword('');
            }
        }
    }, [isOpen, currentStaff]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!currentStaff && (!email || !password)) {
            setError('Vui lòng nhập Email và Mật khẩu cho nhân viên mới.');
            return;
        }
        if (!fullName) {
            setError('Vui lòng nhập Tên đầy đủ.');
            return;
        }

        onSave({
            email: currentStaff ? undefined : email,
            password: currentStaff ? undefined : password,
            full_name: fullName,
            role: role
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">{currentStaff ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}</h2>
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <strong className="font-bold">Lỗi:</strong>
                        <span className="block sm:inline"> {error}</span>
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email:</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
                            required
                            disabled={!!currentStaff}
                        />
                    </div>
                    {!currentStaff && (
                        <div className="mb-4">
                            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Mật khẩu:</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                required={!currentStaff}
                            />
                        </div>
                    )}
                    <div className="mb-4">
                        <label htmlFor="fullName" className="block text-gray-700 text-sm font-bold mb-2">Tên đầy đủ:</label>
                        <input
                            type="text"
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="role" className="block text-gray-700 text-sm font-bold mb-2">Vai trò:</label>
                        <select
                            id="role"
                            value={role}
                            onChange={(e) => setRole(e.target.value as 'user' | 'admin' | 'staff')}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="flex justify-end space-x-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200"
                            disabled={isSaving}
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Đang lưu...' : (currentStaff ? 'Cập nhật' : 'Thêm')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function StaffManagementPage() {
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const { isLoading: isLoadingSession } = useSessionContext();
    const queryClient = useQueryClient();

    const [userRole, setUserRole] = useState<'user' | 'admin' | 'staff' | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentStaff, setCurrentStaff] = useState<UserProfile | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch user role
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

    // Fetch staff list
    const { data: staffList, isLoading: isLoadingStaff, error: staffError } = useQuery<UserProfile[], Error>({
        queryKey: ['staffList'],
        queryFn: async () => {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('id, email, full_name, role, avatar_url, created_at')
                .in('role', ['admin', 'staff'])
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data as UserProfile[];
        },
        enabled: userRole === 'admin' && !isLoadingSession && !isLoadingProfile,
        staleTime: 1000 * 60 * 5,
    });

    // Realtime Updates (có thể kích hoạt lại sau khi có trigger mới)
    useEffect(() => {
        if (userRole === 'admin') {
            const channel = supabaseClient
                .channel('public:profiles_staff')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'profiles',
                    filter: `role=in.(admin,staff)`
                }, (payload) => {
                    console.log('Profile change (staff/admin) received:', payload);
                    queryClient.invalidateQueries({ queryKey: ['staffList'] });
                })
                .subscribe();

            return () => {
                channel.unsubscribe();
            };
        }
    }, [userRole, supabaseClient, queryClient]);


    // --- Handlers ---
    const openCreateModal = () => {
        if (userRole !== 'admin') {
            toast.error('Bạn không có quyền thêm nhân viên.');
            return;
        }
        setCurrentStaff(null);
        setIsModalOpen(true);
    };

    const openEditModal = (staff: UserProfile) => {
        if (userRole !== 'admin') {
            toast.error('Bạn không có quyền chỉnh sửa nhân viên.');
            return;
        }
        if (staff.id === user?.id && staff.role === 'admin') {
             toast.error('Bạn không thể chỉnh sửa vai trò của chính mình.');
             return;
        }
        setCurrentStaff(staff);
        setIsModalOpen(true);
    };

    const handleSaveStaff = async (formData: { email?: string; password?: string; full_name: string; role: 'user' | 'admin' | 'staff'; }) => {
        if (userRole !== 'admin') {
            toast.error('Bạn không có quyền thực hiện thao tác này.');
            return;
        }

        setIsSaving(true);
        try {
            if (currentStaff) {
                // Cập nhật nhân viên hiện có (vẫn dùng client Supabase cho update profiles)
                const { error: updateProfileError } = await supabaseClient
                    .from('profiles')
                    .update({ full_name: formData.full_name, role: formData.role })
                    .eq('id', currentStaff.id);

                if (updateProfileError) throw updateProfileError;

                toast.success('Cập nhật nhân viên thành công!');
            } else {
                // Tạo nhân viên mới - GỌI API ROUTE ĐÃ TẠO Ở TRÊN
                if (!formData.email || !formData.password) {
                    throw new Error('Email và Mật khẩu là bắt buộc khi tạo nhân viên mới.');
                }

                // Lấy session token để gửi cùng request API
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!session) {
                    throw new Error('Không tìm thấy phiên hoạt động. Vui lòng đăng nhập lại.');
                }

                const response = await fetch('/api/admin/users', { // GỌI API ROUTE TẠO USER
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}` // Gửi token xác thực
                    },
                    body: JSON.stringify(formData),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Lỗi khi tạo người dùng mới qua API.');
                }

                toast.success('Thêm nhân viên mới thành công!');
            }
            queryClient.invalidateQueries({ queryKey: ['staffList'] });
            closeModal();
        } catch (err: unknown) {
    console.error('Lỗi khi lưu nhân viên:', err);

    if (err instanceof Error) {
        toast.error('Lỗi khi lưu nhân viên: ' + err.message);
    } else {
        toast.error('Lỗi khi lưu nhân viên: Lỗi không xác định');
    }

        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteStaff = async (staffId: string) => {
        if (userRole !== 'admin') {
            toast.error('Bạn không có quyền xóa nhân viên.');
            return;
        }
        if (staffId === user?.id) {
            toast.error('Bạn không thể tự xóa tài khoản của chính mình.');
            return;
        }

        if (!confirm('Bạn có chắc chắn muốn xóa nhân viên này không? Thao tác này không thể hoàn tác!')) {
            return;
        }

        setIsSaving(true);
        try {
            // Lấy session token để gửi cùng request API
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                throw new Error('Không tìm thấy phiên hoạt động. Vui lòng đăng nhập lại.');
            }

            // Xóa người dùng - GỌI API ROUTE ĐÃ TẠO Ở TRÊN
            const response = await fetch(`/api/admin/users?id=${staffId}`, { // GỌI API ROUTE XÓA USER
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}` // Gửi token xác thực
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Lỗi khi xóa người dùng qua API.');
            }

            queryClient.invalidateQueries({ queryKey: ['staffList'] });
            toast.success('Xóa nhân viên thành công!');
        } catch (err: unknown) {
    console.error('Lỗi khi xóa nhân viên:', err);

    if (err instanceof Error) {
        toast.error('Lỗi khi xóa nhân viên: ' + err.message);
    } else {
        toast.error('Lỗi khi xóa nhân viên: Lỗi không xác định');
    }

        } finally {
            setIsSaving(false);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentStaff(null);
    };

    // ... (Render Logic giữ nguyên) ...
    if (isLoadingSession || isLoadingProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                {isLoadingSession ? "Đang tải phiên đăng nhập..." : "Đang kiểm tra quyền..."}
            </div>
        );
    }

    if (userRole !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-red-500">
                Bạn không có quyền truy cập trang quản lý nhân viên.
            </div>
        );
    }

    if (staffError) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-red-500">
                Lỗi tải danh sách nhân viên: {staffError.message}
            </div>
        );
    }

    if (isLoadingStaff && !staffList) {
        return (
            <div className="min-h-screen flex items-center justify-center text-xl text-gray-700">
                Đang tải danh sách nhân viên...
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Quản lý Nhân viên</h1>

            <div className="flex justify-end mb-4">
                <button
                    onClick={openCreateModal}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200"
                >
                    <i className="fas fa-plus mr-2"></i>Thêm nhân viên mới
                </button>
            </div>

            <div className="overflow-x-auto bg-white shadow-md rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên đầy đủ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vai trò</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {staffList?.map((staff) => (
                            <tr key={staff.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{staff.full_name || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{staff.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${staff.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                        {staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {new Date(staff.created_at).toLocaleDateString('vi-VN')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                        onClick={() => openEditModal(staff)}
                                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                                        disabled={isSaving || (user?.id === staff.id && staff.role === 'admin')}
                                    >
                                        Sửa
                                    </button>
                                    {user?.id !== staff.id && (
                                        <button
                                            onClick={() => handleDeleteStaff(staff.id)}
                                            className="text-red-600 hover:text-red-900"
                                            disabled={isSaving}
                                        >
                                            Xóa
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <StaffModal
                isOpen={isModalOpen}
                onClose={closeModal}
                onSave={handleSaveStaff}
                currentStaff={currentStaff}
                isSaving={isSaving}
            />
        </div>
    );
}