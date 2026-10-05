// The "What should I generate?" categories and how they map onto concept kinds.
export const FOCUS_OPTIONS = [
  { id: "core", label: "Core concepts", kinds: ["concept", "classification"] },
  { id: "definitions", label: "Definitions", kinds: ["definition"] },
  { id: "theories", label: "Theories", kinds: ["theory"] },
  { id: "scholars", label: "Scholars and contributions", kinds: ["scholar"] },
  { id: "examples", label: "Examples", kinds: ["example"] },
  { id: "cause_effect", label: "Cause-effect relationships", kinds: ["cause_effect", "mechanism"] },
  { id: "comparisons", label: "Comparisons", kinds: ["comparison"] },
  { id: "processes", label: "Processes", kinds: ["process", "method"] },
  { id: "critical", label: "Critical thinking questions", kinds: ["controversy", "evidence"] },
  { id: "exam", label: "Exam questions", kinds: [] as string[] },
  { id: "dates", label: "Dates/facts", kinds: ["date_fact", "formula"] },
] as const;

export type FocusId = (typeof FOCUS_OPTIONS)[number]["id"];

export function kindsForFocus(focus: string[]): Set<string> {
  const kinds = new Set<string>();
  for (const f of FOCUS_OPTIONS) if (focus.includes(f.id)) f.kinds.forEach((k) => kinds.add(k));
  return kinds;
}
