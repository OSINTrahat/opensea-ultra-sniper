# OpenSea SeaDrop & Multi-Chain Ultra-Fast Mint Sniper

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node: >=18.0.0](https://img.shields.io/badge/Node->=18.0.0-green.svg)](https://nodejs.org/)
[![Protocol: SeaDrop_v1](https://img.shields.io/badge/Protocol-SeaDrop_v1-orange.svg)](https://opensea.io)
[![Architecture: Multi--Node_Racing](https://img.shields.io/badge/Architecture-Multi--Node_Racing-purple.svg)]()

High-frequency, institutional-grade automated minting suite engineered to execute sub-second transactions on OpenSea SeaDrop V1 contracts and generic Web3 smart contracts. Designed to outperform conventional minting scripts through in-memory cryptographic pre-signing, multi-RPC racing, and atomic countdown synchronization.

---

## Table of Contents
1. [Architectural Overview & Competitive Edge](#architectural-overview--competitive-edge)
2. [Supported Networks](#supported-networks)
3. [Prerequisites & System Requirements](#prerequisites--system-requirements)
4. [Installation & Setup](#installation--setup)
5. [Wallet Configuration (5-Wallet Modular Architecture)](#wallet-configuration-5-wallet-modular-architecture)
6. [Detailed Command Reference](#detailed-command-reference)
   - [1. Wallet Key Management (`set-wallet`)](#1-wallet-key-management-set-wallet)
   - [2. Multi-Chain Balance Query (`wallets`)](#2-multi-chain-balance-query-wallets)
   - [3. Real-Time Network Gas & Gwei Tracker (`gas`)](#3-real-time-network-gas--gwei-tracker-gas)
   - [4. Contract & Drop Inspection (`inspect`)](#4-contract--drop-inspection-inspect)
   - [5. Atomic Sniper Execution (`snipe`)](#5-atomic-sniper-execution-snipe)
7. [Mint Capacity & Quantity Handling](#mint-capacity--quantity-handling)
8. [High-Performance VPS Deployment Guide (Sub-5ms Latency)](#high-performance-vps-deployment-guide-sub-5ms-latency)
9. [Safety Interlocks & Risk Controls](#safety-interlocks--risk-controls)
10. [Troubleshooting & Error Codes](#troubleshooting--error-codes)
11. [Security Principles](#security-principles)
12. [License & Disclaimer](#license--disclaimer)

---

## Architectural Overview & Competitive Edge

Conventional minting bots and browser extensions typically fail during competitive public drops for three structural reasons:
1. **Cryptographic Signing Delay:** Standard tools wait until the block timestamp opens before assembling and signing the transaction, which introduces a 200msâ€“500ms cryptographic CPU bottleneck.
2. **Single-RPC Chokepoints:** Sending transactions to a single RPC node exposes the caller to dropped packets, rate-limiting, and network propagation delays.
3. **Mempool Latency:** Submitting after the block opens guarantees placement in subsequent blocks or behind competitive MEV/searcher transactions.

### How OpenSea Ultra Sniper Solves This:
```
+-----------------------------------------------------------------------------------+
|                         COUNTDOWN PHASE (T - 60s to T - 2s)                       |
|  - Fetch live drop schedule & contract bytecode                                   |
|  - Pre-encode transaction payload (SeaDrop ABI or custom mint signature)          |
|  - Cryptographically PRE-SIGN raw hex transactions in memory for all 5 wallets   |
|  - Stream live Base Fee & calculate 25% priority gas tip                          |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                           SAFETY INTERLOCK (T - 2s)                               |
|  - Verify live contract price has not mutated                                     |
|  - Verify drop schedule start time has not been delayed                           |
|  - Abort instantly if adverse modification detected                               |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                         ATOMIC PRE-FIRE BUFFER (T - 50ms)                         |
|  - 15ms high-frequency polling loop reaches 50ms trigger buffer                   |
|  - Multi-Node Broadcaster blasts signed payloads simultaneously to 3-4 RPCs       |
|  - First responding RPC commits payload to mempool -> Top-of-Block Inclusion      |
+-----------------------------------------------------------------------------------+
```

---

## Supported Networks

The suite natively supports the following EVM networks with pre-configured high-throughput RPC endpoints:

| Network | Chain ID | Native Currency | SeaDrop V1 Address | Supported Protocol |
| :--- | :---: | :---: | :---: | :--- |
| **Ethereum Mainnet** | `1` | ETH | `0x00005EA00Ac477B1030CE78506496665451e930B` | SeaDrop V1 / Custom Contracts |
| **Base Mainnet** | `8453` | ETH | `0x00005EA00Ac477B1030CE78506496665451e930B` | SeaDrop V1 / Custom Contracts |
| **Robinhood Chain** | `48` | ETH | `0x00005EA00Ac477B1030CE78506496665451e930B` | SeaDrop V1 / Custom Contracts |
| **Ink Chain** | `57073` | ETH | `0x00005EA00Ac477B1030CE78506496665451e930B` | SeaDrop V1 / Custom Contracts |

---

## Prerequisites & System Requirements

- **Operating System:** Linux (Ubuntu 20.04+, Debian 11+ recommended for VPS), macOS, or Windows 10/11.
- **Node.js Environment:** Version `18.0.0` or higher (`node -v`).
- **Package Manager:** `npm` (included with Node.js) or `yarn`.
- **Git:** Version `2.30+` installed.

---

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/OSINTrahat/opensea-ultra-sniper.git
cd opensea-ultra-sniper
```

### 2. Install Node.js Dependencies
```bash
npm install
```
This installs the required `ethers` (v6) library and necessary runtime bindings.

---

## Wallet Configuration (5-Wallet Modular Architecture)

The system supports up to **5 independent wallets** stored locally in `wallets.json`.
> **Security Notice:** `wallets.json` is strictly ignored by `.gitignore` and is never committed to GitHub.

Configure your wallets using the command line:

```bash
# Configure Wallet 1
node cli.js set-wallet 1 0xYOUR_PRIVATE_KEY_1

# Configure Wallet 2
node cli.js set-wallet 2 0xYOUR_PRIVATE_KEY_2

# Configure Wallet 3
node cli.js set-wallet 3 0xYOUR_PRIVATE_KEY_3

# Configure Wallet 4
node cli.js set-wallet 4 0xYOUR_PRIVATE_KEY_4

# Configure Wallet 5
node cli.js set-wallet 5 0xYOUR_PRIVATE_KEY_5
```

---

## Detailed Command Reference

### 1. Wallet Key Management (`set-wallet`)
Stores or updates the private key for an allocated wallet slot (1 through 5). Automatically derives and prints the public checksum address.

```bash
node cli.js set-wallet <walletId: 1-5> <privateKey>
```
**Example:**
```bash
node cli.js set-wallet 1 0x4f3edf983ac636a65a842ce7c78d5aa706d41cdc168f8364ff0d58a975183388
```
**Output:**
```
[OK] Wallet 1 successfully configured -> Address: 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1
```

---

### 2. Multi-Chain Balance Query (`wallets`)
Queries real-time native ETH balances across all 5 wallets on the specified chain.

```bash
node cli.js wallets [chain: ethereum | base | robinhood | ink]
```
*(Default chain: `base`)*

**Example:**
```bash
node cli.js wallets base
```
**Output Table:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ ID      â”‚ Name       â”‚ Address                                    â”‚ Balance     â”‚ Status â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ 1       â”‚ Wallet 1   â”‚ 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1 â”‚ 0.04500 ETH â”‚ ACTIVE â”‚
â”‚ 2       â”‚ Wallet 2   â”‚ 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0 â”‚ 0.02100 ETH â”‚ ACTIVE â”‚
â”‚ 3       â”‚ Wallet 3   â”‚ 0x22d491Bde2303f2f13385b1E34952F2285b24471 â”‚ 0.01500 ETH â”‚ ACTIVE â”‚
â”‚ 4       â”‚ Wallet 4   â”‚ Not configured                             â”‚ 0.00000 ETH â”‚ INACTIVEâ”‚
â”‚ 5       â”‚ Wallet 5   â”‚ Not configured                             â”‚ 0.00000 ETH â”‚ INACTIVEâ”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

### 3. Real-Time Network Gas & Gwei Tracker (`gas`)
Streams live network Base Fee, Priority Fee, and estimated gas cost per mint. Automatically polls every 2.5 seconds with zero-lag RPC failover.

```bash
node cli.js gas [chain: ethereum | base | robinhood | ink]
```

**Example:**
```bash
node cli.js gas base
```
**Output Stream:**
```
[INFO] Streaming network gas updates for BASE (Press Ctrl+C to terminate)...
[12:04:15 AM] Base: 0.011 Gwei | Priority: 0.005 Gwei | Est. Mint Gas: ~0.000002 ETH
[12:04:17 AM] Base: 0.011 Gwei | Priority: 0.005 Gwei | Est. Mint Gas: ~0.000002 ETH
[12:04:20 AM] Base: 0.012 Gwei | Priority: 0.006 Gwei | Est. Mint Gas: ~0.000002 ETH
```

---

### 4. Contract & Drop Inspection (`inspect`)
Analyzes target contracts before minting.
- **For OpenSea SeaDrop:** Automatically parses and tabulates **every scheduled drop phase** (GTD Allowlist, FCFS, Public Stage), mint prices, start/end dates, wallet mint stats, and evaluates wallet fee readiness.
- **For Custom Web3 Contracts:** Analyzes bytecode to detect standard mint function signatures (`mint()`, `claim()`, `publicMint(uint256)`), checks paused state, and evaluates pricing.

```bash
node cli.js inspect <contractAddress> [chain]
```

**Example:**
```bash
node cli.js inspect 0x1234567890abcdef1234567890abcdef12345678 base
```

**Output:**
```
======================== DROP METADATA ========================
Network:     Base Mainnet (Chain ID: 8453)
Contract:    0x1234567890abcdef1234567890abcdef12345678
Protocol:    OpenSea SeaDrop (0x00005EA00Ac477B1030CE78506496665451e930B)
Network Gas: 0.011 Gwei (~0.000002 ETH per mint)

=================== DROP SCHEDULE (ALL PHASES) ===================
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Phase   â”‚ Name                   â”‚ Price    â”‚ StartTime            â”‚ EndTime              â”‚ MaxPerWallet â”‚ Status             â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ #1      â”‚ Allowlist / GTD / FCFS â”‚ 0.000 ETHâ”‚ 11/11/2026, 12:00 AM â”‚ 11/11/2026, 12:30 AM â”‚ 1            â”‚ UPCOMING (120s)    â”‚
â”‚ #2      â”‚ Public Mint            â”‚ 0.005 ETHâ”‚ 11/11/2026, 12:30 AM â”‚ 11/12/2026, 12:00 AM â”‚ 3            â”‚ UPCOMING (1920s)   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

================== WALLET READINESS & BALANCES ==================
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Wallet   â”‚ Address                                    â”‚ TargetPhase            â”‚ Balance     â”‚ MintPrice  â”‚ HasFee â”‚ Readiness â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ 1: W1    â”‚ 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1 â”‚ Allowlist / GTD / FCFS â”‚ 0.04500 ETH â”‚ 0.000 ETH  â”‚ YES    â”‚ READY     â”‚
â”‚ 2: W2    â”‚ 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0 â”‚ Allowlist / GTD / FCFS â”‚ 0.02100 ETH â”‚ 0.000 ETH  â”‚ YES    â”‚ READY     â”‚
â”‚ 3: W3    â”‚ 0x22d491Bde2303f2f13385b1E34952F2285b24471 â”‚ Allowlist / GTD / FCFS â”‚ 0.01500 ETH â”‚ 0.000 ETH  â”‚ YES    â”‚ READY     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

### 5. Atomic Sniper Execution (`snipe`)
Arms pre-signed transactions, tracks live gas continuously during countdown, and fires at the 50ms pre-fire buffer across all configured RPC nodes.

#### Mode A: 5-Wallet Parallel Burst (Recommended)
Blasts transactions simultaneously across all configured wallets.
```bash
node cli.js snipe <contractAddress> <chain> all
```
**Example:**
```bash
node cli.js snipe 0x1234567890abcdef1234567890abcdef12345678 base all
```

#### Mode B: Single Target Wallet
Executes the snipe using only a specific wallet slot (e.g. Wallet 1).
```bash
node cli.js snipe <contractAddress> <chain> 1
```

**Execution Flow Output:**
```
[INFO] Configured 3 active wallet(s) for simultaneous parallel blast.
[GAS] Network Gas: 0.011 Gwei | Est Fee: ~0.000002 ETH
[INFO] Inspecting target contract on BASE...
[INFO] Arming and pre-signed raw transactions...
[ARMED] Target Contract: 0x1234567890abcdef1234567890abcdef12345678
[ARMED] Locked Price: 0.000 ETH
[ARMED] Scheduled Time: 11/11/2026, 12:30:00 AM
[INFO] Sniper engine armed. Active Wallets: 3

[COUNTDOWN] 4.2s remaining | Live Gas: [0.011 Gwei]
[COUNTDOWN] 1.1s remaining | Live Gas: [0.012 Gwei]

[TRIGGER] Blasting 3 transaction(s) across multi-node RPCs...
[OK] [Wallet 1] Accepted in 42ms | Hash: 0x93b7482618ec...
[OK] [Wallet 2] Accepted in 45ms | Hash: 0x29ef90a182b3...
[OK] [Wallet 3] Accepted in 48ms | Hash: 0x55aa029cd410...

======================== SNIPE EXECUTION RESULTS ========================
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Success â”‚ Wallet   â”‚ Hash                                                               â”‚ Latency   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ true    â”‚ Wallet 1 â”‚ 0x93b7482618ecbf542c385fa8145719ab23c4a259c73ef8902d847183efba098 â”‚ 42ms      â”‚
â”‚ true    â”‚ Wallet 2 â”‚ 0x29ef90a182b3dc182746f39185a73b4009f48ca179475185938bf82384a838  â”‚ 45ms      â”‚
â”‚ true    â”‚ Wallet 3 â”‚ 0x55aa029cd4108849b287582b185938a18357492c10958371948572837109b8  â”‚ 48ms      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Mint Capacity & Quantity Handling

### How many NFTs can be minted?
1. **Quantity Per Transaction:**
   - The engine defaults to minting `1` token per wallet to minimize execution failure risk from contract caps.
   - For contracts with higher allowances (e.g. 2, 5, or 10 per wallet), you can adjust the quantity parameter directly in `snipe_engine.js`.
2. **Parallel Wallet Multiplier:**
   - By enabling all 5 wallets (`all`), the bot multiplies your total allocation:
     $$\text{Total Minted} = 5 \times (\text{Quantity per Wallet})$$
   - E.g., if a drop allows 2 NFTs per wallet, running 5 wallets will capture **10 NFTs** in the exact same block.
3. **Contract Restrictions (`maxTotalMintableByWallet`):**
   - The `inspect` command automatically queries `getMintStats()` to determine if any of your configured wallets have already minted part of their quota.

---

## High-Performance VPS Deployment Guide (Sub-5ms Latency)

For the fastest possible execution, run this suite on a cloud VPS located close to major Web3 node providers (e.g. Frankfurt, London, or Virginia):

### Quick VPS Setup (Ubuntu/Debian):
```bash
# 1. Update system packages
sudo apt update && sudo apt install -y git curl

# 2. Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Clone repository
git clone https://github.com/OSINTrahat/opensea-ultra-sniper.git
cd opensea-ultra-sniper
npm install

# 4. Set your wallets
node cli.js set-wallet 1 <PRIVATE_KEY>

# 5. Run under TMUX or SCREEN (keeps session alive if SSH disconnects)
tmux new -s sniper
node cli.js snipe <CONTRACT_ADDRESS> base all
# Detach with: Ctrl+B then D
```

---

## Safety Interlocks & Risk Controls

To protect users against common on-chain exploits and ninja changes by project owners, the engine implements automated guards:

1. **Price Modification Guard:**
   - Exactly 2 seconds before drop opening, the bot queries the on-chain contract. If the price in the contract differs from the pre-signed price, the bot immediately aborts execution.
2. **Schedule Mutation Guard:**
   - If project administrators postpone or advance the drop start time while the countdown is running, execution aborts to prevent wasting gas fees on reverted calls.
3. **Nonce Conflict Mitigation:**
   - When arming transactions, pending nonces are fetched with priority to avoid replacement transaction stalls.

---

## Troubleshooting & Error Codes

| Error Message | Cause | Resolution |
| :--- | :--- | :--- |
| `SAFETY_ABORT: Price modified...` | Contract owner altered mint price before launch. | Run `inspect` to check new price; re-arm if acceptable. |
| `INSUFFICIENT_FUNDS` | Wallet balance is lower than mint price + priority gas tip. | Fund wallet with native ETH on the target chain. |
| `All RPC nodes failed for chain...` | Temporary DNS or public RPC network rate-limit. | Add custom private RPCs (Alchemy, Infura, QuickNode) in `sniper_config.js`. |
| `Address is not a deployed contract` | Incorrect address or wrong chain selected. | Verify the contract address and network parameter (e.g., `base`, `ink`, `ethereum`). |

---

## Security Principles

- **No Remote Telemetry:** The bot does not transmit private keys, balances, or configuration data to any external server. All communication occurs strictly between your machine and official blockchain RPC nodes.
- **Git Exclusions:** `wallets.json` is hard-coded into `.gitignore`. Never use `git add -f wallets.json`.
- **Dedicated Sniper Wallets:** Always use dedicated burner or sub-wallets with only the necessary ETH balance required for the specific mint. Never store primary holding vaults on automated trading servers.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Disclaimer

This software is provided for educational and automated testing purposes. Blockchain transactions are irreversible and gas fees are non-refundable. Always verify contract addresses, mint prices, and network conditions before executing transactions. The developers assume no liability for financial loss resulting from on-chain execution.
