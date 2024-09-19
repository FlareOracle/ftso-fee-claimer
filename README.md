# FTSO Fee Claimer

This repository contains a CLI tool for FTSO data providers to claim FTSO v2 fee-based rewards on Flare and Songbird networks.

## Prerequisites

Before using this tool, ensure that you have set up an executor for your rewards:

1. Create an executor account: This is a separate account that will be authorized to claim rewards on behalf of your identity account.
2. Fund the executor account: Ensure it has enough native tokens to cover transaction fees.
3. Authorize the executor: Use your identity account to set the executor in the Flare Portal (https://portal.flare.network/) or directly in the ClaimSetupManager contract (function 13. setClaimExecutors).
4. Set up claim recipient: Add the recipient address to allowed claim recipients in the ClaimSetupManager contract (function 11. setAllowedClaimRecipient).

The executor system allows you to delegate the claiming process to a separate account, enhancing security by not requiring your main identity account to sign claim transactions.

Claim Setup Manager contract addresses:
- Flare: [0xD56c0Ea37B848939B59e6F5Cda119b3fA473b5eB](https://flare-explorer.flare.network/address/0xD56c0Ea37B848939B59e6F5Cda119b3fA473b5eB)
- Songbird: [0xDD138B38d87b0F95F6c3e13e78FFDF2588F1732d](https://songbird-explorer.flare.network/address/0xDD138B38d87b0F95F6c3e13e78FFDF2588F1732d)

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   yarn install
   ```
3. Build the project:
   ```
   yarn build
   ```

## Configuration

Copy the `.env.template` file to `.env` and fill in the required values.

## Usage

The CLI tool provides the following commands:

### Listing Claimable Rewards

To list all claimable reward epochs and their amounts:

```
yarn cli list
```

### Claiming Rewards

To claim rewards, you have two options:

1. Claim rewards for a specific epoch:
   ```
   yarn cli claim -e <epoch_number>
   ```
   Replace `<epoch_number>` with the desired epoch number.

2. Claim all unclaimed rewards:
   ```
   yarn cli claim -a
   ```

### Examples

1. List claimable rewards:
   ```
   yarn cli list
   ```

2. Claim rewards for epoch 10:
   ```
   yarn cli claim -e 220
   ```

3. Claim all unclaimed rewards:
   ```
   yarn cli claim -a

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.