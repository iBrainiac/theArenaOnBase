// BTC price data from public APIs — no auth required

export async function getBTCPrice() {
  const res = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot");
  const json = await res.json();
  return parseFloat(json.data.amount);
}

// Returns last 6 OHLC candles (1hr each) as [timestamp, open, high, low, close]
export async function getBTCHistory() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=1"
  );
  const candles = await res.json();
  if (!Array.isArray(candles) || candles.length === 0) {
    throw new Error("Empty price history from CoinGecko");
  }
  return candles.slice(-6);
}

// Simple momentum signal from candle history
export function calcMomentum(candles) {
  const first = candles[0][1]; // open of oldest candle
  const last  = candles[candles.length - 1][4]; // close of newest candle
  const pct   = ((last - first) / first) * 100;
  return { pct: pct.toFixed(2), signal: pct >= 0 ? "UP" : "DOWN" };
}
