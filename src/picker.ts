/**
 * In-terminal map picker. Renders a list of maps using ANSI escapes
 * directly to xterm (no Terminal/Renderer machinery needed) and resolves
 * with the user's selection when they press Enter.
 *
 * Layout:
 *
 *   <banner>
 *
 *   A subway simulation in your terminal. Pick a map:
 *
 *   > Two routes (showcase)   Six-station mainline forking to a ...
 *     Sound Transit Link       Link 1 & 2 Lines: shared Lynnwood–CID ...
 *     ...
 *
 *   ↑↓ navigate · Enter select · a about
 *
 * Pressing `a` toggles an about overlay drawn on top of the menu.
 */

import type { Terminal as XTerm, IDisposable } from '@xterm/xterm';
import type { MapManifestEntry } from '../track2/src/maps-manifest.js';

const BANNER = [
  '  ______                __  ___',
  ' /_  __/________ ______/ /_|__ \\',
  '  / / / ___/ __ `/ ___/ //_/_/ /',
  ' / / / /  / /_/ / /__/ ,< / __/',
  '/_/ /_/   \\__,_/\\___/_/|_/____/',
];

const ABOUT_TITLE = 'About';
const ABOUT_PARAGRAPHS = [
  "track2 is a subway/metro simulation TUI built in TypeScript: you " +
    "define a network in a .map file and watch trains run on a " +
    "control-room-style terminal display, with route-aware ETAs, switch " +
    "interlocking, and 3-aspect signals.",
  "track2-web is a thin browser wrapper — xterm.js running the same " +
    "TUI in your browser, with the simulation, model, and renderer ported " +
    "unmodified via a small I/O abstraction.",
];
const ABOUT_LINK_LABEL = 'Source';
const ABOUT_LINK = 'https://github.com/ajrudzitis/track2';
const ABOUT_FOOTER = 'Press a or Esc to close.';

const RESET = '\x1b[0m';
const DIM = '\x1b[90m';
const CYAN = '\x1b[36m';
const INVERSE = '\x1b[7m';
const WHITE = '\x1b[37m';

export interface PickerOptions {
  term: XTerm;
  maps: MapManifestEntry[];
  onSelected: (entry: MapManifestEntry) => void;
}

