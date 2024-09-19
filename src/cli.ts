import { Command } from 'commander';
import { Claimer } from './claimer';
import dotenv from 'dotenv';
import { formatEther } from 'ethers';

dotenv.config();

const program = new Command();

program
  .name('reward-claimer')
  .description('CLI to claim Flare rewards')
  .version('1.0.0');

program
  .command('claim')
  .description('Claim rewards for a specific epoch or all unclaimed rewards')
  .option('-e, --epoch <number>', 'Specific epoch to claim rewards for')
  .option('-a, --all', 'Claim all unclaimed rewards')
  .action(async (options) => {
    const claimer = new Claimer();

    if (options.epoch) {
      await claimer.claimRewards(Number.parseInt(options.epoch));
    } else if (options.all) {
      await claimer.claimAllUnclaimedRewards();
    } else {
      console.error('Please specify either an epoch (-e, --epoch) or use -a, --all to claim all unclaimed rewards');
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List claimable reward epochs and their amounts')
  .action(async () => {
    const claimer = new Claimer();
    const claimableEpochs = await claimer.getRewardEpochIdsWithClaimableRewards();
    if (claimableEpochs === null) {
      console.log('No claimable rewards found');
      return;
    }
    console.log('🎉 Claimable reward epochs and amounts:');
    for (const epoch of claimableEpochs) {
      const rewardData = await claimer.getRewardClaimData(epoch);
      if (rewardData?.body?.amount) {
        console.log(`✨ Epoch ${epoch}: ${formatEther(rewardData.body.amount)}`);
      } else {
        console.log(`❌ Epoch ${epoch}: No reward data available`);
      }
    }
  });

program.parse();
