// types/product.ts
// Định nghĩa interface cho đối tượng Product
export interface Product {
  id: number; // ID sản phẩm, kiểu number theo Supabase
  slug: string; // Slug duy nhất của sản phẩm
  image: string; // URL hình ảnh chính của sản phẩm, CÓ THỂ LÀ NULL
  name: string; // Tên sản phẩm
  price: number; // Giá sản phẩm
  description: string | null; // Mô tả chi tiết sản phẩm, CÓ THỂ LÀ NULL
  images: string[] | null; // Mảng các URL hình ảnh phụ (từ cột JSONB), có thể null
  stock_quantity: number; // Số lượng tồn kho của sản phẩm
  [key: string]: unknown; // Cho phép các thuộc tính khác không được định nghĩa trước
}
