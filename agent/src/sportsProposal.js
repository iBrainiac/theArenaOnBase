import axios from "axios";
import { publicClient, account, sendContractCall } from "./wallet.js";
import { MARKET_ABI, USDC_ABI, UMA_ABI } from "./abi.js";
import { MARKET_ADDRESS, USDC_ADDRESS, UMA_ADDRESS, UMA_BOND, BACKEND_URL } from "./config.js";

async function ensureUMAApproval() {
  const allowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [account.address, UMA_ADDRESS],
  });

  if (allowance < UMA_BOND) {
    console.log("[Sports] Approving USDC for UMA bond...");
    await sendContractCall({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "approve",
      args: [UMA_ADDRESS, UMA_BOND * 10n], // 10x to avoid repeated approvals
    });
  }
}

// Runs every 10 min: picks up admin-entered results and proposes them on-chain via UMA
export async function sportsProposalLoop() {
  try {
    const { data: pending } = await axios.get(`${BACKEND_URL}/api/markets/pending-proposals`);
    if (!pending.length) return;

    console.log(`[Sports] ${pending.length} market(s) queued for UMA proposal`);
    await ensureUMAApproval();

    const outcomeLabel = { 1: "Team A wins", 2: "Team B wins", 3: "Draw" };

    for (const { market_id, outcome, question } of pending) {
      try {
        console.log(`[Sports] Proposing market #${market_id}: "${question}" → ${outcomeLabel[outcome]}`);
        await sendContractCall({
          address: MARKET_ADDRESS,
          abi: MARKET_ABI,
          functionName: "proposeOutcome",
          args: [BigInt(market_id), outcome],
        });
        console.log(`[Sports] Proposal submitted for #${market_id} — 2hr dispute window open`);
      } catch (err) {
        console.error(`[Sports] Proposal failed for #${market_id}:`, err.message);
      }
    }
  } catch (err) {
    if (err.code !== "ECONNREFUSED") {
      console.error("[Sports] Proposal loop error:", err.message);
    }
  }
}

// Runs every 10 min: finalizes UMA assertions whose 2hr dispute window has passed
export async function sportsFinalizationLoop() {
  try {
    const { data: finalizable } = await axios.get(`${BACKEND_URL}/api/markets/finalizable-assertions`);
    if (!finalizable.length) return;

    console.log(`[Sports] ${finalizable.length} assertion(s) ready to finalize`);

    for (const { assertion_id, market_id } of finalizable) {
      try {
        console.log(`[Sports] Finalizing assertion for market #${market_id}...`);
        await sendContractCall({
          address: UMA_ADDRESS,
          abi: UMA_ABI,
          functionName: "settleAssertion",
          args: [assertion_id],
        });
        console.log(`[Sports] Market #${market_id} finalized — winners can now claim`);
      } catch (err) {
        console.error(`[Sports] Finalization failed for market #${market_id}:`, err.message);
      }
    }
  } catch (err) {
    if (err.code !== "ECONNREFUSED") {
      console.error("[Sports] Finalization loop error:", err.message);
    }
  }
}
