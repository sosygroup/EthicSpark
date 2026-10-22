# Offline demonstration and optional live prompt

To explore the complete authored conversation, choose **New project (+) → Load demo project**. Six stages cover Requirements, Design, Implementation, Testing, Deployment and Operations. No API key or Ollama is needed. The demo contains Mermaid diagrams, an illustrative SVG chart and downloadable notes. None of its content is a live model response, expert evaluation, executed test result or release approval.

Load demo project reopens the existing demo, restoring it from Trash if needed. It preserves subsequent conversations rather than replacing them. The source is [`support-portal.json`](../catalogue-service/src/main/resources/demo/support-portal.json).

## Fictional support portal

This small example contains no real customer or project data. It is a prompt to try, not a saved model response or a validated system design.

## Explore without a model

Start the local application and choose **Explore catalogue**. Search for privacy or security and inspect a cluster's source actions, evidence and linked references. No model connection is required.

## Try a conversation

On the welcome screen choose **Try a fictional example**, or paste this prompt:

> Review a fictional customer-support portal that stores customer email addresses and ticket text. Suggest a small architecture, three useful tests, and relevant ethical considerations from the catalogue. Keep the answer concise. Do not request real customer data or propose file edits or commands.

In **Model settings**, choose Ollama, click **Load available models** and select any suitable installed model. Authorise processing for this example project, review the prompt, then send it. Cloud providers are also supported with separately configured API credentials. Model responses vary and require review.

## Fresh installations

Git contains application code, the public catalogue and this example. It does not contain the author's local database, conversations, uploaded documents, linked folders, credentials or Ollama models. A new database starts with only the original offline demo (six stages and 12 messages). Reset workspace restores a fresh copy of this demo and removes user additions. Normal updates preserve existing projects. The example button fills the message box without sending a request or creating a project. Updating an existing installation preserves its local Docker database.
