import { $ } from "bun"
import { join } from "path"
import { mkdir, readFile, writeFile } from "fs/promises"

const home = process.env.HOME || process.env.USERPROFILE || "~"
const pluginDir = join(home, ".config", "opencode", "plugins")
const configFile = join(home, ".config", "opencode", "opencode.json")

// Copy built plugin
await mkdir(pluginDir, { recursive: true })
await $`cp dist/index.js ${pluginDir}/pipeline.js`

console.log(`Deployed to ${pluginDir}/pipeline.js`)

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
  console.log("Add manually: \"file:///home/emperor/dev/personal/opencode-pipeline/dist/index.js\"")
}
