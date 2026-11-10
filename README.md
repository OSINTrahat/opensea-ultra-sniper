# OpenSea & Multi-Chain Ultra-Fast Mint Sniper

High-frequency, institutional-grade automated minting engine designed to execute sub-second transactions on OpenSea SeaDrop V1 and arbitrary Web3 smart contracts across Ethereum, Base, Robinhood, and Ink chains.

---

## Key Architecture & Performance Highlights

1. **Pre-Signed In-Memory Raw Transactions:**
   - Pre-signs transaction payloads before the drop begins. Eliminates cryptographic signing delays at block trigger time.
2. **Multi-Node RPC Racing Broadcaster:**
   - Concurrently broadcasts raw transactions across all configured network RPCs. The earliest node acceptance wins, overcoming single-node network congestion.
3. **Atomic 15ms Polling Loop & 50ms Pre-Fire:**
   - High-precision countdown timer polling at 15ms intervals. Pre-fires payload 50ms before the drop second opens to achieve top-of-block positioning.
4. **Universal Contract Auto-Detection:**
   - Detects OpenSea SeaDrop schedules or extracts generic mint signatures (`mint()`, `publicMint()`, `claim()`, `mint(uint256)`, etc.) directly from contract bytecode.
5. **Real-Time Network Gas & Fee Streaming:**
   - Streams live Base Fee, Priority Fee, and estimated mint gas in ETH continuously before and during countdown execution.
6. **Strict Safety Interlocks:**
   - Performs automated safety checks 2 seconds before launch. Aborts immediately if the mint price changes or if the drop time is postponed.
7. **5-Wallet Modular Architecture:**
   - Supports 5 independent wallet configurations. Execute targeted single-wallet snipes or simultaneous 5-wallet parallel bursts.

---

## Installation & Setup

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/<your-username>/opensea-ultra-sniper.git
cd opensea-ultra-sniper
npm install
```

### 2. Configure Wallets (1 through 5)
Configure private keys for your wallets. Private keys are saved locally in `wallets.json` (which is excluded from Git tracking via `.gitignore`).

```bash
node cli.js set-wallet 1 <PRIVATE_KEY_1>
node cli.js set-wallet 2 <PRIVATE_KEY_2>
node cli.js set-wallet 3 <PRIVATE_KEY_3>
node cli.js set-wallet 4 <PRIVATE_KEY_4>
node cli.js set-wallet 5 <PRIVATE_KEY_5>
```

---

## Usage Commands

### 1. Check Wallet Balances
Check native ETH balances across all 5 wallets on any supported chain (`ethereum`, `base`, `robinhood`, `ink`):
```bash
node cli.js wallets base
node cli.js wallets ethereum
node cli.js wallets ink
```

### 2. Stream Live Gas & Gwei
Monitor real-time network gas price and estimated mint cost:
```bash
node cli.js gas base
node cli.js gas ethereum
```

### 3. Inspect Drop Schedules & Wallet Fee Readiness
Inspect any OpenSea SeaDrop collection or custom contract. Displays all scheduled phases (GTD, FCFS, Public), start/end times, prices, and verifies whether each wallet holds sufficient gas and mint fees:
```bash
node cli.js inspect <CONTRACT_ADDRESS> base
```

### 4. Arm & Execute Atomic Snipe

* **Simultaneous 5-Wallet Burst:**
  ```bash
  node cli.js snipe <CONTRACT_ADDRESS> base all
  ```

* **Single Target Wallet Snipe (e.g., Wallet 1):**
  ```bash
  node cli.js snipe <CONTRACT_ADDRESS> base 1
  ```

---

## Supported Networks

| Chain | Chain ID | Native Currency | Standard Protocol |
| :--- | :--- | :--- | :--- |
| **Ethereum Mainnet** | `1` | ETH | SeaDrop V1 / Custom Contracts |
| **Base Mainnet** | `8453` | ETH | SeaDrop V1 / Custom Contracts |
| **Robinhood Chain** | `48` | ETH | SeaDrop V1 / Custom Contracts |
| **Ink Chain** | `57073` | ETH | SeaDrop V1 / Custom Contracts |

---

## Security Notice

- Never commit `wallets.json` or `.env` files to public version control.
- Ensure all target wallets contain enough native ETH to cover both the mint price and the priority gas fee before arming the sniper.
