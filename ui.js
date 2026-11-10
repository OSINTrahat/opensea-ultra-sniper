/**
 * SUPER MINT — Terminal UI Suite
 * Doom-Emacs inspired splash screen: centred wordmark, airy menu, powerline footer.
 * Pure ANSI 256 colours, single-width glyphs, safe on Windows CMD / PowerShell / Termux.
 */

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  // Super Mint palette (mint -> teal -> ice)
  mintGlow: "\x1b[38;5;158m",
  mintBright: "\x1b[38;5;121m",
  mintNeon: "\x1b[38;5;49m",
  mintMid: "\x1b[38;5;44m",
  mintDeep: "\x1b[38;5;37m",
  mintDark: "\x1b[38;5;36m",
  iceBlue: "\x1b[38;5;153m",
  lavender: "\x1b[38;5;147m",
  softPurple: "\x1b[38;5;141m",
  slateBlue: "\x1b[38;5;110m",
  cyan: "\x1b[38;5;81m",
  bCyan: "\x1b[96m",
  bWhite: "\x1b[97m",
  white: "\x1b[97m",
  gray: "\x1b[38;5;244m",
  darkGray: "\x1b[38;5;238m",
  gold: "\x1b[38;5;221m",
  green: "\x1b[38;5;84m",
  bGreen: "\x1b[92m",
  yellow: "\x1b[93m",
  bYellow: "\x1b[93m",
  red: "\x1b[31m",
  bRed: "\x1b[91m",
  magenta: "\x1b[35m",
  bMagenta: "\x1b[95m",

  // Backgrounds
  bgDarkBar: "\x1b[48;5;236m",
  bgSelected: "\x1b[48;5;237m"
};

/* ---------------------------------------------------------------- helpers */

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(s) {
  return String(s).replace(ANSI_RE, '');
}

function vlen(s) {
  return Array.from(stripAnsi(s)).length;
}

function termWidth() {
  const w = process.stdout.columns || 0;
  return w >= 40 ? w : 80;
}

function center(s, width) {
  const pad = Math.max(0, Math.floor((width - vlen(s)) / 2));
  return ' '.repeat(pad) + s;
}

function padRight(s, n) {
  return s + ' '.repeat(Math.max(0, n - vlen(s)));
}

function padLeft(s, n) {
  return ' '.repeat(Math.max(0, n - vlen(s))) + s;
}

/* --------------------------------------------------------------- the logo */

// ANSI-Shadow style block letters. Every glyph row keeps a constant width.
const GLYPHS = {
  S: ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
  U: ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  P: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔═══╝ ', '██║     ', '╚═╝     '],
  E: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'],
  R: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
  M: ['███╗   ███╗', '████╗ ████║', '██╔████╔██║', '██║╚██╔╝██║', '██║ ╚═╝ ██║', '╚═╝     ╚═╝'],
  I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  N: ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
  T: ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   ']
};

function normaliseGlyph(rows) {
  const width = Math.max(...rows.map(r => Array.from(r).length));
  return rows.map(r => r + ' '.repeat(width - Array.from(r).length));
}

function wordmark(text, gap = 3) {
  const words = text.split(' ');
  const rows = ['', '', '', '', '', ''];
  words.forEach((word, wi) => {
    const letters = word.split('').map(ch => normaliseGlyph(GLYPHS[ch] || ['   ', '   ', '   ', '   ', '   ', '   ']));
    for (let r = 0; r < 6; r++) {
      if (wi > 0) rows[r] += ' '.repeat(gap);
      letters.forEach(g => { rows[r] += g[r]; });
    }
  });
  return rows.map(r => r.replace(/\s+$/, ''));
}

const WORDMARK = wordmark('SUPER MINT');
const WORDMARK_COLORS = [c.mintBright, c.mintNeon, c.mintMid, c.mintDeep, c.mintDark, c.mintDark];

// Every row gets the same width so the block can be centred as one unit.
const WORDMARK_W = Math.max(...WORDMARK.map(r => vlen(r)));
const WORDMARK_BLOCK = WORDMARK.map(r => r + ' '.repeat(WORDMARK_W - vlen(r)));

/* ----------------------------------------------------------------- the UI */

