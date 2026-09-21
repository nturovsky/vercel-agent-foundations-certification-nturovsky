import Link from "next/link"
import Image from "next/image"
import { formatPrice } from "@/lib/format"
import type { Product } from "@/lib/types"

interface ProductCardProps {
  product: Product
  priority?: boolean
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const image = product.images[0]
  return (
    <Link
      href={`/products/${product.id}`}
      className="group block overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-foreground/20"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {image && (
          <Image
            src={image}
            alt={product.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium text-foreground">{product.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatPrice(product.price, product.currency)}
        </p>
      </div>
    </Link>
  )
}
