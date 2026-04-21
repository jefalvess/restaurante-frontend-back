const { AppError } = require("../../common/AppError");

const DEFAULT_AUDIO_TIMEOUT_MS = Number(
  process.env.VOICE_PARSE_AI_TIMEOUT_MS || 45000,
);
const DEFAULT_TEXT_TIMEOUT_MS = Number(
  process.env.TEXT_PROMPT_AI_TIMEOUT_MS || 30000,
);
const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta";

  // O modelo principal (mais moderno e estável na sua lista)
const GEMINI_MODEL = "gemini-2.5-flash";

// A lista de fallback com nomes confirmados pelo seu endpoint
const GEMINI_MODELS_FALLBACK = (
  // --- Família 2.5 (A mais equilibrada para 2026) ---
  "gemini-2.5-flash," + 
  "gemini-2.5-flash-lite," +
  "gemini-2.5-pro," +

  // --- Família 3.1 (As versões Preview mais potentes) ---
  "gemini-3.1-flash-lite-preview," +
  "gemini-3.1-pro-preview," +

  // --- Família 2.0 (Versões estáveis de confiança) ---
  "gemini-2.0-flash," +
  "gemini-2.0-flash-001," +
  "gemini-2.0-flash-lite," +

  // --- Versões "Latest" (Apontam sempre para a última estável) ---
  "gemini-flash-latest," +
  "gemini-pro-latest," +
  "gemini-flash-lite-latest," +

  // --- Modelos Gemma 4 (Fallback se a infraestrutura Gemini falhar) ---
  "gemma-4-31b-it," +
  "gemma-4-26b-a4b-it," +
  
  // --- Modelos Gemma 3 (Mais leves e rápidos) ---
  "gemma-3-27b-it," +
  "gemma-3-12b-it"
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

function buildAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function parseJsonContent(raw) {
  if (!raw) return {};

  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(clean);
}

function buildOrderExtractionPrompt() {
  return [
    "Voce extrai dados de pedidos de restaurante.",
    "Responda SOMENTE JSON valido.",
    "Nunca invente itens.",
    "Formato esperado:",
    "{",
    '  "type": "delivery|retirada|balcao|mesa",',
    '  "customerName": "string opcional",',
    '  "customerPhone": "string opcional",',
    '  "customerAddress": "string opcional",',
    '  "items": [{ "productName": "string", "quantity": number, "notes": "string opcional" }],',
    '  "transcript": "texto transcrito opcional"',
    "}",
  ].join("\n");
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const { signal, clear } = buildAbortSignal(timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal,
    });

    return response;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AppError("Tempo limite ao chamar provedor de IA", 504);
    }
    throw error;
  } finally {
    clear();
  }
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((part) => part?.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new AppError("Resposta invalida do provedor de IA", 502);
  }

  return text;
}

function buildGeminiBodies({ prompt, mimeType, base64Audio }) {
  const contentSnakeCase = {
    role: "user",
    parts: [
      { text: prompt },
      {
        inline_data: {
          mime_type: mimeType,
          data: base64Audio,
        },
      },
    ],
  };

  const contentCamelCase = {
    role: "user",
    parts: [
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64Audio,
        },
      },
    ],
  };

  return [
    {
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
      contents: [contentSnakeCase],
    },
    {
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
      contents: [contentCamelCase],
    },
    {
      generationConfig: {
        temperature: 0,
      },
      contents: [contentCamelCase],
    },
    {
      generationConfig: {
        temperature: 0,
      },
      contents: [contentSnakeCase],
    },
  ];
}

function buildGeminiModelCandidates() {
  const seen = new Set();
  const ordered = [GEMINI_MODEL, ...GEMINI_MODELS_FALLBACK];

  return ordered.filter((model) => {
    if (!model || seen.has(model)) return false;
    seen.add(model);
    return true;
  });
}

async function requestGeminiGenerateContent({ apiKey, body, model, timeoutMs }) {
  let response;

  try {
    response = await fetchWithTimeout(
      `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 504) {
      return {
        ok: false,
        status: 504,
        model,
        errorText: error.message,
        timeout: true,
      };
    }

    throw error;
  }

  if (response.ok) {
    return { ok: true, payload: await response.json() };
  }

  const errorText = await response.text();
  return {
    ok: false,
    status: response.status,
    model,
    errorText,
  };
}

async function parseVoiceOrderAudioWithGemini({
  apiKey,
  audioBuffer,
  mimeType,
}) {
  const prompt = [
    buildOrderExtractionPrompt(),
    "Use o audio enviado para transcrever e preencher os campos.",
    "Se um campo nao for informado, omita.",
    "Se um produto aparecer mais de uma vez com observacoes diferentes, mantenha itens separados.",
  ].join("\n\n");

  const base64Audio = audioBuffer.toString("base64");
  const bodies = buildGeminiBodies({ prompt, mimeType, base64Audio });
  const modelCandidates = buildGeminiModelCandidates();
  let lastError = null;

  for (const model of modelCandidates) {
    for (const body of bodies) {
      const result = await requestGeminiGenerateContent({
        apiKey,
        body,
        model,
        timeoutMs: DEFAULT_AUDIO_TIMEOUT_MS,
      });
      if (result.ok) {
        const content = extractGeminiText(result.payload);
        return parseJsonContent(content);
      }

      lastError = result;
    }
  }

  const safeErrorText = String(lastError?.errorText || "").slice(0, 500);
  // eslint-disable-next-line no-console
  console.error("Gemini generateContent falhou", {
    status: lastError?.status,
    model: lastError?.model || GEMINI_MODEL,
    modelsTried: modelCandidates,
    response: safeErrorText,
  });

  if (lastError?.status === 504) {
    throw new AppError("Tempo limite do provedor de IA ao processar audio", 504);
  }

  throw new AppError("Falha ao interpretar pedido por voz", 502);
}

async function parseVoiceOrderAudio({ audioBuffer, mimeType }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError("Servico de processamento de audio indisponivel", 503);
  }

  return parseVoiceOrderAudioWithGemini({
    apiKey,
    audioBuffer,
    mimeType,
  });
}

async function requestGeminiTextPrompt({ prompt }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError("Servico de IA indisponivel", 503);
  }

  const modelCandidates = buildGeminiModelCandidates();
  const body = {
    generationConfig: { temperature: 0.4 },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };

  let lastError = null;

  for (const model of modelCandidates) {
    const result = await requestGeminiGenerateContent({
      apiKey,
      body,
      model,
      timeoutMs: DEFAULT_TEXT_TIMEOUT_MS,
    });
    if (result.ok) {
      return extractGeminiText(result.payload);
    }
    lastError = result;
  }

  const safeErrorText = String(lastError?.errorText || "").slice(0, 500);
  // eslint-disable-next-line no-console
  console.error("Gemini generateContent falhou (text prompt)", {
    status: lastError?.status,
    model: lastError?.model || GEMINI_MODEL,
    response: safeErrorText,
  });

  if (lastError?.status === 504) {
    throw new AppError("Tempo limite do provedor de IA", 504);
  }

  throw new AppError("Falha ao obter resposta da IA", 502);
}

module.exports = {
  parseVoiceOrderAudio,
  requestGeminiTextPrompt,
};
