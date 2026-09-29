import assert from "node:assert/strict"
import { test } from "node:test"

import { floatingPosition } from "../src/lib/position.ts"

test("keeps a result card inside the viewport near its right and bottom edges", () => {
  assert.deepEqual(
    floatingPosition({ top: 570, bottom: 590, left: 780 }, { width: 340, height: 300 }, { width: 800, height: 600 }),
    { top: 262, left: 452 }
  )
})

test("places the card below the selection when there is room", () => {
  assert.deepEqual(
    floatingPosition({ top: 50, bottom: 70, left: 100 }, { width: 340, height: 200 }, { width: 800, height: 600 }),
    { top: 78, left: 100 }
  )
})
