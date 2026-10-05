import { z } from "zod/v4";
import { withUser, parseBody, ok } from "@/lib/api";
import { createDocumentFromBuffer } from "@/lib/data/documents";

const Body = z.object({
  title: z.string().trim().min(1, "Give your text a title.").max(200),
  text: z.string().min(200, "Paste at least a few paragraphs (200+ characters).").max(600_000, "That's too much text for one document — split it into chapters."),
  subject: z.string().max(80).optional(),
});

export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, Body);
  const doc = await createDocumentFromBuffer(user, { buf: Buffer.from(body.text, "utf8"), type: "paste", filename: "pasted-text.txt", title: body.title, subject: body.subject });
  return ok({ id: doc.id }, { status: 201 });
});
