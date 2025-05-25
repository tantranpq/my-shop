// src/app/collection/layout.tsx
// Đây là Server Component, KHÔNG có "use client"
import React from 'react';

export const metadata = {
  title: 'Bộ sưu tập của bạn - Tấn shop', // Tiêu đề cụ thể cho trang Collection
  description: 'Khám phá các sản phẩm yêu thích đã được lưu trong bộ sưu tập của bạn.', // Mô tả cho trang Collection
  // Bạn có thể thêm openGraph và twitter metadata ở đây nếu muốn
  // Nhưng nếu bạn muốn chúng kế thừa từ app/layout.tsx (ví dụ: ảnh logo chung),
  // thì không cần định nghĩa lại images ở đây.
  // openGraph: {
  //   title: 'Bộ sưu tập của bạn - Tanshop',
  //   description: 'Khám phá các sản phẩm yêu thích đã được lưu trong bộ sưu tập của bạn.',
  //   url: 'https://tanshop.vercel.app/collection', // Thay đổi bằng URL thực tế của trang collection
  //   type: 'website',
  // },
  // twitter: {
  //   card: 'summary_large_image',
  //   title: 'Bộ sưu tập của bạn - Tanshop',
  //   description: 'Khám phá các sản phẩm yêu thích đã được lưu trong bộ sưu tập của bạn.',
  // },
};

export default function CollectionLayout({
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