import { useEffect, useState } from "react";

export default function Diagram({ code }: { code: string }) {
  const [svg, setSvg] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setError(false);
    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          flowchart: { htmlLabels: false },
          fontFamily: "Arial, sans-serif",
        });
        const result = await mermaid.render(
          "diagram-" + crypto.randomUUID(),
          code,
        );
        if (active) setSvg(result.svg);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [code]);
  return (
    <figure className="diagram-result">
      {svg ? (
        <img
          alt="Generated diagram"
          src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)}
        />
      ) : !error ? (
        <p>Rendering diagram…</p>
      ) : (
        <p>The diagram could not be rendered. Its source is available below.</p>
      )}
      <details>
        <summary>Diagram source</summary>
        <pre>{code}</pre>
      </details>
    </figure>
  );
}
