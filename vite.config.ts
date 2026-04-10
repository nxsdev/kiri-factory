import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "build:workspace": {
        command: "vp run build:pkg && vp run build:rqb-v1 && vp run build:rqb-v2",
      },
      "check:workspace": {
        command: "vp run check:pkg && vp run check:rqb-v1 && vp run check:rqb-v2",
      },
      "test:workspace": {
        cache: false,
        command: "vp run test:rqb-v1 && vp run test:rqb-v2",
      },
    },
  },
  staged: {
    "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,yml,yaml}": "vp check --fix",
  },
  lint: {
    ignorePatterns: ["dist/**", ".tmp/**", "packages/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  pack: {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    sourcemap: true,
    clean: true,
  },
});
