/**
 * OpenSea & Multi-Chain Contract Sniper Configuration
 * Target Chains: Ethereum Mainnet, Base, Robinhood, Ink
 */

module.exports = {
  // Target Blockchain Networks & High-Performance RPC Nodes
  CHAINS: {
    ethereum: {
      id: 1,
      name: "Ethereum Mainnet",
      symbol: "ETH",
      rpc: [
        "https://ethereum-rpc.publicnode.com",
        "https://1rpc.io/eth",
        "https://rpc.ankr.com/eth"
      ]
    },
    base: {
      id: 8453,
      name: "Base Mainnet",
      symbol: "ETH",
      rpc: [
        "https://mainnet.base.org",
        "https://base-rpc.publicnode.com",
        "https://1rpc.io/base"
      ]
    },
    robinhood: {
      id: 48,
      name: "Robinhood Chain",
      symbol: "ETH",
      rpc: [
        "https://rpc.robinhood.com",
        "https://rpc-evm.robinhood.com"
      ]
    },
    ink: {
      id: 57073,
      name: "Ink Chain",
      symbol: "ETH",
      rpc: [
        "https://rpc-gel.inkonchain.com",
        "https://rpc.inkonchain.com"
      ]
    }
  },

  // SeaDrop Official V1 Contract ABI
  SEADROP_ABI: [
    // Public Drop Mint
    "function mintPublic(address nftContract, address feeRecipient, address minterIfNotPayer, uint256 quantity) payable",
    // Allowlist / FCFS / GTD Mint with Merkle Proof
    "function mintAllowList(address nftContract, address feeRecipient, address minterIfNotPayer, uint256 quantity, tuple(bytes32[] proof, uint256 maxMint, uint256 price, uint256 feeBps) mintParams) payable",
    // View Drop Stages & Info
    "function getPublicDrop(address nftContract) view returns (tuple(uint80 mintPrice, uint48 startTime, uint48 endTime, uint16 maxTotalMintableByWallet, uint16 feeBps, bool restrictFeeRecipients))",
    "function getAllowListMintSchedule(address nftContract) view returns (tuple(uint80 mintPrice, uint48 startTime, uint48 endTime, uint16 maxTotalMintableByWallet, uint16 feeBps, bool restrictFeeRecipients))",
    "function getMintStats(address nftContract, address minter) view returns (uint256 minterNumMinted, uint256 currentTotalMinted, uint256 maxTotalMintableByWallet)"
  ],

  // OpenSea Standard SeaDrop Contract Addresses per Chain
  SEADROP_ADDRESSES: {
    1: "0x00005EA00Ac477B1030CE78506496665451e930B", // Ethereum
    8453: "0x00005EA00Ac477B1030CE78506496665451e930B", // Base
    48: "0x00005EA00Ac477B1030CE78506496665451e930B", // Robinhood
    57073: "0x00005EA00Ac477B1030CE78506496665451e930B" // Ink
  }
};
