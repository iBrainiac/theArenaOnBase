import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { BUILDER_CODE } from "./constants/builderCode.js";
import { PRIVATE_KEY, RPC_URL } from "./config.js";

// ERC-8021 builder code suffix — appended to every transaction's calldata
let DATA_SUFFIX = "";
if (BUILDER_CODE) {
  try {
    const { Attribution } = await import("ox/erc8021");
    const suffix = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });
    DATA_SUFFIX = suffix.startsWith("0x") ? suffix.slice(2) : suffix;
  } catch {
    console.warn("ox/erc8021 not available, skipping builder code attribution");
  }
}

export const account = privateKeyToAccount(PRIVATE_KEY);

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

export const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(RPC_URL),
});

// Wraps writeContract: encodes calldata, appends builder code suffix, sends raw tx
export async function sendContractCall({ address, abi, functionName, args = [], value }) {
  const data = encodeFunctionData({ abi, functionName, args });
  const dataWithSuffix = DATA_SUFFIX ? (data + DATA_SUFFIX) : data;

  const hash = await walletClient.sendTransaction({
    to: address,
    data: dataWithSuffix,
    ...(value !== undefined && { value }),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Tx reverted: ${hash}`);
  return receipt;
}
