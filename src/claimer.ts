import { formatEther, Wallet } from "ethers";
import { ZERO_BYTES32 } from "./configs/networks";
import { rewardManager, flareSystemsManager, provider } from "./contracts";
import { ClaimType } from "./interfaces";
import { getRewardCalculationData } from "./reward-data";
import type { IRewardManager } from "./types";
import { configDotenv } from "dotenv";

configDotenv();

export class Claimer {
	static get DIRECT() {
		const signingPolicyAddress = process.env.SIGNING_POLICY_ADDRESS;
		if (!signingPolicyAddress) {
			return null;
		}
		return new Claimer(ClaimType.DIRECT, signingPolicyAddress);
	}
	static get FEE() {
		const identityAddress = process.env.IDENTITY_ADDRESS;
		if (!identityAddress) {
			return null;
		}
		return new Claimer(ClaimType.FEE, identityAddress);
	}

	private rewardManager = rewardManager;

	get recipientAddress(): string {
		const recipient = process.env.CLAIM_RECIPIENT_ADDRESS;
		if (!recipient) {
			throw new Error("CLAIM_RECIPIENT_ADDRESS environment variable is not set");
		}
		return recipient;
	}

	get wrapRewards(): boolean {
		const wrap = process.env.WRAP_REWARDS?.toLowerCase();

		return wrap !== "false";
	}

	constructor(
		public claimType: ClaimType,
		public beneficiary: string,
	) {}

	async getRewardEpochIdsWithClaimableRewards() {
		const [startRewardEpochId, endRewardEpochId] = await this.getClaimableRewardEpochIdRange();
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
		const rewardClaims = rewardsData.rewardClaims.find(
			([_, [id, address, sum, claimType]]) =>
				address.toLowerCase() === this.beneficiary.toLowerCase() && claimType === this.claimType,
		);
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
				claimType: BigInt(claimType),
			},
		} satisfies IRewardManager.RewardClaimWithProofStruct;
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
				continue;
			}
			rewardClaimWithProofStructs.push(rewardClaimData);
		}
		return rewardClaimWithProofStructs;
	}

	async claimAllUnclaimedRewards() {
		const rewardClaimWithProofStructs = await this.getRewardClaimWithProofStructs();
		if (!rewardClaimWithProofStructs?.length) {
			console.log(`No claimable ${ClaimType[this.claimType]} rewards found`);
			return;
		}
		const epochIdsWithRewardClaims = rewardClaimWithProofStructs.map(({ body }) => body.rewardEpochId);
		console.log(
			`🎉 ${ClaimType[this.claimType]} reward tuples found for epochs: ${epochIdsWithRewardClaims.join(", ")}`,
		);

		const executorPrivateKey = process.env.CLAIM_EXECUTOR_PRIVATE_KEY;
		if (!executorPrivateKey) {
			throw new Error("CLAIM_EXECUTOR_PRIVATE_KEY environment variable is not set");
		}
		const claimExecutor = new Wallet(executorPrivateKey);

		const lastEpochIdToClaim = epochIdsWithRewardClaims[epochIdsWithRewardClaims.length - 1];

		console.log(`✨ Found unclaimed ${ClaimType[this.claimType]} reward epochs:`);
		for (const {
			body: { rewardEpochId, amount },
		} of rewardClaimWithProofStructs) {
			console.log(`💰 Epoch ${rewardEpochId}: ${formatEther(amount)}`);
		}
		console.log(`🚀 Claiming ${ClaimType[this.claimType]} rewards...`);

		const tx = await this.rewardManager
			.connect(claimExecutor.connect(provider))
			.claim(
				this.beneficiary,
				this.recipientAddress,
				lastEpochIdToClaim,
				this.wrapRewards,
				rewardClaimWithProofStructs,
			);

		console.log("Transaction submitted, waiting for confirmation...");

		await tx.wait();

		console.log("🎉 Rewards claimed successfully!");
		console.log(`Transaction hash: ${tx.hash}`);
	}

	async claimRewards(epochId: number) {
		console.log(`🎯 Claiming ${ClaimType[this.claimType]} rewards for epoch ${epochId}`);
		const [_, endRewardEpochId] = await this.getClaimableRewardEpochIdRange();
		if (epochId > endRewardEpochId) {
			console.log(`❌ Epoch ${epochId} is not claimable yet`);
			return;
		}
		const rewardClaimData = await this.getRewardClaimData(epochId);
		if (!rewardClaimData) {
			console.log(`No claimable ${ClaimType[this.claimType]} rewards found`);
			return;
		}

		const executorPrivateKey = process.env.CLAIM_EXECUTOR_PRIVATE_KEY;
		if (!executorPrivateKey) {
			throw new Error("CLAIM_EXECUTOR_PRIVATE_KEY environment variable is not set");
		}
		const claimExecutor = new Wallet(executorPrivateKey).connect(provider);

		const amount = formatEther(rewardClaimData.body.amount);
		console.log(`💸 Found ${amount} of rewards`);
		console.log("🚀 Claiming...");

		const tx = await this.rewardManager
			.connect(claimExecutor)
			.claim(this.beneficiary, this.recipientAddress, epochId, this.wrapRewards, [rewardClaimData]);

		console.log("📨 Transaction submitted, waiting for confirmation...");

		await tx.wait();

		console.log("🎉 Rewards claimed successfully!");
		console.log(`Transaction hash: ${tx.hash}`);
	}

	private async getClaimableRewardEpochIdRange() {
		const startRewardEpochId = await this.rewardManager.getNextClaimableRewardEpochId(this.beneficiary);
		const [_, endRewardEpochId] = await this.rewardManager.getRewardEpochIdsWithClaimableRewards();
		return [startRewardEpochId, endRewardEpochId];
	}
}
