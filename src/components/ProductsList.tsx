"use client";

import Link from "next/link";
import { Product } from "@/types/product";
import React from "react";
import Image from 'next/image'; // Import Next.js Image

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
                            <Image
                                src={product.image}
                                alt={product.name}
                                width={300}
                                height={200}
                                className="w-full h-60 object-cover cursor-pointer"
                                style={{ objectFit: 'cover' }}
                            />
                        </Link>
                        {/* Không còn lớp phủ giá trên ảnh */}
                    </div>
                    <div className="p-4 flex flex-col"> {/* Sử dụng flex-col để sắp xếp dọc */}
                        <h2 className="font-semibold text-lg">{product.name}</h2>
                        <p className="text-pink-500 font-bold text-xl mt-2">{product.price} vnđ</p>
                        <div className="flex items-center justify-between mt-4">
                            <button className="bg-yellow-500 text-white py-2 px-4 rounded-md hover:bg-yellow-600 transition text-sm w-1/2 mr-1">
                                Mua ngay
                            </button>
                            <button
                                className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition text-sm w-1/2 ml-1"
                                onClick={() => onAddToCart(product)}
                            >
                                Thêm
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}