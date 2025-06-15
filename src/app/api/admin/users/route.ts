// app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Khởi tạo Supabase Client với Service Role Key (chỉ dùng ở phía server)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Helper function để kiểm tra xem request có được ủy quyền từ admin không
async function authorizeAdmin(req: Request): Promise<{ authorized: boolean; message?: string; user?: any }> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return { authorized: false, message: 'Unauthorized: Missing Authorization header.' };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return { authorized: false, message: 'Unauthorized: Invalid token format.' };
    }

    try {
        // Xác minh token và lấy thông tin người dùng từ Supabase Auth
        const { data: userResponse, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !userResponse.user) {
            console.error('User token verification failed:', userError?.message);
            return { authorized: false, message: userError?.message || 'Unauthorized: Invalid token.' };
        }

        // Kiểm tra vai trò của người dùng trong bảng profiles
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userResponse.user.id)
            .single();

        if (profileError || profile?.role !== 'admin') {
            console.warn(`User ${userResponse.user.id} (role: ${profile?.role}) attempted unauthorized action.`);
            return { authorized: false, message: 'Forbidden: User is not an admin.' };
        }

        return { authorized: true, user: userResponse.user };
    } catch (err: any) {
        console.error('Error during admin authorization:', err.message);
        return { authorized: false, message: 'Internal Server Error during authorization.' };
    }
}

// Xử lý yêu cầu POST (Tạo người dùng mới)
export async function POST(req: Request) {
    const authResult = await authorizeAdmin(req);
    if (!authResult.authorized) {
        // Thêm kiểm tra !authResult.message để đảm bảo nó không phải undefined
        return NextResponse.json({ message: authResult.message ?? 'Unknown authorization error.' }, { status: authResult.message?.includes('Unauthorized') ? 401 : 403 });
    }

    try {
        const { email, password, full_name, role } = await req.json();

        if (!email || !password || !full_name || !role) {
            return NextResponse.json({ message: 'Missing required fields: email, password, full_name, role.' }, { status: 400 });
        }

        // Tạo người dùng trong Supabase Auth (sử dụng service role key để tạo admin user)
        const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Tự động xác nhận email
        });

        if (createUserError) {
            console.error('Error creating user in Auth:', createUserError);
            return NextResponse.json({ message: createUserError.message || 'Failed to create user in authentication.' }, { status: 500 });
        }

        // Thêm thông tin profile vào bảng 'profiles'
        const { error: insertProfileError } = await supabaseAdmin.from('profiles').insert({
            id: newUser.user?.id,
            email: newUser.user?.email,
            full_name,
            role,
        });

        if (insertProfileError) {
            // Nếu không tạo được profile, có thể cần xóa người dùng đã tạo trong auth
            if (newUser.user?.id) { // Kiểm tra id tồn tại trước khi xóa
                await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
            }
            console.error('Error inserting profile:', insertProfileError);
            return NextResponse.json({ message: 'Failed to create user profile.' }, { status: 500 });
        }

        return NextResponse.json({ message: 'User created successfully.', user: { id: newUser.user?.id, email: newUser.user?.email } }, { status: 201 });

    } catch (err: any) {
        console.error('Internal server error during POST:', err);
        return NextResponse.json({ message: err.message || 'Internal server error.' }, { status: 500 });
    }
}

// Xử lý yêu cầu DELETE (Xóa người dùng)
export async function DELETE(req: Request) {
    const authResult = await authorizeAdmin(req);
    if (!authResult.authorized) {
        // Thêm kiểm tra !authResult.message để đảm bảo nó không phải undefined
        return NextResponse.json({ message: authResult.message ?? 'Unknown authorization error.' }, { status: authResult.message?.includes('Unauthorized') ? 401 : 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const userIdToDelete = searchParams.get('id');

        if (!userIdToDelete) {
            return NextResponse.json({ message: 'User ID is required for deletion.' }, { status: 400 });
        }

        // Đảm bảo admin không tự xóa tài khoản của mình
        if (userIdToDelete === authResult.user.id) {
             return NextResponse.json({ message: 'Forbidden: You cannot delete your own account.' }, { status: 403 });
        }

        // Xóa người dùng khỏi Supabase Auth
        const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);

        if (deleteUserError) {
            console.error('Error deleting user:', deleteUserError);
            return NextResponse.json({ message: deleteUserError.message || 'Failed to delete user.' }, { status: 500 });
        }

        // Xóa thông tin profile khỏi bảng 'profiles'
        const { error: deleteProfileError } = await supabaseAdmin.from('profiles').delete().eq('id', userIdToDelete);

        if (deleteProfileError) {
            console.warn(`Warning: User ${userIdToDelete} was deleted from Auth, but profile deletion failed: ${deleteProfileError.message}`);
            // Quyết định xem bạn có muốn trả về lỗi 500 ở đây hay không.
            // Có thể chấp nhận được nếu người dùng đã bị xóa khỏi auth.
        }

        return NextResponse.json({ message: 'User deleted successfully.' }, { status: 200 });

    } catch (err: any) {
        console.error('Internal server error during DELETE:', err);
        return NextResponse.json({ message: err.message || 'Internal server error.' }, { status: 500 });
    }
}