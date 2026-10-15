# Public catalogue dataset

The software ships `data/catalogue-public.xlsx`, derived on 15 October 2026 from the consolidated catalogue supplied by the authors. The original workbook remains a local research input and is excluded from Git and the Docker build context.

Current author input SHA-256: `370895362d1dcca6cc3d13b6bc33959a50b97cc247e809da4ca3d7037347c220`.

Current public workbook SHA-256: `e51a3127bf1e667f5a9257b91cd5130adeaa0b2ea9915f677b685b22988a396f`.

## Transformation

1. Clear the contents of the General worksheet, including participant labels and interview observations. Retain the worksheet and put a distribution notice in A1.
2. Clear I28:I33 in C01 through C24, where individual expert observations were recorded. Keep the column headers and layout.
3. Export a new XLSX workbook. Do not overwrite the original research file.

All nonempty catalogue and bibliographic cell values outside the above locations were compared with the original and preserved, including source IDs, row positions, whitespace and reference links. The change removes one populated cluster-observation cell, C23!I28, in addition to the General contents. The public XLSX was checked for the removed participant labels in its serialized strings. Export changes file serialization and may change workbook metadata; byte identity is not claimed.

The catalogue still has 24 clusters, 144 actions and 184 references. The public workbook has its own source hash and therefore a different catalogue-version identifier. Existing local projects retain their original imported snapshots. A new checkout imports the public dataset.

The included dataset supports the software demonstration. It does not include participant interview data or establish that the tool itself has been empirically validated. Bibliographic authorship remains intact. Software and data licensing remain subject to agreement among the authors.


## Updated author input, 15 October 2026

The owner replaced the local consolidated workbook during the conversational-workspace increment. A cell-level comparison with the earlier author input identified 724 changed cells, including action prose and list-format changes. The public copy was regenerated from the updated file; every nonempty catalogue/reference cell outside the documented research-observation locations was compared with that updated input and preserved. Participant labels were checked to be absent from serialized public workbook strings.

Importer version **2** explicitly handles the updated comma-separated concern and role lists, while retaining semicolon groups where present. Phase aliases still produce Requirements and Operations. Validate remains the canonical action category; original navigation text is retained as source evidence. Spreadsheet-library decoding and catalogue text normalisation handle line breaks while original source bytes remain available in the snapshot.

The new import has 24 clusters, 144 actions, 184 references, zero blocking errors and **179 warnings**: 96 incomplete reference metadata, 58 possibly truncated references, 24 unmapped phases and one missing boundary note. Informational events record 144 role-list delimiter decisions, 142 phase-list delimiters and 101 phase aliases. See the regenerated [machine-readable report](validation/catalogue-import-report.json).

The previous public input was `3d97e021baf84d0580befccfdd49c696398c04ac75b0a380a35b176989cab757`, derived from original input `ab5ea1ed529383de14e5456a7a42304274b0cb4b6718bbb0a3c3c1914ec30422`. Earlier imported versions and plans remain unchanged; new conversational projects use the current imported version. Historical validation descriptions refer to their stated source hashes.
