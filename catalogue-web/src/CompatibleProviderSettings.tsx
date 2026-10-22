import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  TextField,
} from "@mui/material";
type View = {
  baseUrl: string;
  hasApiKey: boolean;
  tokenParameter: string;
  maxTokens: number;
  jsonMode: boolean;
  connectionId: string;
};
export default function CompatibleProviderSettings({
  disabled,
  onSaved,
}: {
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState<View | null>(null),
    [key, setKey] = useState(""),
    [clear, setClear] = useState(false),
    [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/reasoning/providers/compatible/config")
      .then(async (r) => {
        if (!r.ok) throw Error("Cannot read provider settings.");
        return r.json();
      })
      .then((data) => {
        if (active) setValue(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(forget = false) {
    if (!value) return;
    setWorking(true);
    setError("");
    setSaved(false);
    try {
      const body = forget
        ? {
            baseUrl: "",
            clearApiKey: true,
            tokenParameter: "max_tokens",
            maxTokens: 4096,
            jsonMode: false,
          }
        : {
            baseUrl: value.baseUrl,
            apiKey: key || null,
            clearApiKey: clear,
            tokenParameter: value.tokenParameter,
            maxTokens: Number(value.maxTokens),
            jsonMode: value.jsonMode,
          };
      const response = await fetch(
        "/api/reasoning/providers/compatible/config",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw Error(data.detail || "Cannot save provider settings.");
      setValue(data);
      setKey("");
      setClear(false);
      await onSaved();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  const locked = disabled || working;
  return (
    <section
      className="compatible-settings"
      aria-label="OpenAI-compatible connection"
    >
      <h3>OpenAI-compatible connection</h3>
      <p>
        Use your provider's API base URL and API key. This is a separate
        connection from official OpenAI. Saving sends settings only to the local
        backend; it does not contact the provider or send project material.
      </p>
      {error && <Alert severity="error">{error}</Alert>}
      {saved && (
        <Alert severity="success">
          Connection settings saved. Load or enter a model ID and authorise this
          connection for your project.
        </Alert>
      )}
      {value && (
        <>
          <TextField
            fullWidth
            label="API base URL"
            placeholder="https://provider.example/v1"
            value={value.baseUrl}
            disabled={locked}
            onChange={(e) => {
              setValue({ ...value, baseUrl: e.target.value });
              setSaved(false);
            }}
            helperText="Include the API path/version prefix; omit /chat/completions. With a key only, the base defaults to https://api.openai.com/v1. In Docker, use host.docker.internal to reach a server on this machine."
          />
          <TextField
            fullWidth
            type="password"
            label="Provider API key (optional)"
            value={key}
            disabled={locked || clear}
            autoComplete="new-password"
            onChange={(e) => setKey(e.target.value)}
            helperText={
              value.hasApiKey
                ? "A key is saved on the backend. Leave blank to keep it for the same URL. Changing the URL clears the old key unless you enter a replacement."
                : "Use any provider-issued key format. Leave empty for a service that does not require authentication."
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={clear}
                disabled={locked}
                onChange={(e) => setClear(e.target.checked)}
              />
            }
            label="Remove saved API key"
          />
          <details className="compatibility-options">
            <summary>Advanced compatibility options</summary>
            <div>
              <TextField
                select
                fullWidth
                label="Output token parameter"
                value={value.tokenParameter}
                disabled={locked}
                onChange={(e) =>
                  setValue({ ...value, tokenParameter: e.target.value })
                }
                helperText="Choose the parameter accepted by your provider. Official OpenAI settings are unaffected."
              >
                <MenuItem value="max_tokens">max_tokens</MenuItem>
                <MenuItem value="max_completion_tokens">
                  max_completion_tokens
                </MenuItem>
                <MenuItem value="none">
                  Use provider default (omit parameter)
                </MenuItem>
              </TextField>
              <TextField
                fullWidth
                type="number"
                label="Maximum output tokens"
                value={value.maxTokens}
                disabled={locked || value.tokenParameter === "none"}
                onChange={(e) =>
                  setValue({ ...value, maxTokens: Number(e.target.value) })
                }
                helperText="512–16000; lower this if the provider rejects its output limit."
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={value.jsonMode}
                    disabled={locked}
                    onChange={(e) =>
                      setValue({ ...value, jsonMode: e.target.checked })
                    }
                  />
                }
                label="Request JSON mode (response_format: json_object)"
              />
            </div>
          </details>
          <p>
            Enable JSON mode only if your provider supports it. EthicSpark
            always requests and validates its structured response. Image input
            also requires provider/model support. API keys are stored in a
            private backend configuration file, outside conversations, exports
            and Git. Settings are shared by all windows; saving requires fresh
            project-processing permission.
          </p>
          {value.baseUrl.startsWith("http:") && (
            <Alert severity="warning">
              This endpoint uses HTTP. Its API key and submitted content travel
              without transport encryption. Use a trusted local network or
              HTTPS.
            </Alert>
          )}
          <Button disabled={locked} onClick={() => void save()}>
            Save connection
          </Button>
          <Button
            disabled={locked || (!value.baseUrl && !value.hasApiKey)}
            onClick={() => void save(true)}
          >
            Forget connection
          </Button>
        </>
      )}
    </section>
  );
}
