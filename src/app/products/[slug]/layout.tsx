// app/products/[slug]/layout.tsx
// Đây là một Server Component. Nó không có "use client".
// Đảm bảo import supabaseServer từ lib/supabase của bạn
import { supabase } from '@/lib/supabase'; // Điều chỉnh đường dẫn nếu cần

// Định nghĩa interface cho sản phẩm (phải khớp với cấu trúc bảng của bạn)
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  slug: string;
  image: string;
  images: string | string[] | null;
  stock_quantity: number;
}

// Hàm để lấy dữ liệu sản phẩm từ Supabase
async function getProductBySlugForMetadata(slug: string): Promise<Product | null> {
  const { data, error } = await supabase // Sử dụng supabaseServer từ lib/supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching product for metadata:', error.message);
    return null;
  }
  return data as Product;
}

// ==========================================================
// HÀM GENERATEMETADATA ĐỂ TẠO TIÊU ĐỀ VÀ MÔ TẢ ĐỘNG
// ==========================================================
// ĐÃ SỬA: Thay đổi kiểu của 'params' thành Promise<{ slug: string }>
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  // Await params để lấy đối tượng slug đã giải quyết
  const resolvedParams = await params;
  const product = await getProductBySlugForMetadata(resolvedParams.slug);

  if (!product) {
    return {
      title: 'Sản phẩm không tìm thấy - Tanshop',
      description: 'Sản phẩm bạn đang tìm kiếm không tồn tại.',
    };
  }

  return {
    title: `${product.name} - Tanshop`, // Tiêu đề sẽ là tên sản phẩm
    description: product.description || `Chi tiết về sản phẩm ${product.name} của Tanshop.`, // Mô tả có thể là mô tả sản phẩm
    openGraph: {
      title: `${product.name} - Tanshop`,
      description: product.description || `Chi tiết về sản phẩm ${product.name} của Tanshop.`,
      images: [
        {
          url: (product.images && Array.isArray(product.images) && product.images.length > 0)
            ? product.images[0]
            : product.image || '/default-product-image.jpg', // Lấy ảnh đầu tiên từ mảng images hoặc ảnh chính
          width: 800,
          height: 600,
          alt: product.name,
        },
      ],
      url: `https://tanshop.vercel.app/products/${product.slug}`, // URL chuẩn của trang
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} - Tanshop`,
      description: product.description || `Chi tiết về sản phẩm ${product.name} của Tanshop.`,
      images: [(product.images && Array.isArray(product.images) && product.images.length > 0)
        ? product.images[0]
        : product.image || '/default-product-image.jpg'],
    },
  };
}

// ==========================================================
// COMPONENT LAYOUT CHÍNH CHO ROUTE ĐỘNG NÀY
// ==========================================================
export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}