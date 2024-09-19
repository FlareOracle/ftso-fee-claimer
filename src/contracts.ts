import { JsonRpcProvider } from "ethers";
import { FlareSystemsManager__factory } from "./types";
import { IRewardManager__factory } from "./types";
import { CONTRACTS, RPC } from "./configs/networks";
import { configDotenv } from "dotenv";

configDotenv();

export const provider = new JsonRpcProvider(RPC());

const contracts = CONTRACTS();
if (!contracts) {
  throw new Error("Contracts not found");
}

export const flareSystemsManager = FlareSystemsManager__factory.connect(
  contracts.FlareSystemsManager.address,
  provider
);

export const rewardManager = IRewardManager__factory.connect(
  contracts.RewardManager.address,
  provider
);