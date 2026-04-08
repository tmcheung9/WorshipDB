const { PredictionServiceClient } = require('@google-cloud/aiplatform').v1;
const pLimit = require('p-limit');

// Initialize Vertex AI Prediction client
const client = new PredictionServiceClient({
  apiEndpoint: 'us-central1-aiplatform.googleapis.com',
  project: process.env.GOOGLE_CLOUD_PROJECT || 'crack-walker-269506',
  location: 'us-central1',
});

const modelPath = client.modelPath(
  process.env.GOOGLE_CLOUD_PROJECT || 'crack-walker-269506',
  'us-central1',
  'gemini-1.5-flash-001'
);

// Rate limiter: 2 concurrent requests
const limit = pLimit(2);

async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const request = {
    endpoint: modelPath,
    instances: [
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      }
    ],
    parameters: {
      temperature: 0.2,
      maxOutputTokens: 2000,
    }
  };

  // Add system instruction if provided
  if (systemInstruction) {
    request.instances[0].system_instruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  try {
    const [response] = await client.predict(request);
    const textResponse = response.predictions?.[0]?.toString() || '{}';
    
    // Try to ensure valid JSON
    try {
      JSON.parse(textResponse);
      return textResponse;
    } catch {
      // If not valid JSON, try to extract JSON from text
      const jsonMatch = textResponse.match(/\{.*\}/s);
      if (jsonMatch) {
        return jsonMatch[0];
      }
      return '{"results": []}';
    }
  } catch (error: any) {
    console.error('[AI] API Error:', error.message);
    throw error;
  }
}

// Helper function to check if error is rate limit
function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit") ||
    errorMsg.includes("Resource exhausted")
  );
}

// Simple retry with exponential backoff
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
        await new Promise(r => setTimeout(r, delay));
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

  console.log(`[AI Extract Band] Processing ${songs.length} songs...`);

  const batchSize = 10;
  const results: BandExtractionResult[] = [];

  for (let i = 0; i < songs.length; i += batchSize) {
    const batch = songs.slice(i, i + batchSize);
    
    const batchResult = await limit(() => withRetry(async () => {
      const songList = batch.map((s, idx) => `${idx + 1}. "${s.title}"`).join("\n");
      
      const systemInstruction = `你是一個專門分析敬拜詩歌的助手。根據歌曲標題，推斷可能的樂團或專輯名稱。

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
回應格式必須是 JSON 物件。`;

      const userPrompt = `請分析以下歌曲標題，推斷每首歌可能的樂團/專輯名稱：

${songList}

回應格式：
{"results": [{"index": 1, "band": "樂團名" 或 null, "confidence": "high/medium/low"}]}`;

      const content = await callGemini(userPrompt, systemInstruction);
      console.log("[AI] Raw response:", content);
      
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        console.error("[AI] Failed to parse response:", content);
        return batch.map(s => ({
          songId: s.id,
          title: s.title,
          inferredBand: null,
          confidence: "error"
        }));
      }

      const items = parsed.results || parsed.result || parsed.data || parsed.songs || parsed.analysis || [];
      const itemArray = Array.isArray(items) ? items : [];

      return batch.map((song, idx) => {
        const match = itemArray.find((item: any) => item.index === idx + 1);
        return {
          songId: song.id,
          title: song.title,
          inferredBand: match?.band || null,
          confidence: match?.confidence || "unknown"
        };
      });
    }));

    results.push(...batchResult);
    console.log(`[AI Extract Band] Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(songs.length / batchSize)}`);
  }

  return results;
}

export async function generateTagsForSongs(
  songs: Array<{ id: string; title: string; bandAlbum?: string | null }>
): Promise<TagExtractionResult[]> {
  if (songs.length === 0) return [];

  console.log(`[AI Generate Tags] Processing ${songs.length} songs...`);

  const batchSize = 10;
  const results: TagExtractionResult[] = [];

  for (let i = 0; i < songs.length; i += batchSize) {
    const batch = songs.slice(i, i + batchSize);
    
    const batchResult = await limit(() => withRetry(async () => {
      const songList = batch.map((s, idx) => {
        const bandInfo = s.bandAlbum ? ` (${s.bandAlbum})` : "";
        return `${idx + 1}. "${s.title}"${bandInfo}`;
      }).join("\n");

      const systemInstruction = `你是一個專門分析敬拜詩歌的助手。根據歌曲標題和樂團，為每首歌生成最多3個分類標籤。

【重要】只使用以下類別的標籤，不要創造新標籤：

情感/氛圍類：敬畏、安靜、激昂、感恩、喜樂、平安、盼望、安慰、渴慕、親密
主題類：敬拜、讚美、禱告、認罪、奉獻、福音、十架、救恩、恩典、信心、愛、聖靈、醫治、更新、復興、委身、跟隨
功能/場合類：開場、回應、結束、聖餐、洗禮、差遣、宣告、默想
節期類：聖誕、復活節、受難節

每首歌選擇1-3個最相關的標籤。
回應格式必須是 JSON 物件。`;

      const userPrompt = `請為以下歌曲生成標籤（每首最多3個）：

${songList}

回應格式：
{"results": [{"index": 1, "tags": ["標籤1", "標籤2"]}]}`;

      const content = await callGemini(userPrompt, systemInstruction);
      
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        console.error("[AI] Failed to parse response:", content);
        return batch.map(s => ({
          songId: s.id,
          title: s.title,
          tags: []
        }));
      }

      const items = parsed.results || parsed.result || parsed.data || parsed || [];
      const itemArray = Array.isArray(items) ? items : [];

      return batch.map((song, idx) => {
        const match = itemArray.find((item: any) => item.index === idx + 1);
        const tags = match?.tags || [];
        return {
          songId: song.id,
          title: song.title,
          tags: Array.isArray(tags) ? tags.slice(0, 3) : []
        };
      });
    }));

    results.push(...batchResult);
    console.log(`[AI Generate Tags] Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(songs.length / batchSize)}`);
  }

  return results;
}
