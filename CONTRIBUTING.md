# Coauthor review and contributions

Start with the README and `docs/MANUAL_WORKFLOW.md`, then use a new illustrative project to evaluate the C-01 workflow. Do not enter real customer or participant data into a shared example.

For feedback, report the source commit, browser/platform, steps taken, observed behaviour and expected result. Distinguish catalogue content issues, workflow/usability issues and implementation bugs. Include an English example where possible. Catalogue-reference corrections must retain provenance rather than silently replacing source meaning.

Use branches and pull requests for proposed changes. Keep user-facing text in English and preserve the canonical categories Know, Protect, Inform, Assess, Validate and Respond, the 184-reference registry and the agreed Requirements/Operations phase aliases. Run `./scripts/test.sh` for changes that affect behaviour or data. Check the relevant screens for UI changes.

Never commit `.env`, credentials, database dumps, real project exports or unreviewed research/participant data. The original paper PDF and developer handoff DOCX remain local inputs. Consult `docs/REPLICATION_PACKAGE.md` before adding research artefacts or preparing a public release.

Software/data licensing and the definitive citation author list remain to be agreed by the coauthors. Do not add names, ORCIDs, licences, publication status or a DOI by assumption.
