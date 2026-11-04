import type { Problem } from "../types";

export const HARD: Problem[] = [
  {
    id: "ride-hailing", title: "Ride-hailing Dispatch", difficulty: "hard",
    patterns: ["proximity", "contention", "realtime", "scaling-writes"],
    concepts: ["transactions-locking", "event-streams", "sharding"],
    prompt: "Design an Uber-like system: riders request rides, the system matches them with nearby drivers, and both see live location.",
    hints: {
      requirements: ["How often do drivers send location? How many drivers are online?"],
      highLevel: ["Where do current driver positions live?"],
      deepDives: ["Two riders get matched to the same driver.", "A driver doesn't respond to a request."],
    },
    reference: {
      requirements: `
**Functional**
- Riders get a fare estimate and request a ride.
- System matches the rider to a nearby available driver; driver accepts/declines.
- Rider and driver see each other's live location during the trip.

**Non-functional**
- Match within ~10 s; location updates visible within ~2 s.
- A driver is never assigned two rides at once (strong consistency on assignment).
- 1M online drivers sending location every 4 s ≈ 250k writes/s.
- Spiky demand (events, rush hour) by region.
`,
      entities: `- **Rider**, **Driver** (status: offline|available|on_trip), **DriverLocation** (driverId, lat, lng, ts), **Ride** (id, riderId, driverId, status, pickup, dropoff, fare)`,
      api: `
\`\`\`
POST /fares/estimate           { pickup, dropoff } -> { fareId, price, eta }
POST /rides                    { fareId } -> { rideId }   (starts matching)
POST /drivers/location         { lat, lng }  (every ~4 s)
POST /rides/{id}/accept | /decline  (driver)
WS   /rides/{id}/stream        live location + status
\`\`\`
`,
      highLevel: `
\`\`\`
Driver app ─► Location svc ─► Redis GEO (per city shard)  + Kafka (history)
Rider app  ─► Ride svc ─► Rides DB (Postgres)
                    └─► Matching svc ─► GEOSEARCH nearby available ─► offer to driver (push/WS)
Both apps ◄═ WS gateway ◄═ pub/sub on ride channel
\`\`\`
Matching: find N closest available drivers, offer to the best one with a 10 s timeout, move to the next on decline/timeout.
`,
      deepDives: [
        {
          question: "How do you handle 250k location writes/s and nearby queries?",
          answer: `
- Postgres + PostGIS on moving points ❌: index churn kills it.
- **Redis GEO sets sharded by city/region** ✅ (in-memory geohash; \`GEOADD\` is cheap, \`GEOSEARCH\` by radius). TTL-ish via a separate last-seen key so stale drivers drop out.
- Raw updates also go to Kafka for trip replay, analytics, ETA models.
- Adaptive update rate: less frequent when stationary or no ride.
`,
        },
        {
          question: "How do you avoid assigning one driver to two riders?",
          answer: `
- Matching servers in parallel can pick the same driver.
- Take a **short lock per driver** before offering: \`SET driver:{id}:lock rideId NX PX 10000\`. Only the holder offers. Lock expires on timeout so the driver is offered elsewhere.
- On accept, a DB transaction sets ride.driverId and driver.status=on_trip conditional on status=available.
`,
        },
        {
          question: "How do you make matching reliable and handle surges?",
          answer: `
- Ride requests go into a durable queue partitioned by region; matching workers process them, so a crashed worker's requests are retried.
- Match timeouts via delay queue / workflow engine (Temporal): "if no accept in 10 s, try next driver".
- Surge: per-cell demand/supply counters (H3 cells) feed pricing; shard matching per region so a stadium spike doesn't hurt other cities.
`,
        },
      ],
    },
  },

  {
    id: "video-streaming", title: "Video Upload & Streaming", difficulty: "hard",
    patterns: ["large-files", "long-running", "scaling-reads"],
    concepts: ["blob-storage", "cdn", "message-queues"],
    prompt: "Design a YouTube-like platform: creators upload videos, viewers stream them on any device and network.",
    hints: {
      requirements: ["What resolutions and devices? How quickly after upload must a video be watchable?"],
      highLevel: ["What exactly gets stored after processing, and what does the player download?"],
      deepDives: ["A 2-hour 4K upload: how long does processing take, and how do you speed it up?"],
    },
    reference: {
      requirements: `
**Functional**
- Creators upload videos (up to ~256 GB).
- Viewers watch videos with adaptive quality.
- (Out of scope: comments, recommendations, search detail.)

**Non-functional**
- Smooth playback: low start time (< 2 s), minimal rebuffering, works on slow networks.
- Uploads resumable; processing done within minutes for normal videos.
- Massive read scale: ~1B views/day; reads ≫ uploads (~1M/day).
- Durable storage of originals.
`,
      entities: `- **Video** (id, creatorId, title, status: uploading|processing|ready, manifestUrl), **Rendition/Segment** (videoId, resolution, segment index, s3Key), **User**`,
      api: `
\`\`\`
POST /videos                 { title, size } -> { videoId, multipart upload URLs }
POST /videos/{id}/complete
GET  /videos/{id}            -> metadata + manifest URL (HLS/DASH)
\`\`\`
`,
      highLevel: `
\`\`\`
Creator ─multipart─► S3 (originals) ─event─► Processing orchestrator (DAG)
                                                ├─► split into chunks ─► transcode workers (N parallel) ─► S3 segments
                                                └─► thumbnails, captions ─► manifest ─► Video DB status=ready
Viewer ─► Video svc (metadata) ─► manifest ─► CDN ─► S3 segments
\`\`\`
Player reads the manifest (list of renditions and segment URLs) and fetches 2-6 s segments, switching bitrate based on measured bandwidth.
`,
      deepDives: [
        {
          question: "How do you process uploads fast and reliably?",
          answer: `
- Split the source into GOP-aligned chunks; transcode chunks **in parallel** for each rendition (240p..4K), then stitch manifests. A 2 h video becomes thousands of small, retryable tasks.
- Orchestrate as a **DAG** (Temporal/Step Functions): split → transcode × N → package → publish. Failed tasks retry; workflow state shows progress.
- Workers autoscale on queue depth; spot instances keep cost down since tasks are idempotent.
`,
        },
        {
          question: "How do you stream to millions of viewers?",
          answer: `
- **Adaptive bitrate (HLS/DASH)**: player picks segment quality per network conditions.
- Segments are immutable and cacheable: **CDN** absorbs almost all traffic; origin shield in front of S3.
- Popular videos pre-warmed to edges; long-tail served from regional caches/origin.
`,
        },
        {
          question: "How do you keep metadata and views scalable?",
          answer: `
- Video metadata: read-heavy, cache in Redis; DB sharded by videoId.
- View counts: write-heavy. Increment in a stream (Kafka) and aggregate in batches; display approximate counts.
- Resumable uploads via multipart; client keeps the upload id and completed parts.
`,
        },
      ],
    },
  },

  {
    id: "ad-click-aggregator", title: "Ad Click Aggregator", difficulty: "hard",
    patterns: ["scaling-writes", "long-running"],
    concepts: ["event-streams", "idempotency", "sql-vs-nosql"],
    prompt: "Design a system that records ad clicks, redirects the user to the advertiser, and lets advertisers query click metrics by minute.",
    hints: {
      requirements: ["How fresh must the metrics be? How accurate (billing!)?"],
      highLevel: ["Raw events vs pre-aggregated: what do queries read?"],
      deepDives: ["The same click gets sent twice.", "Your stream processor crashes."],
    },
    reference: {
      requirements: `
**Functional**
- User clicks an ad and is redirected to the advertiser's site.
- Advertisers query click counts per ad over time, at 1-minute granularity.

**Non-functional**
- 10k clicks/s average, 50k peak.
- Metrics fresh within ~1 min.
- Accurate for billing: no lost clicks, no double counting.
- Queries p99 < 1 s over months of data.
- Redirect fast (< 100 ms) and highly available.
`,
      entities: `- **Click event** (clickId, adId, userId/impressionId, ts), **Ad** (id, campaignId, targetUrl), **Aggregate** (adId, minute, count)`,
      api: `
\`\`\`
GET /click?adId=&imp=<signed impression id>   -> 302 to advertiser
GET /ads/{id}/metrics?from=&to=&granularity=1m
\`\`\`
`,
      highLevel: `
\`\`\`
Browser ─► Click svc ─► Kafka "clicks" (partition by adId) ─► 302 response
                           ├─► Flink (1-min tumbling windows, dedup) ─► OLAP store (ClickHouse/Druid)
                           └─► S3 raw archive ─► nightly batch reconciliation
Advertiser ─► Query svc ─► OLAP store
\`\`\`
`,
      deepDives: [
        {
          question: "How do you get fresh and accurate counts?",
          answer: `
- Querying raw events at read time ❌ at this scale.
- **Stream aggregation** (Flink) into per-minute counts ✅; with checkpointing + Kafka offsets, Flink gives exactly-once state.
- **Lambda-style reconciliation**: nightly batch job recounts from the S3 raw archive and corrects aggregates. Billing uses reconciled numbers.
`,
        },
        {
          question: "How do you prevent double counting and fraud?",
          answer: `
- Each impression gets a **signed, unique impression id**. Dedup on it in the stream (keyed state with TTL) so retries/double-clicks count once.
- Bots: rate limits per IP/user, signature verification, offline fraud models adjusting billing.
`,
        },
        {
          question: "How do you handle hot ads and fast queries?",
          answer: `
- A viral ad overloads one Kafka partition: salt the key (\`adId#0..N\`) for hot ads, merge in the aggregator.
- OLAP store is columnar, partitioned by time, sorted by adId; pre-roll-ups at hour/day for long ranges.
`,
        },
      ],
    },
  },

  {
    id: "collab-editor", title: "Collaborative Document Editor", difficulty: "hard",
    patterns: ["realtime", "contention"],
    concepts: ["networking-basics", "event-streams", "replication"],
    prompt: "Design a Google Docs-like editor where many people edit the same document at once and see each other's changes and cursors.",
    hints: {
      requirements: ["How many concurrent editors per doc? Offline edits?"],
      highLevel: ["Do you send whole documents or operations?"],
      deepDives: ["Two users type at the same position at the same time."],
    },
    reference: {
      requirements: `
**Functional**
- Users create and edit text documents.
- Many users edit concurrently and see changes in real time.
- Users see others' cursors/presence.
- Documents are saved durably with version history.

**Non-functional**
- Edits propagate < 100-200 ms.
- **Convergence**: all clients end with the same document.
- Up to ~100 concurrent editors per doc; millions of docs.
- No lost edits.
`,
      entities: `- **Document** (id, snapshot, version), **Operation** (docId, version, userId, op), **Presence** (docId, userId, cursor)`,
      api: `
\`\`\`
WS /docs/{id}
  → op { baseVersion, op }          ← ack { version }
  ← remoteOp { version, op }
  ↔ cursor { position }
GET /docs/{id} -> snapshot + version
\`\`\`
`,
      highLevel: `
\`\`\`
Clients ═WS═► Doc session server (one owner per doc, via consistent hashing on docId)
                 ├─ in-memory doc state + OT/CRDT engine
                 ├─► Op log (Cassandra/Postgres, append by version)
                 └─► periodic snapshots ─► S3/DB
Presence: in-memory on the session server (ephemeral, not persisted)
\`\`\`
`,
      deepDives: [
        {
          question: "How do concurrent edits converge?",
          answer: `
- Last-write-wins on whole doc ❌: loses edits.
- **Operational Transformation** ✅ (classic Docs approach): a single server per doc orders ops; incoming ops based on an older version are transformed against ops since then. Needs a central sequencer, which fits "one owner per doc".
- **CRDTs** (Yjs, Automerge): every char has a unique id, merges commute. No central ordering, great for offline/peer-to-peer; more metadata overhead.
`,
        },
        {
          question: "How do you route all editors of a doc to the same server?",
          answer: `
- Consistent hashing on docId at the WS gateway, or a lookup service (ZooKeeper/etcd) mapping doc → owner.
- On owner failure, another server loads snapshot + replays op log since snapshot, then clients reconnect and resend unacked ops.
`,
        },
        {
          question: "How do you store history efficiently?",
          answer: `
- Append-only op log is the durable truth; take a **snapshot every N ops** so loading doesn't replay everything.
- Old ops compacted into named versions for history.
- Cursors/presence are ephemeral: broadcast only, never persisted.
`,
        },
      ],
    },
  },
];
