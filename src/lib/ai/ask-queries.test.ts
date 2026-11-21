import { describe, expect, it } from "vitest";
import type { CreatorAffiliate, ProductListItem, VideoItem } from "@/lib/tiktoday/types";
import { queryCreators, queryProducts, queryVideos } from "./ask-queries";

const creators: CreatorAffiliate[] = [
  { handle: "a", nickname: "Son Xinh", follower_count: 1000, units_sold: 500, categories: ["Beauty & Personal Care"] },
  { handle: "b", nickname: "Thời Trang", follower_count: 90000, units_sold: 50, categories: ["Womenswear"], agency: "MCN X" },
  { handle: "c", nickname: "Không Số", follower_count: 5000, categories: ["Beauty & Personal Care"] },
];

describe("queryCreators", () => {
  it("lọc theo ngành và xếp theo đơn đã bán, giá trị thiếu xếp cuối", () => {
    const r = queryCreators(creators, { category: "beauty" });
    expect(r.total_matching).toBe(2);
    expect(r.creators.map((c) => c.handle)).toEqual(["a", "c"]);
  });
  it("lọc theo số người theo dõi tối thiểu và từ khoá", () => {
    expect(queryCreators(creators, { min_followers: 2000 }).creators.map((c) => c.handle)).toEqual(["b", "c"]);
    expect(queryCreators(creators, { keyword: "mcn x" }).creators.map((c) => c.handle)).toEqual(["b"]);
  });
  it("giới hạn số dòng trong khoảng 1 đến 30", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ handle: `h${i}`, units_sold: i }));
    expect(queryCreators(many, { limit: 999 }).shown).toBe(30);
    expect(queryCreators(many, { limit: 0 }).shown).toBe(1);
  });
  it("trả tổng số đã lưu để AI biết phạm vi dữ liệu", () => {
    expect(queryCreators(creators, {}).total_saved).toBe(3);
  });
});

const products: ProductListItem[] = [
  { product_id: "1", title: "Serum A", price: { sale_price: 100000 }, sold_count: 10, rating: 4.9 },
  { product_id: "2", title: "Serum B", price: { sale_price: 50000 }, sold_count: 500, rating: 4.2 },
  { product_id: "3", title: "Áo thun", price: { sale_price: 70000 }, sold_count: 1000, rating: 4.8 },
];

describe("queryProducts", () => {
  it("lọc theo chữ trong tên và xếp theo đã bán", () => {
    expect(queryProducts(products, { text: "serum" }).products.map((p) => p.id)).toEqual(["2", "1"]);
  });
  it("lọc theo giá tối đa và điểm tối thiểu", () => {
    expect(queryProducts(products, { max_price: 60000 }).products.map((p) => p.id)).toEqual(["2"]);
    expect(queryProducts(products, { min_rating: 4.8, sort_by: "rating" }).products.map((p) => p.id)).toEqual(["1", "3"]);
  });
  it("xếp theo giá thì rẻ nhất trước", () => {
    expect(queryProducts(products, { sort_by: "sale_price" }).products.map((p) => p.id)).toEqual(["2", "3", "1"]);
  });
});

const videos: VideoItem[] = [
  { id: "v1", description: "Review son #son", hashtags: ["son"], author: { handle: "a" }, stats: { play_count: 1000, like_count: 100, comment_count: 0, share_count: 0 }, is_ecommerce: true },
  { id: "v2", description: "Áo thun", hashtags: ["ao"], author: { handle: "b" }, stats: { play_count: 5000, like_count: 50 } },
  { id: "v3", description: "Không lượt xem", author: { handle: "a" } },
];

describe("queryVideos", () => {
  it("lọc theo tác giả (bỏ @), hashtag (bỏ #) và video có gắn sản phẩm", () => {
    expect(queryVideos(videos, { author: "@a" }).total_matching).toBe(2);
    expect(queryVideos(videos, { hashtag: "#son" }).videos.map((v) => v.id)).toEqual(["v1"]);
    expect(queryVideos(videos, { only_ecommerce: true }).videos.map((v) => v.id)).toEqual(["v1"]);
  });
  it("xếp theo lượt xem hoặc tỷ lệ tương tác, video thiếu số xếp cuối", () => {
    expect(queryVideos(videos, {}).videos.map((v) => v.id)).toEqual(["v2", "v1", "v3"]);
    const r = queryVideos(videos, { sort_by: "engagement_rate" });
    expect(r.videos.map((v) => v.id)).toEqual(["v1", "v2", "v3"]);
    expect(r.videos[0].engagement_rate).toBe(0.1);
    expect(r.videos[2].engagement_rate).toBeUndefined();
  });
});
