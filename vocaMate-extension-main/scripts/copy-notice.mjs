import { copyFile, mkdir, writeFile } from "node:fs/promises"
import { dictionary } from "cmu-pronouncing-dictionary"

const target = process.argv.includes("--dev") ? "chrome-mv3-dev" : "chrome-mv3-prod"
const output = new URL(`../build/${target}/`, import.meta.url)
await mkdir(output, { recursive: true })
await copyFile(new URL("../NOTICE.txt", import.meta.url), new URL("NOTICE.txt", output))
await writeFile(new URL("cmu-pronunciations.json", output), JSON.stringify(dictionary))
