import assert from "node:assert/strict"
import { readFile, stat } from "node:fs/promises"

const output = new URL("../build/chrome-mv3-prod/", import.meta.url)
const manifest = JSON.parse(await readFile(new URL("manifest.json", output), "utf8"))
assert.equal(manifest.manifest_version, 3)
assert.equal(typeof manifest.action?.default_popup, "string")
assert.equal(typeof manifest.background?.service_worker, "string")
assert.ok(manifest.content_scripts?.some((script) => script.matches?.includes("https://*/*")))
assert.deepEqual(manifest.host_permissions?.sort(), [
  "https://freedictionaryapi.com/*",
  "https://translate.googleapis.com/*"
])

const worker = await stat(new URL(manifest.background.service_worker, output))
const cmu = JSON.parse(await readFile(new URL("cmu-pronunciations.json", output), "utf8"))
assert.ok(worker.size < 250_000, `Worker unexpectedly large: ${worker.size} bytes`)
assert.ok(Object.keys(cmu).length > 100_000, "CMU dictionary missing entries")
assert.ok(typeof cmu.hello === "string")
await stat(new URL("NOTICE.txt", output))
console.log(`Build verified: worker ${worker.size} bytes, ${Object.keys(cmu).length} CMU entries`)
