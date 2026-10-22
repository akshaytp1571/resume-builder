// AI Integration Service supporting OpenAI-compatible providers
// Providers: Vyce AI, Groq, OpenAI, OpenRouter, DeepSeek, Mistral, Ollama/Local, Custom

export const AI_PROVIDERS = [
  {
    id: 'vyceai',
    name: 'Vyce AI (DeepSeek, Claude, GPT)',
    baseUrl: 'https://vyceai.com/v1',
    needsApiKey: true,
    hint: 'Vyce AI OpenAI-compatible endpoint. Point at vyceai.com/v1 (supports deepseek-v4.1, deepseek-v4-flash, claude-sonnet-4-6, auto)',
  },
  {
    id: 'groq',
    name: 'Groq (Ultra-Fast & Free Tier)',
    baseUrl: 'https://api.groq.com/openai/v1',
    needsApiKey: true,
    hint: 'Get free instant API key at console.groq.com',
  },
  {
    id: 'openai',
    name: 'OpenAI (Official)',
    baseUrl: 'https://api.openai.com/v1',
    needsApiKey: true,
    hint: 'Get API key at platform.openai.com',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (All Models: Claude, GPT, DeepSeek)',
    baseUrl: 'https://openrouter.ai/api/v1',
    needsApiKey: true,
    hint: 'Get API key at openrouter.ai/keys',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek (Official)',
    baseUrl: 'https://api.deepseek.com/v1',
    needsApiKey: true,
    hint: 'Official platform.deepseek.com API endpoint',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    needsApiKey: true,
    hint: 'Get API key at console.mistral.ai',
  },
  {
    id: 'ollama',
    name: 'Ollama / Local LLM (100% Free & Offline)',
    baseUrl: 'http://localhost:11434/v1',
    needsApiKey: false,
    hint: 'Run ollama serve locally (no internet or API key required)',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-Compatible Endpoint',
    baseUrl: 'https://vyceai.com/v1',
    needsApiKey: true,
    hint: 'Works with any OpenAI-compatible API base URL',
  },
];

export function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim().replace(/\/+$/, '');
  // If the user entered a domain without /v1 (e.g. https://vyceai.com or https://api.openai.com)
  if (/^https?:\/\/[^/]+$/i.test(clean)) {
    clean = `${clean}/v1`;
  }
  return clean;
}

export const DEFAULT_AI_CONFIG = {
  providerId: 'vyceai',
  baseUrl: 'https://vyceai.com/v1',
  // Never commit a real key. Set it in the app: AI Settings, or via the
  // VITE_AI_API_KEY environment variable.
  apiKey: import.meta.env?.VITE_AI_API_KEY || '',
  model: 'deepseek-v4.1',
  temperature: 0.7,
};

export function getSavedAiConfig() {
  try {
    const saved = localStorage.getItem('nexus_ai_config_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      const baseUrl = normalizeBaseUrl(parsed.baseUrl) || DEFAULT_AI_CONFIG.baseUrl;
      const apiKey = cleanApiKey(parsed.apiKey || DEFAULT_AI_CONFIG.apiKey);
      const providerId = parsed.providerId || DEFAULT_AI_CONFIG.providerId;
      const model = (parsed.model || DEFAULT_AI_CONFIG.model || '').trim();

      return {
        ...DEFAULT_AI_CONFIG,
        ...parsed,
        baseUrl,
        apiKey,
        providerId,
        model,
      };
    }
  } catch (e) {
    console.error('Error reading AI config:', e);
  }
  return DEFAULT_AI_CONFIG;
}

export function saveAiConfig(config) {
  try {
    const sanitized = {
      ...config,
      baseUrl: normalizeBaseUrl(config.baseUrl),
      apiKey: cleanApiKey(config.apiKey),
      model: config.model?.trim() || '',
    };
    localStorage.setItem('nexus_ai_config_v1', JSON.stringify(sanitized));
  } catch (e) {
    console.error('Error saving AI config:', e);
  }
}

