# Manual C01 workflow

Open http://localhost:8082 after running `./scripts/run.sh`. Refresh an already open tab after an update. The tool manages catalogue version IDs automatically.

## Start a project

Choose **Start with an example** for a support-ticket portal, or **Create a project** for a blank application. Supply your reviewer name, which is a self-reported label for the local history, then create the project.

The example describes customer names, email addresses and ticket text. Retention, external sharing and existing safeguards are explicitly Unknown. It is illustrative input, not a real project assessment.

## Describe and confirm

In **Application profile**, review eight fields. Every field must have a value or be explicitly Unknown or Not applicable before confirmation. Unknown fields cannot contain asserted facts. Save draft to retain incomplete input; Confirm profile saves an immutable profile version and opens cluster selection.

You may return and change a confirmed context. Saving a change creates an unconfirmed draft and resets recommendations to Proposed. Confirm that draft before further review. Earlier approved plans retain their original profile and recommendation snapshots.

## Select and inspect

In **Cluster selection**, search and inspect all 24 clusters. View details exposes definition, boundaries, label mappings and six source actions. This increment enables adaptation only for C-01 Privacy & Data Protection. Select C-01 and choose **Save selection and adapt**.

## Adapt and review

In **Adaptation workspace**, open any of Know, Protect, Inform, Assess, Validate and Respond. They are navigation categories, not a required sequence. The original source appears beside the editable adaptation.

For Know, a useful illustrative adaptation is:

- Concern scenario: support-ticket text may contain personal information beyond what agents need.
- Adapted action: inventory ticket data, purposes, access, retention and external-sharing decisions; record the unresolved decisions explicitly.
- Expected evidence: a versioned ticket-data inventory linked to the relevant data flows.
- Validation criterion: a human reviewer checks the inventory against implemented data flows and confirms that unresolved decisions have assigned follow-up work.
- Owner: a real role or person from your project, or leave Unassigned.
- Rationale: explain how the confirmed ticket-processing context makes the source action relevant.

Choose **Save edit** to retain a proposal. Choose **Accept** to record a review decision; changing source action/evidence/phases produces Accepted with edits. Accepting requires an application-specific scenario. Missing owners, criteria and rationale remain visible as gaps. Rejection requires a reason; Await information records deferred work. Source details expose references and worksheet cells.

Implementation remains Not started. Acceptance and approval do not claim that safeguards are implemented or validated. Evidence submission and human implementation validation will follow in a later increment.

## Approve and export

In **Project plan**, filter by review status, owner and phase. Inspect gaps and open Decision history for actors, timestamps and before/after content.

Choose **Approve plan version** to review the inclusion/exclusion preview. Only accepted and accepted-edited entries enter the immutable approved snapshot; omitted entries and unresolved application information are disclosed. Approval with gaps is allowed. The source catalogue's pending publication warnings are also disclosed.

Select Current draft or a numbered approved version, then choose **Export JSON** or **Export report**. The report downloads as an English HTML file that can be opened in a browser or printed. Both formats use the selected plan snapshot. Draft exports are labelled DRAFT.

Use Open project to resume another project. Stored profiles, decisions and approved versions survive browser reload and container restart. Unsaved edits prompt before navigation; conflicting edits from another session return an error instead of overwriting newer work.

## Current boundaries

The workflow is manual, local and limited to C-01 adaptation. Other clusters are inspectable. There are no model calls, shared-user authentication, project access permissions, implementation evidence validation or automatic ethical/compliance scores in this increment.
