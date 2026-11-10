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
  ${c.bCyan}${c.bold}OPENSEA SEADROP & MULTI-CHAIN ULTRA SNIPER${c.reset}  ${c.bgCyan}${c.black}${c.bold} v1.0.0 ${c.reset}
  ${c.gray}Private Mempool * Multi-RPC Racing * Atomic Pre-Sign * Cold Vault Routing${c.reset}
  ${c.gray}------------------------------------------------------------------------${c.reset}`);
  },

  section(title) {
    console.log(`\n  ${c.bCyan}${c.bold}>> ${title}${c.reset}`);
    console.log(`  ${c.gray}------------------------------------------------------------------------${c.reset}`);
  },

  divider() {
    console.log(`  ${c.gray}------------------------------------------------------------------------${c.reset}`);
  },

  badge(text) {
    const t = String(text).toUpperCase();
    if (t === 'ACTIVE' || t === 'READY' || t === 'YES' || t === 'SUCCESS' || t === 'TRUE') {
      return `${c.bGreen}${c.bold}[ OK / READY ]${c.reset}`;
    }
    if (t.includes('UPCOMING')) {
      return `${c.bCyan}[ UPCOMING ]${c.reset}`;
    }
    if (t === 'PAUSED' || t === 'WARN' || t === 'WAITING') {
      return `${c.bYellow}[ WAITING ]${c.reset}`;
    }
    if (t === 'ENDED' || t === 'NO' || t === 'ERROR' || t === 'FALSE' || t.includes('FAIL') || t.includes('INSUFFICIENT')) {
      return `${c.bRed}[ NO / LOW_FUNDS ]${c.reset}`;
    }
    if (t === 'NO_KEY' || t === 'INACTIVE') {
      return `${c.gray}[ NOT SET ]${c.reset}`;
    }
    return `${c.cyan}[ ${text} ]${c.reset}`;
  },

  infoRow(label, value, valColor = c.bWhite) {
    const padLabel = label.padEnd(20, ' ');
    console.log(`  ${c.gray}*${c.reset} ${c.white}${padLabel}${c.reset} :  ${valColor}${value}${c.reset}`);
  },

  renderTable(headers, rows) {
    if (!rows || rows.length === 0) {
      console.log(`  ${c.gray}(No data available)${c.reset}`);
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

    // Horizontal border line generator
    const border = '+' + colWidths.map(w => '-'.repeat(w)).join('+') + '+';

    console.log(`  ${c.gray}${border}${c.reset}`);
    
    // Header row
    const headerLine = '|' + headers.map((h, i) => {
      return ` ${c.bold}${c.bCyan}${h.padEnd(colWidths[i] - 1, ' ')}${c.reset}`;
    }).join(`${c.gray}|${c.reset}`) + `${c.gray}|${c.reset}`;
    
    console.log(`  ${headerLine}`);
    console.log(`  ${c.gray}${border}${c.reset}`);

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

    console.log(`  ${c.gray}${border}${c.reset}\n`);
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
