// types/product.ts
export interface Product {
  id: number;
  slug: string;
  image: string;
  name: string;
  price: number;
  // Bạn có thể thêm các thuộc tính khác của sản phẩm nếu cần
  [key: string]: any; // Cho phép các thuộc tính khác không được định nghĩa trước
}