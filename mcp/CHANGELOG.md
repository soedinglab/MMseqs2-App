# Changelog

`core` and `server` are released together under one version.

## 0.1.1

### Added

- `queries` in result summaries and export manifests for foldseek and multimer tickets: how many
  queries the ticket holds and, for up to 100 of them, each `queryIdx` with the chain it covers.
- `send_to` to FoldMason forwards only the selected query's chain when the source is a foldseek
  search whose upload held several chains, named `query_<chain>`. A multimer's chains are one query
  and still travel together.

### Changed

- Schemas: `result-summary@1` to `@2`, `result-artifact@2` to `@3`. Exports cached under the old
  schema are rebuilt on the next `export_result`.
- Residue reading, CA traces, chain listing and chain renaming go through molstar's structure model
  instead of hand-written PDB and mmCIF parsing. `renameChains` re-emits an mmCIF from its parsed
  categories, so rows and values survive but the original byte layout does not.
- `queryIdx` is checked against the ticket's actual query indices rather than assumed to run
  `0..count-1`.
- Running from source needs `npm ci --prefix frontend/lib` before the two mcp installs; the bundle
  carries molstar and is minified.
- The reported version comes from `package.json` instead of strings kept in the source.

### Fixed

- Insertion codes are read on the mmCIF path, so residues sharing a number no longer collapse into
  one.
- Chain renaming reaches `_entity_poly.pdbx_strand_id`, which the previous pattern did not match.

## 0.1.0

Initial release.
