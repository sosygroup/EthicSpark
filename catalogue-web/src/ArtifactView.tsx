import type { Artifact } from "./assistant-types";
import Diagram from "./Diagram";
import VisualImage from "./VisualImage";
import {
  artifactImage,
  isMermaidArtifact,
  downloadArtifact,
} from "./visual-utils";

export default function ArtifactView({ artifact: a }: { artifact: Artifact }) {
  const image = artifactImage(a);
  return (
    <section className="artifact-preview" aria-label={a.name}>
      <div className="artifact-preview-heading">
        <strong>{a.name}</strong>
        <button type="button" onClick={() => downloadArtifact(a)}>
          Download
        </button>
      </div>
      {isMermaidArtifact(a) ? (
        <Diagram code={a.content} />
      ) : image ? (
        <VisualImage src={image} name={a.name} />
      ) : (
        <details>
          <summary>Preview source</summary>
          <pre>{a.content}</pre>
        </details>
      )}
    </section>
  );
}
