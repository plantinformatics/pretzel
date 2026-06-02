# Repository Agent Notes

GitNexus may be available as an optional code-intelligence tool.

If available, the GitNexus MCP server is configured as:
- MCP name: `my-mcp-server-3ec275b9`
- URL: `http://localhost:4747/api/mcp`

Use GitNexus only when it seems beneficial for the task at hand, such as understanding architecture, tracing call chains, exploring execution flows, or assessing the impact of source changes.

Do not use `npx` to access or update GitNexus. The software developer will run `gitnexus analyze` when the knowledge graph needs updating.

For GitNexus-specific guidance, see:

- `.agents/GitNexus.md`

That guide may reference `.claude/skills/gitnexus/gitnexus-*/SKILL.md`.
