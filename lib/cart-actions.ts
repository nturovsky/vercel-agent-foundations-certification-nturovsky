"use server"

import { updateTag } from "next/cache"
import {
  cartAdd,
  cartGet,
  cartRemove,
  cartUpdate,
  getProductStock,
} from "./api"
import { getCartToken, getOrCreateCartToken } from "./cart-token"
import type { CartWithProducts, StockInfo } from "./types"

const EMPTY_CART: CartWithProducts = {
  token: "",
  items: [],
  totalItems: 0,
  subtotal: 0,
  currency: "USD",
  createdAt: "",
  updatedAt: "",
}

export async function getCartAction(): Promise<CartWithProducts> {
  const token = await getCartToken()
  if (!token) return EMPTY_CART
  try {
    return await cartGet(token)
  } catch {
    return EMPTY_CART
  }
}

export async function addToCartAction(
  productId: string,
  quantity: number = 1,
): Promise<CartWithProducts> {
  const token = await getOrCreateCartToken()
  const cart = await cartAdd(token, productId, quantity)
  updateTag("cart")
  return cart
}

export async function updateCartItemAction(
  productId: string,
  quantity: number,
): Promise<CartWithProducts> {
  const token = await getCartToken()
  if (!token) return EMPTY_CART
  const cart = await cartUpdate(token, productId, quantity)
  updateTag("cart")
  return cart
}

export async function removeCartItemAction(
  productId: string,
): Promise<CartWithProducts> {
  const token = await getCartToken()
  if (!token) return EMPTY_CART
  const cart = await cartRemove(token, productId)
  updateTag("cart")
  return cart
}

export async function getProductStockAction(
  idOrSlug: string,
): Promise<StockInfo> {
  return getProductStock(idOrSlug)
}
