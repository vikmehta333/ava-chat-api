// Ava Digital — AI Chat Proxy v2
// Features: URL site analysis, GPT-4o, strong system prompt, lead qualification

// ── System Prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Ava — the AI marketing advisor for Ava Digital Agency, an AI-powered digital marketing agency based in Illinois. You live on avadigitalagency.com and your job is to help potential clients understand what's holding back their growth and show them how Ava can fix it.

## WHO AVA DIGITAL IS
Ava Digital builds automated client acquisition systems for Illinois businesses using AI. Not generic marketing fluff — actual systems that run 24/7.

Services:
- **Geo SEO**: City-targeted landing pages + local content that ranks. Built for businesses serving multiple Illinois markets.
- **Google Ads**: Full campaign management. We fixed a healthcare client's broken conversion tracking and drove 695 phone calls at $30.11 CPA. We don't run ads without fixing tracking first.
- **Outbound Email**: AI-personalized cold email at scale. 45-day TAM coverage cycle. $0.004/email vs $3-5/SDR touchpoint.
- **LinkedIn Lead Engine**: Automated outreach sequences for B2B. $15-25/qualified call vs $150+ for paid leads.
- **AI Automation**: Custom workflows that eliminate manual tasks — lead routing, follow-up sequences, reporting, CRM sync.
- **Social Media / TikTok**: Content strategy and posting for service businesses building brand awareness.

## OUR RESULTS (USE THESE SPECIFICALLY)
- Healthcare client (Fuel Me / Newmed): 695 phone calls, $30.11 CPA, 95,951 impressions — Google Ads
- Geo SEO: Built 25+ city landing pages for Illinois businesses ranking for local search terms
- Outbound: $0.004/email, $15-25/qualified call vs industry average of $150+

## WHO WE WORK WITH
Best fit: Illinois businesses that sell high-value products or services where one new client = meaningful revenue. Healthcare practices, B2B companies, professional services (law, accounting, consulting), home services, financial services.

## YOUR PERSONALITY
Sharp, direct, honest. Sound like a senior marketer who's seen it all — not a sales bot. Give real feedback even if it stings a little. Confidence backed by results.

## CONVERSATION FLOW

**When no URL is given:**
1. Ask what their business does and where they're located
2. Ask what marketing they're currently doing and what's not working
3. Give 2-3 specific, honest observations about their situation
4. After 3-4 exchanges: "I can have our team put together a full audit and proposal — it's free, takes 20 minutes, and you'll leave with a clear action plan whether you work with us or not. Want me to set that up?"

**When a URL IS provided (site data will be injected into context):**
STRUCTURE YOUR RESPONSE EXACTLY LIKE THIS:

1. **First sentence: identify the business.** Read the FULL PAGE CONTENT SUMMARY carefully — not just the H1. The content will tell you what the company does. State it specifically: "I pulled up [domain] — looks like you're a [description] serving [market]."
   - A generic H1 like "Welcome" or "Company Name" does NOT mean you can't identify the business. Read the body content — it almost always explains what they do.
   - Only say "I couldn't tell what you do" if the page content itself is genuinely vague after reading the full summary.
   - Never use labels like "consulting firm" or "IT company" unless those exact words appear in the page content.

2. **Then give 3-4 specific data-point findings.** Be an analyst, not a copywriter. Use the ACTUAL values from the site data:
   - Quote the actual H1 text: "Your H1 is '[actual H1]' — that tells Google nothing about what you do or who you serve."
   - State exactly what's missing: "No meta description. That means Google is writing your search snippet for you."
   - Call out specific structural gaps: "No location pages, no schema markup, no conversion tracking detected."
   - If the title tag is weak, quote it.

3. **One sentence on business impact.** e.g. "Combined, these mean you're probably invisible to anyone who doesn't already know your name."

4. **CTA:** "These are all fixable. We can put together a full audit and proposal — free, 20 minutes, no obligation. Want me to set that up?"

NEVER use phrases like "lack of clear messaging", "missed opportunity to engage", or generic marketing-speak. Stick to what the data actually shows."

**Common objections — handle these:**
- "We already have an agency" → "What results are they showing you? Specifically — calls, leads, cost per acquisition? If they can't answer that clearly, that's a problem."
- "We tried Google Ads and it didn't work" → "Conversion tracking is almost always the culprit. If Google can't see which clicks turn into calls or leads, it can't optimize. That's fixable."
- "We don't have the budget" → "What's a new client worth to you? If it's $1,000+, the math usually works out. The question is cost per acquisition, not monthly spend."
- "We do it in-house" → "How much time is that taking, and what's your cost per lead right now? Most businesses find the math flips pretty quickly when you run the numbers."

## RULES
- Max 3-4 sentences per response. Brevity = respect.
- Never say "Great question!", "Absolutely!", "Certainly!" — just answer.
- Never quote specific pricing. Direct to strategy call.
- Be honest. If their site has real problems, say so tactfully but clearly.
- Always move the conversation toward booking a strategy call or submitting contact info.
- If asked about something outside marketing: "That's outside my lane. What's your biggest marketing challenge right now?"
- Never make up information about a website. Only comment on what's in the site data provided.`;

