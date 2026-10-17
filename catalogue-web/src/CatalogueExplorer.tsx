import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Snackbar,
  TextField,
} from "@mui/material";
import type { Cluster, Action } from "./types";
import { Info } from "./Help";
import "./catalogue-explorer.css";

type Version = {
  id: string;
  sourceSha256: string;
  importerVersion: string;
  importedAt: string;
  clusterCount: number;
  actionCount: number;
  referenceCount: number;
  warningCount: number;
  state: string;
};
type Reference = {
  id: string;
  title: string;
  authors: string;
  year: string;
  authority: string;
  links: string;
  source: string;
};
type Issue = {
  severity: string;
  code: string;
  source: string;
  message: string;
};
type Report = { issues: Issue[] };
const categories = [
  "KNOW",
  "PROTECT",
  "INFORM",
  "ASSESS",
  "VALIDATE",
  "RESPOND",
];
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(path, { signal });
  const data = await r.json();
  if (!r.ok) throw Error(data.detail || "The catalogue could not be loaded.");
  return data;
}
function sourceLinks(raw: string) {
  return [...new Set(raw.match(/https?:\/\/[^\s<>"|]+/g) || [])]
    .map((value) => value.replace(/,$/, ""))
    .filter((value) => {
      try {
        const u = new URL(value);
        return (
          ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
        );
      } catch {
        return false;
      }
    });
}
export default function CatalogueExplorer({
  onClose,
}: {
  onClose?: () => void;
}) {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const [versions, setVersions] = useState<Version[]>([]),
    [version, setVersion] = useState(""),
    [clusters, setClusters] = useState<Cluster[]>([]),
    [references, setReferences] = useState<Reference[]>([]),
    [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reload, setReload] = useState(0);
  const [view, setView] = useState<"clusters" | "references" | "notes">(
    "clusters",
  );
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [phase, setPhase] = useState(""),
    [ethicsLabel, setEthicsLabel] = useState("");
  const [selected, setSelected] = useState(
    onClose ? "" : query.get("cluster") || "",
  );
  const [referenceSearch, setReferenceSearch] = useState(""),
    [scope, setScope] = useState<{ title: string; ids: string[] } | null>(null);
  const [severity, setSeverity] = useState("WARNING");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    read<Version[]>("/api/catalogue/versions", controller.signal)
      .then((v) => {
        setVersions(v);
        // One catalogue is exposed to users; import IDs remain internal provenance.
        setVersion(v[0]?.id || "");
        if (!v.length) setLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    if (!version) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setClusters([]);
    setReferences([]);
    setReport(null);
    setScope(null);
    const base = "/api/catalogue/versions/" + encodeURIComponent(version);
    Promise.all([
      read<Cluster[]>(base + "/cluster-details", controller.signal),
      read<Reference[]>(base + "/references", controller.signal),
      read<Report>(base + "/report", controller.signal),
    ])
      .then(([cs, rs, rp]) => {
        if (controller.signal.aborted) return;
        setClusters(cs);
        setReferences(rs);
        setReport(rp);
        setLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [version, reload]);
  const current = versions.find((v) => v.id === version);
  const phases = useMemo(
    () =>
      [
        ...new Set(clusters.flatMap((c) => c.actions.flatMap((a) => a.phases))),
      ].sort(),
    [clusters],
  );
  const labels = useMemo(
    () =>
      [
        ...new Set(clusters.flatMap((c) => c.labelMappings.map((m) => m.card))),
      ].sort(),
    [clusters],
  );
  const actionMatches = (a: Action) =>
    (!category || a.category === category) &&
    (!phase || a.allPhases || a.phases.includes(phase));
  const shown = clusters.filter(
    (c) =>
      (!ethicsLabel || c.labelMappings.some((m) => m.card === ethicsLabel)) &&
      c.actions.some(actionMatches) &&
      (!search.trim() ||
        [
          c.id,
          c.title,
          c.definition,
          ...c.concerns,
          ...c.labelMappings.flatMap((m) => [m.card, m.characteristic]),
          ...c.actions.flatMap((a) => [
            a.id,
            a.text,
            a.evidence,
            ...a.concerns,
            ...a.roles,
            ...a.phases,
          ]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase())),
  );
  const cluster = shown.find((c) => c.id === selected) || shown[0];
  const actions = cluster?.actions.filter(actionMatches) || [];
  const shownReferences = references.filter(
    (r) =>
      (!scope || scope.ids.includes(r.id)) &&
      [r.id, r.title, r.authors, r.year, r.authority, r.links]
        .join(" ")
        .toLowerCase()
        .includes(referenceSearch.trim().toLowerCase()),
  );
  const notes =
    report?.issues.filter((i) => !severity || i.severity === severity) || [];
  function linked(title: string, ids: string[]) {
    setScope({ title, ids: [...new Set(ids)] });
    setReferenceSearch("");
    setView("references");
  }
  function clearFilters() {
    setSearch("");
    setCategory("");
    setPhase("");
    setEthicsLabel("");
  }
  function copyLink() {
    const url = new URL("/", window.location.origin);
    url.searchParams.set("catalogue", "1");
    if (cluster) url.searchParams.set("cluster", cluster.id);
    void navigator.clipboard
      .writeText(url.href)
      .then(() => setNotice("Catalogue link copied."))
      .catch(() => setNotice(url.href));
  }
  async function openSource(event: MouseEvent<HTMLAnchorElement>, url: string) {
    if (!window.ethicsparkDesktop) return;
    event.preventDefault();
    try {
      if (window.ethicsparkDesktop.openExternalLink)
        await window.ethicsparkDesktop.openExternalLink(url);
      else {
        await navigator.clipboard.writeText(url);
        setNotice(
          "Source URL copied. Open it in your browser, or reopen the desktop app for direct links.",
        );
      }
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  return (
    <section className="catalogue-explorer" aria-label="Catalogue explorer">
      <header className="catalogue-heading">
        <div>
          <span className="catalogue-eyebrow">
            Source catalogue · Read-only
          </span>
          <h1 id="catalogue-explorer-title">
            Explore catalogue <Info topic="explorer" />
          </h1>
          <p>
            Browse ethical concerns and practical engineering actions. No API
            key, Ollama or AI connection is needed.
          </p>
        </div>
        {onClose ? (
          <Button onClick={onClose}>Close catalogue</Button>
        ) : (
          <Button component="a" href="/">
            Back to workspace
          </Button>
        )}
      </header>
      <div className="catalogue-version-bar">
        {current && (
          <div className="catalogue-counts">
            <strong>{current.clusterCount}</strong> clusters <span>·</span>{" "}
            <strong>{current.actionCount}</strong> actions <span>·</span>{" "}
            <strong>{current.referenceCount}</strong> references
          </div>
        )}
        {version && <Button onClick={copyLink}>Copy catalogue link</Button>}
      </div>
      <nav className="catalogue-tabs" aria-label="Catalogue sections">
        <Button
          aria-current={view === "clusters" ? "page" : undefined}
          onClick={() => setView("clusters")}
        >
          Clusters & actions
        </Button>
        <Button
          aria-current={view === "references" ? "page" : undefined}
          onClick={() => {
            setScope(null);
            setView("references");
          }}
        >
          References
        </Button>
        <Button
          aria-current={view === "notes" ? "page" : undefined}
          onClick={() => setView("notes")}
        >
          Import notes
          {current ? " (" + current.warningCount + " warnings)" : ""}
        </Button>
      </nav>
      {error ? (
        <Alert
          severity="error"
          action={
            <Button onClick={() => setReload((v) => v + 1)}>Retry</Button>
          }
        >
          {error}
        </Alert>
      ) : loading ? (
        <div className="catalogue-loading" role="status">
          <CircularProgress size={24} /> Loading source catalogue…
        </div>
      ) : !versions.length ? (
        <Alert severity="info">
          No catalogue has been imported. Start the local backend with a valid
          catalogue source, then retry.{" "}
          <Button onClick={() => setReload((v) => v + 1)}>Retry</Button>
        </Alert>
      ) : (
        <>
          {view === "clusters" ? (
            <>
              <div className="catalogue-filters">
                <TextField
                  label="Search catalogue"
                  placeholder="Concern, action, role or keyword"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  size="small"
                />
                <TextField
                  select
                  label="Action category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  size="small"
                >
                  <MenuItem value="">All categories</MenuItem>
                  {categories.map((c) => (
                    <MenuItem key={c} value={c}>
                      {label(c)}
                    </MenuItem>
                  ))}
                </TextField>
                {(search || category || phase || ethicsLabel) && (
                  <Button onClick={clearFilters}>Clear filters</Button>
                )}
              </div>
              <details className="catalogue-more-filters">
                <summary>
                  More filters{phase || ethicsLabel ? " · active" : ""}
                </summary>
                <div className="catalogue-filters">
                  <TextField
                    select
                    label="SDLC phase"
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                    size="small"
                  >
                    <MenuItem value="">All phases</MenuItem>
                    {phases.map((p) => (
                      <MenuItem key={p} value={p}>
                        {p}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Ethics label"
                    value={ethicsLabel}
                    onChange={(e) => setEthicsLabel(e.target.value)}
                    size="small"
                  >
                    <MenuItem value="">All labels</MenuItem>
                    {labels.map((l) => (
                      <MenuItem key={l} value={l}>
                        {l}
                      </MenuItem>
                    ))}
                  </TextField>
                  <p>
                    Phase results also include actions applicable to all SDLC
                    phases.
                  </p>
                </div>
              </details>
              <div className="catalogue-browse-layout">
                <aside className="catalogue-cluster-list" aria-label="Clusters">
                  <p>
                    {shown.length} of {clusters.length} clusters
                  </p>
                  {shown.map((c) => (
                    <button
                      type="button"
                      className={cluster?.id === c.id ? "selected" : ""}
                      aria-current={cluster?.id === c.id ? "true" : undefined}
                      key={c.id}
                      onClick={() => setSelected(c.id)}
                    >
                      <span>{c.id}</span>
                      <strong>{c.title}</strong>
                    </button>
                  ))}
                  {!shown.length && (
                    <p>
                      No matching clusters. Try a different keyword or clear the
                      filters.
                    </p>
                  )}
                </aside>
                {cluster && (
                  <article
                    className="catalogue-cluster-detail"
                    key={cluster.id}
                  >
                    <span className="catalogue-eyebrow">{cluster.id}</span>
                    <h2>{cluster.title}</h2>
                    <p className="catalogue-definition">{cluster.definition}</p>
                    <div className="catalogue-chips">
                      {cluster.concerns.map((c) => (
                        <Chip size="small" key={c} label={c} />
                      ))}
                    </div>
                    <h3>Ethics label characteristics</h3>
                    <ul className="catalogue-mappings">
                      {cluster.labelMappings.map((m, i) => (
                        <li key={i}>
                          <strong>{m.card}</strong>
                          <span>{m.characteristic}</span>
                        </li>
                      ))}
                    </ul>
                    {(cluster.semanticRationale || cluster.boundaries) && (
                      <details className="catalogue-source-detail">
                        <summary>Scope and boundaries</summary>
                        {cluster.semanticRationale && (
                          <p>{cluster.semanticRationale}</p>
                        )}
                        {cluster.boundaries && <p>{cluster.boundaries}</p>}
                      </details>
                    )}
                    <Button
                      onClick={() =>
                        linked(cluster.id + " · " + cluster.title, [
                          ...cluster.referenceIds,
                          ...cluster.actions.flatMap((a) => a.referenceIds),
                        ])
                      }
                    >
                      View cluster references
                    </Button>
                    <h3>
                      Source actions{" "}
                      <span>
                        {actions.length} of {cluster.actions.length}
                      </span>
                    </h3>
                    {actions.map((a, i) => (
                      <Accordion
                        key={a.id}
                        defaultExpanded={i === 0}
                        className="catalogue-action"
                      >
                        <AccordionSummary
                          expandIcon={<span aria-hidden="true">⌄</span>}
                          aria-controls={a.id + "-detail"}
                          id={a.id + "-heading"}
                        >
                          <strong>{a.id}</strong>
                          <span>{label(a.category)}</span>
                        </AccordionSummary>
                        <AccordionDetails id={a.id + "-detail"}>
                          <p className="catalogue-action-text">{a.text}</p>
                          <dl>
                            <dt>Ethical concerns</dt>
                            <dd>
                              {a.concerns.join(" · ") ||
                                "Not specified in source."}
                            </dd>
                            <dt>Expected evidence</dt>
                            <dd>{a.evidence || "Not specified in source."}</dd>
                            <dt>SDLC phases</dt>
                            <dd>
                              {a.allPhases
                                ? "All SDLC phases"
                                : a.phases.join(" · ") ||
                                  "Not specified in source."}
                            </dd>
                            <dt>Suggested roles</dt>
                            <dd>
                              {a.roles.join(" · ") ||
                                "Not specified in source."}
                            </dd>
                            <dt>Source location</dt>
                            <dd>{a.source}</dd>
                          </dl>
                          <Button
                            disabled={!a.referenceIds.length}
                            onClick={() =>
                              linked(
                                a.id + " · " + label(a.category),
                                a.referenceIds,
                              )
                            }
                          >
                            View action references ({a.referenceIds.length})
                          </Button>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </article>
                )}
              </div>
            </>
          ) : view === "references" ? (
            <div className="catalogue-reference-view">
              <h2>Source references</h2>
              <p>
                Bibliographic records are displayed as supplied. Missing or
                truncated metadata is flagged in Import notes; inclusion does
                not establish support for every recommendation.
              </p>
              {scope && (
                <div className="catalogue-reference-scope">
                  <strong>Linked to {scope.title}</strong>
                  <Button onClick={() => setScope(null)}>
                    Show all references
                  </Button>
                  <Button onClick={() => setView("clusters")}>
                    Back to cluster
                  </Button>
                </div>
              )}
              <TextField
                label="Search references"
                placeholder="ID, title, author or year"
                value={referenceSearch}
                onChange={(e) => setReferenceSearch(e.target.value)}
                size="small"
                fullWidth
              />
              <p>
                {shownReferences.length} of {references.length} references
              </p>
              {!shownReferences.length && (
                <Alert severity="info">
                  No references match these filters.
                </Alert>
              )}
              {shownReferences.map((r) => (
                <article className="catalogue-reference-card" key={r.id}>
                  <span className="catalogue-eyebrow">{r.id}</span>
                  <h3>{r.title || "Title not supplied"}</h3>
                  <dl>
                    <dt>Authors / organisation</dt>
                    <dd>{r.authors || "Not supplied"}</dd>
                    <dt>Year</dt>
                    <dd>{r.year || "Not supplied"}</dd>
                    <dt>Authority / type</dt>
                    <dd>{r.authority || "Not supplied"}</dd>
                  </dl>
                  <div className="catalogue-reference-links">
                    {sourceLinks(r.links).map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => void openSource(event, url)}
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                  {r.links && !sourceLinks(r.links).length && <p>{r.links}</p>}
                  <small>Source location: {r.source}</small>
                </article>
              ))}
            </div>
          ) : (
            <div className="catalogue-notes-view">
              <h2>Import and source-review notes</h2>
              <p>
                These notes describe the imported source and normalisation
                decisions. They do not require an AI model. No source content is
                changed by this explorer.
              </p>
              <details className="catalogue-source-detail">
                <summary>Source provenance</summary>
                <dl>
                  <dt>Import ID</dt>
                  <dd>{version}</dd>
                  <dt>Source SHA-256</dt>
                  <dd>{current?.sourceSha256}</dd>
                  <dt>Importer</dt>
                  <dd>{current?.importerVersion}</dd>
                  <dt>State</dt>
                  <dd>
                    {current?.state} · imported snapshots remain subject to
                    publication review
                  </dd>
                </dl>
              </details>
              <TextField
                select
                label="Note severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                size="small"
              >
                <MenuItem value="">All notes</MenuItem>
                <MenuItem value="WARNING">Warnings</MenuItem>
                <MenuItem value="ERROR">Errors</MenuItem>
                <MenuItem value="INFO">Information</MenuItem>
              </TextField>
              <p>{notes.length} notes</p>
              {notes.map((n, i) => (
                <article className="catalogue-note" key={i}>
                  <strong>
                    {n.severity} · {n.code}
                  </strong>
                  <p>{n.message}</p>
                  <small>{n.source}</small>
                </article>
              ))}
              {!notes.length && <p>No notes at this severity.</p>}
            </div>
          )}
        </>
      )}
      <Snackbar
        open={!!notice}
        message={notice}
        autoHideDuration={8000}
        onClose={() => setNotice("")}
      />
    </section>
  );
}
