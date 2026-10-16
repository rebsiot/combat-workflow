/* Static CSS regression check: combat actions must remain legible in dark WoD20 chat. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const css = fs.readFileSync(path.join(__dirname, "../styles/combat-workflow.css"), "utf8");

function rule(selector) {
  const literal = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matched = css.match(new RegExp(literal + "\\s*\\{([^}]+)\\}"));
  assert.ok(matched, `Missing CSS selector: ${selector}`);
  return matched[1];
}
function prop(block, name) {
  const match = block.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`));
  assert.ok(match, `Missing ${name}`);
  return match[1].replace(/\s*!important\s*$/, "").trim();
}
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(n => parseInt(n, 16) / 255);
  return channels.map(c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4))
    .reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
}
function contrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
const normal = rule(".stl-combat-card .stl-combat-actions button");
const hover = rule(".stl-combat-card .stl-combat-actions button:focus-visible");
const disabled = rule(".stl-combat-card .stl-combat-actions button:disabled");
for (const [name, block] of [["normal", normal], ["hover/focus", hover], ["disabled", disabled]]) {
  const ratio = contrast(prop(block, "color"), prop(block, "background"));
  assert.ok(ratio >= 4.5, `${name} button contrast ${ratio.toFixed(2)} is below 4.5:1`);
  if (name !== "hover/focus") assert.match(block, /opacity\s*:\s*1\s*!important/, `${name} button is faded by a theme`);
  console.log(`${name} button contrast: ${ratio.toFixed(2)}:1`);
}
assert.match(css, /\.stl-combat-card \.stl-combat-actions button\s*\{/, "CSS must be card scoped");
assert.match(css, /\.stl-combat-card \.stl-combat-actions button:hover:not\(:disabled\)/, "Missing hover state");
console.log("Chat action contrast styling: PASS");
