"use client";
import { useState } from "react";
import { Menu, X } from "lucide-react"; // icon
import Link from 'next/link';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { label: "Trang chủ", href: "/" },
    { label: "Sản phẩm", href: "/products" },
    { label: "Bộ sưu tập", href: "/collection" },
    { label: "Liên hệ", href: "/contact" },
    { label: "Giỏ hàng", href: "/cart" },

  ];

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Logo */}
        <Link href="/">
        <div className="text-xl font-bold text-gray-800">Tấn Shop</div>
        </Link>
        {/* Desktop Menu */}
        <ul className="hidden md:flex gap-6 text-sm text-gray-700">
          {menuItems.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="hover:text-pink-500 transition">
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Mobile Button */}
        <button
          className="md:hidden text-gray-700"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <ul className="md:hidden px-4 pb-4 space-y-2 text-gray-700 mobile-menu">
          {menuItems.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="block py-2 border-b hover:text-pink-500"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
};

export default Navbar;
