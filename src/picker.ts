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
 *   ▸ Two routes (showcase)   Six-station mainline forking to a ...
 *     Sound Transit Link       Link 1 & 2 Lines: shared Lynnwood–CID ...
 *     ...
 *
 *   ↑↓ navigate · Enter select
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
  let inputDisposable: IDisposable | null = null;
  let resizeDisposable: IDisposable | null = null;
  let closed = false;

  function moveTo(x: number, y: number): string {
    return `\x1b[${y};${x}H`;
  }

  function render(): void {
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
    out += DIM + '↑↓ navigate · Enter select' + RESET;
    term.write(out);
  }

  function close(): void {
    if (closed) return;
    closed = true;
    inputDisposable?.dispose();
    resizeDisposable?.dispose();
  }

  function handleKey(data: string): void {
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
