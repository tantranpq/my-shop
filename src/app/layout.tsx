// app/layout.tsx
import './globals.css';
import { ClientProviders } from './ClientProviders';

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
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
