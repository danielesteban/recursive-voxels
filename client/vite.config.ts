import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const sharedPath = path.resolve(__dirname, '..', 'shared', 'src');
const srcPath = path.resolve(__dirname, 'src');

export default defineConfig(({ mode }) => ({
  build: {
    rolldownOptions: {
      output: {
        minify: mode === 'production' ? {
          compress: { dropConsole: true },
        } : {},
      },
    },
  },
  define: {
    __SERVER__: JSON.stringify(process.env.SERVER || 'http://localhost:8081/'),
  },
  plugins: [
    {
      name: 'shaders',
      transform(code, id) {
        if (/\.wgsl$/g.test(id)) {
          return {
            code: `export default ${JSON.stringify(code)};`,
            map: null,
          };
        }
        return;
      },
    },
    svelte(),
  ],
  resolve: {
    alias: [
      { find: '@shared', replacement: sharedPath },
      ...fs.readdirSync(srcPath, { withFileTypes: true })
        .filter((f) => f.isDirectory())
        .map(({ name }) => (
          { find: name, replacement: path.join(srcPath, name) }
        )),
    ],
  },
  server: {
    port: 8080,
  },
}));
