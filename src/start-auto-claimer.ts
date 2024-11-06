import { Claimer } from "./claimer";

async function main() {
	console.log("Starting auto-claimer");
	while (true) {
		await Promise.all([Claimer.DIRECT?.claimAllUnclaimedRewards(), Claimer.FEE?.claimAllUnclaimedRewards()]);
		await new Promise((resolve) => setTimeout(resolve, 12 * 60 * 1000));
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
