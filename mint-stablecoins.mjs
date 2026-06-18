import {
    Client,
    PrivateKey,
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType
} from "@hashgraph/sdk";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const operatorId = process.env.HEDERA_OPERATOR_ID;
let operatorKey = process.env.HEDERA_OPERATOR_KEY;

if (!operatorId || !operatorKey) {
    throw new Error("Must have HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in .env.local");
}

let parsedKey;
if (operatorKey.startsWith('0x')) {
    parsedKey = PrivateKey.fromStringECDSA(operatorKey);
} else {
    parsedKey = PrivateKey.fromString(operatorKey);
}

const client = Client.forTestnet().setOperator(operatorId, parsedKey);

async function createToken(name, symbol, decimals, initialSupply) {
    console.log(`Creating ${name} (${symbol})...`);
    
    let tokenCreateTx = new TokenCreateTransaction()
        .setTokenName(name)
        .setTokenSymbol(symbol)
        .setTokenType(TokenType.FungibleCommon)
        .setDecimals(decimals)
        .setInitialSupply(initialSupply * Math.pow(10, decimals))
        .setTreasuryAccountId(operatorId)
        .setAdminKey(parsedKey)
        .setSupplyKey(parsedKey)
        .setSupplyType(TokenSupplyType.Infinite)
        .freezeWith(client);

    const signedTx = await tokenCreateTx.sign(parsedKey);
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    console.log(`- Created ${symbol} with Token ID: ${receipt.tokenId.toString()}`);
    return receipt.tokenId.toString();
}

async function main() {
    try {
        const usdtId = await createToken("Mock USDT", "USDT", 6, 1000000);
        const usdcId = await createToken("Mock USDC", "USDC", 6, 1000000);
        
        console.log("\n--- RESULT ---");
        console.log(`NEXT_PUBLIC_USDT_TOKEN_ID=${usdtId}`);
        console.log(`NEXT_PUBLIC_USDC_TOKEN_ID=${usdcId}`);
        
        process.exit(0);
    } catch (e) {
        console.error("Error creating tokens:", e);
        process.exit(1);
    }
}

main();
