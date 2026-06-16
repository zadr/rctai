import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

await import("../dist/rctai-builder.js");

const builder = globalThis.RctaiBuilder;
const samplePlan = JSON.parse(readFileSync("../../fixtures/sample.park-plan.json", "utf8"));

function request(method, target, body = "") {
  const headers = [`${method} ${target} HTTP/1.1`, "Host: 127.0.0.1"];
  if (body.length > 0) {
    headers.push("Content-Type: application/json", `Content-Length: ${body.length}`);
  }
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

function controller() {
  return new builder.BuildController(new builder.FakeGameAdapter());
}

test("parses HTTP body using content-length", () => {
  const body = JSON.stringify({ ok: true });
  const parsed = builder.parseHttpRequest(request("POST", "/build", body));

  assert.equal(parsed.ok, true);
  assert.equal(parsed.request.method, "POST");
  assert.equal(parsed.request.path, "/build");
  assert.equal(parsed.request.body, body);
});

test("parses query parameters", () => {
  const parsed = builder.parseHttpRequest(request("GET", "/save?name=my%20park"));

  assert.equal(parsed.ok, true);
  assert.equal(parsed.request.path, "/save");
  assert.equal(parsed.request.query.name, "my park");
});

test("rejects malformed requests", () => {
  assert.equal(builder.parseHttpRequest("GET /health\r\n\r\n").ok, false);
  assert.equal(builder.parseHttpRequest("GET /health HTTP/1.1\r\nBadHeader\r\n\r\n").status, 400);
  assert.equal(builder.parseHttpRequest("POST /build HTTP/1.1\r\nContent-Length: nope\r\n\r\n").status, 400);
});

test("marks partial requests as incomplete", () => {
  const parsed = builder.parseHttpRequest("POST /build HTTP/1.1\r\nContent-Length: 10\r\n\r\n{}");

  assert.equal(parsed.ok, false);
  assert.equal(parsed.incomplete, true);
});

test("routes health", () => {
  const response = builder.handleHttpRequest(request("GET", "/health"), controller());

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
});

test("routes build and enqueues valid park plans", () => {
  const body = JSON.stringify(samplePlan);
  const active = controller();
  const response = builder.handleHttpRequest(request("POST", "/build", body), active);

  assert.equal(response.status, 202);
  assert.equal(response.body.accepted, true);
  assert.equal(active.getStatus().queuedJobs, 1);
});

test("defends build against malformed payloads", () => {
  const active = controller();
  const badJson = builder.handleHttpRequest(request("POST", "/build", "{"), active);
  const badPlan = builder.handleHttpRequest(request("POST", "/build", JSON.stringify({ schemaVersion: 1 })), active);

  assert.equal(badJson.status, 400);
  assert.equal(badPlan.status, 422);
  assert.equal(active.getStatus().queuedJobs, 0);
});

test("routes clear", () => {
  const active = controller();
  const response = builder.handleHttpRequest(request("POST", "/clear"), active);

  assert.equal(response.status, 202);
  assert.equal(response.body.accepted, true);
  assert.equal(active.getStatus().queuedJobs, 1);
});

test("routes save", () => {
  const active = controller();
  const response = builder.handleHttpRequest(request("GET", "/save?name=rctai-test"), active);

  assert.equal(response.status, 202);
  assert.equal(response.body.accepted, true);
  assert.equal(active.getStatus().queuedJobs, 1);
});

test("formats HTTP responses", () => {
  const response = builder.formatHttpResponse({ status: 200, body: { ok: true } });

  assert.match(response, /^HTTP\/1\.1 200 OK\r\n/);
  assert.match(response, /\r\nContent-Type: application\/json; charset=utf-8\r\n/);
  assert.match(response, /\r\n\r\n\{"ok":true\}$/);
});
