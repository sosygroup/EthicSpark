import { Info, HelpMuiButton, HelpTextField } from "./Help";
import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { Cluster, ClusterProposal, Project, ReasoningRun } from "./types";
type Provider = {
  connectionId?: string;
  id: string;
  name: string;
  configured: boolean;
  external: boolean;
  setup: string;
};
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "The request failed.");
  return data;
}
export default function ReasoningPanel({
  project,
  actor,
  clusters,
  onApply,
  onError,
  disabled,
  onBusy,
}: {
  project: Project;
  actor: string;
  clusters: Cluster[];
  onApply: (p: Project) => void;
  onError: (e: string) => void;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [providers, setProviders] = useState<Provider[]>([]),
    [provider, setProvider] = useState("openai"),
    [models, setModels] = useState<string[]>([]),
    [model, setModel] = useState("");
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [run, setRun] = useState<ReasoningRun | null>(null),
    [reviewing, setReviewing] = useState(false),
    [chosen, setChosen] = useState<ClusterProposal[]>([]);
  const current = providers.find((p) => p.id === provider),
    base = "/api/projects/" + project.id;
  useEffect(() => {
    request<Provider[]>("/api/reasoning/providers")
      .then(setProviders)
      .catch((e) => onError(e.message));
  }, []);
  useEffect(() => {
    setModels([]);
    setModel("");
    setConsent(false);
  }, [provider, current?.connectionId]);
  useEffect(() => {
    setRun(null);
    setChosen([]);
    setConsent(false);
  }, [project.id, project.revision]);
  async function loadModels() {
    setBusy(true);
    onBusy(true);
    onError("");
    try {
      const list = await request<string[]>(
        "/api/reasoning/providers/" + provider + "/models",
      );
      setModels(list);
      setModel(list[0] || "");
      if (!list.length)
        throw new Error(
          "No models are available. Configure or install a model, then reload.",
        );
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  async function analyse() {
    setBusy(true);
    onBusy(true);
    onError("");
    try {
      const result = await request<ReasoningRun>(base + "/reasoning", {
        revision: project.revision,
        actor,
        provider,
        model,
        consent,
        providerConnectionId: providers.find((p) => p.id === provider)
          ?.connectionId,
      });
      setRun(result);
      setChosen(result.output.clusters);
      setReviewing(false);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  async function apply() {
    if (!run) return;
    setBusy(true);
    onBusy(true);
    onError("");
    try {
      const p = await request<Project>(base + "/reasoning/apply", {
        revision: project.revision,
        actor,
        runId: run.id,
        clusters: chosen,
      });
      setRun(null);
      onApply(p);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <Paper className="panel" sx={{ mb: 3 }}>
      <Typography variant="h6">Analyse with a language model</Typography>
      <Typography color="text.secondary" variant="body2" sx={{ mt: 1, mb: 2 }}>
        Use your confirmed profile and attached material to suggest clusters,
        ethics label characteristics and six adapted actions per cluster. You
        review the result before continuing.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <HelpTextField
          select
          label="Provider"
          value={providers.length ? provider : ""}
          disabled={busy || disabled}
          onChange={(e) => setProvider(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {!providers.length && (
            <MenuItem value="">Loading providers…</MenuItem>
          )}
          {providers.map((p) => (
            <MenuItem value={p.id} key={p.id}>
              {p.name}
              {!p.configured ? " — setup needed" : ""}
            </MenuItem>
          ))}
        </HelpTextField>
        <HelpTextField
          select
          label="Model"
          value={model}
          disabled={busy || disabled || !models.length}
          onChange={(e) => setModel(e.target.value)}
          sx={{ minWidth: 240, flex: 1 }}
        >
          {models.length ? (
            models.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))
          ) : (
            <MenuItem value="">Load available models</MenuItem>
          )}
        </HelpTextField>
        <HelpMuiButton
          help="loadModels"
          variant="outlined"
          onClick={loadModels}
          disabled={busy || disabled || !current?.configured}
        >
          Load models
        </HelpMuiButton>
      </Stack>
      {current && !current.configured && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {current.setup}
        </Alert>
      )}
      <FormControlLabel
        sx={{ mt: 1 }}
        control={
          <Checkbox
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={busy || disabled}
          />
        }
        label={
          current?.external
            ? "I authorise sending this confirmed profile, readable attachment contents and images to the selected external provider."
            : "I authorise processing this confirmed profile and its material with the configured Ollama server."
        }
      />{" "}
      <Info topic="consent" />
      <Box sx={{ mt: 1 }}>
        <HelpMuiButton
          help="analyse"
          variant="contained"
          onClick={analyse}
          disabled={
            busy ||
            disabled ||
            !project.profile.confirmed ||
            !actor.trim() ||
            !model ||
            !consent ||
            !current?.configured
          }
        >
          {busy ? (
            <>
              <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
              Processing…
            </>
          ) : (
            "Analyse catalogue"
          )}
        </HelpMuiButton>
      </Box>
      {!project.profile.confirmed && (
        <Typography variant="caption" color="text.secondary">
          Confirm the application profile first.
        </Typography>
      )}
      <Dialog
        open={!!run}
        fullWidth
        maxWidth="md"
        onClose={() => !busy && setRun(null)}
      >
        <DialogTitle>
          <Info topic="reviewSelection" />{" "}
          {reviewing
            ? "Review clusters and ethics label characteristics"
            : "Your catalogue proposal is ready"}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Applying this proposal replaces the current draft selection and
            actions. All actions require review again; approved plan versions
            remain unchanged.
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            Proposed by {run?.provider} / {run?.model}. Nothing has been
            selected or accepted yet. All six actions are retained; unsuitable
            actions are explained rather than silently removed.
          </Alert>
          {run?.output.uncertainties.map((u, i) => (
            <Alert key={i} severity="warning" sx={{ mb: 1 }}>
              {u}
            </Alert>
          ))}
          {!run?.output.clusters.length && (
            <Typography>
              No clusters were proposed. Close this dialog to revise the profile
              or select clusters manually.
            </Typography>
          )}
          {run?.output.clusters.map((c) => {
            const source = clusters.find((s) => s.id === c.clusterId),
              selected = chosen.find((s) => s.clusterId === c.clusterId);
            return (
              <Box
                key={c.clusterId}
                sx={{ borderBottom: "1px solid #dadce0", py: 2 }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!selected}
                      disabled={!reviewing || busy}
                      onChange={(e) =>
                        setChosen((v) =>
                          e.target.checked
                            ? [...v, c]
                            : v.filter((s) => s.clusterId !== c.clusterId),
                        )
                      }
                    />
                  }
                  label={c.clusterId + " · " + (source?.title || "")}
                />{" "}
                <Info topic="clusters" />
                {reviewing && selected ? (
                  <HelpTextField
                    fullWidth
                    multiline
                    label="Selection rationale"
                    value={selected.rationale}
                    sx={{ my: 2 }}
                    onChange={(e) =>
                      setChosen((v) =>
                        v.map((s) =>
                          s.clusterId === c.clusterId
                            ? { ...s, rationale: e.target.value }
                            : s,
                        ),
                      )
                    }
                  />
                ) : (
                  <Typography variant="body2">{c.rationale}</Typography>
                )}
                {(reviewing ? source?.labelMappings : c.mappings)?.map(
                  (m, i) => (
                    <Box key={i} sx={{ mt: 1 }}>
                      {reviewing && selected ? (
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selected.mappings.some(
                                (v) =>
                                  v.card === m.card &&
                                  v.characteristic === m.characteristic,
                              )}
                              onChange={(e) =>
                                setChosen((v) =>
                                  v.map((s) =>
                                    s.clusterId === c.clusterId
                                      ? {
                                          ...s,
                                          mappings: e.target.checked
                                            ? [...s.mappings, m]
                                            : s.mappings.filter(
                                                (v) =>
                                                  v.card !== m.card ||
                                                  v.characteristic !==
                                                    m.characteristic,
                                              ),
                                        }
                                      : s,
                                  ),
                                )
                              }
                            />
                          }
                          label={m.card + " → " + m.characteristic}
                        />
                      ) : (
                        <Chip
                          size="small"
                          label={m.card + " → " + m.characteristic}
                          sx={{
                            maxWidth: "100%",
                            height: "auto",
                            "& .MuiChip-label": { whiteSpace: "normal" },
                          }}
                        />
                      )}
                    </Box>
                  ),
                )}
                {run.output.recommendations
                  .filter((r) =>
                    r.sourceActionId.startsWith(
                      c.clusterId.replace("-", "") + "-",
                    ),
                  )
                  .map((r) => (
                    <Accordion
                      key={r.sourceActionId}
                      sx={{ mt: 1, boxShadow: "none" }}
                    >
                      <AccordionSummary>
                        {r.sourceActionId} ·{" "}
                        {r.applicability?.replaceAll("_", " ")}
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography>{r.action}</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Phase suitability: {r.applicabilityReason}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Evidence: {r.evidence}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Rationale: {r.rationale}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))}
              </Box>
            );
          })}
          <Typography variant="body2" sx={{ mt: 2 }}>
            You can edit each action in the adaptation workspace. Continuing
            keeps actions Proposed; acceptance and plan approval are separate
            decisions.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap" }}>
          <HelpMuiButton
            help="cancel"
            disabled={busy}
            onClick={() => setRun(null)}
          >
            Close without applying
          </HelpMuiButton>
          {!reviewing && (
            <HelpMuiButton
              help="reviewSelection"
              disabled={busy}
              onClick={() => setReviewing(true)}
            >
              Review or change selection
            </HelpMuiButton>
          )}
          <HelpMuiButton
            help="reviewSelection"
            variant="contained"
            disabled={
              busy ||
              !chosen.length ||
              chosen.some((c) => !c.mappings.length || !c.rationale.trim())
            }
            onClick={apply}
          >
            {reviewing
              ? "Save reviewed selection and edit actions"
              : "Continue to actions"}
          </HelpMuiButton>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
