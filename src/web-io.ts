/**
 * xterm.js adapters that implement track2's OutputSink / InputSource so the
 * Node TUI runtime can drive a browser terminal unchanged.
 */

import type { Terminal as XTerm, IDisposable } from '@xterm/xterm';
import type { OutputSink, InputSource, ResizeListener, DataListener } from '../track2/src/view/io.js';

export class XtermSink implements OutputSink {
  private resizeDisposables: IDisposable[] = [];

  constructor(private readonly term: XTerm) {}

  get cols(): number {
    return this.term.cols;
  }

  get rows(): number {
    return this.term.rows;
  }

  write(s: string): void {
    this.term.write(s);
  }

  onResize(listener: ResizeListener): void {
    const d = this.term.onResize((evt) => listener(evt.cols, evt.rows));
    this.resizeDisposables.push(d);
  }

  enter(): void {
    // Alt screen + hide cursor + clear, matching the Node sink's enter().
    // xterm.js interprets these standard ANSI control sequences natively.
    this.term.write('\x1b[?1049h\x1b[?25l\x1b[2J');
  }

  exit(): void {
    this.term.write('\x1b[?25h\x1b[?1049l');
    // Dispose every resize listener subscribed during this session so the
    // Terminal we tore down doesn't keep receiving resize events.
    for (const d of this.resizeDisposables) d.dispose();
    this.resizeDisposables = [];
  }
}

export class XtermSource implements InputSource {
  private dataListener: DataListener | null = null;
  private disposable: IDisposable | null = null;

  constructor(private readonly term: XTerm) {}

  onData(listener: DataListener): void {
    this.dataListener = listener;
  }

  start(): void {
    if (this.disposable || !this.dataListener) return;
    const cb = this.dataListener;
    this.disposable = this.term.onData((data) => cb(data));
  }

  stop(): void {
    if (this.disposable) {
      this.disposable.dispose();
      this.disposable = null;
    }
    this.dataListener = null;
  }
}
