"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import {
  addToCartAction,
  getCartAction,
  removeCartItemAction,
  updateCartItemAction,
} from "@/lib/cart-actions"
import type { CartItemWithProduct, CartWithProducts, Product } from "@/lib/types"

interface CartContextType {
  cart: CartWithProducts
  itemCount: number
  isOpen: boolean
  isPending: boolean
  openCart: () => void
  closeCart: () => void
  addToCart: (product: Product, quantity: number) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const EMPTY_CART: CartWithProducts = {
  token: "",
  items: [],
  totalItems: 0,
  subtotal: 0,
  currency: "USD",
  createdAt: "",
  updatedAt: "",
}

type OptimisticAction =
  | { type: "add"; product: Product; quantity: number }
  | { type: "update"; productId: string; quantity: number }
  | { type: "remove"; productId: string }

function recompute(items: CartItemWithProduct[], currency: string): CartWithProducts {
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  return {
    token: "",
    items,
    totalItems,
    subtotal,
    currency,
    createdAt: "",
    updatedAt: "",
  }
}

function reducer(state: CartWithProducts, action: OptimisticAction): CartWithProducts {
  switch (action.type) {
    case "add": {
      const { product, quantity } = action
      const existing = state.items.find((i) => i.productId === product.id)
      const items = existing
        ? state.items.map((i) =>
            i.productId === product.id
              ? {
                  ...i,
                  quantity: i.quantity + quantity,
                  lineTotal: (i.quantity + quantity) * product.price,
                }
              : i,
          )
        : [
            ...state.items,
            {
              productId: product.id,
              quantity,
              addedAt: new Date().toISOString(),
              product,
              lineTotal: product.price * quantity,
            },
          ]
      return recompute(items, state.currency || product.currency)
    }
    case "update": {
      const items =
        action.quantity <= 0
          ? state.items.filter((i) => i.productId !== action.productId)
          : state.items.map((i) =>
              i.productId === action.productId
                ? {
                    ...i,
                    quantity: action.quantity,
                    lineTotal: action.quantity * i.product.price,
                  }
                : i,
            )
      return recompute(items, state.currency)
    }
    case "remove": {
      const items = state.items.filter((i) => i.productId !== action.productId)
      return recompute(items, state.currency)
    }
  }
}

interface CartProviderProps {
  children: ReactNode
}

export function CartProvider({ children }: CartProviderProps) {
  const [cart, setCart] = useState<CartWithProducts>(EMPTY_CART)
  const [optimisticCart, applyOptimistic] = useOptimistic<
    CartWithProducts,
    OptimisticAction
  >(cart, reducer)
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)

  // Hydrate from the session cookie after mount so the rest of the app stays static.
  useEffect(() => {
    let cancelled = false
    getCartAction()
      .then((server) => {
        if (!cancelled) setCart(server)
      })
      .catch(() => {
        // No-op: leave cart empty if the API is unreachable.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const addToCart = useCallback(
    (product: Product, quantity: number) => {
      startTransition(async () => {
        applyOptimistic({ type: "add", product, quantity })
        try {
          const updated = await addToCartAction(product.id, quantity)
          setCart(updated)
        } catch (err) {
          console.error("addToCart failed", err)
        }
      })
    },
    [applyOptimistic],
  )

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      startTransition(async () => {
        applyOptimistic({ type: "update", productId, quantity })
        try {
          const updated = await updateCartItemAction(productId, quantity)
          setCart(updated)
        } catch (err) {
          console.error("updateQuantity failed", err)
        }
      })
    },
    [applyOptimistic],
  )

  const removeFromCart = useCallback(
    (productId: string) => {
      startTransition(async () => {
        applyOptimistic({ type: "remove", productId })
        try {
          const updated = await removeCartItemAction(productId)
          setCart(updated)
        } catch (err) {
          console.error("removeFromCart failed", err)
        }
      })
    },
    [applyOptimistic],
  )

  return (
    <CartContext.Provider
      value={{
        cart: optimisticCart,
        itemCount: optimisticCart.totalItems,
        isOpen,
        isPending,
        openCart,
        closeCart,
        addToCart,
        removeFromCart,
        updateQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
