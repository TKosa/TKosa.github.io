const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const builtBundle = path.join(projectRoot, "dist", "bundle.js");
const runtimeBundle = path.join(projectRoot, "js", "bundle.js");

if (!fs.existsSync(builtBundle)) {
  throw new Error("dist/bundle.js not found. Run npm run build first.");
}

fs.copyFileSync(builtBundle, runtimeBundle);
console.log("Updated js/bundle.js from dist/bundle.js");
