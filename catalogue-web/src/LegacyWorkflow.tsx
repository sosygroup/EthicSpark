import { Info, HelpMuiButton, HelpTextField } from "./Help";
import { useEffect, useState } from "react";
import ProfileFields from "./ProfileFields";
import ReasoningPanel from "./ReasoningPanel";
import {
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type {
  Project,
  Summary,
  Field,
  Recommendation,
  Cluster,
  ClusterSummary,
  Plan,
  Event,
} from "./types";

const steps = [
  "Application profile",
  "Cluster selection",
  "Adaptation workspace",
  "Project plan",
];
const reviewLabels: Record<string, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  edited: "Accepted with edits",
  rejected: "Rejected",
  awaiting_information: "Awaiting information",
};
const example: Field[] = [
  {
    id: "purpose",
    status: "known",
    value:
      "A support-ticket portal lets customers submit requests and lets support agents read and answer them.",
  },
  {
    id: "stakeholders",
    status: "known",
    value:
      "Customers submitting tickets, support agents handling requests, and people mentioned in ticket text.",
  },
  {
    id: "data",
    status: "known",
    value: "Customer name, email address and free-text support requests.",
  },
  {
    id: "behaviour",
    status: "known",
    value:
      "Support agents make decisions and send replies. The portal does not make autonomous decisions.",
  },
  { id: "phase", status: "known", value: "Requirements" },
  { id: "retention", status: "unknown", value: "" },
  { id: "sharing", status: "unknown", value: "" },
  { id: "safeguards", status: "unknown", value: "" },
];
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (
    data?.profile?.fields &&
    !data.profile.fields.some((f: Field) => f.id === "additional")
  )
    data.profile.fields.push({
      id: "additional",
      value: "",
      status: "known",
      files: [],
      companyEthics: [],
    });
  if (!response.ok)
    throw new Error(data.detail || "The request failed. Please try again.");
  return data;
}
function Status({ value }: { value: string }) {
  return (
    <Chip
      size="small"
      className={"status-" + value}
      label={reviewLabels[value] || value}
    />
  );
}

