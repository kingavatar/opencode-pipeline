import { join } from "path"
import { readFile, writeFile, rm } from "fs/promises"

const home = process.env.HOME || process.env.USERPROFILE || "~"

// Remove plugin file
const pluginFile = join(home, ".config", "opencode", "plugins", "pipeline.js")
try { await rm(pluginFile, { force: true }) } catch {}

// Remove file:/// entry from opencode.json plugin array
const configFile = join(home, ".config", "opencode", "opencode.json")
try {
  const raw = await readFile(configFile, "utf-8")
  const config = JSON.parse(raw)
  if (config.plugin) {
    config.plugin = (config.plugin as string[]).filter(
      (p) => !p.includes("opencode-pipeline")
    )
    if (config.plugin.length === 0) delete config.plugin
    await writeFile(configFile, JSON.stringify(config, null, 2) + "\n")
    console.log(`Removed pipeline entry from opencode.json`)
  }
} catch (err) {
  console.error("Could not update opencode.json:", err)
}

// Remove command markdown files
const commandsDir = join(home, ".config", "opencode", "commands")
const cmdFiles = ["pipeline-init.md", "pipeline-resume.md", "pipeline-status.md", "pipeline-help.md"]
for (const f of cmdFiles) {
  try { await rm(join(commandsDir, f), { force: true }) } catch {}
}
console.log(`Removed pipeline command files`)

// Prompt about pipeline storage
const storageDir = join(home, ".local", "share", "opencode", "pipeline")
console.log(`\nPipeline storage remains at ${storageDir}`)
console.log("Remove manually if you want to delete all saved state:")
console.log(`  rm -rf ${storageDir}`)
