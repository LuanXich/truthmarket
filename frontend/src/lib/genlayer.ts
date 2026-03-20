import { GenLayerClient } from "genlayer-js";
import * as fs from "fs";
import * as path from "path";

async function deploy() {
  const client = new GenLayerClient();
  const contractPath = path.join(__dirname, "../contracts/truth_market.py");
  const contractCode = fs.readFileSync(contractPath, "utf-8");

  console.log("🚀 Deploying TruthMarket contract...");
  const tx = await client.deployContract({ code: contractCode, args: [] });

  console.log("\n✅ TruthMarket deployed!");
  console.log("   Contract address:", tx.contractAddress);
  console.log("\n📋 Add to frontend/.env:");
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${tx.contractAddress}`);
}

deploy().catch(console.error);
