import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { iconStudio } from "./vendor/ume/vite/icon-studio.ts"

export default defineConfig({
  plugins: [react(), tailwindcss(), iconStudio()],
  resolve: {
    alias: [
      { find: /^@ume\/ui\/(.*)$/, replacement: path.resolve(__dirname, "./vendor/ume/src") + "/$1" },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  server: { port: 5173 },
})
