import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("[AI] GEMINI_API_KEY not set. AI features will be disabled.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (isRateLimitError(error) && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        console.log(`[AI] Rate limited, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      } else if (!isRateLimitError(error)) {
        throw error;
      }
    }
  }
  throw lastError;
}

interface BandExtractionResult {
  songId: string;
  title: string;
  inferredBand: string | null;
  confidence: string;
}

interface TagExtractionResult {
  songId: string;
  title: string;
  tags: string[];
}

export async function extractBandFromTitles(
  songs: Array<{ id: string; title: string }>
): Promise<BandExtractionResult[]> {
  if (songs.length === 0) return [];

  if (!process.env.GEMINI_API_KEY) {
    console.warn("[AI Extract Band] GEMINI_API_KEY not configured, skipping AI extraction");
    return songs.map((s) => ({
      songId: s.id,
      title: s.title,
      inferredBand: null,
      confidence: "disabled",
    }));
  }

  console.log(`[AI Extract Band] Processing ${songs.length} songs...`);

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const batchSize = 10;
  const results: BandExtractionResult[] = [];

  for (let i = 0; i < songs.length; i += batchSize) {
    const batch = songs.slice(i, i + batchSize);

    const batchResult = await withRetry(async () => {
      const songList = batch.map((s, idx) => `${idx + 1}. "${s.title}"`).join("\n");

      const prompt = `你是一個專門分析敬拜詩歌的助手。根據歌曲標題，推斷可能的樂團或專輯名稱。

常見的敬拜樂團包括：
- SEMM (聖馬田山教會)
- 基恩 (基恩敬拜)
- ACM (亞洲創作音樂)
- 建道新祢呈
- 讚美之泉
- 約書亞樂團
- 泥土音樂
- 同心圓
- 玻璃海
- 薪火敬拜使團
- 龔振江
- Immersio

如果無法從標題推斷，返回 null。

請分析以下歌曲標題，推斷每首歌可能的樂團/專輯名稱：

${songList}

必須以純 JSON 回應，格式如下（不要包含 markdown 或代碼塊）：
{"results": [{"index": 1, "band": "樂團名或null", "confidence": "high/medium/low"}]}`;

      const result = await model.generateContent(prompt);
      const content = result.response.text().trim();
      console.log("[AI] Raw response:", content);

      const jsonStr = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        console.error("[AI] Failed to parse response:", content);
        return batch.map((s) => ({
          songId: s.id,
          title: s.title,
          inferredBand: null,
          confidence: "error",
        }));
      }

      const items = parsed.results || parsed.result || parsed.data || parsed || [];
      const itemArray = Array.isArray(items) ? items : [];

      console.log("[AI] Extracted items count:", itemArray.length);

      return batch.map((song, idx) => {
        const match = itemArray.find((item: any) => item.index === idx + 1);
        return {
          songId: song.id,
          title: song.title,
          inferredBand: match?.band && match.band !== "null" ? match.band : null,
          confidence: match?.confidence || "unknown",
        };
      });
    });

    results.push(...batchResult);
    console.log(
      `[AI Extract Band] Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(songs.length / batchSize)}`
    );
  }

  return results;
}

export async function generateTagsForSongs(
  songs: Array<{ id: string; title: string; bandAlbum?: string | null }>
): Promise<TagExtractionResult[]> {
  if (songs.length === 0) return [];

  if (!process.env.GEMINI_API_KEY) {
    console.warn("[AI Generate Tags] GEMINI_API_KEY not configured, skipping AI tag generation");
    return songs.map((s) => ({
      songId: s.id,
      title: s.title,
      tags: [],
    }));
  }

  console.log(`[AI Generate Tags] Processing ${songs.length} songs...`);

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const results: TagExtractionResult[] = [];

  // Process songs one by one for speed and reliability
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    try {
      // Simple prompt using ONLY song title
      const prompt = `Extract 3-5 worship tags from this song title. Return ONLY JSON array.

Song: "${song.title}"

Example: ["敬拜", "讚美", "恩典"]

Tags:`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON array
      const jsonMatch = text.match(/\[[\s\S]*?\]/);
      let tags: string[] = [];
      if (jsonMatch) {
        tags = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(tags)) tags = [];
      }
      
      results.push({
        songId: song.id,
        title: song.title,
        tags: tags.slice(0, 5),
      });
      
      console.log(`[AI] Processed ${i+1}/${songs.length}: ${song.title} -> ${tags.length} tags`);
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.error(`[AI] Error for ${song.title}:`, error);
      results.push({
        songId: song.id,
        title: song.title,
        tags: [],
      });
    }
  }

  return results;
}
