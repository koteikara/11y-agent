const fs = require("fs");
const path = require("path");

function getCandidatePaths(rootDir) {
  const envPath = process.env.GOAL2_RULES_PATH;
  return [
    envPath,
    path.join(rootDir, "data", "rules.jsonl"),
    path.join(rootDir, "..", "a11y-migration-kb", "build", "rules.jsonl"),
  ].filter(Boolean);
}

function parseJsonl(text, sourcePath) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        const message = `Invalid JSONL at ${sourcePath}:${index + 1}`;
        error.message = `${message}: ${error.message}`;
        throw error;
      }
    });
}

function summarizeRules(rules) {
  const byCategory = {};
  const byProcessingClass = {};

  for (const rule of rules) {
    byCategory[rule.category] = (byCategory[rule.category] || 0) + 1;
    byProcessingClass[rule.processing_class] =
      (byProcessingClass[rule.processing_class] || 0) + 1;
  }

  return {
    total: rules.length,
    byCategory,
    byProcessingClass,
  };
}

function loadRules(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, "..");
  const errors = [];

  for (const candidatePath of getCandidatePaths(rootDir)) {
    try {
      const text = fs.readFileSync(candidatePath, "utf8");
      const rules = parseJsonl(text, candidatePath);
      return {
        rules,
        sourcePath: candidatePath,
        summary: summarizeRules(rules),
      };
    } catch (error) {
      errors.push(`${candidatePath}: ${error.message}`);
    }
  }

  const detail = errors.map((line) => `- ${line}`).join("\n");
  throw new Error(`No readable rules.jsonl was found.\n${detail}`);
}

module.exports = {
  loadRules,
  parseJsonl,
  summarizeRules,
};