/**
 * Discover models dynamically from any OpenAI-compatible endpoint.
 * Standard endpoint: GET ${baseUrl}/models
 */
export async function discoverAiModels({ baseUrl, apiKey }) {
  if (!baseUrl?.trim()) {
    throw new Error('Base URL is required to discover models.');
  }

  const cleanBaseUrl = normalizeBaseUrl(baseUrl);
  const endpoint = `${cleanBaseUrl}/models`;

  const headers = {
    Accept: 'application/json',
  };

  if (apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  if (cleanBaseUrl.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'Precision Resume Studio';
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch (e) {}
    throw new Error(errorDetail);
  }

  const resData = await response.json();

  let rawList = [];
  if (Array.isArray(resData)) {
    rawList = resData;
  } else if (Array.isArray(resData?.data)) {
    rawList = resData.data;
  } else if (Array.isArray(resData?.models)) {
    rawList = resData.models;
  }

  const modelIds = rawList
    .map((item) => {
      if (typeof item === 'string') return item;
      return item?.id || item?.name || item?.model;
    })
    .filter((id) => Boolean(id && typeof id === 'string'))
    .filter((id, index, self) => self.indexOf(id) === index);

  modelIds.sort((a, b) => a.localeCompare(b));

  if (modelIds.length === 0) {
    throw new Error('Endpoint responded successfully, but returned an empty list of models.');
  }

  return modelIds;
}

export function cleanApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  return key
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F\u202A-\u202E\r\n\t]/g, '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/[:;,]+$/, '')
    .trim();
}

/**
 * Single source of truth for "can we actually call the AI right now?".
 *
 * A provider only needs a key when its own metadata says so, so a local
 * Ollama endpoint or a keyless proxy counts as ready without one.
 */
export function isAiConfigReady(config = null) {
  const cfg = config || getSavedAiConfig();
  if (!cfg) return false;
  const provider = AI_PROVIDERS.find((p) => p.id === cfg.providerId);
  const needsKey = provider ? provider.needsApiKey : true;
  const hasKey = Boolean(cleanApiKey(cfg.apiKey));
  const hasModel = Boolean(String(cfg.model || '').trim());
  const hasUrl = Boolean(String(cfg.baseUrl || '').trim());
  return hasUrl && hasModel && (!needsKey || hasKey);
}

// Call any OpenAI-compatible endpoint
export async function callAiChat({ systemPrompt, userPrompt, config = null }) {
  const activeConfig = config || getSavedAiConfig();

  if (!activeConfig.baseUrl) {
    throw new Error('Base URL is missing in AI Configuration.');
  }

  const provider = AI_PROVIDERS.find((p) => p.id === activeConfig.providerId);
  const needsKey = provider ? provider.needsApiKey : true;
  const sanitizedKey = cleanApiKey(activeConfig.apiKey);

  if (needsKey && !sanitizedKey) {
    throw new Error(
      `API Key is required for ${provider?.name || 'this provider'}. Please configure it in AI Settings.`
    );
  }

  if (!activeConfig.model?.trim()) {
    throw new Error(
      'Model identifier is not set. Please enter a model name or click [DISCOVER_MODELS] in AI Settings.'
    );
  }

  const cleanBaseUrl = activeConfig.baseUrl.replace(/\/+$/, '');
  const endpoint = `${cleanBaseUrl}/chat/completions`;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (sanitizedKey) {
    headers['Authorization'] = `Bearer ${sanitizedKey}`;
  }

  // OpenRouter specific headers if used
  if (cleanBaseUrl.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    headers['X-Title'] = 'Nexus Resume Studio';
  }

  const payload = {
    model: activeConfig.model.trim(),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: activeConfig.temperature ?? 0.7,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error && errorJson.error.message) {
          errorMsg = errorJson.error.message;
        }
      } catch (e) {}

      // Helpful translation for common provider errors
      if (errorMsg.toLowerCase().includes('user not found')) {
        errorMsg = 'INVALID OPENROUTER KEY: OpenRouter returned "User not found". This API key is invalid, revoked, or has expired. Please create a fresh key at https://openrouter.ai/keys';
      }

      throw new Error(errorMsg);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No completion returned by AI provider.');
    }

    return content.trim();
  } catch (err) {
    console.error('AI API Call Error:', err);
    throw err;
  }
}

