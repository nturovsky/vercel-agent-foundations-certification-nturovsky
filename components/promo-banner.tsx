import { getPromotion } from "@/lib/api"

export async function PromoBanner() {
  const promo = await getPromotion()
  if (!promo || !promo.active) return null

  return (
    <section className="bg-foreground text-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-3 text-center sm:flex-row sm:justify-center sm:gap-3">
        <span className="text-sm font-semibold uppercase tracking-wide">
          {promo.title}
        </span>
        <span className="text-sm opacity-90">{promo.description}</span>
        {promo.code && (
          <span className="rounded-full border border-background/30 px-3 py-1 text-xs font-medium tracking-wider">
            Code: {promo.code}
          </span>
        )}
      </div>
    </section>
  )
}
