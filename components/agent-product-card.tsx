"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { ProductDetailsToolInvocation } from "@/lib/agent";

interface AgentProductCardProps {
  invocation: ProductDetailsToolInvocation;
}

export function AgentProductCard({ invocation }: AgentProductCardProps) {
  if (
    invocation.state === "input-streaming" ||
    invocation.state === "input-available"
  ) {
    const idOrSlug = invocation.input?.idOrSlug;
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Looking up{idOrSlug ? ` "${idOrSlug}"` : ""}…
      </div>
    );
  }

  if (invocation.state !== "output-available") return null;

  const output = invocation.output;

  if (!output) return null;

  if ("error" in output && output.error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {output.error}
      </div>
    );
  }

  const { product, stock } = output;

  if (!product) return null;

  const image = product.images?.[0];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Link
        href={`/products/${product.slug}`}
        className="block transition-colors hover:bg-secondary/50"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-secondary">
          {image && (
            <Image
              src={image}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 320px"
              className="object-cover"
            />
          )}
        </div>

        <div className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight">
                {product.name}
              </h3>
              <p className="text-xs capitalize text-muted-foreground">
                {product.category}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold">
              {formatPrice(product.price, product.currency)}
            </p>
          </div>

          {product.description && (
            <p className="line-clamp-3 text-xs text-muted-foreground">
              {product.description}
            </p>
          )}

          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {stock && (
            <p
              className={`text-xs font-medium ${
                !stock.inStock
                  ? "text-destructive"
                  : stock.lowStock
                    ? "text-amber-600 dark:text-amber-500"
                    : "text-emerald-600 dark:text-emerald-500"
              }`}
            >
              {!stock.inStock
                ? "Out of stock"
                : stock.lowStock
                  ? `Low stock — only ${stock.stock} left`
                  : "In stock"}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}
