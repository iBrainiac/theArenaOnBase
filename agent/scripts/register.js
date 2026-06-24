// One-time script: registers the agent wallet with Base and writes the builder code.
// Run: npm run register
// Do NOT re-run — it generates a new builder code and breaks the existing one.
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILDER_CODE_PATH = path.join(__dirname, "../src/constants/builderCode.js");
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || (() => {
  const { privateKeyToAccount } = await import("viem/accounts");
  return privateKeyToAccount(process.env.PRIVATE_KEY).address;
})();

// Check if already registered
const existing = fs.readFileSync(BUILDER_CODE_PATH, "utf8");
if (existing.includes("bc_")) {
  console.log("Already registered. builderCode.js already contains a builder code.");
  console.log("Re-running would generate a new code and break the existing one. Aborting.");
  process.exit(0);
}

console.log(`Registering wallet: ${WALLET_ADDRESS}`);

const res = await fetch("https://api.base.dev/v1/agents/builder-codes", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet_address: WALLET_ADDRESS }),
});

if (!res.ok) {
  const body = await res.text();
  console.error("Registration failed:", res.status, body);
  process.exit(1);
}

const { builder_code } = await res.json();
console.log(`Builder code: ${builder_code}`);

// Write to constants file
fs.writeFileSync(
  BUILDER_CODE_PATH,
  `// DO NOT re-run registration — this code is permanent for this wallet.\nexport const BUILDER_CODE = "${builder_code}";\n`
);

console.log("Written to src/constants/builderCode.js");
console.log("Attribution is now wired into every transaction via ERC-8021.");
