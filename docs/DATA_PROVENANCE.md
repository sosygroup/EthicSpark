# Public catalogue dataset

The software ships `data/catalogue-public.xlsx`, derived on 15 October 2026 from the consolidated catalogue supplied by the authors. The original workbook remains a local research input and is excluded from Git and the Docker build context.

Original input SHA-256: `ab5ea1ed529383de14e5456a7a42304274b0cb4b6718bbb0a3c3c1914ec30422`.

Public workbook SHA-256: `3d97e021baf84d0580befccfdd49c696398c04ac75b0a380a35b176989cab757`.

## Transformation

1. Clear the contents of the General worksheet, including participant labels and interview observations. Retain the worksheet and put a distribution notice in A1.
2. Clear I28:I33 in C01 through C24, where individual expert observations were recorded. Keep the column headers and layout.
3. Export a new XLSX workbook. Do not overwrite the original research file.

All nonempty catalogue and bibliographic cell values outside the above locations were compared with the original and preserved, including source IDs, row positions, whitespace and reference links. The change removes one populated cluster-observation cell, C23!I28, in addition to the General contents. The public XLSX was checked for the removed participant labels in its serialized strings. Export changes file serialization and may change workbook metadata; byte identity is not claimed.

The catalogue still has 24 clusters, 144 actions and 184 references. The public workbook has its own source hash and therefore a different catalogue-version identifier. Existing local projects retain their original imported snapshots. A new checkout imports the public dataset.

The included dataset supports the software demonstration. It does not include participant interview data or establish that the tool itself has been empirically validated. Bibliographic authorship remains intact. Software and data licensing remain subject to agreement among the authors.