export function showPicker(opts: PickerOptions): void {
  const { term, maps, onSelected } = opts;
  let selected = 0;
  let aboutOpen = false;
  let inputDisposable: IDisposable | null = null;
  let resizeDisposable: IDisposable | null = null;
  let closed = false;

  function moveTo(x: number, y: number): string {
    return `\x1b[${y};${x}H`;
  }

  function renderMenu(): string {
    const cols = term.cols;
    const rows = term.rows;
    const left = 3;

    let out = '\x1b[?25l';   // hide cursor
    out += '\x1b[2J';        // clear screen
    out += moveTo(1, 1);

    let y = 2;
    for (const line of BANNER) {
      out += moveTo(left, y) + CYAN + line + RESET;
      y++;
    }
    y++;
    out += moveTo(left, y) + 'A subway simulation in your terminal. Pick a map:' + RESET;
    y += 2;

    // Reserve last 2 rows for the footer hint.
    const listTop = y;
    const listBottom = Math.max(listTop, rows - 3);
    const maxRows = listBottom - listTop + 1;

    // Scroll window if list is taller than the room we have.
    let firstVisible = 0;
    if (maps.length > maxRows) {
      if (selected < maxRows / 2) {
        firstVisible = 0;
      } else if (selected > maps.length - maxRows / 2) {
        firstVisible = maps.length - maxRows;
      } else {
        firstVisible = selected - Math.floor(maxRows / 2);
      }
    }

    const labelWidth = Math.max(...maps.map((m) => m.label.length));
    const labelCol = labelWidth + 4;
    const descMax = Math.max(0, cols - left - labelCol - 2);

    for (let i = 0; i < Math.min(maxRows, maps.length); i++) {
      const idx = firstVisible + i;
      const m = maps[idx];
      const marker = idx === selected ? '> ' : '  ';
      const label = m.label.padEnd(labelWidth + 2);
      const desc = m.description.length > descMax
        ? m.description.slice(0, Math.max(0, descMax - 1)) + '…'
        : m.description;
      const labelStyle = idx === selected ? INVERSE : WHITE;
      out += moveTo(left, listTop + i);
      out += labelStyle + marker + label + RESET;
      out += ' ' + DIM + desc + RESET;
    }

    out += moveTo(left, rows - 1);
    out += DIM + '↑↓ navigate · Enter select · a about' + RESET;
    return out;
  }

  /** Word-wrap `text` into lines no wider than `width`. Words longer
   * than `width` are emitted on their own (no mid-word breaks). */
  function wrap(text: string, width: number): string[] {
    const lines: string[] = [];
    let current = '';
    for (const word of text.split(/\s+/)) {
      if (!word) continue;
      if (current.length === 0) {
        current = word;
      } else if (current.length + 1 + word.length <= width) {
        current += ' ' + word;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines;
  }

  function renderAboutOverlay(): string {
    const cols = term.cols;
    const rows = term.rows;
    const maxBoxWidth = 76;
    const sidePadding = 4;
    const boxWidth = Math.min(maxBoxWidth, Math.max(40, cols - sidePadding * 2));
    const innerWidth = boxWidth - 4; // 2 for borders, 2 for inner padding

    // Compose the content lines (between border rows).
    const lines: string[] = [];
    lines.push(''); // top padding
    lines.push(ABOUT_TITLE);
    lines.push(''); // gap after title
    for (let p = 0; p < ABOUT_PARAGRAPHS.length; p++) {
      for (const wrapped of wrap(ABOUT_PARAGRAPHS[p], innerWidth)) {
        lines.push(wrapped);
      }
      lines.push(''); // blank line between paragraphs
    }
    lines.push(`${ABOUT_LINK_LABEL}: ${ABOUT_LINK}`);
    lines.push(''); // gap before footer
    lines.push(ABOUT_FOOTER);
    lines.push(''); // bottom padding

    const boxHeight = lines.length + 2; // +2 for top/bottom border
    const boxLeft = Math.max(1, Math.floor((cols - boxWidth) / 2) + 1);
    const boxTop = Math.max(1, Math.floor((rows - boxHeight) / 2) + 1);

    let out = '';
    // Top border
    out += moveTo(boxLeft, boxTop);
    out += CYAN + '┌' + '─'.repeat(boxWidth - 2) + '┐' + RESET;
    // Content rows
    for (let i = 0; i < lines.length; i++) {
      const y = boxTop + 1 + i;
      const content = lines[i];
      // Pad each line to the box's interior width so we overwrite the
      // menu underneath (no transparency).
      const padded = ' ' + content.padEnd(boxWidth - 4, ' ') + ' ';
      out += moveTo(boxLeft, y);
      let style = WHITE;
      if (content === ABOUT_TITLE) style = '\x1b[1m' + CYAN; // bold cyan
      else if (content === ABOUT_FOOTER) style = DIM;
      out += CYAN + '│' + RESET + style + padded + RESET + CYAN + '│' + RESET;
    }
    // Bottom border
    out += moveTo(boxLeft, boxTop + lines.length + 1);
    out += CYAN + '└' + '─'.repeat(boxWidth - 2) + '┘' + RESET;
    return out;
  }

  function render(): void {
    let out = renderMenu();
    if (aboutOpen) out += renderAboutOverlay();
    term.write(out);
  }

  function close(): void {
    if (closed) return;
    closed = true;
    inputDisposable?.dispose();
    resizeDisposable?.dispose();
  }

  function handleKey(data: string): void {
    if (data === 'a' || data === 'A') {
      aboutOpen = !aboutOpen;
      render();
      return;
    }
    if (data === '\x1b' && aboutOpen) {                   // Esc closes about
      aboutOpen = false;
      render();
      return;
    }
    if (aboutOpen) {                                      // swallow keys while modal
      return;
    }
    if (data === '\x1b[A') {                              // up
      selected = (selected - 1 + maps.length) % maps.length;
      render();
    } else if (data === '\x1b[B') {                       // down
      selected = (selected + 1) % maps.length;
      render();
    } else if (data === '\r' || data === '\n') {         // enter
      const entry = maps[selected];
      close();
      onSelected(entry);
    } else if (data === '\x03') {                         // Ctrl-C → no-op
      // The picker is the root view — nothing to escape to.
    }
  }

  inputDisposable = term.onData(handleKey);
  resizeDisposable = term.onResize(() => render());
  render();
}
