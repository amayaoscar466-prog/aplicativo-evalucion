// @ts-check
// @ts-ignore: Astro is resolved at runtime by the project's dependencies.
import { defineConfig } from 'astro/config';
// @ts-ignore: the adapter is provided by the project dependencies at runtime.
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
});