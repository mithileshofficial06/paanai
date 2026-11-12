import { defineConfig } from 'vite';
import { devvit } from '@devvit/start/vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact(), devvit()],
});
