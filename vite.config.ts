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
    "{README.md,package.json,pnpm-workspace.yaml,tsconfig.json,vite.config.ts}":
      "pnpm exec vp check --fix",
    "docs/**/*.md": "pnpm exec vp check --fix",
    "packages/shared/**/*.{ts,md,json}":
      "pnpm exec vp check --fix && pnpm --dir packages/rqb-v1 exec vp check && pnpm --dir packages/rqb-v2 exec vp check",
    "packages/rqb-v1/**/*.{ts,md,json}": "pnpm --dir packages/rqb-v1 exec vp check --fix",
    "packages/rqb-v2/**/*.{ts,md,json}": "pnpm --dir packages/rqb-v2 exec vp check --fix",
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
