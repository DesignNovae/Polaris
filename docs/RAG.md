# Retrieval (RAG)

How the Strategist finds evidence, how to change it, and how to tell whether a
change helped.

Everything here is non-generative. Gemma 4 remains the only model that writes
language in Polaris; the embedding model ranks evidence and never produces a
word of an answer.

---

## Pipeline

```
question
   │
   ├─ plan queries ─────── rewrite.ts    follow-ups resolved against chat history;
   │                                     a stopword-stripped variant for BM25
   │
   ├─ retrieve ─────────── search.ts     BM25 + dense vectors, fused with weighted RRF
   │    ├─ shared KB                     kb_chunks
   │    └─ this student                  user_chunks, always scoped by userId
   │
   ├─ second pass ──────── iterate.ts    only when the first pass scored below
   │                                     0.60 cosine - i.e. found nothing relevant
   │
   ├─ drop if irrelevant ─ iterate.ts    still nothing? send no passages rather
   │                                     than five plausible unrelated ones
   │
   ├─ rerank (optional) ── rerank.ts     RAG_RERANK=on
   │
   ├─ generate ─────────── strategist/research.ts
   │
   └─ verify ───────────── figures.ts    every figure in the answer must appear in
                                         what the model was given, or the student
                                         sees a caveat
```

### Why hybrid

