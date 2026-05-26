/**
 * Browser entry point. Creates an xterm.js terminal, wires up adapters
 * that implement the track2 OutputSink / InputSource contracts, and
 * hands off to the map picker.
 */

import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { runSimulation } from '../track2/src/runtime.js';
import { XtermSink, XtermSource } from './web-io.js';
import { showPicker } from './picker.js';
import { MAPS, loadMap } from './maps.js';
import './styles.css';

const MONO_FONT =
  '"JetBrains Mono", "Fira Code", "Cascadia Code", "Menlo", "Consolas", monospace';

function bootstrap(): void {
  const host = document.getElementById('terminal');
  if (!host) {
    console.error('No #terminal element found');
    return;
  }

  const term = new XTerm({
    fontFamily: MONO_FONT,
    fontSize: 14,
    lineHeight: 1.0,
    letterSpacing: 0,
    cursorBlink: false,
    convertEol: false,
    theme: {
      // The track2 renderer fills cells with ANSI background black
      // (`\x1b[40m`), and xterm's default `black` is a dark grey, which is
      // why the sim background looked washed-out next to the picker. Pin
      // `black` to true black so both views match.
      background: '#000000',
      foreground: '#cccccc',
      cursor: '#000000',
      cursorAccent: '#000000',
      black: '#000000',
      red: '#cc4040',
      green: '#5cb85c',
      yellow: '#d4b144',
      blue: '#5b9bd5',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#cccccc',
      brightBlack: '#666666',
      brightRed: '#ff6e6e',
      brightGreen: '#7be07b',
      brightYellow: '#ffd866',
      brightBlue: '#7cb8ff',
      brightMagenta: '#e090ff',
      brightCyan: '#7adfe6',
      brightWhite: '#ffffff',
    },
    allowProposedApi: true,
  });

  const fit = new FitAddon();
  term.loadAddon(fit);
  // Auto-detect URLs in the terminal output and make them clickable
  // (used by the picker's about overlay to link to the GitHub repo).
  term.loadAddon(new WebLinksAddon());
  term.open(host);
  fit.fit();

  const sink = new XtermSink(term);
  const source = new XtermSource(term);

  window.addEventListener('resize', () => {
    fit.fit();
  });

  function returnToPicker(): void {
    showPicker({
      term,
      maps: MAPS,
      onSelected: (entry) => {
        runSimulation({
          mapSource: loadMap(entry.file),
          output: sink,
          input: source,
          onQuit: () => returnToPicker(),
        });
      },
    });
  }

  returnToPicker();
}

bootstrap();
