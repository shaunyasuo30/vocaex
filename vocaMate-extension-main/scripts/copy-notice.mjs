import { copyFile, mkdir } from "node:fs/promises"

const output = new URL("../build/chrome-mv3-prod/", import.meta.url)
await mkdir(output, { recursive: true })
await copyFile(new URL("../NOTICE.txt", import.meta.url), new URL("NOTICE.txt", output))
