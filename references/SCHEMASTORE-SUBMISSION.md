# SchemaStore Submission Kit (`skill.json`)

Use this checklist and payload for a SchemaStore PR that adds `skill.json` support.

## Submission status

- Submitted on: `2026-02-23`
- Tracking issue: `https://github.com/SchemaStore/schemastore/issues/5405`
- Current state: `OPEN` (awaiting maintainer action)

## Canonical schema URL

- `https://raw.githubusercontent.com/hashgraph-online/registry-broker-skills/main/schemas/skill.schema.json`

## Example file URL

- `https://raw.githubusercontent.com/hashgraph-online/registry-broker-skills/main/skill.json`

## PR checklist

- [ ] Schema validates the example `skill.json`.
- [ ] `$id` is public and stable.
- [ ] Schema uses draft 2020-12.
- [ ] New entry added in SchemaStore catalog with the canonical raw URL.
- [ ] Description includes Registry Broker skill manifest context.

## Suggested PR description

`Adds JSON Schema for Hashgraph Online skill manifests (skill.json) used by Registry Broker skill publishing workflows and AI coding assistant integrations.`

## Post-merge actions

- Link SchemaStore URL in:
  - `README.md`
  - `SKILL.md`
  - registry docs pages referencing skill manifests
