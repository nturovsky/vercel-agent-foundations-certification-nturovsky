import { tool } from "ai";
import { z } from "zod";
import {
  ApiRequestError,
  getCategories,
  getProductById,
  getProducts,
  getProductStock,
} from "@/lib/api";
import { start } from "workflow/api";
import { returnFlow } from "./workflows/return-flow";

export const searchProducts = tool({
  description: `Search the Vercel swag store product catalog. Use this whenever the user asks about products, what the store sells, or wants recommendations. Optionally narrow results to a single category. This is a broad lookup that returns a list of matching products with summary fields — for the full details of one specific item, use getProductDetails instead.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional, free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
      ),
    category: z
      .string()
      .optional()
      .describe(
        `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`,
      ),
  }),
  execute: async ({ query, category }) => {
    "use step";
    try {
      const products = await getProducts({
        search: query,
        category,
        limit: 10,
      });
      return {
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          image: p.images[0],
          price: p.price,
          currency: p.currency,
          category: p.category,
          description: p.description,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, products: [], error: message };
    }
  },
});

export const getAllCategories = tool({
  description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
  inputSchema: z.object({}),
  execute: async () => {
    "use step";
    try {
      const categories = await getCategories();
      return {
        count: categories.length,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          productCount: c.productCount,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, categories: [], error: message };
    }
  },
});

export const getProductDetails = tool({
  description: `Fetch the full details of a single product by its ID or slug, including its full description, price, every product image, tags, and live stock/availability. Use this whenever the user asks about one specific item (e.g. "tell me more about the black hoodie", "is the sticker pack in stock?", "how much is X?") rather than browsing. For broad lookups across many products, use searchProducts instead — then call this tool with the id or slug of the item the user is interested in.`,
  inputSchema: z.object({
    idOrSlug: z
      .string()
      .describe(
        `The product's id or slug. If you only have a product name, use searchProducts first to resolve it to an id or slug.`,
      ),
  }),
  execute: async ({ idOrSlug }) => {
    "use step";
    try {
      const product = await getProductById(idOrSlug);

      // Stock lives on a separate, uncached endpoint. Fetch it too so the
      // agent can answer availability questions, but don't let a stock lookup
      // failure sink the whole call — degrade gracefully to null.
      let stock: {
        stock: number;
        inStock: boolean;
        lowStock: boolean;
      } | null = null;
      try {
        const stockInfo = await getProductStock(product.id);
        stock = {
          stock: stockInfo.stock,
          inStock: stockInfo.inStock,
          lowStock: stockInfo.lowStock,
        };
      } catch {
        stock = null;
      }

      return {
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          currency: product.currency,
          category: product.category,
          images: product.images,
          featured: product.featured,
          tags: product.tags,
        },
        stock,
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { product: null, stock: null, error: message };
    }
  },
});

export const returnOrder = tool({
  description: `File a return for one of the user's past orders. The user must provide an order ID and a reason. Example order IDs: 11111, 22222, 33333.`,
  inputSchema: z.object({
    orderId: z.string().describe("The order ID the user wants to return."),
    reason: z
      .string()
      .min(10)
      .max(500)
      .describe("Why the user is returning the order."),
  }),
  execute: async ({ orderId, reason }) => {
    "use step";
    const run = await start(returnFlow, [orderId, reason]);
    return {
      runId: run.runId,
      message: `Return request received for order ${orderId}.`,
    };
  },
});
