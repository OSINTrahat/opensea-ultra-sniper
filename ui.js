/**
 * Terminal UI Formatter & Color Suite (Clean Modern Minimalist)
 * 100% ASCII-compatible, no unicode glitches, super clean spacing.
 */

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  
  // Colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  
  // Bright colors
  bRed: "\x1b[91m",
  bGreen: "\x1b[92m",
  bYellow: "\x1b[93m",
  bBlue: "\x1b[94m",
  bMagenta: "\x1b[95m",
  bCyan: "\x1b[96m",
  bWhite: "\x1b[97m"
};

const ui = {
  c,

  banner() {
    console.log(`\n  ${c.bCyan}${c.bold}OPENSEA ULTRA SNIPER${c.reset} ${c.gray}v1.0.0${c.reset}`);
    console.log(`  ${c.gray}------------------------------------------------------${c.reset}`);
  },

  hudBar(chain = 'BASE', mev = 'ACTIVE', nodes = '3 Nodes', speed = 'TURBO') {
    console.log(`\n  ${c.bWhite}${c.bold}${chain.toUpperCase()}${c.reset}  ${c.gray}|${c.reset}  MEV: ${c.bGreen}${mev}${c.reset}  ${c.gray}|${c.reset}  RPC: ${c.cyan}${nodes}${c.reset}  ${c.gray}|${c.reset}  Speed: ${c.bYellow}${speed.toUpperCase()}${c.reset}`);
    console.log(`  ${c.gray}------------------------------------------------------${c.reset}`);
  },

  section(title) {
    console.log(`\n  ${c.bCyan}${c.bold}${title}${c.reset}`);
    console.log(`  ${c.gray}------------------------------------------------------${c.reset}`);
  },

  divider() {
    console.log(`  ${c.gray}------------------------------------------------------${c.reset}`);
  },

  badge(text) {
    const t = String(text).toUpperCase();
    if (t === 'ACTIVE' || t === 'READY' || t === 'YES' || t === 'SUCCESS' || t === 'TRUE') {
      return `${c.bGreen}READY${c.reset}`;
    }
    if (t.includes('UPCOMING')) {
      return `${c.bCyan}UPCOMING${c.reset}`;
    }
    if (t === 'PAUSED' || t === 'WARN' || t === 'WAITING') {
      return `${c.bYellow}WAITING${c.reset}`;
    }
    if (t === 'ENDED' || t === 'NO' || t === 'ERROR' || t === 'FALSE' || t.includes('FAIL') || t.includes('INSUFFICIENT')) {
      return `${c.bRed}FAILED${c.reset}`;
    }
    if (t === 'NO_KEY' || t === 'INACTIVE') {
      return `${c.gray}NOT SET${c.reset}`;
    }
    return `${c.white}${text}${c.reset}`;
  },

  infoRow(label, value, valColor = c.bWhite) {
    const padLabel = label.padEnd(16, ' ');
    console.log(`  ${c.gray}${padLabel}${c.reset}  ${valColor}${value}${c.reset}`);
  },

  renderTable(headers, rows) {
    if (!rows || rows.length === 0) {
      console.log(`  ${c.gray}(No data)${c.reset}`);
      return;
    }

    // Calculate maximum width for each column
    const colWidths = headers.map((h, i) => {
      let max = h.length;
      rows.forEach(r => {
        const str = r[i] !== undefined && r[i] !== null ? String(r[i]).replace(/\x1b\[[0-9;]*m/g, '') : '';
        if (str.length > max) max = str.length;
      });
      return max + 4; // neat column spacing
    });

    const totalWidth = Math.min(76, colWidths.reduce((a, b) => a + b, 0));

    // Print Header
    const headerLine = headers.map((h, i) => {
      return `${c.bWhite}${c.bold}${h.padEnd(colWidths[i], ' ')}${c.reset}`;
    }).join('');
    console.log(`  ${headerLine}`);
    console.log(`  ${c.gray}${"-".repeat(totalWidth)}${c.reset}`);

    // Print Rows
    rows.forEach(row => {
      const line = row.map((cell, i) => {
        const rawStr = cell !== undefined && cell !== null ? String(cell) : '';
        const cleanLen = rawStr.replace(/\x1b\[[0-9;]*m/g, '').length;
        const pad = Math.max(0, colWidths[i] - cleanLen);
        return `${rawStr}${' '.repeat(pad)}`;
      }).join('');
      console.log(`  ${line}`);
    });
    console.log(`  ${c.gray}${"-".repeat(totalWidth)}${c.reset}\n`);
  },

  log(level, msg) {
    const lvl = level.toUpperCase();
    let prefix = `${c.cyan}info${c.reset} `;
    if (lvl === 'OK' || lvl === 'SUCCESS') prefix = `${c.bGreen}done${c.reset} `;
    if (lvl === 'WARN') prefix = `${c.bYellow}warn${c.reset} `;
    if (lvl === 'ERROR' || lvl === 'FAIL') prefix = `${c.bRed}fail${c.reset} `;
    if (lvl === 'TRIGGER') prefix = `${c.bMagenta}fire${c.reset} `;
    if (lvl === 'ARMED') prefix = `${c.bGreen}ready${c.reset}`;
    if (lvl === 'GAS') prefix = `${c.cyan}gas${c.reset} `;

    console.log(`  ${prefix} ${msg}`);
  }
};

module.exports = ui;
