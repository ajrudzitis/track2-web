# track2-web

Web frontend for [track2](https://github.com/ajrudzitis/track2) — the same
TUI subway simulation, rendered in the browser via
[xterm.js](https://xtermjs.org/). Hosted at
**[trains.aleksrudzitis.com](https://trains.aleksrudzitis.com)**.

The track2 simulation, model, parser, and ANSI renderer all run unchanged;
this project wires them to xterm.js through track2's `OutputSink` /
`InputSource` interfaces (see `track2/src/view/io.ts`). track2 is included
as a git submodule under [`./track2/`](./track2/).

## Local development

```bash
git clone --recurse-submodules <this repo>
cd track2-web
npm install
npm run dev          # vite dev server on http://localhost:5173
npm run build        # static output in dist/
npm run preview      # serve the built output
```

The picker shows on load; pick a map with `↑` / `↓` + Enter. In the sim,
the usual track2 keys work (`+`/`-` speed, arrows scroll, `a` arrival
board, `h` help, `q` back to picker). Most keys are caught by xterm —
browser shortcuts like Ctrl+L still work as usual.

On touch devices (no hover, coarse pointer), an on-screen keypad along
the bottom edge provides the same keys (arrows, `+`/`-`, `a`, `h`, `[`,
`]`, Enter, Esc, `q`). Taps dispatch through `term.input()` so the same
`onData` listeners fire as for hardware keystrokes.

## Deploying

The site is a static S3 + CloudFront + Route 53 stack defined in CDK
under [`./infra/`](./infra/). One-time setup:

```bash
cd infra
npm install
npx cdk bootstrap                       # once per account+region
npx cdk deploy TrainsSiteStack
```

`cdk deploy` will pause for ~5 minutes waiting on ACM DNS validation. To
unblock it, copy the four name servers from the stack's `NameServers`
output and add them as an `NS` record set named `trains` under the
parent `aleksrudzitis.com` hosted zone. Once DNS resolves, ACM completes
and `deploy` returns.

Ongoing deploys (after a code change):

```bash
./scripts/deploy.sh
```

It runs `npm run build`, syncs `dist/` to S3 with sensible cache headers
(immutable for hashed assets, `no-cache` for `index.html`), and
invalidates the CloudFront distribution.

Override the stack name or region with env vars:
`STACK_NAME=… AWS_REGION=… ./scripts/deploy.sh`.

## Repository layout

```
src/                  Browser app
  main.ts             xterm.js setup + bootstrap
  web-io.ts           XtermSink / XtermSource adapters (track2 IO interfaces)
  picker.ts           In-terminal map picker UI
  maps.ts             Joins track2 manifest with files bundled by Vite
  styles.css          Page styling (full-viewport dark, small-screen notice)
track2/               git submodule — pinned to a specific commit
infra/                AWS CDK stack
  bin/infra.ts        CDK app entry
  lib/                Stack definitions
scripts/deploy.sh     Build + sync + invalidate
vite.config.ts        Includes a virtual module that bundles track2/maps/*.map
                      (Vite's dev server serves .map as JSON, which blocks
                      the simpler `import.meta.glob('?raw')` approach)
```

## Updating track2

```bash
cd track2
git fetch
git checkout <commit-or-branch>
cd ..
git add track2
git commit -m "Bump track2 submodule to <commit>"
```

A bump may require corresponding changes in `src/main.ts` (xterm theme)
or `src/maps.ts` if track2's I/O interfaces or manifest format change.
