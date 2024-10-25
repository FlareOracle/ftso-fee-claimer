import { Command } from 'commander';
import { Claimer } from './claimer';
import dotenv from 'dotenv';
import { formatEther } from 'ethers';
import { ClaimType } from './interfaces';

dotenv.config();

const program = new Command();

program
  .name('reward-claimer')
  .description('CLI to claim Flare rewards')
  .version('1.0.0');

program
  /*Examples for the claim command:
    # Claim FEE rewards for a specific epoch (e.g., epoch 100)
    yarn cli claim -t fee -e 100

    # Claim WNAT rewards for a specific epoch (e.g., epoch 150)
    yarn cli claim -t wnat -e 150

    # Claim DIRECT rewards for a specific epoch (e.g., epoch 200)
    yarn cli claim -t direct -e 200

    # Claim all unclaimed rewards for FEE, WNAT, and DIRECT types
    yarn cli claim -a

    # Claim FEE rewards for epoch 50
    yarn cli claim --type fee --epoch 50
  */
  .command('claim')
  .description('Claim rewards for a specific epoch or all unclaimed rewards')
  .option('-t, --type <type>', 'Claim type ("fee", "wnat", "direct")')
  .option('-e, --epoch <number>', 'Specific epoch to claim rewards for')
  .option('-a, --all', 'Claim all unclaimed rewards')
  .action(async (options) => {
    const claimer = new Claimer();

    try {
      if (options.all) {
        // Claim all unclaimed rewards for FEE, WNAT, and DIRECT types
        await claimer.claimAllUnclaimedRewards();
        console.log('All claimable rewards for FEE, WNAT, and DIRECT have been claimed.');
      } else {
        // Ensure claim type is provided for individual claim
        if (!options.type) {
          console.error('Please specify a claim type with -t or --type.');
          process.exit(1);
        }

        // Convert claim type string to ClaimType enum
        let claimType: ClaimType;
        switch (options.type?.toLowerCase()) {
          case 'fee':
            claimType = ClaimType.FEE;
            break;
          case 'wnat':
            claimType = ClaimType.WNAT;
            break;
          case 'direct':
            claimType = ClaimType.DIRECT;
            break;
          default:
            console.error('Invalid claim type. Please specify "fee", "wnat", or "direct".');
            process.exit(1);
        }

        // Execute claims based on the given options
        if (options.epoch) {
          await claimer.claimRewards(Number.parseInt(options.epoch), claimType);
        } else {
          console.error('Please specify either an epoch (-e, --epoch) or use -a, --all to claim all unclaimed rewards');
          process.exit(1);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('An unknown error occurred.');
      }
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List claimable reward epochs and their amounts for FEE, WNAT, and DIRECT claim types')
  .action(async () => {
    const claimer = new Claimer();
    const supportedClaimTypes: ClaimType[] = [ClaimType.FEE, ClaimType.WNAT, ClaimType.DIRECT];

    try {
      // Iterate through FEE, WNAT, and DIRECT claim types to list all claimable epochs
      for (const claimType of supportedClaimTypes) {
        // Get reward epochs with claimable rewards for the current claim type
        const claimableEpochs = await claimer.getRewardEpochIdsWithClaimableRewards(claimType);
        if (claimableEpochs === null) {
          console.log(`No claimable rewards found for ${ClaimType[claimType]}`);
          continue;
        }

        console.log(`🎉 Claimable ${ClaimType[claimType]} reward epochs and amounts:`);
        for (const epoch of claimableEpochs) {
          const rewardData = await claimer.getRewardClaimData(epoch, claimType);
          if (rewardData?.body?.amount) {
            if (claimType === ClaimType.WNAT) {
              // For WNAT claimType, display "Dust"
              console.log(`✨ Epoch ${epoch}: Dust`);
            } else {
              // For FEE and DIRECT claimType, display the formatted amount
              console.log(`✨ Epoch ${epoch}: ${formatEther(rewardData.body.amount)}`);
            }
          } else {
            console.log(`❌ Epoch ${epoch}: No reward data available`);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('An unknown error occurred.');
      }
      process.exit(1);
    }
  });

program.parse();
