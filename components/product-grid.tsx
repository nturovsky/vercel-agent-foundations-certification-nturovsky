import type { Product } from "@/lib/types"
import { ProductCard } from "./product-card"

interface ProductGridProps {
  products: Product[]
  priorityFirst?: boolean
}

export function ProductGrid({ products, priorityFirst = false }: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, i) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={priorityFirst && i === 0}
        />
      ))}
    </div>
  )
}
