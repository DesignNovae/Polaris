import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("paper drags never dismiss; a fresh stationary backdrop click does", () => {
  const handlers = new Map<string, ((e: Record<string, unknown>) => void)[]>();
  const messages: unknown[] = [];
  const captured: number[] = [];
  const events = {
    addEventListener(name: string, handler: (e: Record<string, unknown>) => void) {
      handlers.set(name, [...(handlers.get(name) || []), handler]);
    },
  };
  runInNewContext(readFileSync("assets/notice-paper-interaction.js", "utf8"), {
    window: events,
    canvas: { ...events, setPointerCapture: (id: number) => captured.push(id) },
    parent: { postMessage: (message: unknown) => messages.push(message) },
    inQuad: (x: number, y: number) => x >= 100 && x <= 300 && y >= 100 && y <= 400,
    dragging: false,
    release: 0,
  });
  function emit(name: string, x = 200, y = 200) {
    for (const handler of handlers.get(name) || [])
      handler({ pointerId: 1, button: 0, isPrimary: true, clientX: x, clientY: y });
  }
  for (const end of [0, 500]) {
    emit("pointerdown");
    emit("pointermove", end);
    emit("pointerup", end);
    emit("lostpointercapture", end);
    emit("click", end);
  }
  assert.deepEqual(captured, [1, 1]);
  assert.equal(messages.length, 0, "releasing to either side keeps the paper open");

  emit("pointerdown", 0);
  emit("pointermove", 80);
  emit("pointermove", 0);
  emit("pointerup", 0);
  emit("click", 0);
  assert.equal(messages.length, 0, "an out-and-back drag is still not a click");

  emit("pointerdown", 0);
  emit("pointercancel", 0);
  emit("click", 0);
  assert.equal(messages.length, 0, "cancelled gestures do not dismiss");

  emit("pointerdown", 0);
  emit("pointerup", 0);
  emit("click", 0);
  assert.equal(messages.length, 1, "a new outside click dismisses once");
  emit("click", 0);
  assert.equal(messages.length, 1, "a click without a fresh press cannot dismiss");
});
