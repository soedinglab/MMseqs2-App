# Changelog

## 0.2.0

Renamed throughout. The server, its two packages, its environment variables and its persiste contracts are now `marv`; what the server does is unchanged.

### Changed

- **Breaking.** Packages: `foldseek-server-lib` is now `marv-core`, and `foldseek-server-mcp` is now `marv-mcp` with its entry point at `bin/marv-mcp.js` instead of `bin/foldseek-server-mcp.js`.
- **Breaking.** Every `FOLDSEEK_SERVER_*` environment variable is now `MARV_*` — `MARV_BASE_URL`, `MARV_STATE_DIR`, `MARV_SHARED_DIR` and the rest. The old names are not read and not aliased.
- **Breaking.** Default paths: the state directory is `~/.marv`, not `~/.foldseek-server`, and the shared folder is `marv-shared` under the user's home, not `foldseek-server-shared`. Results, selections and exports cached under the old paths are neither read nor migrated.
- **Breaking.** Persisted contracts move to the `marv-api` namespace, after the server that emits them: `result-summary@2` is `marv-api/result-summary@2` and `result-artifact@3` is `marv-api/result-artifact@3`. The version numbers are unchanged, but the schema string is part of the artifact cache key, so every artifact id changes; artifacts exported under the old namespace no longer validate and are rebuilt on the next `export_result`.
- The server identifies itself to MCP clients as `Marv API`, which is also the Desktop bundle's display name; its extension id and artifact prefix are `marv-api`. Diagnostics on stderr are prefixed `marv-api:`.
- Release artifacts are `marv-api-v<version>.mcpb` and `marv-api-runtime-v<version>.zip`.
- "Foldseek Server" now refers only to the upstream deployment this server searches, and is written "Foldseek Search Server" wherever both could be meant.

## 0.1.1

### Added

- `queries` in result summaries and export manifests for foldseek and multimer tickets: how many
  queries the ticket holds and, for up to 100 of them, each `queryIdx` with the chain it covers.
- `send_to` to FoldMason forwards only the selected query's chain when the source is a foldseek
  search whose upload held several chains, named `query_<chain>`. A multimer's chains are one query
  and still travel together.

### Changed

- Schemas: `result-summary@1` to `@2`, `result-artifact@2` to `@3`. Exports cached under the old schema are rebuilt on the next `export_result`.
- Residue reading, CA traces, chain listing and chain renaming go through molstar's structure model instead of hand-written PDB and mmCIF parsing. `renameChains` re-emits an mmCIF from its parsed categories, so rows and values survive but the original byte layout does not.
- `queryIdx` is checked against the ticket's actual query indices rather than assumed to run `0..count-1`.
- Running from source needs `npm ci --prefix frontend/lib` before the two mcp installs; the bundle carries molstar and is minified.
- The reported version comes from `package.json` instead of strings kept in the source.

### Fixed

- Insertion codes are read on the mmCIF path, so residues sharing a number no longer collapse into one.
- Chain renaming reaches `_entity_poly.pdbx_strand_id`, which the previous pattern did not match.

## 0.1.0

Initial release.
