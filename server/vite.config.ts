import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { nodeExternals } from 'rollup-plugin-node-externals';
import { defineConfig } from 'vite';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const sharedPath = path.resolve(__dirname, '..', 'shared', 'src');
const srcPath = path.resolve(__dirname, 'src');

export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: ['src/main.ts'],
      fileName: (_format, entryName) => `${entryName}.js`,
      formats: ['es'],
    },
    rolldownOptions: {
      output: {
        minify: mode === 'production' ? {
          compress: { dropConsole: true },
        } : {},
      },
    },
  },
  plugins: [
    {
      ...nodeExternals(),
      name: 'node-externals',
      enforce: 'pre',
      apply: 'build',
    },
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
}));
