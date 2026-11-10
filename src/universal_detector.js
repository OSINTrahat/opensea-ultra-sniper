/**
 * Universal Contract ABI Resolver & Mint Method Detector
 * Auto-detects:
 * 1. Standard SeaDrop (OpenSea)
 * 2. Generic ERC-721 / ERC-1155 custom mint functions:
 *    - mint(), mint(uint256), publicMint(), claim(), claimFree()
 *    - mint(address, uint256), mintBatch(uint256)
 * 3. Contract state: price, paused status, active flag
 */

const { ethers } = require('ethers');
const config = require('./sniper_config');

const COMMON_MINT_SIGNATURES = [
  // 0-param standard mints
  "function mint() payable",
  "function publicMint() payable",
  "function claim() payable",
  "function claimFree() payable",
  
  // 1-param quantity/amount mints
  "function mint(uint256 quantity) payable",
  "function publicMint(uint256 quantity) payable",
  "function mint(uint32 quantity) payable",
  "function claim(uint256 quantity) payable",
  "function mintBatch(uint256 quantity) payable",
  
  // 2-param (address minter/recipient, uint256 quantity)
  "function mint(address to, uint256 quantity) payable",
  "function mintTo(address to, uint256 quantity) payable",
  
  // Price and state views
  "function cost() view returns (uint256)",
  "function price() view returns (uint256)",
  "function mintPrice() view returns (uint256)",
  "function maxMintAmount() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function paused() view returns (bool)",
  "function isMintActive() view returns (bool)"
];

async function detectContractMintMethod(contractAddress, chainKey = 'base') {
  const chain = config.CHAINS[chainKey] || config.CHAINS.base;
  const provider = new ethers.JsonRpcProvider(chain.rpc[0]);

  // Verify bytecode
  const code = await provider.getCode(contractAddress);
  if (!code || code === '0x') {
    return { success: false, error: "Address is not a deployed contract on this chain." };
  }

  // Check OpenSea SeaDrop contract registration
  const seadropAddr = config.SEADROP_ADDRESSES[chain.id];
  let isSeaDrop = false;
  if (seadropAddr) {
    try {
      const seadrop = new ethers.Contract(seadropAddr, config.SEADROP_ABI, provider);
      const pub = await seadrop.getPublicDrop(contractAddress);
      if (pub && pub.startTime > 0n) {
        isSeaDrop = true;
      }
    } catch (e) {}
  }

  if (isSeaDrop) {
    return {
      success: true,
      type: "SEADROP",
      targetAddress: seadropAddr,
      nftContract: contractAddress,
      note: "Standard OpenSea SeaDrop Drop"
    };
  }

  // Scan bytecode against standard mint selectors
  const detectedMethods = [];
  let detectedPrice = 0n;
  let isPaused = false;

  for (const sig of COMMON_MINT_SIGNATURES) {
    const selector = ethers.id(sig).slice(0, 10);
    if (code.includes(selector.slice(2))) {
      detectedMethods.push(sig);
    }
  }

  // Try reading price
  const testContract = new ethers.Contract(contractAddress, COMMON_MINT_SIGNATURES, provider);
  for (const fn of ['cost', 'price', 'mintPrice']) {
    try {
      const p = await testContract[fn]();
      detectedPrice = p;
      break;
    } catch (e) {}
  }

  // Check paused state
  for (const fn of ['paused', 'isMintActive']) {
    try {
      const active = await testContract[fn]();
      if (fn === 'paused') isPaused = active;
      if (fn === 'isMintActive') isPaused = !active;
    } catch (e) {}
  }

  return {
    success: true,
    type: "CUSTOM_CONTRACT",
    contractAddress: contractAddress,
    methodsFound: detectedMethods,
    estimatedPriceEth: ethers.formatEther(detectedPrice),
    isPaused: isPaused
  };
}

module.exports = {
  detectContractMintMethod,
  COMMON_MINT_SIGNATURES
};
