import { cookies } from "next/headers"
import { cartCreate } from "./api"

const CART_TOKEN_COOKIE = "cart_token"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function getCartToken(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(CART_TOKEN_COOKIE)?.value
}

export async function getOrCreateCartToken(): Promise<string> {
  const existing = await getCartToken()
  if (existing) return existing

  const { token } = await cartCreate()
  const store = await cookies()
  store.set(CART_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
  return token
}

export async function clearCartToken(): Promise<void> {
  const store = await cookies()
  store.delete(CART_TOKEN_COOKIE)
}
