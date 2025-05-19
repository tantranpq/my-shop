"use client";

import Link from "next/link";
import { Product } from "@/types/product";
import React from "react";

type Props = {
    products: Product[];
    onAddToCart: (product: Product) => void;
};

export default function ProductsList({ products, onAddToCart }: Props) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {products?.map((product) => (
                <div key={product.id} className="border rounded-lg overflow-hidden shadow hover:shadow-lg transition">
                    <div className="relative">
                        <Link href={`/products/${product.slug}`}>
                            <img src={product.image} alt={product.name} className="w-full h-60 object-cover cursor-pointer" />
                        </Link>
                        <button className="absolute top-2 right-2 bg-white bg-opacity-75 rounded-full p-1 hover:bg-opacity-100">
                            <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </button>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold text-lg">{product.name}</h2>
                            <p className="text-pink-500 font-bold">{product.price} vnđ</p>
                        </div>
                        <button className="bg-yellow-500 text-white py-2 px-4 rounded-md hover:bg-yellow-600 transition text-sm">
                            Mua ngay
                        </button>
                        <button
                            className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition text-sm"
                            onClick={() => onAddToCart(product)}
                        >
                            Thêm vào giỏ
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}