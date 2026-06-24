import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Returns 1 (UP) or 2 (DOWN)
export async function getMarketDecision(candles, currentPrice) {
  const formatted = candles.map(([ts, o, h, l, c]) => ({
    time: new Date(ts).toISOString(),
    open: o, high: h, low: l, close: c,
  }));

  const msg = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 10,
    messages: [
      {
        role: "user",
        content: `BTC/USD OHLC data (last 6 hourly candles):
${JSON.stringify(formatted, null, 2)}

Current price: $${currentPrice.toLocaleString()}

Will BTC be HIGHER or LOWER in 1 hour?
Respond with ONLY: UP or DOWN`,
      },
    ],
  });

  const answer = msg.choices[0].message.content.trim().toUpperCase();
  return answer.startsWith("UP") ? 1 : 2;
}