// Quick Test Connection
export async function testAiConnection(config) {
  if (!config?.model?.trim()) {
    throw new Error('Model is not set. Please enter a model name or click [DISCOVER_MODELS] first.');
  }

  const cleanBaseUrl = config.baseUrl?.replace(/\/+$/, '') || '';
  const sanitizedKey = cleanApiKey(config.apiKey);

  // If using OpenRouter, verify the key against OpenRouter auth/key endpoint first
  if (cleanBaseUrl.includes('openrouter.ai') && sanitizedKey) {
    try {
      const authCheckRes = await fetch(`${cleanBaseUrl}/auth/key`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sanitizedKey}`,
        },
      });

      if (!authCheckRes.ok) {
        let authErrMsg = `HTTP ${authCheckRes.status}: ${authCheckRes.statusText}`;
        try {
          const authErrJson = await authCheckRes.json();
          if (authErrJson.error?.message) {
            authErrMsg = authErrJson.error.message;
          }
        } catch (e) {}

        if (authErrMsg.toLowerCase().includes('user not found')) {
          throw new Error(
            'OpenRouter returned "User not found" (HTTP 401). This API key is expired, revoked, or deleted in your OpenRouter account. Please generate an active key at https://openrouter.ai/keys'
          );
        }
        throw new Error(`OpenRouter Key Authentication error: ${authErrMsg}`);
      }
    } catch (e) {
      // A genuine auth failure must surface. A network/CORS hiccup must not
      // masquerade as success, so only swallow non-auth errors and let the
      // real chat call decide.
      if (e.message && (e.message.includes('OpenRouter') || e.message.includes('User not found'))) {
        throw e;
      }
      console.warn('OpenRouter key pre-check skipped:', e.message);
    }
  }

  return await callAiChat({
    systemPrompt: 'You are a test ping responder. Reply ONLY with: PING_OK',
    userPrompt: 'Ping test',
    config,
  });
}

// 1. Refine Professional Summary
export async function refineSummaryWithAi({
  summary,
  targetRole = 'QA Lead',
  tone = 'Executive & Metric-Driven',
  extraInstructions = '',
  config = null,
}) {
  const systemPrompt = `You are an elite executive resume consultant and ATS optimization engineer.
Your task is to refine, strengthen, and polish the candidate's professional resume summary.
Guidelines:
1. Maintain factual accuracy based on provided experience (do not fabricate false degrees or fake companies).
2. Use strong leadership action verbs and articulate quantifiable impact.
3. Target word count: 45 to 80 words (optimal for recruiter scannability and ATS systems).
4. Tone: ${tone}.
5. Target Role: ${targetRole}.
6. Output ONLY the refined summary text with NO introductory or concluding pleasantries, NO markdown formatting quotes, just raw plain text.`;

  const userPrompt = `Current Summary:
"${summary}"

${extraInstructions ? `Additional Instructions: ${extraInstructions}` : ''}

Provide the refined summary:`;

  return await callAiChat({ systemPrompt, userPrompt, config });
}

// 2. Refine Bullet Point with Google XYZ Formula
export async function refineBulletWithAi({
  bullet,
  roleContext = 'QA Lead',
  extraInstructions = '',
  config = null,
}) {
  const systemPrompt = `You are a world-class tech recruiter and resume writer who specializes in the Google XYZ Formula: "Accomplished [X] as measured by [Y], by doing [Z]".
Your task is to rewrite a resume bullet point to make it significantly more impactful, active, and persuasive.
Guidelines:
1. Begin with a powerful past-tense action verb (e.g. Spearheaded, Engineered, Orchestrated, Automated, Reduced, Accelerated).
2. Incorporate realistic metrics, percentages, scale, or quality benchmarks where appropriate.
3. Keep it to 1-2 concise, punchy sentences.
4. Output ONLY the revised bullet point text with NO quotes, NO bullet markers (* or -), and NO conversational preamble.`;

  const userPrompt = `Role Context: ${roleContext}
Original Bullet:
"${bullet}"

${extraInstructions ? `Instructions: ${extraInstructions}` : ''}

Refined Bullet:`;

  return await callAiChat({ systemPrompt, userPrompt, config });
}

export function extractJson(text) {
  if (!text || typeof text !== 'string') throw new Error('Empty response from AI');

  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch (e) {}

  // Strip markdown code fences
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {}

  // Find first { or [ and last } or ]
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const candidate = cleaned.substring(startIdx, endIdx + 1);
    return JSON.parse(candidate);
  }

  throw new Error('AI returned non-JSON response: ' + text.slice(0, 150));
}

// 3. Enhance Full Role (Multiple Bullets)
export async function enhanceRoleWithAi({
  role,
  company,
  product,
  highlights = [],
  config = null,
}) {
  const systemPrompt = `You are a high-tier executive resume editor.
Improve and sharpen the following work experience entry to maximize recruiter appeal and ATS scores.
Keep the same factual scope (QA Lead for Order-to-Cash automation, API testing, JMeter, Selenium, L2 support).
Format your output as valid JSON with keys:
{
  "product": "refined product description (1 sentence)",
  "highlights": ["refined bullet 1", "refined bullet 2", ...]
}
Return ONLY valid JSON. No markdown code blocks, no backticks, no other text.`;

  const userPrompt = `Role: ${role} | ${company}
Product: ${product}
Highlights:
${highlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}`;

  const rawJson = await callAiChat({ systemPrompt, userPrompt, config });
  return extractJson(rawJson);
}

// 4. Suggest In-Demand Skills
export async function suggestSkillsWithAi({
  currentSkills = [],
  targetRole = 'QA Lead',
  config = null,
}) {
  const systemPrompt = `You are a senior tech recruiter identifying top modern tech stack gaps for a ${targetRole}.
Review the candidate's existing categorized skills and recommend 6-10 modern, complementary high-demand tools, frameworks, and methodologies.
Format output as valid JSON array:
[
  { "category": "Testing / Automation / Cloud / API", "item": "Tool or Skill Name", "reason": "Why it boosts ATS rating" }
]
Return ONLY the raw JSON array.`;

  const skillsSummary = currentSkills.map((s) => `${s.category}: ${s.items}`).join('\n');
  const userPrompt = `Current Skills:\n${skillsSummary}`;

  const rawJson = await callAiChat({ systemPrompt, userPrompt, config });
  return extractJson(rawJson);
}

// 5. Job Description Match & Resume Tailoring
export async function tailorResumeToJobWithAi({
  resumeData,
  jobDescription,
  config = null,
}) {
  const systemPrompt = `You are an enterprise ATS parser and executive job placement coach.
Analyze the candidate's resume against the provided Job Description (JD).
Provide:
1. Match Score (0 to 100).
2. Top matching strengths.
3. Critical missing keywords/technologies found in JD.
4. Suggested tailored Professional Summary specifically crafted for this job.
5. Actionable tips to maximize interview chances.

Format output as valid JSON:
{
  "matchScore": 88,
  "summaryTailored": "...",
  "matchingStrengths": ["...", "..."],
  "missingKeywords": ["...", "..."],
  "recommendations": ["...", "..."]
}
Return ONLY valid JSON.`;

  const userPrompt = `RESUME SUMMARY:
${resumeData.summary}

RESUME SKILLS:
${resumeData.skills?.map((s) => `${s.category}: ${s.items}`).join('\n')}

RESUME EXPERIENCE HIGHLIGHTS:
${resumeData.experience?.map((e) => `${e.role} at ${e.company}:\n` + e.highlights.join('\n')).join('\n\n')}

TARGET JOB DESCRIPTION:
${jobDescription}`;

  const rawJson = await callAiChat({ systemPrompt, userPrompt, config });
  return extractJson(rawJson);
}
