import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  // один экземпляр three.js для ядра и addons (иначе в dev-режиме Vite может загрузить его дважды)
  optimizeDeps: { include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js', 'three/addons/utils/BufferGeometryUtils.js'] },
  build: { chunkSizeWarningLimit: 1200 },
});
