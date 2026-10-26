import test from "node:test";
import assert from "node:assert/strict";
import { readResearchEvents } from "../../lib/market/stream.ts";
import { worldBank } from "../../lib/market/data.ts";

function bytes(text: string, chunkSize = 7) {
  const data = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < data.length; i += chunkSize) controller.enqueue(data.slice(i, i + chunkSize));
      controller.close();
    },
  });
}
async function read(text: string, chunkSize?: number) {
  const events = [];
  for await (const event of readResearchEvents(bytes(text, chunkSize))) events.push(event);
  return events;
}
const result = JSON.stringify({type:"result",run:{status:"completed"}});

test("research streams retain split UTF-8 characters and a final line without newline", async () => {
  const progress = {type:"progress",stage:"collect",message:"正在读取资料"};
  const events = await read(JSON.stringify(progress) + "\n\n" + result, 1);
  assert.deepEqual(events[0], progress);
  assert.equal(events.at(-1)?.type, "result");
});

test("a truncated research stream cannot be reported as completed", async () => {
  await assert.rejects(read('{"type":"heartbeat"}\n'), /连接已中断/);
  await assert.rejects(read('{"type":"result","run":'), SyntaxError);
});

test("research streams reject explicit errors and incomplete results", async () => {
  await assert.rejects(read('{"type":"error","message":"服务暂不可用"}\n'), /服务暂不可用/);
  await assert.rejects(read('{"type":"result","run":{"status":"failed"}}\n'), /格式无效/);
});

test("oversized research messages release the stream reader on failure", async () => {
  const body = bytes("x".repeat(4_000_001), 4_000_001);
  await assert.rejects(async () => {
    for await (const event of readResearchEvents(body)) assert.fail(String(event));
  }, /响应过长/);
  assert.equal(body.locked, false);
});

test("World Bank requests observe research cancellation", async () => {
  const abort = new AbortController();
  abort.abort();
  const fake: typeof fetch = async (_url, init) => {
    assert.equal(init?.signal?.aborted, true);
    init?.signal?.throwIfAborted();
    throw new Error("Expected cancellation");
  };
  await assert.rejects(worldBank(["SGP"], fake, abort.signal), {name:"AbortError"});
});
