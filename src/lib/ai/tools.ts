import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { normalizeHandle } from "@/lib/cache/keys";
import type { CreatorAffiliate, ProductListItem, VideoItem } from "@/lib/tiktoday/types";
import { queryCreators, queryProducts, queryVideos } from "./ask-queries";
import type { CreatorDossier } from "./dossier";

// Bộ công cụ cho trợ lý "Hỏi AI". Tất cả chỉ đọc dữ liệu đã lưu: trợ lý không thể gọi TikToday hay tiêu hạn mức.

/** Nguồn dữ liệu của các công cụ. Tách ra để kiểm thử bằng dữ liệu giả. */
export interface AskData {
  creators(): Promise<CreatorAffiliate[]>;
  creatorDossier(handle: string): Promise<CreatorDossier | null>;
  products(): Promise<ProductListItem[]>;
  productDetails(id: string): Promise<unknown | null>;
  videos(): Promise<VideoItem[]>;
  searches(limit: number): Promise<{ kind: string; query: string; requested_count: number | null; created_at: string }[]>;
}

export type Proposal = { label: string; href: string; cost: number; reason: string };

export type ToolOutcome = { content: string; isError?: boolean; proposal?: Proposal };

const limit = z.number().int().min(1).max(30).optional();

const schemas = {
  search_creators: z.object({
    keyword: z.string().max(100).optional(),
    category: z.string().max(100).optional(),
    min_followers: z.number().int().min(0).optional(),
    min_units_sold: z.number().int().min(0).optional(),
    sort_by: z.enum(["follower_count", "units_sold", "gmv", "video_avg_views", "video_median_views"]).optional(),
    limit,
  }),
  get_creator: z.object({ handle: z.string().min(1).max(40) }),
  search_products: z.object({
    text: z.string().max(100).optional(),
    min_sold: z.number().int().min(0).optional(),
    max_price: z.number().min(0).optional(),
    min_rating: z.number().min(0).max(5).optional(),
    sort_by: z.enum(["sold_count", "sale_price", "rating"]).optional(),
    limit,
  }),
  get_product_details: z.object({ id: z.string().regex(/^\d{1,30}$/) }),
  search_videos: z.object({
    text: z.string().max(100).optional(),
    author: z.string().max(40).optional(),
    hashtag: z.string().max(60).optional(),
    only_ecommerce: z.boolean().optional(),
    sort_by: z.enum(["plays", "likes", "engagement_rate"]).optional(),
    limit,
  }),
  list_saved_searches: z.object({ limit: z.number().int().min(1).max(30).optional() }),
  suggest_fetch: z.object({
    action: z.enum(["creator_search", "product_search", "video_search", "creator_profile", "creator_affiliate", "creator_videos"]),
    target: z.string().min(1).max(100),
    reason: z.string().min(1).max(300),
  }),
};

type ToolName = keyof typeof schemas;

const common = { additionalProperties: false } as const;
const sortNote = "Giá trị thiếu (null) luôn xếp cuối.";

export const ASK_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_creators",
    description: `Tìm creator trong dữ liệu đã lưu (từ các lần tìm creator và hồ sơ affiliate). Trả về số liệu bán hàng rút gọn. ${sortNote}`,
    input_schema: {
      type: "object",
      ...common,
      properties: {
        keyword: { type: "string", description: "Chữ cần có trong tên, handle, MCN hoặc ngành hàng" },
        category: { type: "string", description: "Ngành hàng, ví dụ 'Beauty'" },
        min_followers: { type: "integer" },
        min_units_sold: { type: "integer" },
        sort_by: { type: "string", enum: ["follower_count", "units_sold", "gmv", "video_avg_views", "video_median_views"], description: "Mặc định units_sold" },
        limit: { type: "integer", description: "1 đến 30, mặc định 15" },
      },
    },
  },
  {
    name: "get_creator",
    description: "Lấy toàn bộ dữ liệu đã lưu về một creator: hồ sơ, số liệu bán hàng, video gần đây. Trả lỗi nếu chưa có dữ liệu nào.",
    input_schema: { type: "object", ...common, properties: { handle: { type: "string", description: "Handle TikTok, có hoặc không có @" } }, required: ["handle"] },
  },
  {
    name: "search_products",
    description: `Tìm sản phẩm trong dữ liệu đã lưu (từ các lần tìm sản phẩm). Giá tính bằng đồng. ${sortNote}`,
    input_schema: {
      type: "object",
      ...common,
      properties: {
        text: { type: "string" },
        min_sold: { type: "integer" },
        max_price: { type: "number", description: "Giá bán tối đa (đồng)" },
        min_rating: { type: "number" },
        sort_by: { type: "string", enum: ["sold_count", "sale_price", "rating"], description: "Mặc định sold_count. sale_price xếp rẻ nhất trước" },
        limit: { type: "integer" },
      },
    },
  },
  {
    name: "get_product_details",
    description: "Chi tiết một sản phẩm đã lưu: biến thể, kho, thông số, vận chuyển, shop, đánh giá. Trả lỗi nếu chưa tải chi tiết.",
    input_schema: { type: "object", ...common, properties: { id: { type: "string", description: "Id sản phẩm, chỉ gồm chữ số" } }, required: ["id"] },
  },
  {
    name: "search_videos",
    description: `Tìm video trong dữ liệu đã lưu (từ các lần tìm video và danh sách video của creator). ${sortNote}`,
    input_schema: {
      type: "object",
      ...common,
      properties: {
        text: { type: "string", description: "Chữ cần có trong mô tả" },
        author: { type: "string", description: "Handle tác giả" },
        hashtag: { type: "string" },
        only_ecommerce: { type: "boolean", description: "Chỉ video có gắn sản phẩm TikTok Shop (chỉ biết với video đã tải chi tiết)" },
        sort_by: { type: "string", enum: ["plays", "likes", "engagement_rate"], description: "Mặc định plays" },
        limit: { type: "integer" },
      },
    },
  },
  {
    name: "list_saved_searches",
    description: "Liệt kê các lần tìm kiếm gần đây (loại, từ khoá, số kết quả). Dùng để biết dữ liệu đã lưu bao phủ những gì.",
    input_schema: { type: "object", ...common, properties: { limit: { type: "integer" } } },
  },
  {
    name: "suggest_fetch",
    description:
      "Đề xuất người dùng lấy thêm dữ liệu mới từ TikToday khi dữ liệu đã lưu không đủ. Công cụ này KHÔNG lấy dữ liệu và không tốn hạn mức: nó chỉ hiện nút cho người dùng tự bấm, mỗi lần bấm tốn 1 lượt hạn mức. Chỉ dùng khi thật cần và nêu lý do.",
    input_schema: {
      type: "object",
      ...common,
      properties: {
        action: { type: "string", enum: ["creator_search", "product_search", "video_search", "creator_profile", "creator_affiliate", "creator_videos"] },
        target: { type: "string", description: "Từ khoá (cho tìm kiếm) hoặc handle (cho creator)" },
        reason: { type: "string", description: "Vì sao cần dữ liệu này, một câu" },
      },
      required: ["action", "target", "reason"],
    },
  },
];

