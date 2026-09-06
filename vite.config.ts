/// <reference types="vitest/config" />

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { viteSingleFile } from "vite-plugin-singlefile";
import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    plugins: [react(), tailwindcss(), viteSingleFile()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json'],
        include: ['src/lib/**/*.ts'],
        exclude: [
          'src/main.tsx',
          'src/App.tsx',
          'src/data/**',
          'src/**/*.test.ts',
          'src/**/*.test.tsx',
        ],
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90,
        },
      },
    },
});
