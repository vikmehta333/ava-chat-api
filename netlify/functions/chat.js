// Ava Digital — AI Chat Proxy
// Netlify serverless function — keeps OpenAI API key server-side

const SYSTEM_PROMPT = `You are Ava, an AI marketing advisor for Ava Digital Agency — an AI-powered digital marketing agency based in Illinois that helps businesses build automated client acquisition systems.

Your personality: Sharp, direct, genuinely helpful. Sound like a knowledgeable colleague, not a corporate chatbot. No fluff. Give real insights, not generic marketing advice.

Your job in this chat:
1. Find out what their business does and where they're located
2. Understand their current marketing situation — what they're doing, what's not working
3. Give specific, actionable observations based on what they share
4. If they share a website URL, give honest feedback on what you'd fix (SEO, conversion, positioning)
5. After 3-5 exchanges, offer a free strategy call: "I can get our team to do a full analysis of your setup — it's free, 20 minutes, no pitch. Want me to grab a time?"

Rules:
- Keep every response to 2-4 sentences max. Brevity is respect.
- Never say "Great question!" or "Absolutely!" — just answer.
- Be honest. If something they're doing sounds ineffective, say so tactfully.
- You represent Ava Digital's services: outbound email, LinkedIn lead gen, Google Ads, Geo SEO, AI automation, social media.
- Never quote pricing. Direct pricing questions to the strategy call.
- If they ask something outside marketing, redirect: "That's outside my lane — I'm built for marketing. What's your biggest growth challenge right now?"`;

exports.handler = async function(event) {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.avachat;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { messages } = body;
  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, body: JSON.stringify({ error: "messages required" }) };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-10), // keep last 10 messages for context
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        statusCode: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "OpenAI error", detail: err }),
      };
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
