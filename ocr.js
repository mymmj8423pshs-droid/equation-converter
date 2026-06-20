/* ============================================================
   수식 변환기 — 사진 인식 서버 (Vercel 버전)
   ------------------------------------------------------------
   · 이 파일은 저장소의  api/ocr.js  경로에 둡니다.
   · Vercel 무료 함수는 기본적으로 미국(워싱턴, iad1)에서 실행되어
     Gemini 지역 차단('User location not supported')을 피합니다.
   · Vercel 프로젝트 Settings → Environment Variables 에 등록:
       Name : GEMINI_API_KEY
       Value: aistudio.google.com 에서 발급받은 키
   ============================================================ */

const MODEL = "gemini-2.5-flash"; // 안 되면 "gemini-2.0-flash" 로 교체

export default async function handler(req, res) {
  // CORS (사이트와 같은 도메인이면 사실 필요 없지만, 안전하게 둠)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST 요청만 허용됩니다" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const image = body.image;
    const mediaType = body.media_type || "image/png";
    const prompt = body.prompt || "Transcribe the math in the image into LaTeX. Output only raw LaTeX.";

    if (!image) return res.status(400).json({ error: "이미지 데이터가 없습니다" });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY 가 설정되지 않았습니다" });

    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent";
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mediaType, data: image } }
          ]
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 1024 }
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      const msg = (data && data.error && data.error.message) ? data.error.message : ("Gemini 오류 " + upstream.status);
      return res.status(upstream.status).json({ error: msg });
    }

    const cand = data.candidates && data.candidates[0];
    const parts = cand && cand.content && cand.content.parts ? cand.content.parts : [];
    const text = parts.map(p => p.text || "").join("");

    return res.status(200).json({ content: [{ type: "text", text }] });

  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
