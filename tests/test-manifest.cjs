/* Manifest compatibility and release URL regression test. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../module.json'),'utf8'));
assert.equal(manifest.id,'stl-combat-workflow');
assert.equal(manifest.title,'WoD20 Combat Workflow');
assert.equal(manifest.compatibility.minimum,'14');
assert.equal(manifest.compatibility.verified,'14');
assert.equal(manifest.relationships.systems.find(x=>x.id==='worldofdarkness')?.compatibility.minimum,'7.3.1');
assert.equal(manifest.manifest,'https://raw.githubusercontent.com/rebsiot/combat-workflow/main/module.json');
assert.equal(manifest.download, "https://github.com/rebsiot/combat-workflow/releases/download/v"+manifest.version+"/stl-combat-workflow-v"+manifest.version+".zip");
console.log('PASS: Foundry 14 core compatibility and versioned manifest/download URLs');
