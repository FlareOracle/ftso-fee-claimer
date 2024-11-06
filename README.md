# FTSO Fee Claimer

This repository contains a CLI tool and an auto-claimer for claiming FTSO v2 rewards on Flare and Songbird networks. It supports both FEE and DIRECT claim types.

## Coded with the assistance of:
- Light FTSO
- Burstftso:
  - Telegram: @Burstftso https://t.me/Burstftso
  - Twitter: @Burstnodes https://x.com/Burstnodes

## Understanding Claim Types

The tool supports two types of claims:

1. **FEE Claims (Type 1)**: 
   - Used by data providers to claim their fee rewards
   - Requires the identity address of the data provider
   - Requires Merkle proofs for claiming

2. **DIRECT Claims (Type 0)**:
   - Direct reward claims to an address
   - Requires signing policy address
   - Requires Merkle proofs for claiming

Both claim types require proof verification through the RewardManager smart contract.

## Prerequisites

Before using this tool, ensure that you have set up an executor for your rewards. The setup process is similar for both FEE and DIRECT claims:

1. Create an executor account: This is a separate account that will be authorized to claim rewards on your behalf.
2. Fund the executor account: Ensure it has enough native tokens to cover transaction fees.

3. Authorize the executor:
   - For FEE claims: Use your identity account to authorize the executor
   - For DIRECT claims: Use your signing policy account to authorize the executor
   You can do this through:
   - Flare Portal (https://portal.flare.network/) 
   - Directly in the ClaimSetupManager contract (function 13. setClaimExecutors)

4. Set up claim recipient: 
   - For FEE claims: Add the recipient address to allowed claim recipients for your identity address
   - For DIRECT claims: Add the recipient address to allowed claim recipients for your signing policy address
   This can be done through the ClaimSetupManager contract (function 11. setAllowedClaimRecipient)

The executor system allows you to delegate the claiming process to a separate account, enhancing security by not requiring your main accounts (identity or signing policy) to sign claim transactions.

Claim Setup Manager contract addresses:
- Flare: [0xD56c0Ea37B848939B59e6F5Cda119b3fA473b5eB](https://flare-explorer.flare.network/address/0xD56c0Ea37B848939B59e6F5Cda119b3fA473b5eB)
- Songbird: [0xDD138B38d87b0F95F6c3e13e78FFDF2588F1732d](https://songbird-explorer.flare.network/address/0xDD138B38d87b0F95F6c3e13e78FFDF2588F1732d)

## Configuration

Copy the `.env.template` file to `.env` and fill in the required values.

### Understanding the Addresses

The system involves several different addresses, each with a specific role:

1. **Identity Address** (`IDENTITY_ADDRESS`):
   - Required for FEE claims
   - This is the beneficiary address for FEE claims
   - Typically the data provider's identity address

2. **Signing Policy Address** (`SIGNING_POLICY_ADDRESS`):
   - Required for DIRECT claims
   - This is the beneficiary address for DIRECT claims
   - The address that receives direct rewards

3. **Claim Executor** (`CLAIM_EXECUTOR_PRIVATE_KEY`):
   - Required for both claim types
   - The account that executes the claim transactions
   - Must be authorized by both the identity address (for FEE claims) and signing policy address (for DIRECT claims)
   - Only needs enough native tokens for transaction fees

4. **Claim Recipient** (`CLAIM_RECIPIENT_ADDRESS`):
   - Required for both claim types
   - The address where claimed rewards will be sent
   - Must be authorized as a recipient by both the identity address and signing policy address

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

## Usage

### CLI Tool

The CLI tool provides commands for both FEE and DIRECT claims:

### Listing Claimable Rewards

To list all claimable reward epochs and their amounts for both claim types:

```
yarn cli list
```

### Claiming Rewards

The `claim` command is flexible and can be used in several ways:

1. Claim all unclaimed rewards for both types:
   ```bash
   yarn cli claim
   ```
   This will claim all unclaimed FEE and DIRECT rewards.

2. Claim specific type:
   ```bash
   # Claim all FEE rewards
   yarn cli claim -t fee

   # Claim all DIRECT rewards
   yarn cli claim -t direct
   ```

3. Claim specific epoch:
   ```bash
   # Claim both FEE and DIRECT rewards for epoch 220
   yarn cli claim -e 220
   ```

4. Claim specific type and epoch:
   ```bash
   # Claim only FEE rewards for epoch 220
   yarn cli claim -t fee -e 220

   # Claim only DIRECT rewards for epoch 220
   yarn cli claim -t direct -e 220
   ```

### Auto-Claimer

The auto-claimer is a service that automatically claims unclaimed rewards.

To start the auto-claimer:

1. Using yarn:
   ```
   yarn build
   yarn auto-claimer
   ```

2. Using Docker:
   a. Build the Docker image:
      ```
      docker build -t ftso-fee-claimer .
      ```
      This command builds the Docker image for the project.

   b. Start the service in the background:
      ```
      docker compose up -d auto-claimer
      ```
      This command starts the auto-claimer service in detached mode (-d flag), running it in the background.

   c. Monitor the logs:
      ```
      docker compose logs auto-claimer -f
      ```
      Use this command to follow (-f flag) the logs of the auto-claimer service.

### Using CLI with Docker

You can use the CLI tool via Docker by following these steps:

1. Build the Docker image:
   ```
   docker build -t ftso-fee-claimer .
   ```

2. Run CLI commands using Docker Compose:

   - List claimable rewards:
     ```
     docker compose run --rm cli list
     ```

   - Claim FEE and DIRECT rewards for a specific epoch (e.g., epoch 220):
     ```
     docker compose run --rm cli claim -e 220
     ```

   - Claim all unclaimed rewards:
     ```
     docker compose run --rm cli claim
     ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.