import { Info, HelpMuiButton, HelpTextField } from "./Help";
import { useEffect, useState } from "react";
import { Alert, Box, Chip, MenuItem, Stack, Typography } from "@mui/material";
import type { Attachment, Field } from "./types";

const labels: Record<string, string> = {
  purpose: "Purpose and features",
  stakeholders: "Stakeholders and affected people",
  data: "Data processed",
  behaviour: "Decision-making behaviour",
  phase: "Current SDLC phase",
  retention: "Data retention",
  sharing: "External data sharing",
  safeguards: "Existing safeguards",
  additional: "Additional Material",
};
const inputLabels: Record<string, string> = {
  purpose: "Capabilities and intended outcomes",
  stakeholders: "Users, affected non-users and vulnerable groups",
  data: "Data types, sources and sensitivity",
  behaviour: "Decisions, automation and human control",
  phase: "Selected lifecycle phases",
  retention: "Retention periods and deletion rules",
  sharing: "Recipients, services and data shared",
  safeguards: "Implemented controls and supporting evidence",
};
const helpers: Record<string, string> = {
  purpose:
    "For example, a support portal lets customers submit tickets and helps support agents resolve requests.",
  safeguards:
    "e.g., GDPR, COPPA, ISO, etc. Describe the controls or evidence you have; naming a framework does not establish compliance.",
  phase:
    "Select the phases you want to address. Proposals will explain which actions are suitable for these phases.",
};
export const phases = [
  "Discovery",
  "Requirements",
  "Design",
  "Architecture",
  "Implementation",
  "Verification",
  "Release",
  "Pre-release",
  "Deployment",
  "Operations",
  "Maintenance",
  "Evolution",
  "Evolution Management",
  "Incident Response",
  "Recovery",
];
export default function ProfileFields({
  base,
  fields,
  setFields,
  disabled,
  onError,
  onUploading,
}: {
  base: string;
  fields: Field[];
  setFields: (fields: Field[]) => void;
  disabled: boolean;
  onError: (error: string) => void;
  onUploading: (busy: boolean) => void;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]),
    [uploading, setUploading] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(base + "/attachments")
      .then((r) => r.json())
      .then((data) => {
        if (active && Array.isArray(data)) setAttachments(data);
      })
      .catch((e) => onError(e.message));
    return () => {
      active = false;
    };
  }, [base]);
  function patch(id: string, change: Partial<Field>) {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...change } : f)));
  }
  async function upload(field: Field, company: boolean, file: File) {
    setUploading(true);
    onUploading(true);
    onError("");
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Each file must be at most 10 MiB.");
      const form = new FormData();
      form.append("field", company ? "company_ethics" : field.id);
      form.append("file", file);
      const response = await fetch(base + "/attachments", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.detail || "Upload failed. Check file format and size.",
        );
      const key = company ? "companyEthics" : "files";
      setAttachments((v) => [...v, data]);
      patch(field.id, { [key]: [...(field[key] || []), data.id] });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
      onUploading(false);
    }
  }
  function files(field: Field, company = false) {
    const key = company ? "companyEthics" : "files",
      ids = field[key] || [];
    return (
      <Box sx={{ mt: 1.5 }}>
        <HelpMuiButton
          help="attach"
          component="label"
          variant="outlined"
          size="small"
          disabled={disabled || uploading || ids.length >= 10}
        >
          {uploading
            ? "Uploading…"
            : company
              ? "Upload company ethics"
              : field.id === "additional"
                ? "Upload supplementary material"
                : "Upload a supporting file"}
          <input
            hidden
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(field, company, file);
              e.target.value = "";
            }}
          />
        </HelpMuiButton>
        <Typography
          variant="caption"
          display="block"
          color="text.secondary"
          sx={{ mt: 0.5 }}
        >
          {company
            ? "Add your company's internal regulations."
            : field.id === "additional"
              ? "Add here any supplementary material, e.g., architectural diagram, workflow, etc."
              : "Add a file alongside your text, or use a file on its own."}
        </Typography>
        {ids.map((id) => {
          const a = attachments.find((a) => a.id === id);
          return (
            <Box key={id} sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={a?.name || "Attached file"}
                component="a"
                href={base + "/attachments/" + id}
                clickable
                onDelete={
                  disabled || uploading
                    ? undefined
                    : () =>
                        patch(field.id, { [key]: ids.filter((v) => v !== id) })
                }
              />
              {a && (
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                >
                  {a.extraction} · {(a.size / 1024).toFixed(1)} KiB
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    );
  }
  return (
    <>
      <Alert severity="info" sx={{ mb: 3 }}>
        Files stay with this project. Save or confirm the profile to include new
        attachments. PDF/DOCX and UTF-8 text are read as text; images need a
        vision model. Other formats can be stored, with unreadable content
        reported as a gap. Up to 10 MiB per file.
      </Alert>
      <div className="profile-grid">
        {fields.map((f) => (
          <Box
            key={f.id}
            className={
              f.id === "purpose" || f.id === "additional" ? "wide" : ""
            }
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography fontWeight={600} fontSize={14}>
                {labels[f.id] || f.id}{" "}
                <Info
                  entry={{
                    title: labels[f.id] || f.id,
                    text:
                      (helpers[f.id] ||
                        "Describe the known application context and attach evidence if useful.") +
                      " Known enables text and supporting files. Unknown records a gap; Not applicable records that this concern does not apply. Additional material accepts supplementary files. Save or confirm the profile to retain your changes.",
                  }}
                />
              </Typography>
              {f.id !== "additional" && (
                <HelpTextField
                  select
                  helpEntry={{
                    title: (labels[f.id] || f.id) + " status",
                    text:
                      f.id === "safeguards"
                        ? "Known enables text and files. Company Ethics also enables your internal-regulations upload. Unknown records missing information; Not applicable records that the field does not apply."
                        : f.id === "sharing"
                          ? "Known enables details and evidence. None states that no personal data is shared with third parties. Unknown records a gap; Not applicable records that the field does not apply."
                          : "Known enables text and supporting files. Unknown records missing information. Not applicable records that this field does not concern the application.",
                  }}
                  value={f.status}
                  disabled={disabled || uploading}
                  sx={{ width: 175 }}
                  SelectProps={{
                    SelectDisplayProps: {
                      "aria-label": labels[f.id] + " status",
                    },
                  }}
                  onChange={(e) => {
                    const status = e.target.value as Field["status"];
                    patch(f.id, {
                      status,
                      value:
                        status === "none"
                          ? "We do not share any personal data with third parties."
                          : status === "known" || status === "company_ethics"
                            ? f.status === "none"
                              ? ""
                              : f.value
                            : "",
                      files:
                        status === "known" || status === "company_ethics"
                          ? f.files
                          : [],
                    });
                  }}
                >
                  <MenuItem value="known">Known</MenuItem>
                  <MenuItem value="unknown">Unknown</MenuItem>
                  <MenuItem value="not_applicable">Not applicable</MenuItem>
                  {f.id === "sharing" && <MenuItem value="none">None</MenuItem>}
                  {f.id === "safeguards" && (
                    <MenuItem value="company_ethics">Company Ethics</MenuItem>
                  )}
                </HelpTextField>
              )}
            </Stack>
            {f.id === "additional" ? (
              files(f)
            ) : f.status === "none" ? (
              <Alert severity="info">
                We do not share any personal data with third parties.
              </Alert>
            ) : (
              <>
                {f.status === "company_ethics" && (
                  <Box sx={{ mb: 2 }}>
                    {files(f, true)}
                    <Typography variant="body2" sx={{ mt: 2 }}>
                      You can also describe known safeguards and attach their
                      evidence below.
                    </Typography>
                  </Box>
                )}
                {f.id === "phase" && f.status === "known" ? (
                  <HelpTextField
                    select
                    fullWidth
                    label={inputLabels.phase}
                    value={f.value
                      .split(/[;,]/)
                      .map((v) => v.trim())
                      .filter(Boolean)}
                    SelectProps={{ multiple: true }}
                    onChange={(e) =>
                      patch(f.id, {
                        value: (e.target.value as unknown as string[]).join(
                          "; ",
                        ),
                      })
                    }
                    helperText={helpers.phase}
                  >
                    {[
                      ...new Set([
                        ...phases,
                        ...f.value
                          .split(/[;,]/)
                          .map((v) => v.trim())
                          .filter(Boolean),
                      ]),
                    ].map((p) => (
                      <MenuItem value={p} key={p}>
                        {p}
                      </MenuItem>
                    ))}
                  </HelpTextField>
                ) : (
                  <HelpTextField
                    fullWidth
                    multiline
                    minRows={2}
                    label={inputLabels[f.id]}
                    value={f.value}
                    disabled={
                      disabled ||
                      uploading ||
                      !["known", "company_ethics"].includes(f.status)
                    }
                    onChange={(e) => patch(f.id, { value: e.target.value })}
                    helperText={
                      f.status === "unknown"
                        ? "This gap will remain visible in your plan."
                        : f.status === "not_applicable"
                          ? "Explicitly marked as not applicable."
                          : helpers[f.id] ||
                            "Supplied by you; not inferred by a model."
                    }
                  />
                )}
                {["known", "company_ethics"].includes(f.status) && files(f)}
                {f.id === "safeguards" &&
                  f.status !== "company_ethics" &&
                  (f.companyEthics?.length || 0) > 0 &&
                  files(f, true)}
              </>
            )}
          </Box>
        ))}
      </div>
    </>
  );
}
