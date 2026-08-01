import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

export const CHAT_MODEL = "gpt-4o-mini";
