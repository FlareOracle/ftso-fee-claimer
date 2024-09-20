import { formatEther, Wallet } from "ethers";
import { ZERO_BYTES32 } from "./configs/networks";
import { rewardManager, flareSystemsManager, provider } from "./contracts";
import { ClaimType } from "./interfaces";
import { getRewardCalculationData } from "./reward-data";
import type { IRewardManager } from "./types";
import { configDotenv } from "dotenv";

configDotenv();

export class Claimer {
  private rewardManager = rewardManager;

  get identityAddress(): string {
    const identityAddress = process.env.IDENTITY_ADDRESS;
    if (!identityAddress) {
      throw new Error("IDENTITY_ADDRESS environment variable is not set");
    }
    return identityAddress;
  }

  get recipientAddress(): string {
    const recipient = process.env.CLAIM_RECIPIENT_ADDRESS;
    if (!recipient) {
      throw new Error("CLAIM_RECIPIENT_ADDRESS environment variable is not set");
    }
    return recipient;
  }

  async getRewardEpochIdsWithClaimableRewards() {
    const [startRewardEpochId, endRewardEpochId] = await this.getClaimableRewardEpochIdRange()
    if (endRewardEpochId < startRewardEpochId) {
      return null;
    }
    const claimableRewardEpochIds: number[] = [];
    for (
      let epochId = startRewardEpochId;
      epochId <= endRewardEpochId;
      epochId++
  ) {
      const rewardsHash = await flareSystemsManager.rewardsHash(epochId)
      const rewardHashSigned = Boolean(rewardsHash) && rewardsHash !== ZERO_BYTES32;
      if (rewardHashSigned) {
        claimableRewardEpochIds.push(Number(epochId));
      }
    }
    if (claimableRewardEpochIds.length === 0) {
      return null;
    }
    return claimableRewardEpochIds;
  }

  async getRewardClaimData(rewardEpochId: number) {
    const rewardsData = await getRewardCalculationData(rewardEpochId);
    if (!rewardsData) {
      return null;
    }
    const rewardClaims = rewardsData.rewardClaims.find(([_, [id, address, sum, claimType]]) => address.toLowerCase() === this.identityAddress.toLowerCase() && claimType === ClaimType.FEE);
    if (!rewardClaims) {
      return null;
    }
    const [merkleProof, [id, address, sum, claimType]] = rewardClaims;
    return {
      merkleProof, 
      body: {
        rewardEpochId: BigInt(id),
        beneficiary: address,
        amount: BigInt(sum),
        claimType: BigInt(claimType)
      }
    } satisfies IRewardManager.RewardClaimWithProofStruct
  }

  async getRewardClaimWithProofStructs() {
    const claimableRewardEpochIds = await this.getRewardEpochIdsWithClaimableRewards();
    if (!claimableRewardEpochIds?.length) {
      return;
    }
    const rewardClaimWithProofStructs: IRewardManager.RewardClaimWithProofStruct[] = [];
    for (const epochId of claimableRewardEpochIds) {
      const rewardClaimData = await this.getRewardClaimData(epochId);
      if (!rewardClaimData) {
        break;
      }
      rewardClaimWithProofStructs.push(rewardClaimData);
    }
    return rewardClaimWithProofStructs;
  }

  async claimAllUnclaimedRewards() {
    const rewardClaimWithProofStructs = await this.getRewardClaimWithProofStructs();
    if (!rewardClaimWithProofStructs?.length) {
      console.log("No claimable rewards found");
      return;
    }
    const epochIdsWithRewardClaims = rewardClaimWithProofStructs.map(({body}) => body.rewardEpochId);
    console.log(`🎉 Reward tuples found for epochs: ${epochIdsWithRewardClaims.join(", ")}`);

    const executorPrivateKey = process.env.CLAIM_EXECUTOR_PRIVATE_KEY;
    if (!executorPrivateKey) {
      throw new Error("CLAIM_EXECUTOR_PRIVATE_KEY environment variable is not set");
    }
    const claimExecutor = new Wallet(executorPrivateKey);

    const lastEpochIdToClaim = epochIdsWithRewardClaims[epochIdsWithRewardClaims.length - 1];

    console.log('✨ Found unclaimed reward epochs:')
    for (const {body: {rewardEpochId, amount}} of rewardClaimWithProofStructs) {
      console.log(`💰 Epoch ${rewardEpochId}: ${formatEther(amount)}`)
    }
    console.log('🚀 Claiming...')

    const tx = await this.rewardManager
      .connect(claimExecutor.connect(provider))
      .claim(this.identityAddress, this.recipientAddress, lastEpochIdToClaim, true, rewardClaimWithProofStructs)

    console.log('Transaction submitted, waiting for confirmation...')

    await tx.wait();

    console.log('🎉 Rewards claimed successfully!');
    console.log(`Transaction hash: ${tx.hash}`);
  }

  async claimRewards(epochId: number) {
    console.log(`🎯 Claiming rewards for epoch ${epochId}`);
    const [_, endRewardEpochId] = await this.getClaimableRewardEpochIdRange();
    if (epochId > endRewardEpochId) {
      console.log(`❌ Epoch ${epochId} is not claimable yet`);
      return;
    }
    const rewardClaimData = await this.getRewardClaimData(epochId);
    if (!rewardClaimData) {
      console.log('No claimable rewards found');
      return;
    }

    const executorPrivateKey = process.env.CLAIM_EXECUTOR_PRIVATE_KEY;
    if (!executorPrivateKey) {
      throw new Error("CLAIM_EXECUTOR_PRIVATE_KEY environment variable is not set");
    }
    const claimExecutor = new Wallet(executorPrivateKey).connect(provider);

    const amount = formatEther(rewardClaimData.body.amount);
    console.log(`💸 Found ${amount} of rewards`);
    console.log('🚀 Claiming...')

    const tx = await this.rewardManager
      .connect(claimExecutor)
      .claim(this.identityAddress, this.recipientAddress, epochId, true, [rewardClaimData]);

    console.log('📨 Transaction submitted, waiting for confirmation...')

    await tx.wait();

    console.log('🎉 Rewards claimed successfully!');
    console.log(`Transaction hash: ${tx.hash}`);
  }

  private async getClaimableRewardEpochIdRange() {
    const startRewardEpochId = await this.rewardManager.getNextClaimableRewardEpochId(this.identityAddress);
    const [_, endRewardEpochId] = await this.rewardManager.getRewardEpochIdsWithClaimableRewards();
    return [startRewardEpochId, endRewardEpochId];
  }
}