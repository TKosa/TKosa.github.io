const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

if (!fs.existsSync(dist)) {
  throw new Error("dist/ does not exist. Run npm run build first.");
}

fs.cpSync(dist, root, { recursive: true, force: true });
console.log("Published dist/ into project root.");
