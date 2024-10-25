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

  get signingPolicyAddress(): string {
    const signingPolicyAddress = process.env.SIGNINGPOLICY_ADDRESS;
    if (!signingPolicyAddress) {
      throw new Error("SIGNINGPOLICY_ADDRESS environment variable is not set");
    }
    return signingPolicyAddress;
  }

  get wrapRewards(): boolean {
    const wrap = process.env.WRAP_REWARDS?.toLowerCase();
    return wrap !== 'false';
  }

  private async getClaimableRewardEpochIdRange(claimType: ClaimType) {
    let address: string;

    switch (claimType) {
      case ClaimType.FEE:
        address = this.identityAddress;
        break;
      case ClaimType.WNAT:
        address = this.recipientAddress;
        break;
      case ClaimType.DIRECT:
        address = this.signingPolicyAddress;
        break;
      default:
        throw new Error('Unsupported claim type for determining reward epoch range');
    }

    const startRewardEpochId = await this.rewardManager.getNextClaimableRewardEpochId(address);
    const [_, endRewardEpochId] = await this.rewardManager.getRewardEpochIdsWithClaimableRewards();
    return [startRewardEpochId, endRewardEpochId];
  }

  async getRewardEpochIdsWithClaimableRewards(claimType: ClaimType) {
    const [startRewardEpochId, endRewardEpochId] = await this.getClaimableRewardEpochIdRange(claimType);
    if (endRewardEpochId < startRewardEpochId) {
      return null;
    }

    const claimableRewardEpochIds: number[] = [];
    for (let epochId = startRewardEpochId; epochId <= endRewardEpochId; epochId++) {
      const rewardsHash = await flareSystemsManager.rewardsHash(epochId);
      const rewardHashSigned = Boolean(rewardsHash) && rewardsHash !== ZERO_BYTES32;
      if (rewardHashSigned) {
        claimableRewardEpochIds.push(Number(epochId));
      }
    }
    return claimableRewardEpochIds.length === 0 ? null : claimableRewardEpochIds;
  }

  async getRewardClaimData(rewardEpochId: number, claimType: ClaimType) {
    const rewardsData = await getRewardCalculationData(rewardEpochId);
    if (!rewardsData) {
      return null;
    }

    let rewardClaims;

    if (claimType === ClaimType.FEE) {
      rewardClaims = rewardsData.rewardClaims.find(([_, [id, address, sum, type]]) =>
        address.toLowerCase() === this.identityAddress.toLowerCase() && type === ClaimType.FEE
      );
    } else if (claimType === ClaimType.WNAT) {
      rewardClaims = rewardsData.rewardClaims.find(([_, [id, address, sum, type]]) =>
        address.toLowerCase() === this.recipientAddress.toLowerCase() && type === ClaimType.WNAT
      );
    } else if (claimType === ClaimType.DIRECT) {
      rewardClaims = rewardsData.rewardClaims.find(([_, [id, address, sum, type]]) =>
        address.toLowerCase() === this.signingPolicyAddress.toLowerCase() && type === ClaimType.DIRECT
      );
    }

    if (!rewardClaims) {
      return null;
    }

    const [merkleProof, [id, address, sum, type]] = rewardClaims;

    return {
      merkleProof,
      body: {
        rewardEpochId: BigInt(id),
        beneficiary: address,
        amount: BigInt(sum),
        claimType: BigInt(type),
      },
    } satisfies IRewardManager.RewardClaimWithProofStruct;
  }

  async getRewardClaimWithProofStructs(claimType: ClaimType) {
    const claimableRewardEpochIds = await this.getRewardEpochIdsWithClaimableRewards(claimType);
    if (!claimableRewardEpochIds?.length) {
      return;
    }

    const rewardClaimWithProofStructs: IRewardManager.RewardClaimWithProofStruct[] = [];
    for (const epochId of claimableRewardEpochIds) {
      const rewardClaimData = await this.getRewardClaimData(epochId, claimType);
      if (!rewardClaimData) {
        continue;
      }
      rewardClaimWithProofStructs.push(rewardClaimData);
    }
    return rewardClaimWithProofStructs;
  }

  async claimAllUnclaimedRewards() {
    // Claim FEE Rewards
    await this.claimRewardsByType(ClaimType.FEE, process.env.CLAIM_EXECUTOR_PRIVATE_KEY, this.identityAddress); //1

    // Claim WNAT Rewards
    await this.claimRewardsByType(ClaimType.WNAT, process.env.CLAIM_RECIPIENT_PRIVATE_KEY, this.recipientAddress); //2

    // Claim DIRECT Rewards
    await this.claimRewardsByType(ClaimType.DIRECT, process.env.SIGNINGPOLICY_ADDRESS_PRIVATE_KEY, this.signingPolicyAddress); //0
  }

  async claimRewardsByType(claimType: ClaimType, privateKey: string | undefined, address: string) {
    if (!privateKey) {
      throw new Error(`${claimType === ClaimType.FEE ? "CLAIM_EXECUTOR_PRIVATE_KEY" : claimType === ClaimType.WNAT ? "CLAIM_RECIPIENT_PRIVATE_KEY" : "SIGNINGPOLICY_ADDRESS_PRIVATE_KEY"} environment variable is not set`);
    }

    const rewardClaimWithProofStructs = await this.getRewardClaimWithProofStructs(claimType);
    if (!rewardClaimWithProofStructs?.length) {
      console.log(`No claimable rewards found for ${ClaimType[claimType]}`);
      return;
    }

    const claimExecutor = new Wallet(privateKey).connect(provider);
    const epochIdsWithRewardClaims = rewardClaimWithProofStructs.map(({ body }) => body.rewardEpochId);
    const lastEpochIdToClaim = epochIdsWithRewardClaims[epochIdsWithRewardClaims.length - 1];

    console.log(`✨ Found unclaimed ${ClaimType[claimType]} rewards:`);
    for (const { body: { rewardEpochId, amount } } of rewardClaimWithProofStructs) {
      if (claimType === ClaimType.WNAT) {
        console.log(`✨ Epoch ${rewardEpochId}: Dust`);
      } else {
        console.log(`💰 Epoch ${rewardEpochId}: ${formatEther(amount)}`);
      }
    }
    console.log('🚀 Claiming...');

    const tx = await this.rewardManager
      .connect(claimExecutor)
      .claim(address, this.recipientAddress, lastEpochIdToClaim, this.wrapRewards, rewardClaimWithProofStructs);

    console.log('Transaction submitted, waiting for confirmation...');
    await tx.wait();
    console.log(`🎉 ${ClaimType[claimType]} Rewards claimed successfully!`);
    console.log(`Transaction hash: ${tx.hash}`);
  }

  async claimRewards(epochId: number, claimType: ClaimType) {
    console.log(`🎯 Claiming rewards for epoch ${epochId}`);
    const [_, endRewardEpochId] = await this.getClaimableRewardEpochIdRange(claimType);
    if (epochId > endRewardEpochId) {
      console.log(`❌ Epoch ${epochId} is not claimable yet`);
      return;
    }
    const rewardClaimData = await this.getRewardClaimData(epochId, claimType);
    if (!rewardClaimData) {
      console.log(`No claimable ${ClaimType[claimType]} rewards found`);
      return;
    }

    const privateKey = claimType === ClaimType.FEE ? process.env.CLAIM_EXECUTOR_PRIVATE_KEY
                    : claimType === ClaimType.WNAT ? process.env.CLAIM_RECIPIENT_PRIVATE_KEY
                    : process.env.SIGNINGPOLICY_ADDRESS_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error(`${claimType === ClaimType.FEE ? "CLAIM_EXECUTOR_PRIVATE_KEY" 
        : claimType === ClaimType.WNAT ? "CLAIM_RECIPIENT_PRIVATE_KEY" 
        : "SIGNINGPOLICY_ADDRESS_PRIVATE_KEY"} environment variable is not set`);
    }

    const claimExecutor = new Wallet(privateKey).connect(provider);
    const amount = formatEther(rewardClaimData.body.amount);

    if (claimType === ClaimType.WNAT) {
      console.log(`💸 Epoch ${epochId}: Dust`);
    } else {
      console.log(`💸 Found ${amount} of ${ClaimType[claimType]} rewards`);
    }

    console.log('🚀 Claiming...');

    const tx = await this.rewardManager
    .connect(claimExecutor)
    .claim(claimType === ClaimType.DIRECT ? this.signingPolicyAddress : this.identityAddress, this.recipientAddress, epochId, this.wrapRewards, [rewardClaimData]);

    console.log('📨 Transaction submitted, waiting for confirmation...');
    await tx.wait();
    console.log(`🎉 ${ClaimType[claimType]} Rewards claimed successfully!`);
    console.log(`Transaction hash: ${tx.hash}`);
  }
}
