import '@/app/globals.css'; 
import Navbar from "@/components/Navbar";
export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Liên hệ</h1>
      <p>Bạn có thể liên hệ với chúng tôi qua email: <strong>support@tanshop.vn</strong></p>
    </main>
    </>
  );
}


