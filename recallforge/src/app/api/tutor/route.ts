import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody, jsonError } from "@/lib/api";
import { getAI } from "@/lib/ai";
import { retrieveSections } from "@/lib/data/search";
import { assertFeature, assertQuota, incrementUsage } from "@/lib/billing/usage";
import { enforceRateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/events";

export const runtime = "nodejs";

const Body = z.object({ deckId: z.string(), threadId: z.string().min(4).max(64), message: z.string().trim().min(1).max(4000) });

export const GET = withUser(async (req, user) => {
  const threadId = req.nextUrl.searchParams.get("threadId");
  const deckId = req.nextUrl.searchParams.get("deckId");
  if (!threadId && !deckId) return ok({ messages: [] });
  const messages = await db.tutorMessage.findMany({
    where: { userId: user.id, ...(threadId ? { threadId } : { deckId }) },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return ok({ messages });
});

/** Streams a grounded tutor answer (RAG over the deck's source document). Sources are sent in the X-Sources header. */
export const POST = withUser(async (req, user) => {
  const b = await parseBody(req, Body);
  const deck = await db.deck.findFirst({ where: { id: b.deckId, userId: user.id } });
  if (!deck) return jsonError("Deck not found.", 404);
  if (!deck.isSample) assertFeature(user, "tutor");
  await enforceRateLimit(`ai:${user.id}`, 60, 600);
  await assertQuota(user, "ai");

  const history = await db.tutorMessage.findMany({ where: { userId: user.id, threadId: b.threadId }, orderBy: { createdAt: "asc" }, take: 20 });
  const retrieved = deck.documentId ? await retrieveSections(user.id, deck.documentId, `${history.slice(-2).map((m) => m.content).join(" ")} ${b.message}`, 5) : [];
  const sources = retrieved.map((s) => ({ id: s.id, heading: s.path ?? s.heading, text: s.text, pageStart: s.pageStart }));
  await db.tutorMessage.create({ data: { userId: user.id, deckId: deck.id, threadId: b.threadId, role: "user", content: b.message } });

  const stream = getAI().tutorStream(
    { messages: [...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })), { role: "user", content: b.message }], sources },
    { userId: user.id, purpose: "tutor" },
  );
  const citations = sources.map((s, i) => ({ ref: `S${i + 1}`, sectionId: s.id, heading: s.heading, page: s.pageStart ?? null }));
  const encoder = new TextEncoder();
  let full = "";
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const piece of stream) {
          full += piece;
          controller.enqueue(encoder.encode(piece));
        }
      } catch {
        const msg = "\n\n(The tutor is temporarily unavailable. Please try again.)";
        full += msg;
        controller.enqueue(encoder.encode(msg));
      } finally {
        controller.close();
        await db.tutorMessage.create({ data: { userId: user.id, deckId: deck.id, threadId: b.threadId, role: "assistant", content: full, citations } }).catch(() => {});
        await incrementUsage(user.id, "aiRequests", 1);
        await track("tutor_used", user.id, { sources: sources.length });
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Sources": encodeURIComponent(JSON.stringify(citations)) },
  });
});
