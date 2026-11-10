/**
 * Terminal UI Formatter & Color Suite
 * Clean, modern, high-contrast ANSI formatting without heavy external dependencies.
 */

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  
  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  
  // Bright foreground
  bRed: "\x1b[91m",
  bGreen: "\x1b[92m",
  bYellow: "\x1b[93m",
  bBlue: "\x1b[94m",
  bMagenta: "\x1b[95m",
  bCyan: "\x1b[96m",
  bWhite: "\x1b[97m",
  
  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
  bgDarkGray: "\x1b[100m"
};

const ui = {
  c,

  banner() {
    console.log(`
${c.bCyan}${c.bold}+==============================================================================+
|                                                                              |
|   ${c.bWhite}OPENSEA SEADROP & MULTI-CHAIN ULTRA SNIPER${c.bCyan}   ${c.bGreen}[v1.0.0]${c.bCyan}                   |
|   ${c.gray}Zero-Latency In-Memory Pre-Signing * Multi-RPC Racing * Atomic Pre-Fire    ${c.bCyan}|
|                                                                              |
+==============================================================================+${c.reset}`);
  },

  section(title) {
    const totalLen = 78;
    const titlePart = `=== [ ${title} ] `;
    const rem = Math.max(4, totalLen - titlePart.length);
    console.log(`\n${c.bCyan}${c.bold}=== [ ${c.bWhite}${title}${c.bCyan} ] ${"=".repeat(rem)}${c.reset}\n`);
  },

  divider() {
    console.log(`${c.gray}${"-".repeat(78)}${c.reset}`);
  },

  badge(text) {
    const t = String(text).toUpperCase();
    if (t === 'ACTIVE' || t === 'READY' || t === 'YES' || t === 'SUCCESS' || t === 'TRUE') {
      return `${c.bgGreen}${c.bold}${c.black} ${text} ${c.reset}`;
    }
    if (t.includes('UPCOMING')) {
      return `${c.bgCyan}${c.bold}${c.black} ${text} ${c.reset}`;
    }
    if (t === 'PAUSED' || t === 'WARN' || t === 'WAITING') {
      return `${c.bgYellow}${c.bold}${c.black} ${text} ${c.reset}`;
    }
    if (t === 'ENDED' || t === 'NO' || t === 'ERROR' || t === 'FALSE' || t.includes('FAIL') || t.includes('INSUFFICIENT')) {
      return `${c.bgRed}${c.bold}${c.white} ${text} ${c.reset}`;
    }
    if (t === 'NO_KEY' || t === 'INACTIVE') {
      return `${c.bgDarkGray}${c.white} ${text} ${c.reset}`;
    }
    return `${c.bgBlue}${c.bold}${c.white} ${text} ${c.reset}`;
  },

  infoRow(label, value, valColor = c.bWhite) {
    const padLabel = label.padEnd(18, ' ');
    console.log(`  ${c.cyan}${padLabel}${c.reset} :  ${valColor}${value}${c.reset}`);
  },

  log(level, msg) {
    const lvl = level.toUpperCase();
    let prefix = `${c.cyan}[INFO]${c.reset}`;
    if (lvl === 'OK' || lvl === 'SUCCESS') prefix = `${c.bGreen}[OK]${c.reset}`;
    if (lvl === 'WARN') prefix = `${c.bYellow}[WARN]${c.reset}`;
    if (lvl === 'ERROR' || lvl === 'FAIL') prefix = `${c.bRed}[ERROR]${c.reset}`;
    if (lvl === 'TRIGGER') prefix = `${c.bgMagenta}${c.bold}${c.bWhite} [TRIGGER] ${c.reset}`;
    if (lvl === 'ARMED') prefix = `${c.bGreen}${c.bold}[ARMED]${c.reset}`;
    if (lvl === 'GAS') prefix = `${c.bMagenta}[GAS]${c.reset}`;

    console.log(`${prefix} ${msg}`);
  }
};

module.exports = ui;
