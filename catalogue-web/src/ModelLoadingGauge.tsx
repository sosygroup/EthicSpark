import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";

/** Ollama exposes a duration after loading, not a live percentage. */
export default function ModelLoadingGauge({
  startedAt,
  model,
}: {
  startedAt: number;
  model: string;
}) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((performance.now() - startedAt) / 1000)),
  );
  useEffect(() => {
    const update = () =>
      setElapsed(
        Math.max(0, Math.floor((performance.now() - startedAt) / 1000)),
      );
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  const clock = `${Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`;
  return (
    <div className="model-loading-gauge" aria-label="Model preparation">
      <div className="model-loading-dial">
        <svg viewBox="0 0 84 84" aria-hidden="true">
          <circle
            cx="42"
            cy="42"
            r="38"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
          />
        </svg>
        <CircularProgress
          size={84}
          thickness={3.2}
          aria-label="Model preparation in progress; percentage unavailable"
        />
        <span
          className="model-loading-clock"
          role="timer"
          aria-live="off"
          aria-label={`Elapsed preparation time: ${elapsed} seconds`}
        >
          {clock}
        </span>
      </div>
      <div className="model-loading-description">
        <strong role="status">Preparing model…</strong>
        <span>{model}</span>
        <small>
          Elapsed time · Ollama does not report a loading percentage.
        </small>
      </div>
    </div>
  );
}