const ui = {
  c,
  helpers: { stripAnsi, vlen, center, termWidth, padRight, padLeft },

  /** Big centred wordmark + tagline. Falls back to a compact lockup on narrow terminals. */
  logoLines(width) {
    const w = width || termWidth();
    const lines = [];

    if (WORDMARK_W <= w - 2) {
      const pad = ' '.repeat(Math.max(0, Math.floor((w - WORDMARK_W) / 2)));
      WORDMARK_BLOCK.forEach((row, i) => {
        lines.push(`${pad}${WORDMARK_COLORS[i]}${c.bold}${row}${c.reset}`);
      });
    } else {
      lines.push(center(`${c.mintBright}${c.bold}▓▓▓  S U P E R   M I N T  ▓▓▓${c.reset}`, w));
    }

    lines.push('');
    lines.push(center(`${c.iceBlue}${c.bold}S U P E R   M I N T${c.reset}   ${c.gray}·   Atomic Multi-Chain Mint Engine${c.reset}`, w));
    return lines;
  },

  /** Compact two-line lockup for short terminals (under 30 rows). */
  compactLogo(width) {
    const w = width || termWidth();
    return [
      center(`${c.mintBright}${c.bold}▓▓  S U P E R   M I N T  ▓▓${c.reset}`, w),
      center(`${c.gray}Atomic Multi-Chain Mint Engine${c.reset}`, w)
    ];
  },

  /** Full splash screen (framed panel + footer). Returns an array of lines. */
  screen(title, options, selectedIndex = 0, opts = {}) {
    const termW = termWidth();
    const termH = process.stdout.rows || 30;
    const showBanner = opts.banner === true;
    const lines = [];

    if (showBanner) {
      lines.push('');
      const head = termH >= 30 ? ui.logoLines(termW) : ui.compactLogo(termW);
      head.forEach(l => lines.push(l));
      lines.push('');
    } else {
      lines.push('');
    }

    /* ---- measure the menu so every column lines up ------------------- */
    const labels = options.map(o => String(o.label).replace(/^\s*\d+\)\s*/, '').trim());
    const keys = options.map((o, i) => (o.key !== undefined ? String(o.key) : String(i + 1)));
    const keyW = Math.max(1, ...keys.map(k => k.length));
    const labelMax = Math.max(...labels.map(l => vlen(l)));
    const hintMax = Math.max(0, ...options.map(o => vlen(String(o.hint || ''))));
    const cols = 2 + 2 + keyW + 3 + labelMax + 3;      // margin, marker, key, label
    const natural = cols + hintMax;
    const innerW = Math.max(cols + 4, Math.min(Math.max(natural, 60), termW - 6, 86));
    const hintW = Math.max(4, innerW - cols);
    const pad = (s, n) => s + ' '.repeat(Math.max(0, n - vlen(s)));

    const border = ch => `${c.mintDark}${ch}${c.reset}`;
    const rule = (left, right) => `${border(left)}${c.mintDark}${'─'.repeat(innerW)}${border(right)}`;
    const headTitle = `◆  ${title.toUpperCase()}`;
    const headPad = Math.max(0, innerW - 2 - vlen(headTitle));

    lines.push(rule('╭', '╮'));
    lines.push(`${border('│')}${c.mintNeon}${c.bold}  ◆  ${c.white}${title.toUpperCase()}${c.reset}${' '.repeat(headPad)}${border('│')}`);
    lines.push(rule('├', '┤'));

    options.forEach((opt, idx) => {
      const selected = idx === selectedIndex;
      const key = keys[idx].padStart(keyW, ' ');
      const label = pad(labels[idx], labelMax);
      let hint = String(opt.hint || '');
      if (vlen(hint) > hintW) hint = Array.from(hint).slice(0, hintW - 1).join('') + '…';
      hint = pad(hint, hintW);

      if (selected) {
        const body = `${c.bgSelected}  ${c.mintBright}${c.bold}❯ ${c.white}${c.bold}${key}${c.bgSelected}   ${c.mintBright}${c.bold}${label}${c.bgSelected}   ${c.cyan}${hint}`;
        lines.push(`${c.mintDark}│${c.reset}${body}${c.reset}${c.mintDark}│${c.reset}`);
      } else {
        const body = `    ${c.mintMid}${key}${c.reset}   ${c.lavender}${label}${c.reset}   ${c.gray}${hint}${c.reset}`;
        lines.push(`${c.mintDark}│${c.reset}${body}${c.mintDark}│${c.reset}`);
      }
    });

    lines.push(rule('├', '┤'));
    const help = '↑↓ move    ↵ select    number keys    q quit';
    lines.push(`${border('│')}${c.darkGray}  ${pad(help, innerW - 2)}${c.reset}${border('│')}`);
    lines.push(rule('╰', '╯'));
    lines.push('');

    if (showBanner) {
      lines.push(center(`${c.slateBlue}5 wallets armed  ${c.darkGray}·${c.slateBlue}  4 EVM chains  ${c.darkGray}·${c.slateBlue}  3-node RPC race  ${c.darkGray}·${c.slateBlue}  0 ms signing${c.reset}`, termW));
    }

    return lines;
  },

  /** Print just the branded header (used by help / one-shot commands). */
  banner() {
    const w = Math.min(termWidth(), 100);
    ui.logoLines(w).forEach(l => console.log(l));
    console.log('');
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

  /** One-line echo of what the user picked, printed once a menu closes. */
  pick(label) {
    console.log(`  ${c.mintNeon}❯${c.reset} ${c.white}${c.bold}${label}${c.reset}`);
  },

  badge(text) {
    const t = String(text).toUpperCase().replace(/_/g, ' ');
    if (t === 'ACTIVE' || t === 'READY' || t === 'YES' || t === 'SUCCESS' || t === 'TRUE' || t === 'ELIGIBLE' || t === 'FUNDED' || t === 'SWEPT_SUCCESS') {
      return `${c.bGreen}✓ ${t === 'YES' ? 'READY' : t}${c.reset}`;
    }
    if (t.includes('UPCOMING')) {
      return `${c.bCyan}UPCOMING${c.reset}`;
    }
    if (t === 'PAUSED' || t === 'WARN' || t === 'WAITING' || t.includes('ALLOWLIST')) {
      return `${c.bYellow}${t}${c.reset}`;
    }
    if (t === 'NO KEY' || t === 'NOT SET' || t === 'UNKNOWN' || t === 'INACTIVE') {
      return `${c.gray}${t}${c.reset}`;
    }
    if (t === 'ENDED' || t === 'NO' || t === 'ERROR' || t === 'FALSE' || t.includes('FAIL') || t.includes('INSUFFICIENT') || t.includes('LOW') || t.includes('LIMIT')) {
      return `${c.bRed}${t}${c.reset}`;
    }
    return `${c.white}${text}${c.reset}`;
  },

  infoRow(label, value, valColor = c.white) {
    const padLabel = label.padEnd(16, ' ');
    console.log(`  ${c.gray}${padLabel}${c.reset}  ${valColor}${value}${c.reset}`);
  },

  renderTable(headers, rows) {
    if (!rows || rows.length === 0) {
      console.log(`  ${c.gray}(No data)${c.reset}`);
      return;
    }

    const colWidths = headers.map((h, i) => {
      let max = h.length;
      rows.forEach(r => {
        const str = r[i] !== undefined && r[i] !== null ? stripAnsi(r[i]) : '';
        if (str.length > max) max = str.length;
      });
      return max + 4;
    });

    const totalWidth = Math.min(76, colWidths.reduce((a, b) => a + b, 0));

    const headerLine = headers.map((h, i) => {
      return `${c.white}${c.bold}${h.padEnd(colWidths[i], ' ')}${c.reset}`;
    }).join('');
    console.log(`  ${headerLine}`);
    console.log(`  ${c.gray}${'-'.repeat(totalWidth)}${c.reset}`);

    rows.forEach(row => {
      const line = row.map((cell, i) => {
        const rawStr = cell !== undefined && cell !== null ? String(cell) : '';
        const cleanLen = stripAnsi(rawStr).length;
        const pad = Math.max(0, colWidths[i] - cleanLen);
        return `${rawStr}${' '.repeat(pad)}`;
      }).join('');
      console.log(`  ${line}`);
    });
    console.log(`  ${c.gray}${'-'.repeat(totalWidth)}${c.reset}\n`);
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
