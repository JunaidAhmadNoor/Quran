# @tilawah/quran-data

The Quran text and surah metadata. Filled in **Phase 2**.

- `source/quran-uthmani.txt` is the Tanzil Uthmani file committed **byte-for-byte** as
  downloaded from tanzil.net, including its license header. It is never edited.
- `source/quran-data.xml` is Tanzil's metadata (surah names, ayah counts, juz boundaries).
- `checksums.json` stores the SHA-256 of both files. A test fails if either changes.
- A build script derives `generated/surah-NNN.json` (ayahs split into words). A test proves the
  derivation is lossless: joining the words back reproduces every source line exactly.

Attribution (required by the Tanzil license) is shown in the site footer and returned in the
`source` field of `GET /api/v1/surahs/{n}/text`.
