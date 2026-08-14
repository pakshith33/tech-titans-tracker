#!/usr/bin/env node
/**
 * Local parser smoke test (no Firebase, no network).
 * Usage (from functions/): npm run test:parse
 */
const fs = require("fs");
const path = require("path");
const { parseScorecardHtml } = require("./parseScorecard");

const samplePath = path.join(__dirname, "..", "Sample Scorecard.html");
if (!fs.existsSync(samplePath)) {
  console.error("Missing Sample Scorecard.html at", samplePath);
  process.exit(1);
}

const html = fs.readFileSync(samplePath, "utf8");
const result = parseScorecardHtml(html, {
  sourceUrl:
    "https://cricheroes.com/scorecard/26150403/rising-cup-season-54-saturday/hawks-vs-tech-titans/scorecard",
});

console.log(JSON.stringify(result, null, 2));

const problems = [];
if (result.matchId !== "26150403") problems.push(`matchId=${result.matchId}`);
if (!result.matchName || !/vs/i.test(result.matchName)) {
  problems.push(`matchName=${result.matchName}`);
}
if (result.date !== "2026-07-18") problems.push(`date=${result.date}`);
if (!result.teams || result.teams.length !== 2) {
  problems.push(`teams.length=${result.teams && result.teams.length}`);
} else {
  for (const t of result.teams) {
    if (!t.players || t.players.length < 8) {
      problems.push(`${t.name} players=${t.players && t.players.length}`);
    }
  }
}

if (problems.length) {
  console.error("\nSMOKE TEST FAILED:", problems.join("; "));
  process.exit(1);
}

console.error("\nSMOKE TEST PASSED");
