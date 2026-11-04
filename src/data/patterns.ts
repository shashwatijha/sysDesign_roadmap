import type { Pattern } from "./types";

export const PATTERNS: Pattern[] = [
  {
    id: "scaling-reads", node: "p-reads", title: "Scaling Reads",
    summary: "Reads vastly outnumber writes and must be fast.",
    signals: ["read-heavy", "100:1 read/write", "millions of views", "low-latency lookups", "popular items", "feed / timeline", "profile pages"],
    body: `
### Recognize it
The ratio of reads to writes is huge (10:1 to 1000:1), and reads must be fast. Typical in URL shorteners, social profiles, product pages, feeds.

### Toolbox, in the order you'd add them
1. **Indexes** that match the query. Free wins first.
2. **Read replicas**. Linear read scale; accept replication lag.
3. **Cache** (Redis, cache-aside). Sub-ms hits; handle invalidation and stampedes.
4. **CDN / edge cache** for content the same for many users.
5. **Denormalize / precompute** the read shape (materialized views, fan-out-on-write timelines).
6. **Shard** if the hot dataset can't fit on replicas.

### Deep-dive traps
- Hot keys (a viral post): replicate the key, local caches, request coalescing.
- Cache consistency after writes: delete-on-write, short TTL, read-your-writes via leader.
- Cold cache after deploy or failover: warmup, stale-while-revalidate.
`,
  },
  {
    id: "scaling-writes", node: "p-writes", title: "Scaling Writes",
    summary: "Ingest more writes than one node can take, often in bursts.",
    signals: ["millions of events per second", "click tracking", "metrics ingestion", "logs", "likes / views counters", "bursty traffic", "IoT telemetry"],
    body: `
### Recognize it
High write volume (10k-1M+/s), bursty spikes, or append-heavy data like events and metrics.

### Toolbox
1. **Shard by a well-distributed key** so writes spread across nodes.
2. **Write-optimized storage**: LSM-tree stores (Cassandra, ScyllaDB), time-series DBs, ClickHouse.
3. **Buffer with a queue/stream** (Kafka) so bursts don't hit the DB directly; consumers write at a steady rate.
4. **Batch** writes: group many small writes into one.
5. **Pre-aggregate**: count in memory/stream processor (Flink) and write totals every N seconds instead of every event.
6. **Hot-key splitting**: write \`counter#0..N\` shards and sum on read.

### Deep-dive traps
- Hot partitions (one celebrity, one popular ad). Salt the key.
- Losing data in buffers: durable logs, ack only after persisting.
- Exactly-once counts: idempotent consumers, dedup by event id, or reconcile from raw logs.
`,
  },
  {
    id: "contention", node: "p-contention", title: "Dealing with Contention",
    summary: "Many users compete for the same limited thing.",
    signals: ["limited inventory", "book a seat", "no double booking", "flash sale", "auction bids", "claim a username", "first come first served"],
    body: `
### Recognize it
Two requests must not both succeed: last seat, last item, highest bid, unique handle. Correctness beats availability.

### Toolbox (simplest first)
1. **Single-DB transaction with row lock** or **atomic conditional update** (\`UPDATE seats SET status='held' WHERE id=? AND status='free'\`). Handles more than people expect.
2. **Optimistic concurrency** (version check, retry). Good when conflicts are rare.
3. **Reservation with expiry**: hold for 10 minutes, then release. Separates "choosing" from "paying".
4. **Distributed lock** (Redis with TTL) when the resource spans services. Know its failure modes.
5. **Virtual waiting room / queue** for extreme spikes: admit users at a rate the system can handle.
6. **Partition the hot resource**: per-event or per-item serialization (single writer per key, e.g. Kafka partition by itemId).

### Deep-dive traps
- Lock held while user enters card details: use reservation, not a DB lock.
- Expired holds that never release: TTL in the row, cron/delay-queue cleanup.
- Retries causing double charge: idempotency keys.
`,
  },
  {
    id: "realtime", node: "p-realtime", title: "Real-time Updates",
    summary: "Push changes to clients within ~a second.",
    signals: ["live", "real-time", "chat", "notifications", "presence / online status", "collaborative editing", "live location", "typing indicators"],
    body: `
### Recognize it
Users must see changes without refreshing: messages, driver location, scores, document edits.

### Two halves
**1. Server → client delivery**
- Polling (simple, wasteful) → long polling → **SSE** (one-way) → **WebSockets** (two-way).
- Persistent connections live on **connection/gateway servers**; keep a registry \`userId → server\` (Redis).

**2. Getting the update to the right connection server**
- **Pub/sub** (Redis pub/sub, Kafka topic per shard): servers subscribe to channels for their connected users.
- Or route directly using the registry.

### Deep-dive traps
- A user with 3 devices: fan out to every connection.
- Offline users: persist and deliver on reconnect (inbox + last-seen cursor), push notification fallback.
- Reconnect storms after a deploy: jittered backoff.
- Ordering: per-conversation sequence numbers.
- Huge fan-out channels (a stream with 1M viewers): hierarchical fan-out, sampling, batching.
`,
  },
  {
    id: "long-running", node: "p-longrunning", title: "Long-running Tasks",
    summary: "Work that takes seconds to hours shouldn't block a request.",
    signals: ["video transcoding", "generate a report", "send to millions", "crawl", "scheduled jobs", "process upload", "retry until it succeeds"],
    body: `
### Recognize it
Work takes longer than a request should (> a few seconds), can fail midway, or must happen later/on a schedule.

### Toolbox
1. **Async job pattern**: API enqueues a job, returns \`202 + jobId\`; workers pull from a queue; client polls or gets notified.
2. **Worker pools** that autoscale on queue depth.
3. **Retries with backoff** + **dead-letter queue**.
4. **Checkpointing**: split work into chunks so a crash resumes instead of restarting.
5. **Scheduler**: store \`run_at\` in a DB indexed by time, or a delay queue; a poller moves due jobs to the work queue.
6. **Workflow engines** (Temporal, Step Functions) for multi-step processes with compensation.

### Deep-dive traps
- Duplicate execution after a worker dies: idempotent jobs, leases with heartbeats.
- Poison messages: DLQ after N attempts.
- Fairness: one tenant's 1M jobs starving others → per-tenant queues or weighted scheduling.
`,
  },
  {
    id: "large-files", node: "p-blobs", title: "Handling Large Files",
    summary: "Upload and serve big binaries without routing them through your servers.",
    signals: ["upload videos", "file sync", "photos", "attachments", "GB-sized files", "resume upload", "stream playback"],
    body: `
### Recognize it
Files of MBs to GBs: video, photos, documents, backups.

### Toolbox
1. **Object storage** for bytes, DB for metadata.
2. **Pre-signed URLs**: client uploads directly to S3.
3. **Chunked / multipart upload**: parallel, resumable; track chunk status in metadata.
4. **Content hashing** per chunk for dedup and delta sync (only upload changed chunks).
5. **CDN** for downloads; **range requests** for seeking.
6. **Post-upload pipeline** triggered by storage events (thumbnails, transcoding, virus scan).

### Deep-dive traps
- Marking an upload complete: rely on storage notification or client confirm + server verify, not trust alone.
- Partial uploads: lifecycle rules to delete orphaned parts.
- Adaptive streaming for video: segment files + manifests (HLS/DASH) at multiple bitrates.
`,
  },
  {
    id: "proximity", node: "p-geo", title: "Proximity Search",
    summary: "Find entities near a location, often while they move.",
    signals: ["nearby", "within 5 km", "closest driver", "map", "location updates every few seconds", "restaurants near me", "geofence"],
    body: `
### Recognize it
Queries like "N closest" or "everything within radius R", possibly with frequently changing positions.

### Toolbox
- **Geohash**: encodes lat/lng as a string; shared prefix ≈ nearby. Query the cell + 8 neighbors. Works with any key-value store or B-tree index. Redis \`GEOADD/GEOSEARCH\` uses it.
- **Quadtree**: recursively split dense areas. Good for uneven density, mostly static data.
- **PostGIS / R-tree**: rich queries, good for static places (Yelp-like).
- **H3 / S2 cells**: hexagonal/spherical cells, used for dispatch and pricing grids.

### Moving objects (drivers)
- Updates every ~5s × 1M drivers = 200k writes/s. Keep current positions **in memory** (Redis geo sets), sharded by region; write history to a stream for analytics.
- Don't index moving points in a B-tree DB.

### Deep-dive traps
- Cell boundaries: always include neighbor cells.
- Hot regions (stadium after a game): finer cells, region-level sharding.
`,
  },
];

export const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));
