"use client";

import { useEffect, useState } from "react";

/* The channels, not stored in the db. */
const CHANNELS = [
  { id: "general",      name: "General",      blurb: "Introductions and open questions" },
  { id: "scholarships", name: "Scholarships", blurb: "Aid letters, awards, negotiation" },
  { id: "visa",         name: "Visa",         blurb: "Interviews and document checklists" },
  { id: "mentor-ama",   name: "Mentor AMA",   blurb: "Ask verified mentors anything" },
];

/* One message, as the API sends it back. */
type Message = {
  _id: string;
  userName: string;
  userRole: string;
  text: string;
  createdAt: string;
};

export function CommunityClient() {
  const [channel, setChannel] = useState("general");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  /* Load messages*/
  useEffect(() => {
    fetch("/api/community?channel=" + channel)
      .then((res) => res.json())
      .then((data) => setMessages(data));
  }, [channel]);

  /* Send a message. */
  async function send() {
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, text }),
    });
    const saved = await res.json();

    if (!res.ok) {
      setError(saved.error);
      return;
    }
    setMessages([...messages, saved]);   // add it to the list on screen
    setText("");
    setError("");
  }

  const open = CHANNELS.find((c) => c.id === channel);

  return (
    <div className="h-full flex">
      {/* ─── Channel rail ─── */}
      <aside className="w-56 shrink-0 border-r border-ink/10 p-3 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink/45 px-2 pb-2 font-medium">
          Channels
        </div>
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            onClick={() => setChannel(c.id)}
            className={
              "w-full text-left rounded-lg px-3 py-2 mb-1 text-[13px] font-medium transition-colors " +
              (c.id === channel
                ? "bg-polaris-500 text-white shadow-sm"
                : "text-ink/70 hover:bg-ink/[0.06] hover:text-ink")
            }
          >
            <span className="opacity-50 mr-1">#</span>{c.name}
          </button>
        ))}
      </aside>

      {/* ─── Chat column ─── */}
      <section className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-ink/10 px-6 py-4">
          <h1 className="font-serif text-[19px] font-bold text-ink tracking-tight">
            <span className="text-ink/30">#</span> {open?.name}
          </h1>
          <p className="text-[12.5px] text-ink/55 mt-0.5">{open?.blurb}</p>
        </header>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto polaris-scrollbar px-6 py-5 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <p className="text-[13.5px] text-ink/45">No messages yet.</p>
              <p className="text-[12px] text-ink/35 mt-1">Be the first to post in #{open?.name}.</p>
            </div>
          )}

          {messages.map((m) => (
            <article
              key={m._id}
              className="flex gap-3 rounded-xl bg-bg-card ring-1 ring-inset ring-ink/[0.07] px-4 py-3"
            >
              {/* Initials avatar */}
              <div className="h-8 w-8 shrink-0 rounded-full bg-polaris-500 text-white inline-flex items-center justify-center font-serif font-semibold text-[12px]">
                {(m.userName || "S").slice(0, 1).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-ink">{m.userName}</span>

                  {m.userRole === "partner" && (
                    <span className="rounded-full bg-aurora-100 text-aurora-700 ring-1 ring-inset ring-aurora-400/40 px-2 py-[1px] text-[9.5px] font-bold uppercase tracking-wide">
                      Verified mentor
                    </span>
                  )}
                  {m.userRole === "admin" && (
                    <span className="rounded-full bg-polaris-100 text-polaris-700 ring-1 ring-inset ring-polaris-300 px-2 py-[1px] text-[9.5px] font-bold uppercase tracking-wide">
                      Admin
                    </span>
                  )}

                  <span className="text-[11px] text-ink/40">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-[13.5px] leading-relaxed text-ink/80 mt-1 whitespace-pre-wrap break-words">
                  {m.text}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* Composer */}
        <div className="border-t border-ink/10 px-6 py-4">
          {error && (
            <p className="text-[12px] text-rose-600 mb-2 rounded-lg bg-rose-50 px-3 py-1.5 ring-1 ring-inset ring-rose-200">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={"Message #" + (open?.name ?? "")}
              className="flex-1 rounded-xl bg-bg-card border border-ink/15 px-4 py-2.5 text-[13.5px] text-ink placeholder:text-ink/35 outline-none focus:border-polaris-400 focus:ring-2 focus:ring-polaris-500/15 transition"
            />
            <button
              onClick={send}
              className="rounded-xl bg-polaris-500 hover:bg-polaris-600 text-white px-5 py-2.5 text-[13px] font-semibold transition-colors active:scale-[0.98]"
            >
              Send
            </button>
          </div>

          <p className="text-[11px] text-ink/40 pt-2.5">
            
          </p>
        </div>
      </section>
    </div>
  );
}
