import { Command } from "commander";
import { Claimer } from "./claimer";
import dotenv from "dotenv";
import { formatEther } from "ethers";
import { ClaimType } from "./interfaces";
import { z } from "zod";

dotenv.config();

const program = new Command();

program.name("reward-claimer").description("CLI to claim Flare rewards").version("1.0.0");

const claimTypeSchema = z.union([z.literal("direct"), z.literal("fee")]);
const epochSchema = z
	.string()
	.transform((value) => Number(value))
	.refine((value) => value >= 0);

const parseClaimType = (value: string) => {
	const result = claimTypeSchema.safeParse(value);
	if (!result.success) {
		throw new Error("Invalid claim type. Please specify 'direct' or 'fee'.");
	}
	return result.data;
};
const parseEpoch = (value: string) => {
	const result = epochSchema.safeParse(value);
	if (!result.success) {
		throw new Error("Invalid epoch. Please specify a valid number.");
	}
	return result.data;
};

program
	/*Examples for the claim command:
    # Claim all unclaimed rewards for FEE and DIRECT types
    yarn cli claim

    # Claim FEE rewards for a specific epoch (e.g., epoch 100)
    yarn cli claim -t fee -e 100

    # Claim DIRECT rewards for a specific epoch (e.g., epoch 200)
    yarn cli claim -t direct -e 200

    # Claim all unclaimed rewards for DIRECT type
    yarn cli claim -t direct 

    # Claim FEE rewards for epoch 50
    yarn cli claim --type fee --epoch 50
  */
	.command("claim")
	.description("Claim DIRECT and FEE rewards")
	.option("-t, --type <type>", 'Claim type ("direct", "fee"), by default tries to claim both')
	.option("-e, --epoch <number>", "Specific epoch to claim rewards for, by default claims all unclaimed epochs")
	.action(async (options) => {
		//const claimer = new Claimer();

		try {
			// Claim for specific type
			if (options.type) {
				const claimType = parseClaimType(options.type);

				let claimer: Claimer;

				if (claimType === "direct") {
					if (!Claimer.DIRECT) {
						throw new Error("Claiming DIRECT requires SIGNING_POLICY_ADDRESS environment variable to be set.");
					}
					claimer = Claimer.DIRECT;
				} else {
					if (!Claimer.FEE) {
						throw new Error("Claiming FEE requires IDENTITY_ADDRESS environment variable to be set.");
					}
					claimer = Claimer.FEE;
				}

				// Claim all epochs
				if (options.epoch) {
					const epoch = parseEpoch(options.epoch);
					await claimer.claimRewards(epoch);
				} else {
					await claimer.claimAllUnclaimedRewards();
				}
			} else {
				// Type not defined, claim all available types
				const claimers = [Claimer.DIRECT, Claimer.FEE].filter((claimer): claimer is Claimer => claimer !== null);

				if (options.epoch) {
					const epoch = parseEpoch(options.epoch);
					for (const claimer of claimers) {
						await claimer.claimRewards(epoch);
					}
				} else {
					for (const claimer of claimers) {
						await claimer.claimAllUnclaimedRewards();
					}
				}
			}
		} catch (error) {
			if (error instanceof Error) {
				console.error(error.message);
			} else {
				console.error("An unknown error occurred.");
			}
			process.exit(1);
		}
	});

program
	.command("list")
	.description("List claimable reward epochs and their amounts for FEE and DIRECT claim types")
	.action(async () => {
		const claimers = [Claimer.FEE, Claimer.DIRECT].filter((claimer): claimer is Claimer => claimer !== null);

		try {
			// Iterate through FEE and DIRECT claim types to list all claimable epochs
			for (const claimer of claimers) {
				// Get reward epochs with claimable rewards for the current claim type
				const claimableEpochs = await claimer.getRewardEpochIdsWithClaimableRewards();
				if (claimableEpochs === null) {
					console.log(`No claimable ${ClaimType[claimer.claimType]} rewards found`);
					continue;
				}

				console.log(`🎉 Claimable ${ClaimType[claimer.claimType]} reward epochs and amounts:`);
				for (const epoch of claimableEpochs) {
					const rewardData = await claimer.getRewardClaimData(epoch);
					if (rewardData?.body?.amount) {
						console.log(`✨ Epoch ${epoch}: ${formatEther(rewardData.body.amount)}`);
					} else {
						console.log(`❌ Epoch ${epoch}: No reward data available`);
					}
				}
			}
		} catch (error) {
			if (error instanceof Error) {
				console.error(error.message);
			} else {
				console.error("An unknown error occurred.");
			}
			process.exit(1);
		}
	});

program.parse();
