"use client";

/**
 * Effort points, in full.
 *
 * The level ring is the hero: a dimensional dial that fills as the level does,
 * with the star sitting proud of it. The 3D is doing a job here rather than
 * decorating - a ring you can tilt reads as an instrument, which is the
 * register this product wants, where a flat percentage bar reads as a game.
 *
 * The weekly goal is a slider because the student sets it themselves. A target
 * someone chose is motivating; a target imposed on them is a chore, and that
 * difference is the entire reason this control exists rather than a constant.
 *
 * The daily cap is stated plainly rather than hidden. A student who discovers
 * a ceiling by hitting it feels cheated; one who is told about it understands
 * the number means "a day's work", which is what it is for.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/cn";
import { Card } from "./ui";
import {
  DAILY_CAP,
  WEEKLY_GOAL_MAX,
  WEEKLY_GOAL_MIN,
  WEEKLY_GOAL_STEP,
} from "@/lib/xp/rules";

export type XpDto = {
  total: number;
  today: number;
  dailyCap: number;
  week: number;
  weeklyGoal: number;
  weekPercent: number;
  weekDays: Array<{ day: string; earned: number }>;
  level: {
    level: number;
    name: string;
    floor: number;
    ceiling: number;
    into: number;
    remaining: number;
    percent: number;
  };
};

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

export function XpPanel({ initial }: { initial: XpDto }) {
  const [data, setData] = useState<XpDto>(initial);
  const [goal, setGoal] = useState(initial.weeklyGoal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<number | undefined>(undefined);

  // Debounced: dragging a slider must not fire a write per pixel.
  const commitGoal = useCallback((next: number) => {
    setGoal(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaving(true);
      setError("");
      try {
        const res = await fetch("/api/xp", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ weeklyGoal: next }),
        });
        if (!res.ok) throw new Error("Could not save your goal");
        const d = (await res.json()) as { weeklyGoal: number };
        setGoal(d.weeklyGoal);
        setData((prev) => ({
          ...prev,
          weeklyGoal: d.weeklyGoal,
          weekPercent: Math.min(100, Math.round((prev.week / Math.max(1, d.weeklyGoal)) * 100)),
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setSaving(false);
      }
    }, 450);
  }, []);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const capLeft = Math.max(0, data.dailyCap - data.today);
  const weekMax = Math.max(DAILY_CAP, ...data.weekDays.map((d) => d.earned));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      {/* ── Level dial ── */}
      <Card className="flex flex-col items-center p-6">
        <LevelDial percent={data.level.percent} level={data.level.level} />
        <div className="mt-4 text-center">
          <div className="font-serif text-[20px] font-bold leading-tight text-ink">
            {data.level.name}
          </div>
          <div className="mt-1 text-[11.5px] text-ink-dim">
            <span className="font-mono tabular-nums">{data.total.toLocaleString()}</span> points earned
          </div>
          <div className="mt-3 text-[11.5px] text-ink-muted">
            {data.level.remaining > 0 ? (
              <>
                <span className="font-mono tabular-nums text-ink">{data.level.remaining}</span> to
                the next level
              </>
            ) : (
              "Top of the current band"
            )}
          </div>
        </div>
      </Card>

      {/* ── Week ── */}
      <Card className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-ink">This week</h3>
          <div className="text-[12.5px] text-ink-dim">
            <span className="font-mono tabular-nums text-ink">{data.week}</span>
            {" of "}
            <span className="font-mono tabular-nums">{goal}</span> points
          </div>
        </div>

        {/* goal progress */}
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper-deep dark:bg-white/[0.07]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-polaris-500 to-nova-400"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.round((data.week / Math.max(1, goal)) * 100))}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        {/* day bars */}
        <div className="mt-5 flex items-end gap-2" role="img" aria-label="Points earned each day this week">
          {data.weekDays.map((d, i) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-mono text-[9.5px] tabular-nums text-ink-muted">
                {d.earned || ""}
              </span>
              <motion.div
                className={cn(
                  "w-full rounded-t-md",
                  d.earned >= DAILY_CAP
                    ? "bg-gradient-to-t from-nova-500 to-nova-300"
                    : d.earned > 0
                      ? "bg-gradient-to-t from-polaris-500 to-polaris-400"
                      : "bg-ink/[0.08] dark:bg-white/[0.08]",
                )}
                style={{ minHeight: 4 }}
                initial={{ height: 4 }}
                animate={{ height: Math.max(4, (d.earned / weekMax) * 84) }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                title={`${d.day}: ${d.earned} points`}
              />
              <span className="text-[9.5px] font-semibold text-ink-muted">{DOW[i]}</span>
            </div>
          ))}
        </div>

        {/* goal control */}
        <div className="mt-6 border-t border-ink/[0.07] pt-4 dark:border-white/[0.08]">
          <label htmlFor="weekly-goal" className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[12.5px] font-semibold text-ink">Your weekly target</span>
            <span className="font-mono text-[12px] tabular-nums text-ink-dim">
              {goal} points{saving && <span className="ml-2 text-ink-muted">saving…</span>}
            </span>
          </label>
          <input
            id="weekly-goal"
            type="range"
            min={WEEKLY_GOAL_MIN}
            max={WEEKLY_GOAL_MAX}
            step={WEEKLY_GOAL_STEP}
            value={goal}
            onChange={(e) => commitGoal(Number(e.target.value))}
            className="mt-2.5 w-full accent-polaris-500"
          />
          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            You set this, not us. Today has earned{" "}
            <span className="font-mono tabular-nums">{data.today}</span> of a{" "}
            <span className="font-mono tabular-nums">{data.dailyCap}</span> daily
            maximum
            {capLeft > 0
              ? <> &mdash; <span className="font-mono tabular-nums">{capLeft}</span> still available today.</>
              : <> &mdash; today is full, which is the cap doing its job.</>}
          </p>
          {error && <p role="alert" className="mt-2 text-[11.5px] text-rose-600 dark:text-rose-300">{error}</p>}
        </div>
      </Card>
    </div>
  );
}