export default function App() {
  const [summaries, setSummaries] = useState<Summary[]>([]),
    [project, setProject] = useState<Project | null>(null),
    [versions, setVersions] = useState<{ id: string; importedAt: string }[]>(
      [],
    );
  const [stage, setStage] = useState(0),
    [fields, setFields] = useState<Field[]>([]),
    [selection, setSelection] = useState<string[]>([]),
    [clusters, setClusters] = useState<ClusterSummary[]>([]),
    [catalogueClusters, setCatalogueClusters] = useState<Cluster[]>([]);
  const [index, setIndex] = useState(0),
    [phaseText, setPhaseText] = useState(""),
    [approvalKey, setApprovalKey] = useState(""),
    [edit, setEdit] = useState<Recommendation | null>(null),
    [actor, setActor] = useState(
      () => localStorage.getItem("ethics-actor") || "",
    );
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [newOpen, setNewOpen] = useState(false),
    [newName, setNewName] = useState(""),
    [isExample, setIsExample] = useState(false),
    [search, setSearch] = useState("");
  const [details, setDetails] = useState<Cluster | null>(null),
    [history, setHistory] = useState<Event[] | null>(null),
    [plans, setPlans] = useState<
      { id: string; version: number; approvedAt: string }[]
    >([]),
    [planId, setPlanId] = useState(""),
    [viewPlan, setViewPlan] = useState<Plan | null>(null),
    [approval, setApproval] = useState<Plan | null>(null);
  const [statusFilter, setStatusFilter] = useState("all"),
    [ownerFilter, setOwnerFilter] = useState(""),
    [phaseFilter, setPhaseFilter] = useState("");
  const [refs, setRefs] = useState<
    { id: string; title: string; links: string }[]
  >([]);
  const base = project ? "/api/projects/" + project.id : "";
  const dirty =
    !!project &&
    (stage === 0
      ? JSON.stringify(fields) !== JSON.stringify(project.profile.fields)
      : stage === 1
        ? JSON.stringify(selection) !== JSON.stringify(project.selectedClusters)
        : stage === 2
          ? JSON.stringify(edit) !==
              JSON.stringify(project.recommendations[index]) ||
            phaseText !== project.recommendations[index]?.phases.join("; ")
          : false);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage, index, project?.id]);
  useEffect(() => {
    localStorage.setItem("ethics-actor", actor);
  }, [actor]);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<Summary[]>("/api/projects"),
      api<{ id: string; importedAt: string }[]>("/api/catalogue/versions"),
    ])
      .then(async ([list, vs]) => {
        if (!active) return;
        setSummaries(list);
        setVersions(vs);
        const last = localStorage.getItem("ethics-project");
        if (last && list.some((p) => p.id === last)) {
          const p = await api<Project>("/api/projects/" + last);
          if (active) setProject(p);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!project) return;
    setFields(project.profile.fields);
    setSelection(project.selectedClusters);
    setEdit(project.recommendations[index]);
    setPhaseText(project.recommendations[index]?.phases.join("; ") || "");
    localStorage.setItem("ethics-project", project.id);
  }, [project, index]);
  useEffect(() => {
    const version = project?.catalogueVersion || versions[0]?.id;
    if (!version) return;
    let active = true;
    Promise.all([
      api<ClusterSummary[]>("/api/catalogue/versions/" + version + "/clusters"),
      api<Cluster[]>("/api/catalogue/versions/" + version + "/cluster-details"),
      api<{ id: string; title: string; links: string }[]>(
        "/api/catalogue/versions/" + version + "/references",
      ),
    ])
      .then(([cs, c, rs]) => {
        if (active) {
          setClusters(cs);
          setCatalogueClusters(c);
          setRefs(rs);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [project?.catalogueVersion, versions]);
  useEffect(() => {
    if (!project || stage !== 3) return;
    let active = true;
    Promise.all([
      api<Plan>(planId ? base + "/plans/" + planId : base + "/draft"),
      api<{ id: string; version: number; approvedAt: string }[]>(
        base + "/plans",
      ),
    ])
      .then(([d, ps]) => {
        if (active) {
          setPlans(ps);
          setViewPlan(d);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [project?.id, project?.revision, stage, planId]);
  async function work(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function discard() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return false;
    if (project) {
      setFields(project.profile.fields);
      setSelection(project.selectedClusters);
      setEdit(project.recommendations[index]);
      setPhaseText(project.recommendations[index]?.phases.join("; ") || "");
    }
    return true;
  }
  function go(next: number) {
    if (discard()) setStage(next);
  }
  async function refreshList() {
    setSummaries(await api<Summary[]>("/api/projects"));
  }
  function openNew(demo: boolean) {
    if (!discard()) return;
    setIsExample(demo);
    setNewName(demo ? "Support ticket portal" : "");
    setNewOpen(true);
  }
  async function create() {
    await work(async () => {
      let p = await api<Project>("/api/projects", "POST", {
        name: newName,
        actor,
      });
      if (isExample)
        p = await api<Project>("/api/projects/" + p.id + "/profile", "PUT", {
          revision: p.revision,
          actor,
          fields: example,
          confirm: false,
        });
      setProject(p);
      setStage(0);
      setIndex(0);
      setNewOpen(false);
      await refreshList();
      setNotice(
        isExample
          ? "Example loaded. Review the profile and confirm it when ready."
          : "Project created. Start with the application profile.",
      );
    });
  }
  async function saveProfile(confirm: boolean) {
    await work(async () => {
      const p = await api<Project>(base + "/profile", "PUT", {
        revision: project!.revision,
        actor,
        fields,
        confirm,
      });
      setProject(p);
      await refreshList();
      setNotice(
        confirm
          ? "Profile confirmed. You can now select concerns."
          : "Profile draft saved.",
      );
      if (confirm) setStage(1);
    });
  }
  async function saveSelection() {
    await work(async () => {
      const p = await api<Project>(base + "/selection", "PUT", {
        revision: project!.revision,
        actor,
        clusterIds: selection,
      });
      setProject(p);
      setNotice("Cluster selection saved.");
      setIndex(0);
      if (selection.length) setStage(2);
    });
  }
  async function review(decision: string) {
    if (!edit) return;
    await work(async () => {
      const p = await api<Project>(
        base + "/recommendations/" + edit.sourceActionId,
        "PUT",
        {
          revision: project!.revision,
          actor,
          recommendation: {
            ...edit,
            phases: phaseText
              .split(";")
              .map((v) => v.trim())
              .filter(Boolean),
          },
          decision,
        },
      );
      setProject(p);
      setNotice(
        decision === "save"
          ? "Draft saved. It still needs explicit acceptance."
          : "Review decision recorded.",
      );
    });
  }
  async function inspect(id: string) {
    await work(async () => {
      const version = project?.catalogueVersion || versions[0]?.id;
      setDetails(
        await api<Cluster>(
          "/api/catalogue/versions/" + version + "/clusters/" + id,
        ),
      );
    });
  }
  async function chooseProject(id: string) {
    if (!id || !discard()) return;
    await work(async () => {
      setProject(await api<Project>("/api/projects/" + id));
      setIndex(0);
      setStage(0);
      setPlanId("");
    });
  }
  async function selectPlan(id: string) {
    await work(async () => {
      setViewPlan(
        await api<Plan>(id ? base + "/plans/" + id : base + "/draft"),
      );
      setPlanId(id);
    });
  }
  async function approve() {
    if (!approval) return;
    await work(async () => {
      const p = await api<Plan>(base + "/plans", "POST", {
        revision: approval.projectRevision,
        actor,
        requestKey: approvalKey,
      });
      const [latest, list] = await Promise.all([
        api<Project>(base),
        api<{ id: string; version: number; approvedAt: string }[]>(
          base + "/plans",
        ),
      ]);
      setApproval(null);
      setProject(latest);
      setNotice("Approved snapshot saved. Implementation remains Not started.");
      setPlans(list);
      setViewPlan(p);
      setPlanId(p.id);
    });
  }
  function patch(key: keyof Recommendation, value: unknown) {
    setEdit((e) => (e ? { ...e, [key]: value } : e));
  }
  const accepted =
    project?.recommendations.filter((r) =>
      ["accepted", "edited"].includes(r.reviewStatus),
    ).length || 0;
  const unknowns = fields.filter((f) => f.status === "unknown").length;
  const source = catalogueClusters
    .flatMap((c) => c.actions)
    .find((a) => a.id === edit?.sourceActionId);
  const shown = clusters.filter((c) =>
    (c.id + " " + c.title + " " + c.definition + " " + c.concerns.join(" "))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">E</div>
          <div>
            <Typography fontWeight={600} fontSize={20}>
              EthicSpark
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Ethics-aware engineering
            </Typography>
          </div>
        </div>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ px: 1.5, mb: 1 }}
        >
          Project workspace
        </Typography>
        <HelpMuiButton help="start" component="a" href="/">
          Conversational workspace
        </HelpMuiButton>
        <nav>
          {steps.map((s, i) => (
            <HelpMuiButton
              help={["profile", "clusters", "adaptation", "plan"][i]}
              key={s}
              fullWidth
              className={stage === i ? "selected-step" : ""}
              onClick={() => go(i)}
              disabled={busy || (!project && i !== 1)}
              sx={{
                justifyContent: "flex-start",
                textAlign: "left",
                px: 1.5,
                py: 1.5,
                mb: 0.5,
                color: stage === i ? "primary.main" : "text.secondary",
                bgcolor: stage === i ? "#e8f0fe" : "transparent",
              }}
            >
              <span className="step-dot">{i + 1}</span>
              {s}
            </HelpMuiButton>
          ))}
        </nav>
        <Divider sx={{ my: 3 }} />
        <HelpMuiButton
          help="projects"
          onClick={() => openNew(false)}
          variant="outlined"
          disabled={busy || !versions.length}
        >
          + New project
        </HelpMuiButton>
        <div className="local-note">
          <strong>Catalogue workspace</strong>
          <p>
            Local workspace. Reviewer names are self-reported. Model analysis
            runs only when you request it.
          </p>
          <a href="/api/catalogue/versions" target="_blank" rel="noreferrer">
            Catalogue API ↗
          </a>
        </div>
      </aside>
      <div>
        <header className="topbar">
          <div>
            <Typography fontSize={14} color="text.secondary">
              {project ? "Projects / " + project.name : "Developer workspace"}
            </Typography>
            <Typography fontSize={13} color="text.secondary">
              {project
                ? "Profile " +
                  (project.profile.version || "draft") +
                  " · " +
                  (project.profile.confirmed ? "Confirmed" : "Draft")
                : "Turn ethical concerns into practical engineering work"}
            </Typography>
          </div>
          <div className="toolbar">
            {summaries.length > 0 && (
              <HelpTextField
                select
                label="Open project"
                value={project?.id || ""}
                onChange={(e) => chooseProject(e.target.value)}
                sx={{ minWidth: 180, maxWidth: 240 }}
                disabled={busy}
              >
                <MenuItem value="">Choose a project</MenuItem>
                {summaries.map((p) => (
                  <MenuItem value={p.id} key={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </HelpTextField>
            )}
            <HelpTextField
              label="Reviewer name"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              helperText="For the local decision history"
              sx={{ width: 190 }}
            />
          </div>
        </header>
        {busy && <LinearProgress aria-label="Saving or loading" />}
        <main className="main">
          <div className="help-field-heading">
            About this page{" "}
            <Info
              topic={["profile", "clusters", "adaptation", "plan"][stage]}
            />
          </div>
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 3 }}
              action={
                <HelpMuiButton
                  help="reload"
                  color="inherit"
                  size="small"
                  onClick={() => window.location.reload()}
                >
                  Reload
                </HelpMuiButton>
              }
            >
              {error}
            </Alert>
          )}
          {loading ? (
            <Box sx={{ p: 8, textAlign: "center" }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>Opening your workspace…</Typography>
            </Box>
          ) : !project && stage !== 1 ? (
            <>
              <div className="intro">
                <div>
                  <div className="eyebrow">
                    From concerns to concrete actions
                  </div>
                  <Typography variant="h4">
                    Build an ethics action plan
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    A guided workspace for applying the catalogue to your
                    software.
                  </Typography>
                </div>
                <Chip
                  label="Manual or LLM-assisted workflow"
                  sx={{ bgcolor: "#e8f0fe", color: "#1967d2" }}
                />
              </div>
              <Paper className="empty-hero panel">
                <div className="hero-symbol">◇</div>
                <Typography variant="h5">
                  Start with your application
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{ my: 2, maxWidth: 540, mx: "auto" }}
                >
                  Describe the context, select relevant concerns and turn six
                  catalogue actions into a reviewed plan. Keep ownership,
                  evidence and open questions in view.
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  justifyContent="center"
                  sx={{ mt: 3 }}
                >
                  <HelpMuiButton
                    help="projects"
                    variant="contained"
                    size="large"
                    onClick={() => openNew(false)}
                    disabled={!versions.length}
                  >
                    Create a project
                  </HelpMuiButton>
                  <HelpMuiButton
                    help="example"
                    variant="outlined"
                    size="large"
                    onClick={() => openNew(true)}
                    disabled={!versions.length}
                  >
                    Start with an example
                  </HelpMuiButton>
                </Stack>
                <HelpMuiButton
                  help="clusters"
                  sx={{ mt: 2 }}
                  onClick={() => setStage(1)}
                >
                  Explore the catalogue →
                </HelpMuiButton>
                {!versions.length && (
                  <Alert severity="warning" sx={{ mt: 3 }}>
                    No catalogue has been imported. Check the service import
                    report.
                  </Alert>
                )}
              </Paper>
              <div className="summary-grid" style={{ marginTop: 24 }}>
                {[
                  ["01", "Describe your context"],
                  ["02", "Adapt and review actions"],
                  ["03", "Export a traceable plan"],
                ].map(([n, t]) => (
                  <Paper key={n} className="panel">
                    <Typography color="primary" fontWeight={600}>
                      {n}
                    </Typography>
                    <Typography sx={{ mt: 1 }}>{t}</Typography>
                  </Paper>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="intro">
                <div>
                  <div className="eyebrow">
                    Step {stage + 1} of 4 · Reviewed workflow
                  </div>
                  <Typography variant="h4">{steps[stage]}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {
                      [
                        "Describe what you are building and make unknowns explicit.",
                        "Inspect the catalogue and choose the concerns to address.",
                        "Connect the original guidance to your application.",
                        "Review your decisions and preserve a version of your plan.",
                      ][stage]
                    }
                  </Typography>
                </div>
                {project && (
                  <Chip
                    label={
                      project.profile.confirmed
                        ? "Profile confirmed"
                        : "Profile needs confirmation"
                    }
                    color={project.profile.confirmed ? "success" : "default"}
                    variant="outlined"
                  />
                )}
              </div>
              {stage === 0 && project && (
                <>
                  <Paper className="panel">
                    <div
                      className="toolbar"
                      style={{
                        justifyContent: "space-between",
                        marginBottom: 24,
                      }}
                    >
                      <Typography variant="h6">Application context</Typography>
                      <Chip
                        size="small"
                        label={
                          unknowns +
                          " explicit unknown" +
                          (unknowns === 1 ? "" : "s")
                        }
                      />
                    </div>
                    <ProfileFields
                      base={base}
                      fields={fields}
                      setFields={setFields}
                      disabled={busy}
                      onError={setError}
                      onUploading={setBusy}
                    />
                    <div className="sticky-actions">
                      <HelpMuiButton
                        help="saveDraft"
                        disabled={busy || !actor.trim()}
                        onClick={() => saveProfile(false)}
                      >
                        Save draft
                      </HelpMuiButton>
                      <HelpMuiButton
                        help="confirm"
                        variant="contained"
                        disabled={
                          busy ||
                          !actor.trim() ||
                          (project.profile.confirmed && !dirty)
                        }
                        onClick={() => saveProfile(true)}
                      >
                        Confirm profile
                      </HelpMuiButton>
                      {project.profile.confirmed && !dirty && (
                        <HelpMuiButton
                          help="clusters"
                          variant="contained"
                          onClick={() => go(1)}
                        >
                          Continue to clusters →
                        </HelpMuiButton>
                      )}
                    </div>
                  </Paper>
                  {project.profile.version > 0 && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Changing the context opens a new profile draft and returns
                      all recommendations to Proposed. Approved plans remain
                      unchanged.
                    </Alert>
                  )}
                </>
              )}
              {stage === 1 && (
                <>
                  {project && (
                    <ReasoningPanel
                      key={project.id}
                      project={project}
                      actor={actor}
                      clusters={catalogueClusters}
                      disabled={busy}
                      onError={setError}
                      onBusy={setBusy}
                      onApply={(p) => {
                        setProject(p);
                        setIndex(0);
                        setStage(2);
                        setNotice(
                          "Model proposal saved. Review and accept each action separately.",
                        );
                        void refreshList();
                      }}
                    />
                  )}
                  <Paper className="panel" sx={{ mb: 3 }}>
                    <div
                      className="toolbar"
                      style={{ justifyContent: "space-between" }}
                    >
                      <HelpTextField
                        label="Search clusters"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        sx={{ minWidth: 260 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {clusters.length} clusters · 144 source actions · 184
                        references
                      </Typography>
                      {project && (
                        <HelpMuiButton
                          help="selection"
                          variant="contained"
                          disabled={
                            busy || !project.profile.confirmed || !actor.trim()
                          }
                          onClick={saveSelection}
                        >
                          Save selection{selection.length ? " and adapt →" : ""}
                        </HelpMuiButton>
                      )}
                    </div>
                    <div className="selection-note" style={{ marginTop: 20 }}>
                      Select relevant clusters manually, or review a model
                      proposal above. Each selected cluster has six source
                      actions; assess their suitability for your selected
                      phases.
                    </div>
                    {project && !project.profile.confirmed && (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        Confirm the application profile before saving a cluster
                        selection.
                      </Alert>
                    )}
                  </Paper>
                  <div className="cluster-grid">
                    {shown.map((c) => (
                      <Paper
                        className="panel cluster-card"
                        key={c.id}
                        sx={{
                          borderColor: selection.includes(c.id)
                            ? "#1967d2"
                            : undefined,
                          bgcolor: selection.includes(c.id)
                            ? "#f3f7ff"
                            : "white",
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography variant="overline" color="primary">
                            {c.id}
                          </Typography>
                          {selection.includes(c.id) && (
                            <Chip
                              size="small"
                              label="Selected"
                              color="primary"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                        <Typography fontWeight={600} sx={{ mt: 1, mb: 1 }}>
                          {c.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ flex: 1 }}
                        >
                          {c.concerns.join(" · ")}
                        </Typography>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{ mt: 2 }}
                        >
                          <HelpMuiButton
                            help="details"
                            size="small"
                            onClick={() => inspect(c.id)}
                            disabled={busy}
                          >
                            View details
                          </HelpMuiButton>
                          {project && (
                            <>
                              <FormControlLabel
                                sx={{ mr: 0 }}
                                control={
                                  <Checkbox
                                    checked={selection.includes(c.id)}
                                    disabled={
                                      !project.profile.confirmed || busy
                                    }
                                    onChange={(e) =>
                                      setSelection(
                                        e.target.checked
                                          ? [...selection, c.id]
                                          : selection.filter(
                                              (id) => id !== c.id,
                                            ),
                                      )
                                    }
                                  />
                                }
                                label="Select"
                              />{" "}
                              <Info topic="clusters" />
                            </>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </div>
                  {shown.length === 0 && (
                    <Alert severity="info">
                      No clusters match this search.
                    </Alert>
                  )}
                  {project && (
                    <div className="sticky-actions">
                      <Typography
                        variant="body2"
                        sx={{ mr: "auto", alignSelf: "center" }}
                      >
                        {selection.length} cluster selected
                      </Typography>
                      <HelpMuiButton
                        help="selection"
                        variant="contained"
                        disabled={
                          busy || !project.profile.confirmed || !actor.trim()
                        }
                        onClick={saveSelection}
                      >
                        Save selection{selection.length ? " and adapt →" : ""}
                      </HelpMuiButton>
                    </div>
                  )}
                </>
              )}
              {stage === 2 &&
              project &&
              (!project.profile.confirmed ||
                project.selectedClusters.length === 0) ? (
                <Alert
                  severity="info"
                  action={
                    <HelpMuiButton
                      help="profile"
                      onClick={() => go(project.profile.confirmed ? 1 : 0)}
                    >
                      Continue setup
                    </HelpMuiButton>
                  }
                >
                  Confirm your application profile and select a cluster to start
                  adaptation.
                </Alert>
              ) : (
                stage === 2 &&
                project &&
                edit &&
                source && (
                  <>
                    <div className="action-layout">
                      <Paper
                        className="panel action-nav"
                        sx={{ p: "12px!important", alignSelf: "start" }}
                      >
                        {project.recommendations.map((r, i) =>
                          (() => {
                            const a = catalogueClusters
                              .flatMap((c) => c.actions)
                              .find((a) => a.id === r.sourceActionId);
                            const c = (a?.category || "Action").toLowerCase();
                            return (
                              <HelpMuiButton
                                help="adaptation"
                                key={r.sourceActionId}
                                fullWidth
                                sx={{
                                  justifyContent: "space-between",
                                  py: 1.5,
                                  mb: 0.5,
                                  bgcolor: index === i ? "#e8f0fe" : undefined,
                                  color:
                                    index === i
                                      ? "primary.main"
                                      : "text.secondary",
                                }}
                                onClick={() => {
                                  if (discard()) setIndex(i);
                                }}
                                disabled={busy}
                              >
                                <span>
                                  {r.sourceActionId}
                                  <br />
                                  {c.charAt(0).toUpperCase() + c.slice(1)}
                                </span>
                                <span>
                                  {["accepted", "edited"].includes(
                                    project.recommendations[i]?.reviewStatus,
                                  )
                                    ? "✓"
                                    : i + 1}
                                </span>
                              </HelpMuiButton>
                            );
                          })(),
                        )}
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                          Use any category in any order.
                        </Typography>
                      </Paper>
                      <div>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{ mb: 2 }}
                        >
                          <Typography variant="h6">
                            {source.id} ·{" "}
                            {source.category.charAt(0) +
                              source.category.slice(1).toLowerCase()}
                          </Typography>
                          <Status value={edit.reviewStatus} />
                        </Stack>
                        <Alert
                          severity={
                            edit.applicability === "not_applicable"
                              ? "warning"
                              : "info"
                          }
                          sx={{ mb: 2 }}
                        >
                          Phase suitability:{" "}
                          {(edit.applicability || "suitable").replaceAll(
                            "_",
                            " ",
                          )}
                          .{" "}
                          {edit.applicabilityReason ||
                            "Review suitability against your current lifecycle phases."}
                        </Alert>
                        <div className="two-col">
                          <Paper className="panel source">
                            <Typography
                              variant="overline"
                              color="text.secondary"
                            >
                              Original catalogue
                            </Typography>
                            <Typography fontWeight={600} sx={{ mt: 1, mb: 2 }}>
                              {
                                catalogueClusters.find((c) =>
                                  c.actions.some((a) => a.id === source.id),
                                )?.title
                              }
                            </Typography>
                            <Typography className="source-text">
                              {source.text}
                            </Typography>
                            <div className="small-label">Possible evidence</div>
                            <Typography className="source-text">
                              {source.evidence}
                            </Typography>
                            <div className="small-label">Suggested phases</div>
                            <Typography variant="body2">
                              {source.phases.join(" · ")}
                            </Typography>
                            <div className="small-label">
                              Suggested responsible roles
                            </div>
                            <Typography variant="body2">
                              {source.roles.join(" · ")}
                            </Typography>
                            <Accordion
                              sx={{
                                mt: 3,
                                bgcolor: "transparent",
                                boxShadow: "none",
                              }}
                            >
                              <AccordionSummary>
                                Source details and references
                              </AccordionSummary>
                              <AccordionDetails>
                                <Typography variant="caption">
                                  Source cell: {source.source}
                                </Typography>
                                {source.referenceIds.map((id) => (
                                  <Box sx={{ mt: 1.5 }} key={id}>
                                    <Typography
                                      fontWeight={600}
                                      variant="caption"
                                    >
                                      {id}
                                    </Typography>
                                    <Typography variant="body2">
                                      {refs.find((r) => r.id === id)?.title ||
                                        id}
                                    </Typography>
                                  </Box>
                                ))}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ mt: 2 }}
                                >
                                  A reference link records provenance; it does
                                  not establish support for every adapted
                                  detail.
                                </Typography>
                              </AccordionDetails>
                            </Accordion>
                          </Paper>
                          <Paper className="panel">
                            <Typography variant="overline" color="primary">
                              Your application-specific adaptation
                            </Typography>
                            <Stack spacing={2.5} sx={{ mt: 2 }}>
                              <HelpTextField
                                select
                                label="Phase suitability"
                                value={edit.applicability || "suitable"}
                                onChange={(e) =>
                                  patch("applicability", e.target.value)
                                }
                              >
                                <MenuItem value="suitable">
                                  Suitable for selected phases
                                </MenuItem>
                                <MenuItem value="not_applicable">
                                  Not applicable for selected phases
                                </MenuItem>
                                <MenuItem value="uncertain">
                                  Uncertain — needs information
                                </MenuItem>
                              </HelpTextField>
                              <HelpTextField
                                label="Phase suitability explanation"
                                value={edit.applicabilityReason || ""}
                                multiline
                                minRows={2}
                                onChange={(e) =>
                                  patch("applicabilityReason", e.target.value)
                                }
                                helperText="Explain any change to the model's phase assessment before accepting."
                              />
                              <HelpTextField
                                label="Concern scenario"
                                value={edit.scenario}
                                onChange={(e) =>
                                  patch("scenario", e.target.value)
                                }
                                multiline
                                minRows={2}
                                helperText="Describe the behaviour, affected people and plausible adverse effect."
                              />
                              <HelpTextField
                                label="Adapted action"
                                value={edit.action}
                                onChange={(e) =>
                                  patch("action", e.target.value)
                                }
                                multiline
                                minRows={3}
                              />
                              <HelpTextField
                                label="Expected evidence"
                                value={edit.evidence}
                                onChange={(e) =>
                                  patch("evidence", e.target.value)
                                }
                                multiline
                                minRows={2}
                              />
                              <HelpTextField
                                label="Validation criterion"
                                value={edit.criterion}
                                onChange={(e) =>
                                  patch("criterion", e.target.value)
                                }
                                multiline
                                minRows={2}
                                helperText="What would a human reviewer check? Leave blank to record an unresolved criterion."
                              />
                              <HelpTextField
                                label="Responsible owner"
                                value={edit.owner}
                                onChange={(e) => patch("owner", e.target.value)}
                                placeholder="Unassigned"
                                helperText="Map the suggested catalogue roles to your actual team."
                              />
                              <HelpTextField
                                label="Applicable phases"
                                value={phaseText}
                                onChange={(e) => setPhaseText(e.target.value)}
                                helperText="Separate phase names with semicolons."
                              />
                              <HelpTextField
                                label="Adaptation rationale"
                                value={edit.rationale}
                                onChange={(e) =>
                                  patch("rationale", e.target.value)
                                }
                                multiline
                                minRows={2}
                              />
                              <HelpTextField
                                label="Review reason or unresolved question"
                                value={edit.reason}
                                onChange={(e) =>
                                  patch("reason", e.target.value)
                                }
                                multiline
                                minRows={2}
                                helperText="A reason is required when rejecting an action."
                              />
                            </Stack>
                          </Paper>
                        </div>
                        <Paper className="panel" sx={{ mt: 2 }}>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                          >
                            Saving an edit leaves it Proposed. Acceptance
                            records a planning decision; implementation remains
                            Not started.
                          </Typography>
                          <div className="toolbar">
                            <HelpMuiButton
                              help="saveEdit"
                              variant="outlined"
                              disabled={busy || !actor.trim()}
                              onClick={() => review("save")}
                            >
                              Save edit
                            </HelpMuiButton>
                            <HelpMuiButton
                              help="accept"
                              variant="contained"
                              disabled={
                                busy ||
                                !actor.trim() ||
                                (edit.applicability !== undefined &&
                                  edit.applicability !== "suitable")
                              }
                              onClick={() => review("accept")}
                            >
                              Accept
                              {edit.action !== source.text ||
                              edit.evidence !== source.evidence
                                ? " edited version"
                                : ""}
                            </HelpMuiButton>
                            <HelpMuiButton
                              help="await"
                              color="warning"
                              disabled={busy || !actor.trim()}
                              onClick={() => review("awaiting_information")}
                            >
                              Await information
                            </HelpMuiButton>
                            <HelpMuiButton
                              help="reject"
                              color="error"
                              disabled={busy || !actor.trim()}
                              onClick={() => review("reject")}
                            >
                              Reject
                            </HelpMuiButton>
                            <HelpMuiButton
                              help="plan"
                              sx={{ ml: "auto" }}
                              onClick={() => go(3)}
                            >
                              Review project plan →
                            </HelpMuiButton>
                          </div>
                          {dirty && (
                            <Typography
                              variant="caption"
                              color="warning.main"
                              sx={{ mt: 1, display: "block" }}
                            >
                              Unsaved changes
                            </Typography>
                          )}
                        </Paper>
                      </div>
                    </div>
                  </>
                )
              )}
              {stage === 3 && project && (
                <>
                  <div className="summary-grid">
                    {[
                      [accepted, "Accepted in current draft"],
                      [
                        project.recommendations.filter(
                          (r) => r.reviewStatus === "awaiting_information",
                        ).length,
                        "Awaiting information",
                      ],
                      [plans.length, "Approved plan versions"],
                    ].map(([n, t]) => (
                      <Paper key={String(t)} className="stat panel">
                        <div className="stat-value">{n}</div>
                        <Typography color="text.secondary" variant="body2">
                          {t}
                        </Typography>
                      </Paper>
                    ))}
                  </div>
                  <Paper className="panel">
                    <div
                      className="toolbar"
                      style={{ justifyContent: "space-between" }}
                    >
                      <HelpTextField
                        select
                        SelectProps={{ displayEmpty: true }}
                        InputLabelProps={{ shrink: true }}
                        label="Plan version"
                        value={planId}
                        onChange={(e) => selectPlan(e.target.value)}
                        sx={{ minWidth: 240 }}
                      >
                        <MenuItem value="">Current draft</MenuItem>
                        {plans.map((p) => (
                          <MenuItem key={p.id} value={p.id}>
                            Approved version {p.version}
                          </MenuItem>
                        ))}
                      </HelpTextField>
                      <div className="toolbar">
                        <HelpMuiButton
                          help="history"
                          onClick={() =>
                            work(async () =>
                              setHistory(await api<Event[]>(base + "/history")),
                            )
                          }
                        >
                          Decision history
                        </HelpMuiButton>
                        <HelpMuiButton
                          help="exportPlan"
                          variant="outlined"
                          component="a"
                          download
                          href={
                            busy
                              ? undefined
                              : base +
                                "/export?format=json" +
                                (planId ? "&plan=" + planId : "")
                          }
                          disabled={busy}
                        >
                          Export JSON
                        </HelpMuiButton>
                        <HelpMuiButton
                          help="exportPlan"
                          variant="outlined"
                          component="a"
                          download
                          href={
                            busy
                              ? undefined
                              : base +
                                "/export?format=html" +
                                (planId ? "&plan=" + planId : "")
                          }
                          disabled={busy}
                        >
                          Export report
                        </HelpMuiButton>
                        <HelpMuiButton
                          help="approvePlan"
                          variant="contained"
                          disabled={
                            busy ||
                            !actor.trim() ||
                            !project.profile.confirmed ||
                            accepted === 0 ||
                            project.selectedClusters.length === 0
                          }
                          onClick={() =>
                            work(async () => {
                              setApproval(
                                await api<Plan>(base + "/approval-preview"),
                              );
                              setApprovalKey(crypto.randomUUID());
                            })
                          }
                        >
                          Approve plan version
                        </HelpMuiButton>
                      </div>
                    </div>
                    <Alert
                      severity={planId ? "success" : "info"}
                      sx={{ mt: 3 }}
                    >
                      {planId
                        ? "Approved snapshot. Later edits will not change this version."
                        : "Draft plan. Only accepted recommendations will enter an approved version."}{" "}
                      Implementation remains Not started.
                    </Alert>
                    {viewPlan?.reasoning && (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        LLM-assisted proposal: {viewPlan.reasoning.provider} /{" "}
                        {viewPlan.reasoning.model}. Actions and label
                        characteristics remain subject to your review.
                      </Alert>
                    )}
                    {viewPlan?.reasoning?.output.clusters.map((c) => (
                      <Box key={c.clusterId} sx={{ mt: 2 }}>
                        <Typography fontWeight={600}>
                          {c.clusterId} · Selected ethics label characteristics
                        </Typography>
                        {c.mappings.map((m, i) => (
                          <Typography variant="body2" key={i}>
                            {m.card} → {m.characteristic}
                          </Typography>
                        ))}
                      </Box>
                    ))}
                    {viewPlan && (
                      <Accordion
                        defaultExpanded
                        sx={{
                          mt: 2,
                          boxShadow: "none",
                          border: "1px solid #e3e7ed",
                        }}
                      >
                        <AccordionSummary>
                          Gaps and unresolved work ({viewPlan.gaps.length})
                        </AccordionSummary>
                        <AccordionDetails>
                          <ul className="gaps">
                            {viewPlan.gaps.map((g, i) => (
                              <li key={i}>
                                <Typography variant="body2">{g}</Typography>
                              </li>
                            ))}
                          </ul>
                          {viewPlan.excludedActionIds.length > 0 && (
                            <Typography variant="body2">
                              Excluded actions:{" "}
                              {viewPlan.excludedActionIds.join(", ")}
                            </Typography>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    )}
                    <div className="toolbar" style={{ marginTop: 24 }}>
                      <HelpTextField
                        select
                        label="Review status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        sx={{ width: 195 }}
                      >
                        <MenuItem value="all">All statuses</MenuItem>
                        {Object.entries(reviewLabels).map(([id, label]) => (
                          <MenuItem key={id} value={id}>
                            {label}
                          </MenuItem>
                        ))}
                      </HelpTextField>
                      <HelpTextField
                        label="Filter owner"
                        value={ownerFilter}
                        onChange={(e) => setOwnerFilter(e.target.value)}
                      />
                      <HelpTextField
                        label="Filter phase"
                        value={phaseFilter}
                        onChange={(e) => setPhaseFilter(e.target.value)}
                      />
                    </div>
                    <div className="review-table">
                      <Table sx={{ mt: 2, minWidth: 750 }}>
                        <TableHead>
                          <TableRow>
                            {[
                              "Action",
                              "Adaptation",
                              "Owner / phases",
                              "Review / implementation",
                            ].map((h) => (
                              <TableCell key={h}>{h}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(viewPlan?.entries || [])
                            .filter(
                              (e) =>
                                (statusFilter === "all" ||
                                  e.recommendation.reviewStatus ===
                                    statusFilter) &&
                                (e.recommendation.owner || "Unassigned")
                                  .toLowerCase()
                                  .includes(ownerFilter.toLowerCase()) &&
                                e.recommendation.phases
                                  .join(" ")
                                  .toLowerCase()
                                  .includes(phaseFilter.toLowerCase()),
                            )
                            .map(({ recommendation: r, source: s }) => (
                              <TableRow key={s.id}>
                                <TableCell>
                                  <Typography fontWeight={600}>
                                    {s.category.charAt(0) +
                                      s.category.slice(1).toLowerCase()}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {s.id}
                                  </Typography>
                                  {!planId && (
                                    <HelpMuiButton
                                      help="adaptation"
                                      size="small"
                                      onClick={() => {
                                        if (discard()) {
                                          setIndex(
                                            project.recommendations.findIndex(
                                              (a) => a.sourceActionId === s.id,
                                            ),
                                          );
                                          setStage(2);
                                        }
                                      }}
                                    >
                                      Edit
                                    </HelpMuiButton>
                                  )}
                                </TableCell>
                                <TableCell sx={{ maxWidth: 420 }}>
                                  {r.action}
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    display="block"
                                    sx={{ mt: 1 }}
                                  >
                                    Evidence: {r.evidence}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {r.owner || "Unassigned"}
                                  <Typography
                                    variant="caption"
                                    display="block"
                                    color="text.secondary"
                                  >
                                    {r.phases.join(", ")}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Status value={r.reviewStatus} />
                                  <Typography
                                    variant="caption"
                                    display="block"
                                    sx={{ mt: 1 }}
                                  >
                                    Not started
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                    {viewPlan?.entries.length === 0 && (
                      <Typography sx={{ py: 3 }} color="text.secondary">
                        No selected recommendations in this plan. Confirm the
                        profile and select a cluster to continue.
                      </Typography>
                    )}
                  </Paper>
                </>
              )}
            </>
          )}
        </main>
      </div>
      <Dialog
        open={newOpen}
        onClose={() => !busy && setNewOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {isExample
            ? "Start with a support-ticket example"
            : "Create a project"}
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            The project will use the current imported catalogue. The tool
            manages its version automatically.
          </Typography>
          <Stack spacing={3}>
            <HelpTextField
              autoFocus
              label="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              fullWidth
            />
            <HelpTextField
              label="Your reviewer name"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              helperText="Self-reported name used in the local decision history."
              fullWidth
            />
            {isExample && (
              <Alert severity="info">
                The example includes explicit unknowns for retention, sharing
                and safeguards. Review it before confirmation.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <HelpMuiButton
            help="cancel"
            onClick={() => setNewOpen(false)}
            disabled={busy}
          >
            Cancel
          </HelpMuiButton>
          <HelpMuiButton
            help="create"
            variant="contained"
            disabled={busy || !newName.trim() || !actor.trim()}
            onClick={create}
          >
            Create project
          </HelpMuiButton>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!details}
        onClose={() => setDetails(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {details?.id} · {details?.title}
        </DialogTitle>
        <DialogContent>
          {details && (
            <>
              <Typography sx={{ mb: 2 }}>{details.definition}</Typography>
              <Typography fontWeight={600}>Scope and boundaries</Typography>
              <Typography sx={{ my: 1 }}>
                {details.boundaries || "No boundary notes supplied."}
              </Typography>
              <Typography color="text.secondary" sx={{ my: 2 }}>
                {details.semanticRationale}
              </Typography>
              <Typography fontWeight={600}>Ethics label mappings</Typography>
              {details.labelMappings.map((m, i) => (
                <Typography key={i} variant="body2" sx={{ my: 1 }}>
                  {m.card} → {m.characteristic}
                </Typography>
              ))}
              <Divider sx={{ my: 2 }} />
              <Typography fontWeight={600}>Six source actions</Typography>
              {details.actions.map((a) => (
                <Accordion key={a.id} sx={{ boxShadow: "none" }}>
                  <AccordionSummary>
                    {a.category.charAt(0) + a.category.slice(1).toLowerCase()} ·{" "}
                    {a.id}
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography>{a.text}</Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Evidence: {a.evidence}
                    </Typography>
                    <Typography variant="caption">
                      References: {a.referenceIds.join(", ")} · Source:{" "}
                      {a.source}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <HelpMuiButton help="close" onClick={() => setDetails(null)}>
            Close
          </HelpMuiButton>
        </DialogActions>
      </Dialog>
      <Dialog
        open={history !== null}
        onClose={() => setHistory(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Decision history <Info topic="history" />
        </DialogTitle>
        <DialogContent>
          {history?.map((e) => (
            <div key={e.id} className="history-item">
              <Typography fontWeight={600}>
                {e.operation.replaceAll("_", " ")}
                {e.sourceActionId ? " · " + e.sourceActionId : ""}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {e.actor} · {new Date(e.at).toLocaleString("en-GB")}
              </Typography>
              {e.reason && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {e.reason}
                </Typography>
              )}
              <Accordion sx={{ boxShadow: "none" }}>
                <AccordionSummary>Before and after</AccordionSummary>
                <AccordionDetails>
                  <Typography variant="caption">Before</Typography>
                  <pre>{JSON.stringify(e.before, null, 2)}</pre>
                  <Typography variant="caption">After</Typography>
                  <pre>{JSON.stringify(e.after, null, 2)}</pre>
                </AccordionDetails>
              </Accordion>
            </div>
          ))}
        </DialogContent>
        <DialogActions>
          <HelpMuiButton help="close" onClick={() => setHistory(null)}>
            Close
          </HelpMuiButton>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!approval}
        onClose={() => !busy && setApproval(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Approve a plan version <Info topic="approvePlan" />
        </DialogTitle>
        <DialogContent>
          <Typography>
            Approval creates an immutable snapshot of accepted recommendations.
            Rejected, proposed and awaiting-information entries stay in history.
          </Typography>
          <Alert severity="warning" sx={{ my: 2 }}>
            This plan can be approved with explicit gaps. Approval does not
            confirm implementation or compliance.
          </Alert>
          <Typography fontWeight={600}>
            Included:{" "}
            {approval?.entries
              .filter((e) =>
                ["accepted", "edited"].includes(e.recommendation.reviewStatus),
              )
              .map((e) => e.source.id)
              .join(", ") || "None"}
          </Typography>
          <Typography sx={{ mt: 2 }}>
            Omitted: {approval?.excludedActionIds.join(", ") || "None"}
          </Typography>
          <ul className="gaps">
            {approval?.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
          <Typography variant="body2">Approving as: {actor}</Typography>
        </DialogContent>
        <DialogActions>
          <HelpMuiButton
            help="cancel"
            onClick={() => setApproval(null)}
            disabled={busy}
          >
            Cancel
          </HelpMuiButton>
          <HelpMuiButton
            help="approvePlan"
            variant="contained"
            onClick={approve}
            disabled={busy}
          >
            Approve with recorded gaps
          </HelpMuiButton>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!notice}
        autoHideDuration={5000}
        onClose={() => setNotice("")}
        message={notice}
      />
    </div>
  );
}
