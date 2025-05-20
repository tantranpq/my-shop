"use client";
import { useState, useEffect, useRef } from "react";
import { Menu, ShoppingCart, User } from "lucide-react";
import { Search as SearchIcon, X as CloseIcon } from "lucide-react";
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import styles from './Navbar.module.css'; // Import CSS module

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { cart } = useCart();
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const mobileSearchInputRef = useRef<HTMLDivElement>(null);

  const totalItemsInCart = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDesktopLoginClick = () => {
    router.push(`/login?redirectTo=${pathname}`);
  };

  const handleMobileLoginClick = () => {
    setIsOpen(false);
    router.push(`/login?redirectTo=${pathname}`);
  };

  const toggleMobileSearch = () => {
    setIsMobileSearchOpen(!isMobileSearchOpen);
    setSearchTerm('');
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/products?search=${searchTerm.trim()}`);
      setSearchTerm('');
      setIsMobileSearchOpen(false);
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileSearchOpen && mobileSearchInputRef.current && !mobileSearchInputRef.current.contains(event.target as Node)) {
        setIsMobileSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileSearchOpen]);

  const menuItems = [
    { label: "Trang chủ", href: "/" },
    { label: "Sản phẩm", href: "/products" },
    { label: "Bộ sưu tập", href: "/collection" },
    { label: "Liên hệ", href: "/contact" },
  ];

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          Tấn Shop
        </Link>

        {/* Desktop Menu and Search */}
        <div className={styles.desktopSection}>
          <ul className={styles.desktopMenuList}>
            {menuItems.map((item) => (
              <li key={item.href} className={styles.desktopMenuItem}>
                <Link href={item.href} className={styles.desktopLink}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <form onSubmit={handleSearchSubmit} className={styles.desktopSearchForm}>
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={handleSearchInputChange}
            />
            <button type="submit" className={styles.searchButton}>
              <SearchIcon size={20} />
            </button>
          </form>
        </div>

        {/* Mobile Icons (hiển thị khi không phải desktop) */}
        <div className={`md:hidden ${styles.mobileIcons}`}>
          <div onClick={toggleMobileSearch} className={styles.mobileSearchIcon}>
            {isMobileSearchOpen ? <CloseIcon size={24} /> : <SearchIcon size={24} />}
          </div>
          <Link href="/cart" className={styles.iconLink}>
            <ShoppingCart size={24} />
            {totalItemsInCart > 0 && (
              <span className={styles.cartBadge}>{totalItemsInCart}</span>
            )}
          </Link>
          {user ? (
            <Link href="/profile" className={styles.iconLink}>
              <User size={24} />
            </Link>
          ) : (
            <Link href={`/login?redirectTo=${pathname}`} className={styles.iconLink}>
              Đăng nhập
            </Link>
          )}
          {user && (
            <button onClick={handleSignOut} className={styles.iconLink}>
              Đăng xuất
            </button>
          )}
          {/* Mobile Menu Button */}
          <button onClick={() => setIsOpen(!isOpen)} className={styles.mobileMenuButton}>
            {isOpen ? <CloseIcon size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Desktop Auth Icons */}
        <div className={styles.desktopAuthIcons}>
          <Link href="/cart" className={styles.iconLink}>
            <ShoppingCart size={24} />
            {totalItemsInCart > 0 && (
              <span className={styles.cartBadge}>{totalItemsInCart}</span>
            )}
          </Link>
          {user ? (
            <Link href="/profile" className={styles.iconLink}>
              <User size={24} />
            </Link>
          ) : (
            <Link href={`/login?redirectTo=${pathname}`} className={styles.iconLink}>
              Đăng nhập
            </Link>
          )}
          {user && (
            <button onClick={handleSignOut} className={styles.iconLink}>
              Đăng xuất
            </button>
          )}
        </div>
      </div>

      {/* Mobile Search Input */}
      {isMobileSearchOpen && (
        <div className={styles.mobileSearchContainer} ref={mobileSearchInputRef}>
          <form onSubmit={handleSearchSubmit} className={styles.mobileSearchForm}>
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              className={styles.mobileSearchInput}
              value={searchTerm}
              onChange={handleSearchInputChange}
            />
            <button type="submit" className={styles.mobileSearchSubmitButton}>
              <SearchIcon size={20} />
            </button>
          </form>
        </div>
      )}

      {/* Mobile Menu */}
      {isOpen && (
        <div className={styles.mobileMenu}>
          <ul className={styles.mobileMenuList}>
            {menuItems.map((item) => (
              <li key={item.href} className={styles.mobileMenuItem}>
                <Link
                  href={item.href}
                  className={styles.mobileLink}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
};

export default Navbar;