BM25 handles queries that name a thing ("Chevening eligibility", "BUET
admission test"). Vectors handle queries that describe it instead ("how do I
study abroad if my family can't pay") — which is most of what a chat agent
gets. Reciprocal Rank Fusion merges the two rank lists without either needing
calibrated scores, so a missing vector index degrades to plain BM25 rather
than breaking.

The dense list carries `RAG_VECTOR_WEIGHT` (default 1.6) in fusion. That
number was measured, not guessed: unweighted RRF let weak keyword matches take
rank 1 on semantic queries, costing R@1 against vector-only.

---

## Storage

| Collection | Contents | Scope |
|---|---|---|
| `kb_chunks` | Shared knowledge base, one row per chunk | Global |
| `user_chunks` | One student's roadmap, milestones, memories, recent chat | Per user, always queried with `userId` first |
| `kb_documents` | Admin-authored long-form source material | Global |

Vector scoring is a brute-force cosine scan in Node, not an Atlas vector index.
At a few hundred chunks that is about a millisecond and it keeps the feature
independent of cluster tier. Swapping in `$vectorSearch` later touches only
`loadKbVectors` / `loadUserVectors` in `store.ts`.

Per-student rows are deleted with the account (`deleteAccount` in
`lib/db/collections.ts`).

---

## The corpus

The seed corpus is 114 short structured records — universities, admissions
enrichment, scholarships, case studies, living costs, practice questions,
prep resources. **None of them is long enough to split into more than one
chunk.**

That is a data limit, not an architecture limit, and it is not fixable by
inventing facts about real institutions. It is fixed by adding real source
material: **Admin → Knowledge** takes a pasted page, its source URL and a
verification date. Those documents are long, so they exercise the chunking
and overlap path the short records never reach — a 3.3k-character document
splits into 5 chunks, and retrieval matches the relevant chunk rather than
the whole document.

Every document requires a source URL. A claim a student cannot trace back to
an official page is worth less than no claim.

---

## Commands

```bash
npm run rag:test        # deterministic self-test - no API key, no DB, CI-safe
npm run rag:ingest      # embed changed chunks (add --force to rebuild all)
npm run rag:eval        # retrieval: recall@k and MRR per retriever
npm run rag:eval -- --rerank    # also score the LLM reranker (a model call per query)
npm run rag:faith       # generation: citation validity, figures, groundedness
npm run rag:calibrate   # grade the judge against known-labelled answers
```

Same reports are available to admins at `GET /api/admin/rag/eval`
(`?format=text`, `?rerank=1`, `?faithfulness=N`), and index status plus
re-embedding at `/api/admin/rag`.

---

## Measurements

Re-run these after any change to chunking, fusion, the embedder or the
prompt. They are the only reason to believe a change helped.

### Retrieval — 50 queries, 114 chunks

| retriever | R@1 | R@3 | R@5 | MRR |
|---|---|---|---|---|
| lexical (BM25 only) | 0.640 | 0.780 | 0.860 | 0.726 |
| vector only | 0.880 | 0.960 | 0.980 | 0.925 |
| **hybrid (default)** | 0.840 | 0.980 | 0.980 | 0.897 |
| reranked (`RAG_RERANK=on`) | 0.940 | 0.960 | 0.980 | 0.955 |

BM25's weakness is concentrated where you would expect: R@3 on semantic
queries is 0.59, against 0.95 for hybrid. That gap widens as the corpus grows.

### Generation — 8 sampled answers

| metric | value | how it is measured |
|---|---|---|
| citation precision | 0.957 | deterministic — every `kb://` uri must name a retrieved passage |
| malformed uris | 0 | deterministic — real id, broken syntax |
| unsupported figures | 0 | deterministic — every figure must appear in the context |
| groundedness | 0.903 | judged |
| answer relevance | 1.000 | judged |

**Read the judged rows with the sample size in mind.** Across three `--n 8`
runs, groundedness moved between 0.77 and 0.93 with no code change in
between. The deterministic rows are stable run to run; the judged ones are
noisy at this sample size, mostly because the judge is inconsistent about
whether strategy advice counts as a factual claim. Use `--n 20` or more
before concluding that a prompt change helped.

The residual 0.043 of citation imprecision is two instances of one mistyped
id — `case:cs-cs-budget-1` for `case:cs-budget-1`, the model duplicating a
prefix. Caught exactly as a fabrication should be.

### Judge calibration — 10 labelled answers

| metric | value |
|---|---|
| detection rate | 0.800 |
| false-alarm rate | 0.000 |
| accuracy | 0.900 |
| mean groundedness, faithful vs unfaithful | 1.000 vs 0.633 |

Read that as: when the judge says an answer is ungrounded, believe it — it has
never flagged a faithful answer. When it says an answer is clean, that is worth
about 80%.

Its one blind spot is numeric. The fixture it misses plants an invented
withdrawal limit and semester fee into an otherwise accurate answer, and it
scores 1.00 — a fabricated amount reads as fluently as a real one. That is
precisely what `figures.ts` catches, and why both layers exist.

---

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `RAG_EMBEDDINGS` | on | `off` falls back to BM25-only retrieval |
| `RAG_EMBED_MODEL` | `gemini-embedding-001` | changing it invalidates stored vectors |
| `RAG_EMBED_DIM` | 768 | as above — re-run `rag:ingest -- --force` |
| `RAG_VECTOR_WEIGHT` | 1.6 | dense weight in fusion; retune with `rag:eval` |
| `RAG_QUERY_REWRITE` | on | `off` skips follow-up resolution |
| `RAG_RERANK` | off | `on` adds a model call per turn and widens retrieval depth to 15 |
| `RAG_SECOND_PASS` | on | `off` disables the retry on weak retrieval |
| `RAG_SECOND_PASS_THRESHOLD` | 0.6 | cosine below which retrieval counts as having found nothing |
| `RAG_EVAL_RPM` | 12 | request budget for the batch harnesses only |

The reranker is off by default deliberately. It measurably improves ordering
(R@1 0.840 → 0.940, MRR 0.897 → 0.955) but not coverage — R@5 is unchanged at
0.980, and the Strategist hands the model all five passages either way, so
reranking only changes which one it reads first. One extra second on every
turn is a certain cost against an uncertain benefit.

That is a judgement call, not a verdict from the data. If answers turn out to
depend on passage order, the numbers already justify turning it on.

---

## Failure behaviour

Every stage degrades rather than breaking:

- No API key → BM25 only, no embeddings, no rewriting.
- Vector index empty or Mongo down → lexical results, failure negative-cached so
  an outage does not add a round trip per query.
- Rewriter, reranker or second-pass planner fails or times out → the previous
  stage's output passes through unchanged.
- Nothing relevant found → an empty `<kb>` block, so the prompt's refusal path
  is the obvious move, rather than five unrelated passages inviting improvisation.

Retrieval must never be the reason a student gets no answer.

---

## Known limits

- **Chunking is exercised only by admin documents.** No seed record is long
  enough to split. Covered by `rag:test`, which builds a document that does,
  and verified end to end: a 3.3k-character document produces 5 chunks and
  retrieval matches the relevant chunk rather than the whole document.
- **The reranker row was under-measured for two runs.** `rerank()` swallows
  its own errors — correct in production, where a failing reranker must never
  cost a student their answer, but it also hid the 429s from the pacer, so
  they were never retried and a quota outage read as "the reranker had no
  effect". It now reports `rateLimited`, the eval retries those, and coverage
  went 38/50 → 48/50. Worth remembering as a general hazard: a defensive
  fallback in a request path is a silent data-loss bug in a measurement path.
- **The corpus is small.** R@5 = 0.98 is a real measurement of a task that is
  not yet hard. Expect the numbers to fall as coverage grows — that is the
  metric working, not regressing.
- **Groundedness is a model's opinion**, with the error rate above attached.
  The citation and figure checks are deterministic; prefer them when the two
  disagree.
- **Brute-force cosine** is exact but linear. Past roughly 50k chunks, move to
  `$vectorSearch`.
- **Chat history in the per-student index is a rolling window** of the most
  recent 40 messages. Durable facts live in long-term memory, not here.
