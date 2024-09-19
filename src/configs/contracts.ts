export type ContractAddress = string;

type ContractNames = 'FlareSystemsManager' | 'RewardManager';

export type ContractDefinitions = {
  [K in ContractNames]: {
    name: K;
    address: ContractAddress;
  }
}[ContractNames];

export type NetworkContractAddresses = {
  [K in ContractNames]: ContractDefinitions;
};
