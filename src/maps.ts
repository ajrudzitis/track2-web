/**
 * Bundle every demo `.map` file from the track2 submodule into the
 * build, joined with the curated manifest from track2's library.
 *
 * The map sources come from a Vite virtual module (`virtual:track2-maps`)
 * built by `vite.config.ts` — `.map` is special-cased by Vite's dev
 * server as a JS source-map MIME type, so we sidestep that by serving
 * the files as a generated JS object instead of via `?raw` imports.
 */

import bundledMaps from 'virtual:track2-maps';
import { MAPS_MANIFEST, type MapManifestEntry } from '../track2/src/maps-manifest.js';

// Only expose manifest entries whose file is actually bundled. (A typo or a
// renamed map in the manifest would otherwise produce a menu entry that
// errors on selection.)
export const MAPS: MapManifestEntry[] = MAPS_MANIFEST.filter(
  (entry) => bundledMaps[entry.file] !== undefined,
);

export function loadMap(file: string): string {
  const source = bundledMaps[file];
  if (source === undefined) {
    throw new Error(`Map file not bundled: ${file}`);
  }
  return source;
}
