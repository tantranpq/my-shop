"use client";

import { useSearchParams } from 'next/navigation';

export default function SimpleClient() {
  const searchParams = useSearchParams();
  const foo = searchParams.get('foo') || 'Chưa có giá trị foo';

  return (
    <div style={{ padding: 20 }}>
      <h2>Test useSearchParams trong client component</h2>
      <p>Giá trị của "foo" trong URL là: <strong>'{foo}'</strong></p>
      <p>Ví dụ thử truy cập: /checkout?foo=hello</p>
    </div>
  );
}
