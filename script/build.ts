import { build } from "bun"

const result = await build({
  entrypoints: ["./index.ts"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  external: [
    "@opencode-ai/plugin",
    "@opencode-ai/sdk",
  ],
  minify: false,
  sourcemap: "linked",
})

if (!result.success) {
  console.error("Build failed:", result.logs)
  process.exit(1)
}

console.log("Build succeeded")
