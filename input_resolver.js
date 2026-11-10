/**
 * Target Resolver
 * Accepts a raw 0x contract address OR any NFT / mint link
 * (OpenSea, Basescan, Etherscan, Zora, Manifold, custom mint sites)
 * and turns it into a contract address + chain hint.
 */

const { ethers } = require('ethers');

const ADDR_RE = /0x[a-fA-F0-9]{40}/g;

const CHAIN_URL_HINTS = [
  { key: 'base', re: /\/(base|8453)\//i },
  { key: 'ethereum', re: /\/(ethereum|eth|mainnet|1)\//i },
  { key: 'robinhood', re: /\/robinhood\//i },
  { key: 'ink', re: /\/ink\//i }
];

const CHAIN_WORD_HINTS = [
  { key: 'base', re: /\bbase\b|opensea\.io\/base|basescan/i },
  { key: 'robinhood', re: /robinhood/i },
  { key: 'ink', re: /\bink\b/i },
  { key: 'ethereum', re: /ethereum|etherscan|mainnet/i }
];

function isAddress(s) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(s).trim());
}

function isUrl(s) {
  return /^https?:\/\//i.test(String(s).trim());
}

function firstAddress(s) {
  const m = String(s).match(ADDR_RE);
  return m ? m[0] : null;
}

function detectChain(text) {
  const t = String(text || '');
  for (const h of CHAIN_URL_HINTS) if (h.re.test(t)) return h.key;
  for (const h of CHAIN_WORD_HINTS) if (h.re.test(t)) return h.key;
  return null;
}

function checksum(addr) {
  try { return ethers.getAddress(addr); } catch { /* fall through */ }
  try { return ethers.getAddress(String(addr).toLowerCase()); } catch { return addr; }
}

function fetchText(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, {
    signal: ctrl.signal,
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9'
    }
  }).then(async r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }).finally(() => clearTimeout(timer));
}

// Addresses that are never the NFT contract we want.
const IGNORE = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0x4200000000000000000000000000000000000006', // WETH on Base
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH on Ethereum
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC on Base
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on Ethereum
  '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789'  // EntryPoint
].map(a => a.toLowerCase()));

/** Look for an address that a page explicitly labels as the contract. */
function labelledAddress(html) {
  const clean = html.replace(/\\"/g, '"').replace(/\\u002F/g, '/');
  const patterns = [
    /"contractAddress"\s*:\s*"(0x[a-fA-F0-9]{40})"/,
    /"contract_address"\s*:\s*"(0x[a-fA-F0-9]{40})"/,
    /"nftContract"\s*:\s*"(0x[a-fA-F0-9]{40})"/,
    /"nft_contract_address"\s*:\s*"(0x[a-fA-F0-9]{40})"/,
    /"tokenAddress"\s*:\s*"(0x[a-fA-F0-9]{40})"/,
    /"address"\s*:\s*"(0x[a-fA-F0-9]{40})","telegramUrl"/,
    /"address"\s*:\s*"(0x[a-fA-F0-9]{40})"/,
    /contract\s*address[^0-9a-fA-F]{0,40}(0x[a-fA-F0-9]{40})/i,
    /nft\s*contract[^0-9a-fA-F]{0,40}(0x[a-fA-F0-9]{40})/i
  ];
  for (const re of patterns) {
    const m = clean.match(re);
    if (m && m[1] && !IGNORE.has(m[1].toLowerCase())) return m[1];
  }
  return null;
}

/** Most repeated plausible address, used when nothing is labelled. */
function frequentAddress(html) {
  const found = (html.match(ADDR_RE) || []).filter(a => !IGNORE.has(a.toLowerCase()));
  const counts = {};
  found.forEach(a => { const k = a.toLowerCase(); counts[k] = (counts[k] || 0) + 1; });
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ranked.length && ranked[0][1] >= 3 && (ranked.length === 1 || ranked[0][1] >= ranked[1][1] * 2)) {
    return ranked[0][0];
  }
  return null;
}

/** Chain stated inside the page payload, e.g. "chain":"base". */
function pageChain(html) {
  const clean = String(html).replace(/\\+"/g, '"');
  const m = clean.match(/"chain(?:Identifier)?"\s*:\s*"(ethereum|base|robinhood|ink|matic|polygon|arbitrum|optimism)"/i);
  if (!m) return null;
  const v = m[1].toLowerCase();
  if (v === 'matic' || v === 'polygon' || v === 'arbitrum' || v === 'optimism') return null;
  return v;
}

/** Last resort: if the page mentions exactly one plausible address, use it. */
function onlyAddress(html) {
  const found = (html.match(ADDR_RE) || []).filter(a => !IGNORE.has(a.toLowerCase()));
  const unique = [...new Set(found.map(a => a.toLowerCase()))];
  return unique.length === 1 ? unique[0] : null;
}

/**
 * Resolve user input to { ok, address, chain, source } or { ok:false, error }.
 */
async function resolveTarget(input, opts = {}) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'Nothing entered.' };

  if (isAddress(raw)) {
    return { ok: true, address: checksum(raw), chain: null, source: 'address' };
  }

  const inline = firstAddress(raw);
  if (inline) {
    return {
      ok: true,
      address: checksum(inline),
      chain: detectChain(raw),
      source: isUrl(raw) ? 'link' : 'text'
    };
  }

  if (!isUrl(raw)) {
    return { ok: false, error: 'No contract address found. Paste the 0x… contract address or an OpenSea / mint link.' };
  }

  const chain = detectChain(raw);
  try {
    const html = await fetchText(raw);
    const found = labelledAddress(html) || frequentAddress(html);
    if (found) {
      return {
        ok: true,
        address: checksum(found),
        chain: chain || pageChain(html),
        source: 'page'
      };
    }
    return {
      ok: false,
      error: 'This page did not show a contract address. Open the NFT page and copy its 0x… address instead.'
    };
  } catch (err) {
    return {
      ok: false,
      error: `Could not read that link (${err.message}). Paste the 0x… contract address instead.`,
      chain
    };
  }
}

module.exports = { resolveTarget, isAddress, isUrl, detectChain, firstAddress };