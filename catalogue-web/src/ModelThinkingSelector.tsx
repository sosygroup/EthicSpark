import { useEffect, useState } from "react";
import { MenuItem, TextField } from "@mui/material";
import type { ThinkingOptions } from "./model-thinking";
import { thinkingChoice, thinkingLabel } from "./model-thinking";
import { reportIssue } from "./notification-store";

export default function ModelThinkingSelector({
  model,
  value,
  onChange,
  disabled,
}: {
  model: string;
  value: string;
  onChange: (choice: string) => void;
  disabled: boolean;
}) {
  const [options, setOptions] = useState<ThinkingOptions | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setOptions(null);
    if (!model.trim()) {
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    void fetch("/api/reasoning/providers/ollama/thinking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model.trim() }),
      signal: abort.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.detail || "Cannot read this model's reasoning controls.",
          );
        return data as ThinkingOptions;
      })
      .then((data) => {
        if (!abort.signal.aborted) setOptions(data);
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          reportIssue(error.message, "Ollama reasoning settings", "warning");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [model]);
  const choices = options?.model === model.trim() ? options.values : [];
  const stale =
    value !== "auto" &&
    value !== "default" &&
    !choices.some((option) => thinkingChoice(option) === value);
  return (
    <div className="thinking-settings">
      <TextField
        fullWidth
        select
        label="Reasoning level"
        value={value}
        disabled={disabled || !model.trim()}
        onChange={(event) => onChange(event.target.value)}
        helperText={
          loading
            ? "Checking this model's supported controls…"
            : stale
              ? "This saved choice is not currently advertised. Requests use model default if it is unsupported."
              : "Remembered for this model. Automatic applies a compatible server preference; otherwise the model default is used."
        }
      >
        <MenuItem value="auto">Automatic (compatible)</MenuItem>
        <MenuItem value="default">Model default</MenuItem>
        {choices.map((option) => (
          <MenuItem key={thinkingChoice(option)} value={thinkingChoice(option)}>
            {thinkingLabel(option)}
          </MenuItem>
        ))}
        {stale && (
          <MenuItem value={value} disabled>
            Saved choice · not currently available
          </MenuItem>
        )}
      </TextField>
      {options && (
        <small>
          Automatic now: {thinkingLabel(options.automaticValue)}.{" "}
          {options.defaultValue !== null
            ? `Model default: ${thinkingLabel(options.defaultValue)}.`
            : "The model has not advertised a default value."}{" "}
          {choices.length === 0
            ? "No adjustable thinking controls are advertised."
            : "Only controls supported by this model are listed."}
        </small>
      )}
      <p>
        Lower reasoning can reduce processing time on models that support
        levels. Loading memory depends mainly on the model size, quantization
        and context; lowering reasoning may not make a model fit in RAM.
        Automatic uses model capabilities, not a hardware benchmark.
      </p>
    </div>
  );
}
