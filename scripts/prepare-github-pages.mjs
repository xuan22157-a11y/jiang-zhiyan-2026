import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("dist/client");
const siteBase = "/jiang-zhiyan-2026";

async function rewrite(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewrite(filename);
      continue;
    }
    if (!/\.(?:html|css|js)$/.test(entry.name)) continue;
    const source = await readFile(filename, "utf8");
    const updated = source
      .replaceAll("/assets/", `${siteBase}/assets/`)
      .replace("<title>Mobile Prototype Boilerplate</title>", "<title>Jiang Zhiyan 2026</title>");
    if (updated !== source) await writeFile(filename, updated);
  }
}

await rewrite(outputDirectory);
await copyFile(path.join(outputDirectory, "index.html"), path.join(outputDirectory, "404.html"));

