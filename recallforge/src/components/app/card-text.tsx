/** Renders card text; cloze markup {{term}} becomes a blank (front) or highlighted term (back). */
export function CardText({ text, cloze, reveal }: { text: string; cloze?: boolean; reveal?: boolean }) {
  if (!cloze) return <>{text}</>;
  const parts = text.split(/(\{\{.+?\}\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{\{(.+?)\}\}$/);
        if (!m) return <span key={i}>{p}</span>;
        return reveal ? (
          <mark key={i} className="rounded bg-primary-soft px-1 font-semibold text-primary">
            {m[1]}
          </mark>
        ) : (
          <span key={i} className="mx-0.5 inline-block min-w-[4ch] border-b-2 border-primary text-center text-primary" aria-label="blank">
            [ … ]
          </span>
        );
      })}
    </>
  );
}
