import { test } from "node:test";
import assert from "node:assert/strict";
import { isOwnOrDraft } from "../src/lib/filter";

const m = (address: string, isDraft = false) => ({ isDraft, from: { emailAddress: { address } } });

test("drafts are skipped", () => assert.equal(isOwnOrDraft(m("a@b.de", true), ""), true));
test("own address skipped, case-insensitive", () =>
  assert.equal(isOwnOrDraft(m("Me@Outlook.com"), "x@y.de, me@outlook.com"), true));
test("other senders kept", () => assert.equal(isOwnOrDraft(m("abo@kvv.karlsruhe.de"), "me@outlook.com"), false));
test("empty own list keeps everything", () => assert.equal(isOwnOrDraft(m("me@outlook.com"), ""), false));
