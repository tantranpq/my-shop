"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  SetStateAction, // Import SetStateAction
  Dispatch // Import Dispatch
} from "react";

type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  slug: string;
};

type CartItem = Product & { quantity: number };

type CartContextType = {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (slug: string) => void;
  clearCart: () => void;
  notification: string | null;
  setNotification: (message: string | null) => void;
  incrementQuantity: (slug: string) => void;
  decrementQuantity: (slug: string) => void;
  // Thêm setCart vào CartContextType
  setCart: Dispatch<SetStateAction<CartItem[]>>;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const storedCart = localStorage.getItem("cart");
    if (storedCart) {
      setCart(JSON.parse(storedCart));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.slug === product.slug);
      if (existing) {
        return prev.map((item) =>
          item.slug === product.slug
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setNotification(`Đã thêm "${product.name}" vào giỏ hàng!`);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const removeFromCart = (slug: string) => {
    setCart((prev) => prev.filter((item) => item.slug !== slug));
    setNotification(`Đã xóa sản phẩm khỏi giỏ hàng.`);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const clearCart = () => {
    setCart([]);
    setNotification('Giỏ hàng đã được làm trống.');
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const incrementQuantity = (slug: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.slug === slug ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const decrementQuantity = (slug: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.slug === slug && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
    );
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        notification,
        setNotification,
        incrementQuantity,
        decrementQuantity,
        setCart, // Thêm setCart vào đây
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}