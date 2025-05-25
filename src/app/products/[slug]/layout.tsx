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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
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
      url: `https://tanshop.vercel.app/products/${product.slug}`, 
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} - Tấn shop`,
      description: product.description || `Chi tiết về sản phẩm ${product.name} của Tấn shop.`,
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