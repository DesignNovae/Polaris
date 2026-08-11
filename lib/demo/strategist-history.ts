export type DemoStrategistMode = "general" | "research" | "study" | "coding";
export type DemoStrategistSurface = "main" | "sidebar";

export type DemoStrategistSource = {
  label: string;
  uri: string;
  kind: "kb" | "case" | "web" | "profile" | "roadmap";
};

export type DemoStrategistMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources: DemoStrategistSource[];
  createdAt: string;
};

export type DemoStrategistThread = {
  id: string;
  title: string;
  mode: DemoStrategistMode;
  surfaces: DemoStrategistSurface[];
  createdAt: string;
  lastMessageAt: string;
  messages: DemoStrategistMessage[];
};

type DemoStrategistHistory = {
  version: 1;
  activeId: string | null;
  threads: DemoStrategistThread[];
};

const HISTORY_KEY = "polaris.demo.strategist.history.v1";
export const DEMO_ACTIVE_THREAD_KEY = "polaris.chat.activeThread";
const CHANGE_EVENT = "polaris:demoStrategistHistory";
let memoryCache: DemoStrategistHistory | null = null;

function now() {
  return new Date().toISOString();
}

function initialHistory(): DemoStrategistHistory {
  const createdAt = now();
  return {
    version: 1,
    activeId: "demo-conversation",
    threads: [{
      id: "demo-conversation",
      title: "Why am I at 41% for MIT?",
      mode: "general",
      surfaces: ["main", "sidebar"],
      createdAt,
      lastMessageAt: createdAt,
      messages: [
        {
          id: "demo-welcome-user",
          role: "user",
          text: "Why am I at 41% for MIT?",
          sources: [],
          createdAt,
        },
        {
          id: "demo-welcome-agent",
          role: "assistant",
          text: "Your current estimate reflects a strong academic base, but the evidence profile is still incomplete. The highest-leverage next steps are a stronger standardized-test signal, one verifiable flagship project, and sustained leadership evidence.",
          sources: [],
          createdAt,
        },
      ],
    }],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readStored(): DemoStrategistHistory {
  if (typeof window === "undefined") return initialHistory();
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoStrategistHistory;
      if (parsed.version === 1 && Array.isArray(parsed.threads)) {
        memoryCache = parsed;
        return clone(parsed);
      }
    }
  } catch { /* use the in-memory copy or seed */ }
  if (memoryCache) return clone(memoryCache);
  const seeded = initialHistory();
  writeStored(seeded);
  return clone(seeded);
}

function writeStored(state: DemoStrategistHistory) {
  memoryCache = clone(state);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state));
    if (state.activeId) localStorage.setItem(DEMO_ACTIVE_THREAD_KEY, state.activeId);
    else localStorage.removeItem(DEMO_ACTIVE_THREAD_KEY);
  } catch { /* the module cache still keeps this tab working */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function titleFrom(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 58 ? `${compact.slice(0, 55)}...` : compact || "New conversation";
}

function addSurface(thread: DemoStrategistThread, surface: DemoStrategistSurface) {
  if (!thread.surfaces.includes(surface)) thread.surfaces.push(surface);
}

export function listDemoStrategistThreads(): DemoStrategistThread[] {
  return readStored().threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export function getDemoStrategistThread(id?: string | null): DemoStrategistThread | null {
  const state = readStored();
  const target = id || state.activeId;
  return state.threads.find((thread) => thread.id === target) ?? null;
}

export function selectDemoStrategistThread(id: string) {
  const state = readStored();
  if (!state.threads.some((thread) => thread.id === id)) return;
  state.activeId = id;
  writeStored(state);
}

export function createDemoStrategistThread(
  mode: DemoStrategistMode,
  surface: DemoStrategistSurface,
  title = "New conversation",
): DemoStrategistThread {
  const state = readStored();
  const createdAt = now();
  const thread: DemoStrategistThread = {
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    mode,
    surfaces: [surface],
    createdAt,
    lastMessageAt: createdAt,
    messages: [],
  };
  state.threads.unshift(thread);
  state.activeId = thread.id;
  writeStored(state);
  return clone(thread);
}

export function ensureDemoStrategistThread(
  firstUserText: string,
  mode: DemoStrategistMode,
  surface: DemoStrategistSurface,
): DemoStrategistThread {
  const state = readStored();
  let thread = state.threads.find((item) => item.id === state.activeId);
  if (!thread) {
    return createDemoStrategistThread(mode, surface, titleFrom(firstUserText));
  }
  if (thread.messages.length === 0 && thread.title === "New conversation") {
    thread.title = titleFrom(firstUserText);
  }
  thread.mode = mode;
  addSurface(thread, surface);
  writeStored(state);
  return clone(thread);
}

export function appendDemoStrategistMessage(
  threadId: string,
  message: Omit<DemoStrategistMessage, "id" | "createdAt"> & Partial<Pick<DemoStrategistMessage, "id" | "createdAt">>,
  mode: DemoStrategistMode,
  surface: DemoStrategistSurface,
) {
  const state = readStored();
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread || !message.text.trim()) return;
  const createdAt = message.createdAt || now();
  thread.messages.push({
    id: message.id || crypto.randomUUID(),
    role: message.role,
    text: message.text,
    sources: message.sources || [],
    createdAt,
  });
  if (thread.messages.filter((item) => item.role === "user").length === 1) {
    const firstUser = thread.messages.find((item) => item.role === "user");
    if (firstUser) thread.title = titleFrom(firstUser.text);
  }
  thread.mode = mode;
  addSurface(thread, surface);
  thread.lastMessageAt = createdAt;
  state.activeId = thread.id;
  writeStored(state);
}

export function renameDemoStrategistThread(id: string, title: string) {
  const state = readStored();
  const thread = state.threads.find((item) => item.id === id);
  if (!thread) return;
  thread.title = titleFrom(title);
  writeStored(state);
}

export function removeDemoStrategistThread(id: string) {
  const state = readStored();
  state.threads = state.threads.filter((thread) => thread.id !== id);
  if (state.activeId === id) state.activeId = state.threads[0]?.id ?? null;
  writeStored(state);
}

export function clearDemoStrategistHistory() {
  memoryCache = null;
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(DEMO_ACTIVE_THREAD_KEY);
  } catch { /* the next read can still rebuild the in-memory seed */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}
export function subscribeDemoStrategistHistory(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key !== HISTORY_KEY && event.key !== DEMO_ACTIVE_THREAD_KEY) return;
    memoryCache = null;
    listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
