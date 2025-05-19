import '@/app/globals.css'; 
import Navbar from "@/components/Navbar";
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white">
{/* Hero Section */}
      <section className="relative h-[90vh] bg-cover bg-center" style={{ backgroundImage: "url('/hero.jpg')" }}>
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <h2 className="text-white text-4xl md:text-6xl font-bold text-center">
            Sự tinh tế trong từng thiết kế
          </h2>
        </div>
      </section>
      </main>
    </>
  );
}


