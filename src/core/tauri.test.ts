// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { isNewerVersion, isTrustedReleaseUrl } from "./tauri";

test("accepts Token Saver GitHub release pages", () => {
  assert.equal(
    isTrustedReleaseUrl("https://github.com/SiruGao/token-saver/releases/tag/v1.1.0"),
    true,
  );
  assert.equal(
    isTrustedReleaseUrl("https://github.com/SiruGao/token-saver/releases/latest"),
    true,
  );
});

test("rejects lookalike hosts and unrelated repositories", () => {
  assert.equal(
    isTrustedReleaseUrl("https://github.com.evil.example/SiruGao/token-saver/releases/tag/v1.1.0"),
    false,
  );
  assert.equal(
    isTrustedReleaseUrl("https://github.com/another/repository/releases/tag/v1.1.0"),
    false,
  );
  assert.equal(isTrustedReleaseUrl("javascript:alert(1)"), false);
});

test("compares packaged and release versions numerically", () => {
  assert.equal(isNewerVersion("1.1.0", "1.0.9"), true);
  assert.equal(isNewerVersion("v2.0.0", "1.9.9"), true);
  assert.equal(isNewerVersion("1.0.0", "1.0.0"), false);
  assert.equal(isNewerVersion("1.0.0-beta.2", "1.0.0"), false);
});
