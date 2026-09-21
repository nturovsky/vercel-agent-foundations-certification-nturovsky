"use client"

import { ShoppingBag } from "lucide-react"
import { useCart } from "@/components/cart-provider"

export function CartButton() {
  const { itemCount, openCart } = useCart()

  return (
    <button
      onClick={openCart}
      className="relative text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Shopping cart"
    >
      <ShoppingBag className="h-5 w-5" />
      {itemCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </button>
  )
}