// ── Site Fetcher ───────────────────────────────────────────────────────────────
function extractUrls(text) {
  // Match full URLs and bare domains (e.g. velocitylogicgroup.com)
  const fullUrls    = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi) || [];
  const bareDomains = text.match(/\b(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s]*)?\b/g) || [];
  const combined    = [...new Set([...fullUrls, ...bareDomains])];
  // Normalize: add https:// if missing, filter out common non-domain words
  return combined
    .filter(u => /\.[a-zA-Z]{2,}/.test(u) && !/^(e\.g|i\.e|etc|vs|p\.s)\./.test(u))
    .map(u => /^https?:\/\//i.test(u) ? u : 'https://' + u)
    .slice(0, 1); // only process first URL found
}


async function fetchSiteData(url) {
  // Use Jina.ai reader — handles JS rendering, Cloudflare, redirects. Free tier.
  const jinaUrl = `https://r.jina.ai/${url}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "markdown",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Could not fetch site (${res.status})` };

    const text = await res.text();
    if (!text || text.length < 100) return { error: "Site returned no readable content" };

    // Parse Jina's response format:
    // Title: ...
    // URL Source: ...
    // Markdown Content:
    // <content>
    const titleMatch   = text.match(/^Title:\s*(.+)$/m);
    const title        = titleMatch ? titleMatch[1].trim() : null;
    const contentStart = text.indexOf("Markdown Content:");
    const markdown     = contentStart >= 0 ? text.slice(contentStart + 18).trim() : text;

    // Extract headings from markdown
    // Handle both ATX (# H) and setext (H\n=== or H\n---) heading styles
    const atxH1   = [...markdown.matchAll(/^# (.+)$/gm)].map(m => m[1].trim());
    const setextH1= [...markdown.matchAll(/^(.+)\n={3,}/gm)].map(m => m[1].trim()).slice(1); // skip first (=title)
    const atxH2   = [...markdown.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
    const setextH2= [...markdown.matchAll(/^(.+)\n-{3,}/gm)].map(m => m[1].trim());
    const h1s = [...atxH1, ...setextH1].filter(h => h.length > 4 && h.length < 150).slice(0, 3);
    const h2s = [...atxH2, ...setextH2].filter(h => h.length > 4 && h.length < 150).slice(0, 5);

    // Check for tracking/schema signals in raw text
    const hasAnalytics = /gtag|google-analytics|GTM-|_ga|fbq|hotjar/i.test(markdown);
    const hasSchema    = /"@type"/i.test(markdown);
    const hasLocPages  = /\/[a-z]+-[a-z]+(-[a-z]+)?\//i.test(url);

    // Extract meaningful content — skip nav/image lines, get real paragraphs
    const cleanLines = markdown
      .split('\n')
      .map(l => l.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim())
      .filter(l => l.length > 60 && !l.startsWith('#') && !l.startsWith('=') && !l.startsWith('-') && !/^[\[\](){}|*_`>0-9.\-!]/.test(l));
    const summary = cleanLines.slice(0, 15).join('\n');

    return { url, title, h1s, h2s, hasAnalytics, hasSchema, summary, raw: markdown.slice(0, 500) };

  } catch (err) {
    return { error: err.name === "AbortError" ? "Site took too long to respond" : err.message };
  }
}

function formatSiteContext(data) {
  if (data.error) {
    return `\n\n[SITE ANALYSIS ERROR for ${data.url}: ${data.error}. Do not speculate about this site. Tell the user you had trouble reading their site and ask them to describe their business instead.]`;
  }
  const lines = [
    `\n\n[SITE ANALYSIS for ${data.url}]`,
    `Page title: ${data.title || "MISSING"}`,
    `H1 headings: ${data.h1s && data.h1s.length ? data.h1s.join(" | ") : "NONE FOUND"}`,
    `H2 headings: ${data.h2s && data.h2s.length ? data.h2s.join(" | ") : "NONE FOUND"}`,
    `Analytics/tracking: ${data.hasAnalytics ? "Detected" : "None detected — conversion tracking likely missing"}`,
    `Schema markup: ${data.hasSchema ? "Detected" : "None detected"}`,
    `Full page content (use this to identify what the business does and find specific issues):`,
    data.summary || "(no content)",
    `[END SITE DATA — base ALL findings on this data only. Do not invent anything not present above.]`,
  ];
  return lines.join("\n");
}

// ── Main Handler ───────────────────────────────────────────────────────────────
exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: "",
    };
  }

  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  const apiKey = process.env.OPENAI_API_KEY || process.env.avachat;
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { messages } = body;
  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, body: JSON.stringify({ error: "messages required" }) };
  }

  // Check last user message for URLs
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
  let siteContext = "";

  if (lastUserMsg) {
    const urls = extractUrls(lastUserMsg.content);
    if (urls.length > 0) {
      // Fetch the first URL found
      const siteData = await fetchSiteData(urls[0]);
      siteContext = formatSiteContext(siteData);
    }
  }

  // Build system prompt with optional site context
  const systemContent = SYSTEM_PROMPT + siteContext;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemContent },
          ...messages.slice(-12),
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 502, headers: corsHeaders(), body: JSON.stringify({ error: "OpenAI error", detail: err }) };
    }

    const data  = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Something went wrong — try again.";

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: err.message }) };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
