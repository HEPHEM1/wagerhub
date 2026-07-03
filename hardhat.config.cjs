require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: ".env.local" });

const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hedera: {
      url: "https://testnet.hashio.io/api",
      accounts: OPERATOR_KEY ? [OPERATOR_KEY] : [],
      // Hedera requires explicit gas settings — auto-estimation triggers INSUFFICIENT_TX_FEE
      gas: 4_000_000,
      gasPrice: 1650000000000, // 1650 Gwei — Hedera Testnet minimum
    },
  },
};
