import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("Chưa cấu hình khoá AI");
    this.name = "AiNotConfiguredError";
  }
}

let claude: Anthropic | null = null;
let gem: GoogleGenAI | null = null;

/** Client Anthropic dùng chung. Khoá lấy từ ANTHROPIC_API_KEY, không bao giờ gửi xuống trình duyệt. */
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new AiNotConfiguredError();
  claude ??= new Anthropic();
  return claude;
}

/** Client Gemini dùng chung. Khoá lấy từ GEMINI_API_KEY. */
export function gemini(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new AiNotConfiguredError();
  gem ??= new GoogleGenAI({ apiKey: key, apiVersion: "v1beta" }); // v1 chưa hỗ trợ function calling
  return gem;
}
