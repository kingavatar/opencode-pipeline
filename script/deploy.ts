import { join } from "path"
import { readFile, writeFile, rm, mkdir, cp } from "fs/promises"
import { $ } from "bun"

const home = process.env.HOME || process.env.USERPROFILE || "~"
const configFile = join(home, ".config", "opencode", "opencode.json")
const commandsSrc = join(import.meta.dir, "..", "commands")
const commandsDest = join(home, ".config", "opencode", "commands")

// Build
await $`bun run script/build.ts`

// Remove flat plugin file (auto-discovery causes double-load → crashes)
const flatFile = join(home, ".config", "opencode", "plugins", "pipeline.js")
try { await rm(flatFile, { force: true }) } catch {}

// Deploy command markdown files (GSD pattern: file auto-discovery, no config hook)
await mkdir(commandsDest, { recursive: true })
const srcFiles = ["pipeline-init.md", "pipeline-resume.md", "pipeline-status.md", "pipeline-help.md"]
for (const f of srcFiles) {
  await cp(join(commandsSrc, f), join(commandsDest, f))
}
console.log(`Deployed ${srcFiles.length} commands to ${commandsDest}`)

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
  }
} catch (err) {
  console.error("Could not update opencode.json:", err)
}

console.log("Deployed via file:/// + markdown commands (GSD pattern)")
