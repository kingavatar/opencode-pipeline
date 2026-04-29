import { $ } from "bun"
import { join } from "path"
import { mkdir } from "fs/promises"

const home = process.env.HOME || process.env.USERPROFILE || "~"
const pluginDir = join(home, ".config", "opencode", "plugins")

await mkdir(pluginDir, { recursive: true })
await $`cp dist/index.js ${pluginDir}/pipeline.js`

console.log(`Deployed to ${pluginDir}/pipeline.js`)
