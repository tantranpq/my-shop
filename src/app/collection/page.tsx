import '@/app/globals.css'; 
import Navbar from "@/components/Navbar";
export const dynamic = "force-dynamic";

export default function CollectionPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Bộ sưu tập của bạn</h1>
      <p>Đây là bộ sưu tập của bạn <strong>COLLECTION</strong></p>
    </main>
    </>
  );
}


