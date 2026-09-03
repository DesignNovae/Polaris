/**
 * POST /api/strategist
 *
 * Streams a Strategist response over Server-Sent Events. Requires a
 * signed-in user and respects per-plan rate limits.
 *
 * Body: see `StrategistRequestSchema` - accepts optional mode, model,
 * autoSelect, offline, allowPaid params.
 * Response: `text/event-stream` with `StrategistChunk` events.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireSession } from "@/lib/authz";
import { HttpError, parseJson } from "@/lib/api/respond";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { StrategistRequestSchema } from "@/lib/strategist/schemas";
import { sseHeaders, strategistStream } from "@/lib/strategist/stream";
import { getProfile, getLatestRoadmap, getRoadmapV2, getMessages } from "@/lib/db/collections";
import { roadmapContextLines } from "@/lib/roadmap/generate";
import { integrationContextLines } from "@/lib/integrations/service";
import { getAiPref, prefToRoute } from "@/lib/llm/prefs";
import { planMeets, upgradeMessage } from "@/lib/features";
import { BN_ERRORS, requestLanguage } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const language = requestLanguage(req);
  try {
    const user = await requireSession();

    // The AI Strategist is a Pro/Elite feature - Free users get a clear
    // upgrade signal, never a degraded chat (matches FEATURE_ACCESS).
    if (!planMeets(user.plan, "pro")) {
      return NextResponse.json(
        {
          error: upgradeMessage("strategistChat"),
          code: "UPGRADE_REQUIRED",
        },
        { status: 403 },
      );
    }

    const rl = await rateLimit(user.id, user.plan, "chat");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: language === "bn" ? BN_ERRORS.rateLimit : "Rate limit reached. Slow down for a few minutes." },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }

    const body = StrategistRequestSchema.parse(await parseJson(req));

    const [profile, roadmap, roadmapV2, integrationLines, threadMessages] =
      await Promise.all([
        getProfile(user.id),
        getLatestRoadmap(user.id),
        getRoadmapV2(user.id).catch(() => null),
        integrationContextLines(user.id).catch(() => []),
        body.threadId
          ? getMessages(user.id, body.threadId).catch(() => [])
          : Promise.resolve([]),
      ]);

    // Recent turns, used only to rewrite follow-up questions into standalone
    // retrieval queries. The client persists the live message in parallel with
    // this request, so drop it if it already landed - the rewriter should not
    // see the current question twice.
    const history = threadMessages
      .filter((m) => m.text?.trim())
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));
    while (
      history.length > 0 &&
      history[history.length - 1].text.trim() === body.message.trim()
    ) {
      history.pop();
    }
    if (!profile) {
      return NextResponse.json(
        { error: language === "bn" ? BN_ERRORS.completeIntake : "Complete the intake first." },
        { status: 412 },
      );
    }

    // The SAME roadmap doc that renders the tree feeds the Strategist:
    // config, branch focus nodes, recent scores, last adaptation. When the
    // tree changes (task ticked, score entered, replan) the next message
    // already reflects it - the two surfaces can't drift.
    const recentMilestones = roadmapV2
      ? roadmapContextLines(roadmapV2)
      : roadmap?.roadmap.milestones
          .slice(0, 6)
          .map((m) => `${m.title} - ${m.status} - priority ${m.priority}`) ?? [];

    // Live client context: the node the user is focused on right now + the
    // last few roadmap events. The Strategist must answer about THAT node
    // without re-asking for details the roadmap already holds.
    if (roadmapV2 && body.roadmapContext?.selectedNodeId) {
      const node = roadmapV2.branches
        .flatMap((b) => b.nodes.map((n) => ({ n, b })))
        .find(({ n }) => n.id === body.roadmapContext!.selectedNodeId);
      if (node) {
        recentMilestones.push(
          `USER'S SELECTED NODE (answer about this without re-asking): "${node.n.title}" [${node.b.category}] - status ${node.n.status}, progress ${node.n.progress}%, priority ${node.n.priority}, ~${node.n.estimatedHoursPerWeek}h/wk. Do: ${node.n.description} How: ${node.n.how.slice(0, 220)} Done when: ${node.n.completionCriteria}`,
        );
      }
    }
    if (body.roadmapContext?.recentEvents?.length) {
      recentMilestones.push(
        `RECENT ROADMAP EVENTS: ${body.roadmapContext.recentEvents.slice(-8).join(" · ")}`,
      );
    }
    // Connected-tool insights (GitHub portfolio health, Codeforces weak tags…)
    recentMilestones.push(...integrationLines);

    // When the client doesn't send explicit routing, fall back to the user's
    // saved preference (same doc the picker persists) so the choice follows
    // them across devices and stale clients.
    const saved = prefToRoute(await getAiPref(user.id));
    const stream = strategistStream({
      userId: user.id,
      profile,
      recentMilestones,
      userMessage: body.message,
      history,
      mode: body.mode,
      language,
      routeMode: body.routeMode ?? saved.mode,
      preferred: body.model ?? saved.preferred,
      autoSelect: body.autoSelect ?? (body.model ? undefined : saved.autoSelect),
      offline: body.offline ?? saved.offline,
      allowPaid: body.allowPaid ?? saved.allowPaid,
      abortSignal: req.signal,
    });

    return new Response(stream, { headers: { ...sseHeaders(), ...rateLimitHeaders(rl) } });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: language === "bn" ? BN_ERRORS.invalidRequest : "Invalid request body" },
        { status: 400 },
      );
    }
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[strategist] route error:", err);
    return NextResponse.json(
      { error: language === "bn" ? BN_ERRORS.generic : "Something went wrong" },
      { status: 500 },
    );
  }
}
