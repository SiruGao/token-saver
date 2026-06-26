// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./strategies.ts", import.meta.url), "utf8");

test("Strategy Hub renders a real Headroom adapter surface", () => {
  assert.match(source, /function headroomSetupCard/);
  assert.match(source, /Install and activate/);
  assert.match(source, /Broad context compression is active/);
  assert.match(source, /tokens saved in local ledger/);
  assert.match(source, /Routed:/);
  assert.match(source, /Remove route/);
});

test("metadata candidates are separated from executable integrations", () => {
  assert.match(source, /Candidate metadata only/);
  assert.match(source, /not active until a reviewed executable adapter/);
  assert.match(source, /!\["rtk", "headroom"\]\.includes\(strategy\.id\)/);
  assert.match(source, /Registry selection does not mean installed or active/);
});
