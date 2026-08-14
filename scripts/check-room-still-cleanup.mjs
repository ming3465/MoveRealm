import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const uploadDirectory = join(tmpdir(), "moverealm-room-stills");

let entries = [];
try {
  entries = await readdir(uploadDirectory);
} catch (error) {
  if (!(error instanceof Error) || !Object.hasOwn(error, "code") || error.code !== "ENOENT") {
    console.error("Unable to verify temporary room-still cleanup.");
    process.exitCode = 2;
  }
}

if (process.exitCode == null && entries.length > 0) {
  console.error(`Temporary room-still cleanup failed: ${entries.length} retained item(s).`);
  process.exitCode = 1;
} else if (process.exitCode == null) {
  console.log("Temporary room-still cleanup PASS: 0 retained items.");
}
