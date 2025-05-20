// app/notification.tsx
"use client";

import { useCart } from "@/context/CartContext";

const Notification = () => {
  const { notification } = useCart();

  if (notification) {
    return (
      <div
        className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-md shadow-md z-50"
        style={{ zIndex: 100 }}
      >
        {notification}
      </div>
    );
  }
  return null;
};

export default Notification;