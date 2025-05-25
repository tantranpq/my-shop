import { supabase } from '@/lib/supabase'; 

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
  const { data, error } = await supabase 
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
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const resolvedParams = await Promise.resolve(params);
  const product = await getProductBySlugForMetadata(resolvedParams.slug);

  if (!product) {
    return {
      title: 'Sản phẩm không tìm thấy - Tấn shop',
      description: 'Sản phẩm bạn đang tìm kiếm không tồn tại.',
    };
  }

  return {
    title: `${product.name} - Tấn shop`, 
    description: product.description || `Chi tiết về sản phẩm ${product.name} của Tấn shop.`, 
    openGraph: {
      title: `${product.name} - Tấn shop`,
      description: product.description || `Chi tiết về sản phẩm ${product.name} của Tấn shop.`,
      images: [
        {
          url: (product.images && Array.isArray(product.images) && product.images.length > 0)
            ? product.images[0]
            : product.image || '/default-product-image.jpg', 
          width: 800,
          height: 600,
          alt: product.name,
        },
      ],
      url: `https://tanshop.vercel.app/products/${product.slug}`, 
      type: 'website', 
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} - Tấn Shop`,
      description: product.description || `Chi tiết về sản phẩm ${product.name} của Tấn shop.`,
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