const ok = (data: unknown): ToolOutcome => ({ content: JSON.stringify(data) });
const err = (message: string): ToolOutcome => ({ content: message, isError: true });

function proposalFor(a: z.infer<typeof schemas.suggest_fetch>): Proposal {
  const target = a.target.trim();
  const q = encodeURIComponent(target);
  switch (a.action) {
    case "creator_search":
      return { label: `Tìm creator "${target}"`, href: `/creators?q=${q}&count=20`, cost: 1, reason: a.reason };
    case "product_search":
      return { label: `Tìm sản phẩm "${target}"`, href: `/products?q=${q}&limit=20`, cost: 1, reason: a.reason };
    case "video_search":
      return { label: `Tìm video "${target}"`, href: `/videos?q=${q}&limit=20`, cost: 1, reason: a.reason };
    default: {
      const handle = normalizeHandle(target);
      const what = a.action === "creator_profile" ? "Mở hồ sơ" : a.action === "creator_affiliate" ? "Tải số liệu bán hàng của" : "Tải video của";
      return { label: `${what} @${handle}`, href: `/creators/${encodeURIComponent(handle)}`, cost: 1, reason: a.reason };
    }
  }
}

/** Chạy một công cụ. Đầu vào do model sinh ra nên luôn được kiểm tra lại bằng Zod trước khi dùng. */
export async function executeTool(name: string, input: unknown, data: AskData): Promise<ToolOutcome> {
  if (!(name in schemas)) return err(`Không có công cụ tên ${name}`);
  const tool = name as ToolName;
  const parsed = schemas[tool].safeParse(input ?? {});
  if (!parsed.success) return err(`Tham số không hợp lệ: ${parsed.error.issues[0]?.message ?? "sai định dạng"}`);

  try {
    switch (tool) {
      case "search_creators":
        return ok(queryCreators(await data.creators(), parsed.data as z.infer<typeof schemas.search_creators>));
      case "get_creator": {
        const handle = normalizeHandle((parsed.data as z.infer<typeof schemas.get_creator>).handle);
        const d = await data.creatorDossier(handle);
        return d ? ok(d) : err(`Chưa có dữ liệu đã lưu về @${handle}. Có thể dùng suggest_fetch để đề xuất lấy.`);
      }
      case "search_products":
        return ok(queryProducts(await data.products(), parsed.data as z.infer<typeof schemas.search_products>));
      case "get_product_details": {
        const d = await data.productDetails((parsed.data as z.infer<typeof schemas.get_product_details>).id);
        return d ? ok(d) : err("Chưa tải chi tiết sản phẩm này. Có thể dùng search_products để xem thông tin rút gọn.");
      }
      case "search_videos":
        return ok(queryVideos(await data.videos(), parsed.data as z.infer<typeof schemas.search_videos>));
      case "list_saved_searches":
        return ok(await data.searches((parsed.data as z.infer<typeof schemas.list_saved_searches>).limit ?? 15));
      case "suggest_fetch": {
        const p = proposalFor(parsed.data as z.infer<typeof schemas.suggest_fetch>);
        return {
          content: JSON.stringify({ status: "da_hien_nut_cho_nguoi_dung", ghi_chu: "Chưa lấy dữ liệu. Người dùng sẽ tự bấm, mỗi lần tốn 1 lượt hạn mức. Hãy nói rõ với người dùng bạn đề xuất gì và vì sao.", ...p }),
          proposal: p,
        };
      }
    }
  } catch (e) {
    console.error("[ai] công cụ lỗi", name, e instanceof Error ? e.message : e);
    return err("Không đọc được dữ liệu đã lưu.");
  }
}
