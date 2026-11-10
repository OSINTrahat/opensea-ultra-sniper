/**
 * Terminal UI Formatter & Color Suite (Bloomberg / DeFi Institutional Edition)
 * Dense, data-rich ANSI terminal layouts with crisp borders, status badges, and latency tables.
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
${c.bCyan}================================================================================${c.reset}
  ${c.bWhite}${c.bold}OPENSEA SEADROP & MULTI-CHAIN ULTRA SNIPER${c.reset}  ${c.bgCyan}${c.black}${c.bold} v1.0.0 ${c.reset}  ${c.bGreen}[INSTITUTIONAL]${c.reset}
  ${c.gray}ARCHITECTURE : Zero-Latency In-Memory Pre-Signing | Multi-Node Mempool Racing${c.reset}
  ${c.gray}MEV RELAYS   : Flashbots Protect Private Bundle Routing | Cold Vault Delivery${c.reset}
${c.bCyan}================================================================================${c.reset}`);
  },

  hudBar(chain = 'BASE', mev = 'ACTIVE', nodes = '3 RACING', speed = 'TURBO') {
    const bar = `SYS: ONLINE | NET: ${chain.toUpperCase()} | MEV: ${mev} | RPC: ${nodes} | TIER: ${speed.toUpperCase()}`;
    console.log(`\n${c.bCyan}================================================================================${c.reset}`);
    console.log(`  ${c.bWhite}${c.bold}${bar}${c.reset}`);
    console.log(`${c.bCyan}================================================================================${c.reset}`);
  },

  section(title) {
    const line = "=".repeat(Math.max(4, 76 - title.length));
    console.log(`\n${c.bCyan}==[ ${c.bWhite}${c.bold}${title}${c.bCyan} ]${line}${c.reset}\n`);
  },

  divider() {
    console.log(`${c.gray}${"-".repeat(80)}${c.reset}`);
  },

  badge(text) {
    const t = String(text).toUpperCase();
    if (t === 'ACTIVE' || t === 'READY' || t === 'YES' || t === 'SUCCESS' || t === 'TRUE') {
      return `${c.bGreen}${c.bold}[ OK:READY ]${c.reset}`;
    }
    if (t.includes('UPCOMING')) {
      return `${c.bCyan}[ UPCOMING ]${c.reset}`;
    }
    if (t === 'PAUSED' || t === 'WARN' || t === 'WAITING') {
      return `${c.bYellow}[ WAITING ]${c.reset}`;
    }
    if (t === 'ENDED' || t === 'NO' || t === 'ERROR' || t === 'FALSE' || t.includes('FAIL') || t.includes('INSUFFICIENT')) {
      return `${c.bRed}${c.bold}[ REJECTED ]${c.reset}`;
    }
    if (t === 'NO_KEY' || t === 'INACTIVE') {
      return `${c.gray}[ NOT_SET ]${c.reset}`;
    }
    return `${c.cyan}[ ${text} ]${c.reset}`;
  },

  infoRow(label, value, valColor = c.bWhite) {
    const padLabel = label.padEnd(20, ' ');
    console.log(`  ${c.cyan}${padLabel}${c.reset} :  ${valColor}${value}${c.reset}`);
  },

  renderTable(headers, rows) {
    if (!rows || rows.length === 0) {
      console.log(`  ${c.gray}(No records found)${c.reset}`);
      return;
    }

    // Calculate maximum width for each column
    const colWidths = headers.map((h, i) => {
      let max = h.length;
      rows.forEach(r => {
        const str = r[i] !== undefined && r[i] !== null ? String(r[i]).replace(/\x1b\[[0-9;]*m/g, '') : '';
        if (str.length > max) max = str.length;
      });
      return max + 2; // padding
    });

    const border = '+' + colWidths.map(w => '-'.repeat(w)).join('+') + '+';

    console.log(`  ${c.bCyan}${border}${c.reset}`);
    
    // Header row
    const headerLine = '|' + headers.map((h, i) => {
      return ` ${c.bold}${c.bYellow}${h.padEnd(colWidths[i] - 1, ' ')}${c.reset}`;
    }).join(`${c.bCyan}|${c.reset}`) + `${c.bCyan}|${c.reset}`;
    
    console.log(`  ${headerLine}`);
    console.log(`  ${c.bCyan}${border}${c.reset}`);

    // Data rows
    rows.forEach(row => {
      const line = '|' + row.map((cell, i) => {
        const rawStr = cell !== undefined && cell !== null ? String(cell) : '';
        const cleanLen = rawStr.replace(/\x1b\[[0-9;]*m/g, '').length;
        const pad = Math.max(0, colWidths[i] - cleanLen - 1);
        return ` ${rawStr}${' '.repeat(pad)}`;
      }).join(`${c.gray}|${c.reset}`) + `${c.gray}|${c.reset}`;
      console.log(`  ${line}`);
    });

    console.log(`  ${c.bCyan}${border}${c.reset}\n`);
  },

  log(level, msg) {
    const lvl = level.toUpperCase();
    const time = new Date().toTimeString().split(' ')[0];
    let prefix = `${c.gray}[${time}]${c.reset} ${c.cyan}[INFO]${c.reset}`;
    if (lvl === 'OK' || lvl === 'SUCCESS') prefix = `${c.gray}[${time}]${c.reset} ${c.bGreen}${c.bold}[CONFIRMED]${c.reset}`;
    if (lvl === 'WARN') prefix = `${c.gray}[${time}]${c.reset} ${c.bYellow}[WARN]${c.reset}`;
    if (lvl === 'ERROR' || lvl === 'FAIL') prefix = `${c.gray}[${time}]${c.reset} ${c.bRed}${c.bold}[FAILED]${c.reset}`;
    if (lvl === 'TRIGGER') prefix = `${c.gray}[${time}]${c.reset} ${c.bgMagenta}${c.bold}${c.bWhite} [BURST_FIRE] ${c.reset}`;
    if (lvl === 'ARMED') prefix = `${c.gray}[${time}]${c.reset} ${c.bGreen}${c.bold}[PRE-SIGNED]${c.reset}`;
    if (lvl === 'GAS') prefix = `${c.gray}[${time}]${c.reset} ${c.bMagenta}[GAS_RADAR]${c.reset}`;

    console.log(`${prefix} ${msg}`);
  }
};

module.exports = ui;
