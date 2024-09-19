import { z } from 'zod';

export enum ClaimType {
  DIRECT = 0,
  FEE = 1,
  WNAT = 2,
  MIRROR = 3,
  CCHAIN = 4,
}

const HexString = z.string().regex(/^0x[0-9a-fA-F]+$/);

const RewardClaimData = z.tuple([
  z.number().int().positive(),
  HexString.length(42),
  z.string().regex(/^\d+$/),
  z.number().int().min(0).max(4)
]);

const RewardClaim = z.tuple([
  z.array(HexString),
  RewardClaimData
]);

export const RewardsDataSchema = z.object({
  rewardEpochId: z.number().int().positive(),
  rewardClaims: z.array(RewardClaim),
  noOfWeightBasedClaims: z.number().int().nonnegative(),
  merkleRoot: HexString,
  /*
  abi: z.object({
    components: z.array(z.object({
      internalType: z.string(),
      name: z.string(),
      type: z.string()
    })),
    internalType: z.string(),
    name: z.string(),
    type: z.string()
  })
  */
});

export type RewardsData = z.infer<typeof RewardsDataSchema>;