import { $ } from "bun"
import { join } from "path"
import { mkdir } from "fs/promises"

const home = process.env.HOME || process.env.USERPROFILE || "~"
const pluginDir = join(home, ".config", "opencode", "plugins", "opencode-pipeline")

await mkdir(pluginDir, { recursive: true })
await $`cp dist/index.js ${pluginDir}/index.js`

console.log(`Deployed to ${pluginDir}/index.js`)
