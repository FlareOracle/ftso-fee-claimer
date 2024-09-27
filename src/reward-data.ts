import axios from "axios";
import { RewardsDataSchema } from "./interfaces";

export function getRewardCalculationDataPath(rewardEpochId: number) {
  const network = process.env.NETWORK;
  if (!network) {
    throw new Error("NETWORK environment variable is not set");
  }
  switch (network) {
    case "coston2":
      return `https://gitlab.com/timivesel/ftsov2-testnet-rewards/-/raw/main/rewards-data/coston2/${rewardEpochId}/reward-distribution-data-tuples.json`;
    case "coston":
      return `https://gitlab.com/timivesel/ftsov2-testnet-rewards/-/raw/main/rewards-data/coston/${rewardEpochId}/reward-distribution-data-tuples.json`;
    case "songbird":
      return `https://raw.githubusercontent.com/flare-foundation/fsp-rewards/refs/heads/main/songbird/${rewardEpochId}/reward-distribution-data-tuples.json`;
    case "flare":
      return `https://raw.githubusercontent.com/flare-foundation/fsp-rewards/refs/heads/main/flare/${rewardEpochId}/reward-distribution-data-tuples.json`;
    default:
      throw new Error("Network not supported");
  }
}

export const getRewardCalculationData = async (rewardEpochId: number) => {
  try {
  const rewardsDataPath = getRewardCalculationDataPath(rewardEpochId);
  const res = await axios.get(rewardsDataPath);
  const rewardsData = RewardsDataSchema.parse(res.data);
    return rewardsData;
  } catch (error) {
    console.error(`Error fetching rewards data for epoch ${rewardEpochId}: ${error}`);
    return null
  }
}