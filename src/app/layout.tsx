// app/layout.tsx
import './globals.css'; // Đảm bảo bạn vẫn import global CSS của mình
import { ClientProviders } from './ClientProviders'; // Import ClientProviders của bạn

export const metadata = {
  title: 'Tấn Shop',
  description: 'Nơi bán mọi sản phẩm bạn cần',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Thêm liên kết Font Awesome CDN vào đây */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
        {/* Các thẻ <meta> hoặc <link> khác của bạn có thể ở đây, ví dụ: */}
        {/* <meta name="viewport" content="width=device-width, initial-scale=1" /> */}
      </head>
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