/**
 * The dial. Tilts toward the pointer on a spring, with the ring and the star
 * on separate depth planes so the parallax between them reads as thickness.
 */
function LevelDial({ percent, level }: { percent: number; level: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 200, damping: 20, mass: 0.6 };
  const rotateY = useTransform(useSpring(px, spring), [-0.5, 0.5], [-20, 20]);
  const rotateX = useTransform(useSpring(py, spring), [-0.5, 0.5], [16, -16]);

  const size = 168;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      ref={ref}
      style={{ perspective: 800 }}
      onPointerMove={(e) => {
        if (reduce) return;
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        px.set((e.clientX - box.left) / box.width - 0.5);
        py.set((e.clientY - box.top) / box.height - 0.5);
      }}
      onPointerLeave={() => { px.set(0); py.set(0); }}
    >
      <motion.div
        style={{
          rotateX: reduce ? 0 : rotateX,
          rotateY: reduce ? 0 : rotateY,
          transformStyle: "preserve-3d",
          width: size,
          height: size,
        }}
        className="relative grid place-items-center"
      >
        {/* base plate, sunk behind the ring */}
        <span
          aria-hidden
          className="absolute inset-3 rounded-full bg-gradient-to-br from-polaris-500/12 to-nova-400/10 blur-md"
          style={{ transform: "translateZ(-26px)" }}
        />

        <svg width={size} height={size} className="-rotate-90" style={{ transform: "translateZ(10px)" }}>
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
            className="stroke-paper-deep dark:stroke-white/[0.08]"
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
            strokeLinecap="round"
            stroke="url(#levelDialStroke)"
            strokeDasharray={c}
            initial={reduce ? false : { strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (c * percent) / 100 }}
            transition={{ duration: reduce ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
          <defs>
            <linearGradient id="levelDialStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B5E3C" />
              <stop offset="55%" stopColor="#C47D4E" />
              <stop offset="100%" stopColor="#5B8C6D" />
            </linearGradient>
          </defs>
        </svg>

        {/* the number, standing proud of the ring */}
        <span
          className="absolute grid place-items-center text-center"
          style={{ transform: "translateZ(40px)" }}
        >
          <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-ink-muted">
            Level
          </span>
          <span className="font-serif text-[42px] font-bold leading-none tabular-nums text-ink">
            {level}
          </span>
          <span className="mt-1 font-mono text-[10px] tabular-nums text-ink-muted">
            {percent}%
          </span>
        </span>
      </motion.div>
    </div>
  );
}
