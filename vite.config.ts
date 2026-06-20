import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 8888,
  },
  plugins: [vue(), mode === "development" && vueDevTools(), tailwindcss()].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Vue / Pinia 等框架代码单独成 chunk，长期不变可强缓存
        manualChunks(id: string) {
          if (id.includes("node_modules/vue") || id.includes("node_modules/pinia")) {
            return "vendor-vue";
          }
        },
      },
    },
  },
}));
