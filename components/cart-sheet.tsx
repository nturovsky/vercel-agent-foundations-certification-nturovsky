"use client"

import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCart } from "@/components/cart-provider"
import { formatPrice } from "@/lib/format"

export function CartSheet() {
  const {
    isOpen,
    closeCart,
    cart,
    itemCount,
    removeFromCart,
    updateQuantity,
  } = useCart()

  const items = cart.items
  const currency = cart.currency || "USD"

  return (
    <Sheet open={isOpen} onOpenChange={closeCart}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Shopping Cart ({itemCount})</SheetTitle>
          <SheetDescription className="sr-only">
            Review the items in your cart, adjust quantities, or remove items.
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground">Your cart is empty</p>
            <Button variant="outline" onClick={closeCart} asChild>
              <Link href="/search">Continue Shopping</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.productId} className="px-4 py-4">
                    <div className="flex gap-4">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                        {item.product.images[0] && (
                          <Image
                            src={item.product.images[0]}
                            alt={item.product.name}
                            fill
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex justify-between">
                          <Link
                            href={`/products/${item.productId}`}
                            onClick={closeCart}
                            className="text-sm font-medium text-foreground hover:underline"
                          >
                            {item.product.name}
                          </Link>
                          <button
                            onClick={() => removeFromCart(item.productId)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatPrice(item.product.price, currency)}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity - 1)
                            }
                            className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity + 1)
                            }
                            className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <span className="ml-auto text-sm font-medium tabular-nums">
                            {formatPrice(item.lineTotal, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <SheetFooter className="border-t border-border">
              <div className="w-full space-y-4">
                <div className="flex items-center justify-between text-base font-medium">
                  <span>Subtotal</span>
                  <span>{formatPrice(cart.subtotal, currency)}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Shipping and taxes calculated at checkout.
                </p>
                <Button disabled className="w-full">
                  Checkout
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Checkout coming soon
                </p>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
