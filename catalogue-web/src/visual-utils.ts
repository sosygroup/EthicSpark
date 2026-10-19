import type { Artifact } from "./assistant-types";

/** Only repair the unambiguous missing space in a flowchart header. */
export function normalizeMermaid(source: string): string {
  return source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .replace(/^(graph|flowchart)(TB|TD|BT|RL|LR)\b/, "$1 $2");
}
export function isMermaidArtifact(a: Artifact): boolean {
  return (
    /\.(mmd|mermaid)$/i.test(a.name) ||
    a.mediaType.split(";")[0].trim() === "text/vnd.mermaid"
  );
}
/** Never fetch an arbitrary model-supplied image URL. SVGs are rendered as images, not DOM. */
export function artifactImage(a: Artifact): string | null {
  if (a.content.length > 200000) return null;
  if (
    a.mediaType.split(";")[0].trim() === "image/svg+xml" ||
    /\.svg$/i.test(a.name)
  ) {
    if (!/<svg[\s>]/i.test(a.content)) return null;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(a.content);
  }
  const content = a.content.trim();
  if (
    !/^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(content)
  )
    return null;
  const normalized = content.replace(/\s/g, "");
  try {
    atob(normalized.split(",")[1]);
  } catch {
    return null;
  }
  return normalized;
}
export function downloadArtifact(a: Artifact) {
  const raster = artifactImage(a);
  const binary =
    raster?.startsWith("data:image/") && raster.includes(";base64,");
  const blob = binary
    ? new Blob(
        [Uint8Array.from(atob(raster!.split(",")[1]), (c) => c.charCodeAt(0))],
        { type: raster!.slice(5, raster!.indexOf(";")) },
      )
    : new Blob([a.content], { type: a.mediaType || "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = a.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
