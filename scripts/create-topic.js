const { Client, TopicCreateTransaction, PrivateKey } = require("@hiero-ledger/sdk");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

async function main() {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;

  if (!operatorId || !operatorKey) {
    throw new Error("Operator credentials not found in .env.local");
  }

  const key = operatorKey.length === 64 || operatorKey.startsWith('0x') 
    ? PrivateKey.fromStringECDSA(operatorKey) 
    : PrivateKey.fromString(operatorKey);
    
  const client = Client.forTestnet().setOperator(operatorId, key);

  console.log("Creating new HCS Topic...");
  const tx = new TopicCreateTransaction().setTopicMemo("WagerHub Leaderboard");
  
  const submitTx = await tx.execute(client);
  const receipt = await submitTx.getReceipt(client);
  const topicId = receipt.topicId;

  console.log(`Topic Created successfully: ${topicId.toString()}`);

  // Append to .env.local
  const envPath = path.resolve(__dirname, "../.env.local");
  let envContent = fs.readFileSync(envPath, "utf-8");
  
  if (envContent.includes("NEXT_PUBLIC_HCS_TOPIC_ID=")) {
    envContent = envContent.replace(/NEXT_PUBLIC_HCS_TOPIC_ID=.*/, `NEXT_PUBLIC_HCS_TOPIC_ID=${topicId.toString()}`);
  } else {
    envContent += `\nNEXT_PUBLIC_HCS_TOPIC_ID=${topicId.toString()}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log("Saved to .env.local");

  process.exit(0);
}

main().catch(console.error);
