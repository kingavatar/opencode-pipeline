import { join } from "path"
import { readFile, writeFile, rm } from "fs/promises"
import { $ } from "bun"

const home = process.env.HOME || process.env.USERPROFILE || "~"
const configFile = join(home, ".config", "opencode", "opencode.json")

// Build
await $`bun run script/build.ts`

// Remove flat plugin file (auto-discovery causes double-load)
const flatFile = join(home, ".config", "opencode", "plugins", "pipeline.js")
try {
  await rm(flatFile, { force: true })
  console.log("Removed flat plugin file (file:/// is the single load path)")
} catch {}

// Ensure file:/// entry exists in opencode.json plugin array
try {
  const raw = await readFile(configFile, "utf-8")
  const config = JSON.parse(raw)
  const plugins: string[] = config.plugin ?? []

  const pluginUri = `file://${home}/dev/personal/opencode-pipeline/dist/index.js`
  if (!plugins.some((p) => p.startsWith("file:///") && p.includes("opencode-pipeline"))) {
    plugins.push(pluginUri)
    config.plugin = plugins
    await writeFile(configFile, JSON.stringify(config, null, 2) + "\n")
    console.log(`Added plugin entry to opencode.json`)
  } else {
    console.log(`Plugin already in opencode.json plugin array`)
  }
} catch (err) {
  console.error("Could not update opencode.json:", err)
  console.log(`Add manually: "${pluginUri}"`)
}

console.log("Deployed via file:/// only (no flat auto-discovery)")
