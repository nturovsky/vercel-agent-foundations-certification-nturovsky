# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`).

- `pnpm dev` — start the Next.js dev server on http://localhost:3000
- `pnpm build` — production build
- `pnpm start` — serve the production build
- `pnpm lint` — wired but `eslint` is not installed; the script will fail until a linter is added

There is no test framework wired up.

## Stack

- **Next.js 16** App Router with **React 19**
- **TypeScript** with `strict: true`, `@/*` path alias maps to the project root
- **Tailwind CSS v4** (PostCSS plugin); theme tokens are CSS variables defined in `app/globals.css`
- **shadcn/ui** (new-york style, neutral base) — components live in `components/ui/`, generator config in `components.json`. Use `cn()` from `lib/utils.ts` for class merging
- **lucide-react** for icons

## Environment

`.env.local` (gitignored) holds:

- `BYPASS_SECRET` — required. Sent as the `x-vercel-protection-bypass` header on every API call. Must never be exposed to the client (no `NEXT_PUBLIC_` prefix).
- `API_BASE_URL` — optional. Defaults to `https://vercel-agentic-swag-store-api.vercel.app/api` in `lib/api.ts`.
- `VERCEL_OIDC_TOKEN` — auth for the **AI Gateway** (the chat agent's model calls, model id `anthropic/claude-sonnet-4.6`). Pulled by `vercel env pull` / `vercel dev`. **It expires (~12h)** — when it does, the agent fails with `GatewayAuthenticationError: Unauthenticated request to AI Gateway`. Refresh with `vercel env pull` or run via `vercel dev`.

`.env.example` is the redacted template for new developers.

### AI Gateway auth gotcha (chat agent)

The chat agent authenticates to the Vercel AI Gateway. The gateway **prefers `AI_GATEWAY_API_KEY` over `VERCEL_OIDC_TOKEN`** when both are present. The committed `.env` contains an **invalid/expired `AI_GATEWAY_API_KEY`**, so with a normal `next dev` (which loads both `.env` and `.env.local`) the bad key wins and every agent call is rejected — surfaced in the UI as the generic "An error occurred." (the AI SDK masks the real error; check the dev-server log for `GatewayAuthenticationError`).

Fix in place: `.env.local` sets `AI_GATEWAY_API_KEY=` (empty). Next.js loads `.env.local` after `.env`, so the empty value overrides the bad key and the gateway falls back to the working `VERCEL_OIDC_TOKEN`. The clean alternative is to remove/correct the key in `.env` and drop the empty override — but `.env` may be blocked by tooling permissions. After editing any `.env*`, restart the dev server.

## Architecture

The storefront brand is **Ship It Shop** (metadata, header, homepage copy). The store is backed by the live **Vercel Swag Store API** (no local product/cart database). The protection-bypass secret stays server-side: every API read happens in a Server Component or Server Action, every cart mutation goes through a Server Action, and the cart token cookie is `httpOnly`.

### Data layer (`lib/`)

- `lib/types.ts` — pure type module re-exporting the API schemas (`Product`, `CartWithProducts`, `CartItemWithProduct`, `Promotion`, `Category`, `StockInfo`, `StoreConfig`). Both server and client modules import from here. Also exports the `CATEGORY_SLUGS` const tuple used by the category filter.
- `lib/api.ts` — typed `fetch` wrapper. Functions: `getProducts`, `getProductById`, `getProductStock`, `getCategories`, `getPromotion`, `getStoreConfig`, `cartCreate`, `cartGet`, `cartAdd`, `cartUpdate`, `cartRemove`. **Server-only** by convention (reads `process.env.VERCEL_PROTECTION_BYPASS_SECRET`). Throws `ApiRequestError` on non-200/`success:false` responses.
- `lib/cart-token.ts` — `getOrCreateCartToken()`/`getCartToken()`/`clearCartToken()` using `next/headers`. Stores the API-issued cart UUID in an `httpOnly` cookie `cart_token` with a 30-day max-age.
- `lib/cart-actions.ts` — `'use server'` actions: `getCartAction`, `addToCartAction`, `updateCartItemAction`, `removeCartItemAction`, `getProductStockAction`. Each cart mutation calls the API and `revalidateTag('cart')`. The first add lazily creates the cart on the server.
- `lib/format.ts` — `formatPrice(cents, currency)` using `Intl.NumberFormat`. **API prices are integers in cents**, so always pass them through this helper.
- `components/cart-provider.tsx` — Client `CartProvider` that hydrates the cart on mount by calling `getCartAction()` (so the layout can stay synchronous and routes can be statically rendered). Mutations dispatch through Server Actions inside `startTransition`, with `useOptimistic` for snappy UI.

### Chat agent

The "Ship It Shop Agent" (AI SDK `ToolLoopAgent`) is wired across three files — keep the responsibilities separated:

- `lib/agent.ts` — **defines and exports** `shoppingAgent` (`new ToolLoopAgent({ model, instructions })`). This is the only place the agent is created. (Common mistake: the route-handler code getting pasted here, which produces a self-import `import { shoppingAgent } from "@/lib/agent"` that resolves to the file itself and errors "no exported member 'shoppingAgent'".)
- `app/api/chat/route.ts` — the `POST` handler. Imports `shoppingAgent` and streams it via `createAgentUIStreamResponse({ agent, uiMessages })`.
- `components/agent-chat.tsx` — client UI. Uses `useChat()` from `@ai-sdk/react`, submits via `sendMessage({ text })`, renders each message's `parts` (text parts through `Message`/`MessageContent`/`MessageResponse` from `components/ai-elements/message`).

#### Agent tools (`lib/tools.ts`)

Completed the "Tools" workshop chapter — `lib/tools.ts` defines four `tool()`s, all registered on `shoppingAgent` in `lib/agent.ts` and driven by its instructions:

- `searchProducts` — broad catalog lookup (`getProducts`), optional free-text `query` + string `category`. Returns trimmed summary fields for up to 10 products.
- `getAllCategories` — runtime category list (`getCategories`), no args. Lets the model fetch valid category slugs instead of a hardcoded enum, then feed one into `searchProducts`.
- `getProductDetails` — single-item lookup by id/slug (`getProductById`) returning full details (all images, tags, featured) plus live stock from `getProductStock` (nested try/catch → `null` on stock failure). Descriptions steer the model here (vs. `searchProducts`) for specific items.
- `returnOrder` — the one *action* tool. Now **durable**: instead of running the API calls inline, its `execute` calls `start(returnFlow, [orderId, reason])` and returns `{ runId, message }`. The multi-step return (`getOrder` → `notifyReturnInProcess` → `preauthorizeRefund` → `createReturn`) runs inside the `returnFlow` workflow so a mid-flow crash resumes instead of leaving partial state. See **Workflows** below.

Every `execute` wraps the API call in try/catch and returns a structured `{ ..., error }` instead of throwing. Longer walkthrough with rationale in `vercel.md` (untracked scratch note).

UI plumbing: `AgentChat` lives in `components/agent-sidebar.tsx` (a **right-side, offcanvas, `defaultOpen={false}`** sidebar), mounted by `app/(store)/layout.tsx`. It's hidden until you click the **Bot icon** (`components/agent-button.tsx`) in the header (or `Cmd/Ctrl+B`). Open state is mirrored to a `?chat=open` URL param by `components/agent-panel-sync.tsx`. See the **AI Gateway auth gotcha** above if messages return "An error occurred."

#### Generative UI (tool calls as React components)

Completed the "Generative UI" workshop chapter — two `searchProducts`/`getProductDetails` tool calls render as typed React components instead of plain text.

- `lib/agent.ts` derives and exports the UI types from the agent (import `type InferAgentUIMessage` + `type UIToolInvocation` from `ai`): `ShoppingAgentUIMessage` (encodes each tool as a `tool-{name}` part), plus `SearchProductsToolInvocation` and `ProductDetailsToolInvocation` (the per-tool invocation shapes used as component props).
- `components/agent-product-list.tsx` — `AgentProductList` renders `searchProducts`. `components/agent-product-card.tsx` — `AgentProductCard` renders `getProductDetails`. Both are `"use client"`, switch on `invocation.state` (`input-streaming`/`input-available` → skeleton, `output-available` → result, else `null`), show a destructive box on `output.error`, and link out to `/products/{slug}` with `next/image` + `formatPrice`.
- The card reads the **real** `getProductDetails` output shape — `{ product, stock, error }` (not the flat shape the workshop starter assumes): image from `product.images[0]`, `product.tags` as pills, and a stock line off `output.stock` (`inStock`/`lowStock`/count), hidden when `stock` is `null`. Skeleton reads `invocation.input?.idOrSlug` (the tool's input field is `idOrSlug`, not `id`).
- `components/agent-chat.tsx` types the hook as `useChat<ShoppingAgentUIMessage>()` so the `switch (p.type)` narrows per part, and adds `case "tool-searchProducts"` / `case "tool-getProductDetails"` rendering the two components. `searchProducts` needs a specific-item query (e.g. "tell me about the black hoodie") to trigger the `getProductDetails` card; a broad category query only fires `searchProducts`.
- **Not wired**: `components/admin-agent-chat.tsx` is a separate chapter and still uses local `useState` (no agent) — leave it untouched here. The model may still narrate products in prose alongside the card; that's model behavior, not a rendering bug.

### Workflows (durable agent + durable actions)

Completed the "Workflows" workshop chapter — chat and the return action now run as **durable Vercel Workflows** (`"use workflow"` orchestrators built from `"use step"` steps that are cached and retried up to 3×). A crash or dropped connection resumes from the last completed step instead of restarting.

- `next.config.mjs` — wraps the export in `withWorkflow(nextConfig)` (from `workflow/next`) so the `"use workflow"` / `"use step"` directives are compiled at build time.
- `lib/workflows/return-flow.ts` — `returnFlow(orderId, reason)` marked `"use workflow"`. Each API call is its own `"use step"` helper (`getOrderStep`, `notifyReturnInProcessStep`, `preauthorizeRefundStep`, `createReturnStep`) so each retries/caches independently. Returns `{ orderId, returnId }`.
- `lib/workflows/chat-flow.ts` — `chatFlow(messages)` marked `"use workflow"`. Builds a `DurableAgent` (`@workflow/ai/agent`) with the same model/instructions/tools as `shoppingAgent`, and streams UI chunks to `getWritable<UIMessageChunk>()`.
- `lib/tools.ts` — every tool `execute` starts with `"use step"`. `returnOrder` no longer runs the API calls inline; it calls `start(returnFlow, [orderId, reason])` (from `workflow/api`) and returns the `runId`.
- `app/api/chat/route.ts` — `POST` calls `start(chatFlow, [messages])` and returns `run.readable` with the run ID in the `x-workflow-run-id` header.
- `app/api/chat/[id]/stream/route.ts` — `GET` re-attaches to a run via `getRun(id).getReadable({ startIndex })` (with `x-workflow-stream-tail-index` header) so a refresh resumes the stream.
- `components/agent-chat.tsx` — `useChat` uses `WorkflowChatTransport` (`@workflow/ai`): stores the run ID from `x-workflow-run-id` in `localStorage` on send, clears it on chat end, and reconnects to `/api/chat/{runId}/stream`. `resume` is on when a stored run ID exists.

**Local-dev note:** `vercel dev` runs the workflow engine locally (Queues + Runtime Cache on ports 4782–4785). The engine works, but model calls through the AI Gateway need valid auth — see the **AI Gateway auth gotcha** above; in production Vercel handles gateway auth natively. `pnpm-workspace.yaml` (project root, gitignored/local-only) is an env fix for build-script approval + Turbopack workspace-root resolution — not part of the chapter.

### Caching strategy

Classic App Router (Cache Components / `'use cache'` are intentionally **not** used).

- Read endpoints (`getProducts`, `getProductById`, `getCategories`, `getPromotion`, `getStoreConfig`) pass `next: { revalidate: 300, tags: [...] }` to `fetch`. Tags: `products`, `product:{id}`, `categories`, `promotion`, `store-config`.
- `getProductStock` uses `cache: 'no-store'` so the indicator reflects live inventory.
- All cart endpoints use `cache: 'no-store'`. Mutations call `revalidateTag('cart')`, primarily for navigation re-renders — same-page UI relies on the action's return value + `useOptimistic`.

### Routes (App Router)

- `/` (`app/page.tsx`) — **Static** (`○`). Synchronous parent component renders three siblings (`<PromoBanner />`, `<FeaturedProducts />`, `<CategoryShowcase />`) so async children fan out in parallel. Each handles its own data fetch.
- `/search` (`app/search/page.tsx`) — **Dynamic** (`ƒ`, by necessity — uses `searchParams`). Reads `q` and `category`, fetches categories + products in parallel via `Promise.all`, and renders results inline (no `Suspense`). Loading feedback is a spinner inside `<SearchForm />` driven by `useTransition`.
- `app/search/search-form.tsx` — Client. `next/form` `<Form>` for the no-JS fallback, debounced 300ms `router.replace` wrapped in `startTransition` once `q.length >= 3` (or back to empty), `<Select>` from shadcn for the category dropdown.
- `/products/[param]` (`app/products/[param]/page.tsx`) — **SSG** (`●`). The `param` accepts both product **id** and **slug** (the API resolves either). `generateStaticParams` enumerates products via `getProducts({ limit: 100 })`; `generateMetadata` builds title, description, and `openGraph`/`twitter` cards using `product.images`. The page renders product image, name, price, description server-side; the only client island is `<ProductPurchase />`.
- `app/products/[param]/product-purchase.tsx` — Client. Stock + qty selector + Add-to-Cart. Fetches stock on mount via `getProductStockAction`, polls every 30s. Initial render shows "Checking availability…" until the action resolves; this is the cost of keeping the product page statically renderable.
- `app/products/[param]/related-products.tsx` — Server, async. `getProducts({ category, limit: 8 })`, filters out the current product, slices to 4.

### Layout

`app/layout.tsx` is **synchronous** so it doesn't opt routes out of static rendering. It mounts `<Header />` (server) — which contains `<CartButton />` (client) — `<Footer />`, `<CartProvider>` (no initial cart prop; provider hydrates client-side), and `<CartSheet />`. `metadataBase`, `title.template`, and root `openGraph`/`twitter` defaults live here.

### Client / server split

Client components are kept minimal — only where state, effects, or browser APIs are required:
- `cart-provider.tsx`, `cart-button.tsx`, `cart-sheet.tsx` (cart state + UI)
- `app/products/[param]/product-purchase.tsx` (stock polling, qty, add-to-cart)
- `app/search/search-form.tsx` (input state + URL sync)

Everything else (`Header`, `Footer`, `ProductCard`, `ProductGrid`, `PromoBanner`, `CategoryShowcase`, `RelatedProducts`, every page) is a Server Component.

### Configuration quirks

- `next.config.mjs` keeps `typescript.ignoreBuildErrors: true` and `images.unoptimized: true`. `images.remotePatterns` is whitelisted for `**.public.blob.vercel-storage.com` and `**.vercel-storage.com` (where API product images live); add hostnames here if the API ever returns images from a new domain.
- `@vercel/analytics` only mounts when `NODE_ENV === 'production'` (see `app/layout.tsx`).
- The repo is linked to v0 (`https://v0.app/chat/projects/prj_X7UGePkFlLC33RuxWiTZySFDcSzO`); merges to `main` auto-deploy via Vercel. v0 may push commits directly. When deploying, set `VERCEL_PROTECTION_BYPASS_SECRET` in the Vercel project's environment variables.
- The root layout is intentionally synchronous so it doesn't opt routes out of static. `pnpm build` should report `/` as `○` (Static), `/products/[param]` as `●` (SSG), and `/search` as `ƒ` (Dynamic). If you ever convert the layout to `async function` and `await` something that uses `cookies()`/`headers()`/`searchParams`, you will silently switch every route back to dynamic — verify the build output after layout changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
