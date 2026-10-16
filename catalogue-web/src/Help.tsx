import { createContext, useContext, useId, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import type { ButtonProps, TextFieldProps } from "@mui/material";
import { help } from "./help-content";
import type { HelpEntry } from "./help-content";
import "./help.css";

const HelpContext = createContext<(entry: HelpEntry) => void>(() => {});
export function HelpProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<HelpEntry | null>(null);
  const id = useId();
  return (
    <HelpContext.Provider value={setEntry}>
      {children}
      <Dialog
        open={!!entry}
        onClose={() => setEntry(null)}
        fullWidth
        maxWidth="sm"
        aria-labelledby={id}
        aria-describedby={id + "-body"}
      >
        <DialogTitle id={id}>{entry?.title}</DialogTitle>
        <DialogContent id={id + "-body"} className="help-dialog-body">
          {entry?.text.split("\n").map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEntry(null)}>Close explanation</Button>
        </DialogActions>
      </Dialog>
    </HelpContext.Provider>
  );
}
export function Info({ topic, entry }: { topic?: string; entry?: HelpEntry }) {
  const open = useContext(HelpContext);
  const content = entry || (topic ? help[topic] : undefined);
  if (!content) return null;
  return (
    <button
      type="button"
      className="help-info"
      aria-label={"Information: " + content.title}
      title={"Information: " + content.title}
      aria-haspopup="dialog"
      onClick={(e) => {
        e.stopPropagation();
        open(content);
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path d="M12 10.5v6" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="7.3" r="1" fill="currentColor" />
      </svg>
    </button>
  );
}
export function HelpButton({
  help: topic,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { help: string }) {
  return (
    <span
      className={
        "help-action " +
        className
          .split(" ")
          .map((c) => "help-for-" + c)
          .join(" ")
      }
    >
      <button type="button" className={className} {...props}>
        {children}
      </button>
      <Info topic={topic} />
    </span>
  );
}
export function HelpMuiButton({
  help: topic,
  ...props
}: ButtonProps & {
  help: string;
  component?: "a" | "label";
  download?: boolean;
}) {
  return (
    <span
      className={
        "help-action help-mui-action" + (props.fullWidth ? " help-full" : "")
      }
    >
      <Button {...props} />
      <Info topic={topic} />
    </span>
  );
}

export const fieldHelp: Record<string, string> = {
  "Capabilities and intended outcomes":
    "Describe what the application lets people do and what it aims to achieve. For example, a support portal lets customers submit tickets and enables support staff to resolve requests. Add supporting requirements or product documentation if useful.",
  "Users, affected non-users and vulnerable groups":
    "Identify direct users and other people affected by the software, including people who do not use it. Mention vulnerable groups and explain how they may be affected. Do not assume every stakeholder is a customer.",
  "Data types, sources and sensitivity":
    "Describe the information the application collects, generates or uses, where it comes from and whether it is sensitive. Include personal data and relevant non-personal data. Attach a data inventory if available.",
  "Decisions, automation and human control":
    "Describe decisions made or supported by the system, which steps are automated and where people can review or override them. For example, explain whether a suggested ticket priority is checked by a support agent.",
  "Selected lifecycle phases":
    "Choose the software lifecycle phases you want the structured plan to address. An action may be unsuitable for a particular phase; review the proposed suitability before accepting it. These choices are not required in the conversational workspace.",
  "Retention periods and deletion rules":
    "State how long each relevant type of data is kept, what triggers deletion and whether backups follow different rules. Use Unknown if the retention policy has not yet been decided.",
  "Recipients, services and data shared":
    "Identify third parties or external services receiving data, what is shared and why. Use None only when no personal data is shared with third parties; use Unknown when this has not been established.",
  "Implemented controls and supporting evidence":
    "Describe safeguards already implemented, such as access controls, encryption or review procedures, and provide evidence. Naming GDPR, COPPA or an ISO standard alone does not establish compliance. Company Ethics also allows uploading internal regulations.",
  "Open project":
    "Choose a saved structured-workflow project. Its profile, selection, draft actions and plan versions will be loaded. Switching may prompt you about unsaved edits.",
  "Reviewer name":
    "Enter the person making this decision. The name is recorded in local history; it is self-reported and is not an authenticated identity.",
  "Your reviewer name":
    "Enter the person creating and reviewing this project. The name is self-reported and recorded in local decision history.",
  "Search clusters":
    "Filter catalogue clusters by the search text. Clear the text to see all clusters. Searching does not change your saved selection.",
  "Phase suitability":
    "Assess whether this action fits the selected lifecycle phases. Only suitable actions can be accepted. Mark uncertain when evidence is missing, and explain your assessment.",
  "Phase suitability explanation":
    "Explain why the action applies, does not apply, or needs more information for the selected phases. Save the edit to retain your assessment.",
  "Concern scenario":
    "Describe the software behaviour, people affected and plausible harm that make this action relevant. Use a concrete scenario from your own project.",
  "Adapted action":
    "Rewrite the source recommendation as a practical task for your project. Retain its ethical intent and make the requested work clear enough for your team to perform.",
  "Expected evidence":
    "Describe the artefact or observation that would show the work was performed, such as a test report, design review or retention configuration. This field describes evidence; it does not create it.",
  "Validation criterion":
    "State what a human reviewer should check to judge the action's result. For example, specify a measurable test outcome. Leaving this blank records an unresolved criterion.",
  "Responsible owner":
    "Name the person or team responsible for this action. Map catalogue roles to your organisation. This does not assign work in an external issue tracker.",
  "Applicable phases":
    "Enter the lifecycle phases where this action will be used, separated by semicolons, such as Requirements; Design. Review them against the action's phase suitability.",
  "Adaptation rationale":
    "Explain how and why the source action was adapted to your application. Record assumptions and relevant evidence so another reviewer can understand the decision.",
  "Review reason or unresolved question":
    "Explain your decision or record information still needed. A reason is required when rejecting an action. This becomes part of the review history when saved.",
  "Plan version":
    "Choose the current draft or a previously approved snapshot. Approved versions do not change when the draft is edited. Exports use the selected version.",
  "Review status":
    "Filter the displayed actions by their review decision. This only changes the view and does not change any action status.",
  "Filter owner":
    "Show actions matching this owner text. Clear the field to show all owners. This is a display filter, not a reassignment.",
  "Filter phase":
    "Show actions matching this lifecycle phase. Clear the field to show all phases. This does not change action applicability.",
  "Selection rationale":
    "Explain why this cluster is relevant to your application. Review the explanation and selected characteristics before applying the proposed selection.",
};

export function HelpTextField({
  helpEntry,
  ...props
}: TextFieldProps & { helpEntry?: HelpEntry }) {
  const label =
    typeof props.label === "string" ? props.label : "Field guidance";
  const topic =
    label === "Provider"
      ? "provider"
      : label === "Model"
        ? "model"
        : label === "Project name"
          ? "projectName"
          : undefined;
  const text =
    fieldHelp[label] ||
    (typeof props.helperText === "string"
      ? props.helperText
      : "Describe the known information for this field. Review it before saving. In the structured profile, use Unknown when information is missing or Not applicable when it does not concern this application. Text and attached evidence support later reasoning; they do not establish compliance.");
  return (
    <TextField
      {...props}
      helperText={
        <>
          {props.helperText}{" "}
          <Info
            topic={topic}
            entry={helpEntry || (topic ? undefined : { title: label, text })}
          />
        </>
      }
    />
  );
}
