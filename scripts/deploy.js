import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("Starting deployment...");

  const WAGER_EVM_ADDRESS = "0x0000000000000000000000000000000000868e0f";

  // Deploy WagerSwapPool
  // console.log("Deploying WagerSwapPool...");
  // const WagerSwapPool = await ethers.getContractFactory("WagerSwapPool");
  // const wagerSwapPool = await WagerSwapPool.deploy(WAGER_EVM_ADDRESS);
  // await wagerSwapPool.waitForDeployment();
  // const poolAddress = await wagerSwapPool.getAddress();
  // console.log(`WagerSwapPool deployed to: ${poolAddress}`);

  // Deploy WagerGames
  console.log("Deploying WagerGames...");
  const WagerGames = await ethers.getContractFactory("WagerGames");
  const wagerGames = await WagerGames.deploy(WAGER_EVM_ADDRESS);
  await wagerGames.waitForDeployment();
  const gamesAddress = await wagerGames.getAddress();
  console.log(`WagerGames deployed to: ${gamesAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
