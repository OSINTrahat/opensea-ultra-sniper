/**
 * OpenSea Drop Inspector & Eligibility Verifier
 * Extracts NFT Contract, SeaDrop Stages (GTD, FCFS, Public), Wallet Balances, and Fee Readiness.
 */

const { ethers } = require('ethers');
const config = require('./sniper_config');

function parseOpenSeaUrl(url) {
  const clean = url.trim().replace(/\/$/, "");
  const parts = clean.split('/');
  const colIdx = parts.indexOf('collection');
  if (colIdx !== -1 && parts[colIdx + 1]) {
    return parts[colIdx + 1];
  }
  return clean;
}

async function inspectDrop(nftContractAddress, chainKey = 'base', targetWallets = []) {
  const chain = config.CHAINS[chainKey] || config.CHAINS.base;
  const provider = new ethers.JsonRpcProvider(chain.rpc[0]);
  const seadropAddr = config.SEADROP_ADDRESSES[chain.id];

  const seadrop = new ethers.Contract(seadropAddr, config.SEADROP_ABI, provider);

  let publicDrop = null;
  let allowListDrop = null;

  try {
    publicDrop = await seadrop.getPublicDrop(nftContractAddress);
  } catch (e) {}

  try {
    allowListDrop = await seadrop.getAllowListMintSchedule(nftContractAddress);
  } catch (e) {}

  const nowSec = Math.floor(Date.now() / 1000);
  const phases = [];

  // 1. Allowlist / GTD / FCFS Stage
  if (allowListDrop && allowListDrop.startTime > 0n) {
    const start = Number(allowListDrop.startTime);
    const end = Number(allowListDrop.endTime);
    let status = "ENDED";
    if (nowSec < start) {
      status = `UPCOMING (${start - nowSec}s)`;
    } else if (nowSec >= start && nowSec < end) {
      status = "ACTIVE";
    }

    phases.push({
      phaseName: "Allowlist / GTD / FCFS",
      priceEth: `${ethers.formatEther(allowListDrop.mintPrice)} ETH`,
      startTime: new Date(start * 1000).toLocaleString(),
      endTime: new Date(end * 1000).toLocaleString(),
      maxPerWallet: Number(allowListDrop.maxTotalMintableByWallet),
      status: status,
      rawStart: start,
      rawEnd: end
    });
  }

  // 2. Public Stage
  if (publicDrop && publicDrop.startTime > 0n) {
    const start = Number(publicDrop.startTime);
    const end = Number(publicDrop.endTime);
    let status = "ENDED";
    if (nowSec < start) {
      status = `UPCOMING (${start - nowSec}s)`;
    } else if (nowSec >= start && nowSec < end) {
      status = "ACTIVE";
    }

    phases.push({
      phaseName: "Public Mint",
      priceEth: `${ethers.formatEther(publicDrop.mintPrice)} ETH`,
      startTime: new Date(start * 1000).toLocaleString(),
      endTime: new Date(end * 1000).toLocaleString(),
      maxPerWallet: Number(publicDrop.maxTotalMintableByWallet),
      status: status,
      rawStart: start,
      rawEnd: end
    });
  }

  // Evaluate each wallet
  const walletEligibility = [];
  for (const w of targetWallets) {
    if (!w.address) continue;

    let mintedSoFar = 0;
    try {
      const stats = await seadrop.getMintStats(nftContractAddress, w.address);
      mintedSoFar = Number(stats.minterNumMinted);
    } catch (e) {}

    const balWei = await provider.getBalance(w.address);
    const ethBal = parseFloat(ethers.formatEther(balWei));

    let targetPhase = phases.find(p => p.status === "ACTIVE") || phases.find(p => p.status.startsWith("UPCOMING")) || phases[0];
    let slot = targetPhase ? targetPhase.phaseName : "Public";
    let requiredPrice = targetPhase ? parseFloat(targetPhase.priceEth) : 0;

    const hasEnoughBalance = ethBal >= requiredPrice;

    walletEligibility.push({
      id: w.id,
      name: w.name,
      address: w.address,
      targetSlot: slot,
      mintedCount: mintedSoFar,
      currentBalance: `${ethBal.toFixed(5)} ${chain.symbol}`,
      pricePerMint: `${requiredPrice} ${chain.symbol}`,
      hasFee: hasEnoughBalance ? 'YES' : 'NO',
      readyToSnipe: hasEnoughBalance ? 'READY' : 'INSUFFICIENT_FUNDS'
    });
  }

  return {
    chain: chain.name,
    chainId: chain.id,
    nftContract: nftContractAddress,
    seadropAddress: seadropAddr,
    phases,
    wallets: walletEligibility
  };
}

module.exports = {
  parseOpenSeaUrl,
  inspectDrop
};
