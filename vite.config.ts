import { defineConfig, type Plugin } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MAPS_DIR = resolve(__dirname, 'track2', 'maps');
const VIRTUAL_ID = 'virtual:track2-maps';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/**
 * Vite serves files with the `.map` extension as JavaScript source maps
 * (MIME `application/json`), and that short-circuits the `?raw` query —
 * the browser then rejects them as module scripts. Expose the bundled
 * maps through a virtual module instead.
 */
function track2MapsPlugin(): Plugin {
  return {
    name: 'track2-maps',
    enforce: 'pre',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const files = readdirSync(MAPS_DIR).filter((f) => f.endsWith('.map'));
      const entries = files
        .map((f) => {
          const source = readFileSync(join(MAPS_DIR, f), 'utf-8');
          return `  ${JSON.stringify(f)}: ${JSON.stringify(source)}`;
        })
        .join(',\n');
      return `export default {\n${entries}\n};\n`;
    },
    configureServer(server) {
      // Reload the virtual module if anyone edits a .map file under track2/maps.
      server.watcher.add(MAPS_DIR);
      server.watcher.on('change', (path) => {
        if (!path.startsWith(MAPS_DIR) || !path.endsWith('.map')) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.reloadModule(mod);
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [track2MapsPlugin()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
});
