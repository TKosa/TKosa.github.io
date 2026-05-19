const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const runtimeFiles = ["index.html", "pause-menu.html"];
const runtimeDirs = ["assets", "css", "src"];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const rel of runtimeFiles) {
  fs.copyFileSync(path.join(root, rel), path.join(dist, rel));
}

for (const rel of runtimeDirs) {
  fs.cpSync(path.join(root, rel), path.join(dist, rel), { recursive: true, force: true });
}

console.log("Built static runtime files into dist/");

