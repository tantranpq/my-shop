import Navbar from "@/components/Navbar";
import ProductListClient from "@/app/products/ProductListClient";
import { supabase } from "@/lib/supabase";

interface ProductsPageProps {
  searchParams?: { search?: string };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const searchTerm = searchParams?.search || null;

  let query = supabase.from("products").select("*");
  if (searchTerm) {
    query = query.ilike("name", `%${searchTerm}%`);
  }
  const { data: products, error } = await query;

  if (error || !products) {
    return (
      <>
        <Navbar />
        <main className="max-w-6xl mx-auto p-6">
          <p>Lỗi khi tải sản phẩm: {error?.message || "Không thể tải dữ liệu."}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">
          {searchTerm ? `Kết quả tìm kiếm cho '${searchTerm}'` : "Sản phẩm"}
        </h1>
        {products.length > 0 ? (
          <ProductListClient products={products} />
        ) : (
          searchTerm && <p>Không tìm thấy sản phẩm nào phù hợp với từ khóa &quot;{searchTerm}&quot;</p>
        )}
      </main>
    </>
  );
}
