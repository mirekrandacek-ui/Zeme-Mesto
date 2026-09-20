import assert from "node:assert/strict";

function missingInset(systemInset, parentGap, parentPadding) {
  const alreadyHandled = Math.max(0, parentGap, parentPadding);
  return Math.max(0, systemInset - alreadyHandled);
}

const cases = [
  {
    name: "3-button navigation already handled by Capacitor padding",
    args: [144, 0, 144],
    expected: 0,
  },
  {
    name: "gesture navigation already handled by Capacitor padding",
    args: [24, 0, 24],
    expected: 0,
  },
  {
    name: "parent bounds already stop above navigation bar",
    args: [144, 144, 0],
    expected: 0,
  },
  {
    name: "true edge-to-edge parent still needs full navigation inset",
    args: [144, 0, 0],
    expected: 144,
  },
  {
    name: "partially handled inset only adds the missing part",
    args: [144, 0, 80],
    expected: 64,
  },
  {
    name: "no navigation inset needs no correction",
    args: [0, 0, 0],
    expected: 0,
  },
];

for (const testCase of cases) {
  assert.equal(
    missingInset(...testCase.args),
    testCase.expected,
    testCase.name
  );
}

console.log(`Banner inset math: ${cases.length}/${cases.length} scenarios passed.`);
