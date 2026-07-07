const fs = require("fs");
const path = require("path");
const { parseJsonl } = require("./rules");

function getCandidatePaths(rootDir) {
  const envPath = process.env.GOAL2_MICHECKER_CHECKITEMS_PATH;
  return [
    envPath,
    path.join(rootDir, "data", "michecker-checkitems.json"),
    path.join(rootDir, "..", "a11y-migration-kb", "build", "michecker-checkitems.json"),
  ].filter(Boolean);
}

function loadCheckitems(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, "..");
  const errors = [];

  for (const candidatePath of getCandidatePaths(rootDir)) {
    try {
      const text = fs.readFileSync(candidatePath, "utf8");
      const checkitems = parseJsonl(text, candidatePath);
      return {
        checkitems,
        sourcePath: candidatePath,
        summary: { total: checkitems.length },
      };
    } catch (error) {
      errors.push(`${candidatePath}: ${error.message}`);
    }
  }

  const detail = errors.map((line) => `- ${line}`).join("\n");
  throw new Error(`No readable michecker-checkitems.json was found.\n${detail}`);
}

module.exports = {
  loadCheckitems,
};
