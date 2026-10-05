// Generates a realistic multi-page textbook-style PDF for tests:
// running header, page numbers, larger-font headings, wrapped paragraphs.
import fs from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const TOPICS: [string, string[]][] = [
  ["Platformization", [
    "Platformization refers to the penetration of the infrastructures, economic processes and governance frameworks of digital platforms into different sectors of society.",
    "News organisations increasingly depend on platforms for distribution, which shifts power over visibility from editors to platform companies.",
  ]],
  ["Algorithmic curation", [
    "Algorithmic curation is the automated ranking and filtering of content by software.",
    "Unlike editorial gatekeeping, algorithmic curation is optimised for signals such as engagement, and its criteria are rarely transparent.",
  ]],
  ["Gatekeeping", [
    "Gatekeeping is the process by which editors and journalists select which events become news.",
    "David Manning White (1950) studied how a wire editor chose stories for publication.",
  ]],
  ["Mediatization", [
    "Mediatization is the process through which media increasingly shape institutions, practices and social interaction.",
    "Political communication changes because parties adapt their messages to media logic.",
  ]],
  ["Media accountability", [
    "Media accountability is the set of processes through which media organisations answer to the public for their conduct.",
    "Traditional accountability theory often assumes Western institutional structures and overlooks hybrid media environments.",
  ]],
];


// Additional distinct terms so long fixtures yield many different concepts.
const EXTRA: [string, string][] = [
  ["Agenda setting", "the process by which news coverage influences which issues the public considers important"],
  ["Framing", "the selection and emphasis of certain aspects of an issue to promote a particular interpretation"],
  ["Priming", "the effect by which media coverage makes some criteria more salient when people evaluate leaders"],
  ["Filter bubble", "a state of informational isolation produced by personalised recommendation systems"],
  ["Echo chamber", "an environment in which people encounter only beliefs that amplify their own"],
  ["Network effects", "the increase in a platform's value as more users join it"],
  ["Datafication", "the transformation of social action into quantified data that can be tracked and analysed"],
  ["Surveillance capitalism", "an economic logic that turns behavioural data into predictions sold to advertisers"],
  ["Content moderation", "the screening and removal of user content according to platform rules"],
  ["Platform governance", "the rules and enforcement practices through which platforms regulate user activity"],
  ["Media literacy", "the ability to access, analyse, evaluate and create media messages"],
  ["Public sphere", "a space in which citizens discuss matters of common concern and form public opinion"],
  ["Cultivation theory", "the idea that long-term television exposure shapes viewers' perceptions of social reality"],
  ["Uses and gratifications", "an approach that studies why audiences actively choose particular media"],
  ["Two-step flow", "the model in which media influence passes through opinion leaders to wider publics"],
  ["Spiral of silence", "the tendency of people to stay quiet when they believe their view is in the minority"],
  ["Hybrid media system", "an environment in which older and newer media logics interact and compete"],
  ["Attention economy", "a market in which human attention is treated as a scarce resource to be captured"],
  ["Native advertising", "paid content designed to match the form and style of the surrounding editorial content"],
  ["Disinformation", "false information spread deliberately to deceive"],
  ["Misinformation", "false information spread without intent to deceive"],
  ["Remediation", "the representation of one medium within another"],
  ["Convergence culture", "the flow of content across multiple platforms and the migratory behaviour of audiences"],
  ["Participatory culture", "a culture with low barriers to artistic expression and strong support for sharing creations"],
  ["Algorithmic bias", "systematic errors in automated systems that produce unfair outcomes for some groups"],
];

function wrap(text: string, max = 88): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function makeTextbookPdf(pages = 60): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Digital Media Theory — Chapter 4");
  const body = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  for (let p = 1; p <= pages; p++) {
    const page = pdf.addPage([595, 842]);
    page.drawText("Digital Media Theory — Chapter 4", { x: 60, y: 805, size: 9, font: body, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(String(p), { x: 290, y: 30, size: 9, font: body });
    let y = 760;
    const [heading, sentences] = TOPICS[(p - 1) % TOPICS.length];
    if ((p - 1) % 3 === 0) {
      page.drawText(`${Math.floor((p - 1) / 3) + 1}. ${heading}${p > 15 ? ` (${Math.ceil(p / 15)})` : ""}`, { x: 60, y, size: 18, font: bold });
      y -= 34;
    }
    const [term, def] = EXTRA[(p - 1) % EXTRA.length];
    const paras = [...sentences, `${term} is ${def}.`];
    for (let k = 0; k < 4; k++) {
      const para = `${paras[k % paras.length]} This point is developed further on page ${p} with examples from contemporary media systems and the debates they have generated among scholars.`;
      for (const line of wrap(para)) {
        page.drawText(line, { x: 60, y, size: 11, font: body });
        y -= 15;
      }
      y -= 12;
    }
  }
  return Buffer.from(await pdf.save());
}

if (process.argv[1]?.endsWith("make-pdf.ts")) {
  makeTextbookPdf(Number(process.argv[2] ?? 60)).then((b) => {
    fs.writeFileSync(process.argv[3] ?? "tests/fixtures/textbook-60.pdf", b);
    console.log("written", b.length);
  });
}
