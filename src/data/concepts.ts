import type { Concept } from "./types";

export const CONCEPTS: Concept[] = [
  // ---------------- framework ----------------
  {
    id: "delivery-framework", node: "framework", title: "The 5-step delivery framework",
    summary: "A fixed order for a 45-minute design interview, so you never stall or ramble.",
    body: `
Interviewers grade you on **progress** and **judgment**. A fixed structure means you spend your energy on the design, not on deciding what to do next.

| Step | Time | Output |
|---|---|---|
| Requirements | ~5 min | 3-5 functional, 3-5 non-functional |
| Core entities | ~2 min | list of nouns |
| API | ~5 min | one endpoint per functional requirement |
| High-level design | ~10-15 min | boxes and arrows that satisfy every functional req |
| Deep dives | ~10-15 min | changes that satisfy the non-functional reqs |

### Rules of thumb
- **Functional first, scale second.** A simple design that works beats a scalable one that doesn't.
- **Non-functional requirements drive the deep dives.** If you wrote "p99 < 200ms" you'll be asked how you hit it.
- **Quantify.** "Low latency" means nothing; "feed loads in < 300ms at p99" is a target.
- **Say the tradeoff out loud.** Every choice gives something up: name it.
- **Estimation only when it changes a decision.** Don't do 5 minutes of math to conclude "it's big".
- **Leave room for the interviewer.** Pause at the end of each step: "Anything you'd like me to focus on?"

### Senior vs mid signals
Mid-level: reaches a working design with prompting. Senior: drives the conversation, picks the right deep dives unprompted, and knows the operational edges (failure, hot keys, backfills). Staff: frames the problem's real constraint early and spends time where it matters.
`,
  },
  {
    id: "estimation", node: "framework", title: "Back-of-envelope estimation",
    summary: "The handful of numbers worth memorizing, and when math actually matters.",
    body: `
Do math only when the answer **changes the design** (one DB or sharded? fits in memory? needs a CDN?).

### Numbers to know
- 1 day ≈ 10^5 seconds (86,400). 1M req/day ≈ 12 req/s. 1B/day ≈ 12k/s.
- Peak ≈ 2-3× average for consumer traffic.
- Memory read ~100 ns · SSD read ~100 µs · same-DC round trip ~0.5 ms · cross-continent ~100 ms.
- One modern server: tens of thousands of simple req/s; one Postgres: a few thousand writes/s comfortably, ~10-20k with tuning; Redis: ~100k ops/s per node.
- A beefy machine has 256 GB-1 TB RAM; a DB node holds a few TB comfortably.
- Kafka partition: ~10 MB/s write.

### Quick method
1. Users → actions/day → QPS (divide by 10^5, multiply by peak factor).
2. Bytes per record × records/day × retention → storage.
3. Compare to the single-node numbers above. If you're within 10×, one node plus replicas is fine. If you're past it, partition.

### Example
500M URLs/year × 500 B = 250 GB/year: fits on one DB node for years. Reads at 100:1 → maybe 10k QPS: a cache handles it. Conclusion: no sharding needed for storage, cache for reads.
`,
  },

  // ---------------- networking ----------------
  {
    id: "networking-basics", node: "c-networking", title: "Protocols: HTTP, TCP, UDP, WebSockets",
    summary: "Which transport to pick and what each costs.",
    body: `
- **HTTP/1.1 & HTTP/2 over TCP**: default for request/response. HTTP/2 multiplexes many requests on one connection.
- **TCP**: reliable, ordered. Connection setup costs a round trip (plus TLS).
- **UDP**: no ordering or retransmit. Use for real-time media and gaming where a late packet is worthless.
- **WebSockets**: one long-lived, bidirectional TCP connection. Good for chat, live collaboration, games. Costs: stateful servers, you need sticky routing or a connection registry, and load balancers must support long connections.
- **Server-Sent Events (SSE)**: one-way server → client stream over HTTP. Simpler than WebSockets when the client only listens (live scores, notifications, LLM token streaming).
- **Long polling**: client holds a request open until data arrives. Works everywhere, wasteful at scale.
- **gRPC**: HTTP/2 + protobuf. Typed, fast, streaming. Great service-to-service; awkward for browsers.

**Interview heuristic**: REST over HTTP for client APIs, gRPC internally if latency matters, WebSocket/SSE only when a requirement says "real-time".
`,
  },
  {
    id: "load-balancing", node: "c-networking", title: "Load balancers & API gateways",
    summary: "Spreading traffic and where cross-cutting concerns live.",
    body: `
### Load balancer
- **L4** (TCP): fast, doesn't look at the request. Good for WebSockets and raw throughput.
- **L7** (HTTP): routes by path/header/cookie, terminates TLS. Most web traffic.
- Algorithms: round robin, least connections, consistent hash (for stickiness/cache affinity).
- Health checks remove dead nodes. LBs themselves are replicated (active-passive or DNS across several).

### API gateway
One entry point that handles **auth, rate limiting, routing to services, request validation, and logging**. In interviews draw it once and move on; it's rarely the interesting part.

### Stateless services
Keep app servers stateless (session in a token or a cache) so any node can serve any request and you scale by adding nodes. State lives in databases, caches and queues.
`,
  },
  {
    id: "api-design", node: "c-networking", title: "API design: REST, pagination, idempotency keys",
    summary: "Writing the API step fast and correctly.",
    body: `
- **Resources as nouns**: \`POST /tweets\`, \`GET /tweets/{id}\`, \`GET /users/{id}/followers\`.
- **User identity comes from the auth header**, never from the body. \`POST /tweets {userId}\` is a red flag.
- **Pagination**: prefer **cursor** (\`?cursor=<opaque>&limit=20\`) over offset. Offset gets slow and skips or duplicates items when the list changes.
- **Idempotency keys** on unsafe operations that clients retry (payments, bookings): \`Idempotency-Key: <uuid>\` header, server stores the result.
- **Async operations** return \`202 Accepted\` + a job id the client polls or is notified about.
- **GraphQL**: when many client types need different shapes of the same data. Mention it only if over/under-fetching is a real issue.
- **Versioning**: \`/v1/\` prefix. Don't spend interview time here.
`,
  },

  // ---------------- storage ----------------
  {
    id: "sql-vs-nosql", node: "c-storage", title: "Choosing a database",
    summary: "Relational by default; switch when access patterns demand it.",
    body: `
**Start with Postgres** unless you have a reason not to. Interviewers mostly want to hear the reason.

| Need | Reach for |
|---|---|
| Relations, transactions, ad-hoc queries | Postgres / MySQL |
| Huge write volume, simple key access, horizontal scale | DynamoDB, Cassandra |
| Flexible documents | MongoDB, DynamoDB |
| Sub-ms key-value, counters, leaderboards | Redis |
| Full-text / fuzzy search | Elasticsearch / OpenSearch |
| Time series / metrics | TimescaleDB, InfluxDB, ClickHouse |
| Analytics over billions of rows | ClickHouse, BigQuery, Druid |
| Graph traversal | Rarely needed; usually Postgres is fine |

### Wide-column (Cassandra/Dynamo) mental model
Partition key decides **which node**; sort/clustering key decides **order within the partition**. Design tables around queries: one table per access pattern is normal. No joins.

### Common mistake
Picking NoSQL "for scale" when the data fits on one Postgres with read replicas. Say what breaks first and when.
`,
  },
  {
    id: "indexing", node: "c-storage", title: "Indexes",
    summary: "How lookups stay fast and what indexes cost.",
    body: `
- **B-tree** (default): equality and range queries, ordered scans. Cost: slower writes, extra storage.
- **Hash**: equality only.
- **Composite index** \`(user_id, created_at)\`: serves "user's items newest first". Column order matters: leftmost prefix rule.
- **Covering index**: includes all columns a query needs so the table isn't touched.
- **LSM trees** (Cassandra, RocksDB): write-optimized; writes go to memory then sorted files, reads may check several files (bloom filters help).
- **Inverted index**: word → doc ids. Full-text search.
- **Geospatial**: geohash, quadtree, R-tree (PostGIS). See Proximity Search.

**In interviews**: when you write a query in the high-level design, name the index that serves it.
`,
  },
  {
    id: "blob-storage", node: "c-storage", title: "Blob / object storage",
    summary: "S3-style storage for files, images, video.",
    body: `
- Store large binaries in **object storage** (S3, GCS), and only **metadata + the object key** in your DB.
- Cheap, durable (11 nines), effectively infinite. Not for small random updates.
- **Pre-signed URLs**: server authorizes and hands the client a time-limited URL to upload/download directly, so bytes never pass through your app servers.
- **Multipart upload**: split big files into parts, upload in parallel, resume failed parts.
- Serve reads through a **CDN** in front of the bucket.
- Event notifications (object created) can trigger processing pipelines.
`,
  },

  // ---------------- async ----------------
  {
    id: "message-queues", node: "c-async", title: "Message queues",
    summary: "Decouple producers from consumers; absorb bursts.",
    body: `
A queue (SQS, RabbitMQ) holds work until a worker takes it.

**Use when**: work is slow, bursty, or can fail and be retried; producers shouldn't wait.

Key properties:
- **At-least-once delivery** is the norm, so consumers must be **idempotent**.
- **Visibility timeout / ack**: a message reappears if the worker dies before acking.
- **Dead-letter queue** for messages that keep failing.
- **Back-pressure**: queue depth is your autoscaling signal.
- Ordering is usually not guaranteed (FIFO queues exist, with lower throughput).

Don't add a queue when the caller needs the result right now and the work is fast.
`,
  },
  {
    id: "event-streams", node: "c-async", title: "Event streams (Kafka)",
    summary: "Durable, ordered, replayable logs.",
    body: `
Kafka/Kinesis store events in **partitioned, append-only logs**. Consumers track their own offset.

- **Ordering is per partition**. Choose the partition key so related events land together (e.g. \`rideId\`).
- **Consumer groups**: each partition is read by one consumer in a group, so parallelism ≤ partition count.
- **Retention**: events stay for days, so you can **replay** to rebuild a view or fix a bug.
- **Fan-out**: many independent consumer groups read the same stream.
- Throughput: hundreds of MB/s per cluster easily.

**Queue vs stream**: queue = tasks to do and delete; stream = facts that happened, read by many, replayable.
`,
  },

  // ---------------- caching ----------------
  {
    id: "caching-strategies", node: "c-caching", title: "Caching strategies",
    summary: "Cache-aside, write-through, TTLs, invalidation, stampedes.",
    body: `
### Where
Client → CDN → API gateway → **app-level cache (Redis/Memcached)** → DB buffer cache.

### Patterns
- **Cache-aside** (default): read cache; on miss read DB and populate. Simple, stale until TTL or explicit delete.
- **Write-through**: write cache and DB together. Fresher, slower writes.
- **Write-behind**: write cache, flush to DB async. Fast, risk of loss.

### Problems you'll be asked about
- **Invalidation**: delete-on-write + TTL as a safety net. Deleting beats updating (avoids races).
- **Stampede / thundering herd**: a hot key expires and 10k requests hit the DB. Fix: request coalescing (single-flight), lock-and-recompute, stale-while-revalidate, jittered TTLs.
- **Hot keys**: one key gets most traffic. Fix: replicate the key across nodes (\`key#1..N\`), local in-process cache.
- **Eviction**: LRU is the usual default.

Cache what is **read often, changes rarely, and tolerates slight staleness**.
`,
  },
  {
    id: "cdn", node: "c-caching", title: "CDNs",
    summary: "Serve static and cacheable content from the edge.",
    body: `
- Edge servers near users cache static assets, images, video segments, and even API responses with short TTLs.
- Cuts latency (100ms → 10ms) and origin load.
- **Invalidation** is slow-ish (seconds to minutes); use versioned URLs (\`app.3f2a.js\`) instead of purging.
- Origin shield: a mid-tier cache that protects the origin from many edges missing at once.
- Signed URLs/cookies for private content.
`,
  },

  // ---------------- scaling ----------------
  {
    id: "sharding", node: "c-scaling", title: "Sharding / partitioning",
    summary: "Splitting data across nodes and picking the key.",
    body: `
Shard when **one node can't hold the data or absorb the writes**, not before.

### Picking a shard key
- High cardinality, even distribution, and **most queries include it**.
- \`userId\` for user-scoped data is common. \`createdAt\` is a trap: all writes hit the newest shard.

### Strategies
- **Hash**: even spread; range queries become scatter-gather.
- **Range**: efficient ranges; hotspots.
- **Directory/lookup**: flexible; the lookup service is a dependency.

### Costs
Cross-shard queries (scatter-gather), cross-shard transactions (avoid them), rebalancing, hot partitions (a celebrity user). Mitigate hot partitions by key salting or special-casing heavy hitters.
`,
  },
  {
    id: "consistent-hashing", node: "c-scaling", title: "Consistent hashing",
    summary: "Adding or removing nodes without reshuffling everything.",
    body: `
\`hash(key) % N\` remaps almost every key when N changes. **Consistent hashing** places nodes and keys on a ring; a key belongs to the next node clockwise. Adding a node moves only ~1/N of keys.

- **Virtual nodes**: each physical node owns many ring points, which smooths load and lets bigger machines take more.
- Used by Dynamo, Cassandra, many cache clusters, and load balancers for affinity.
- Replication: store a key on the next R nodes on the ring.
`,
  },
  {
    id: "replication", node: "c-scaling", title: "Replication",
    summary: "Copies for read scale and availability.",
    body: `
- **Leader-follower**: writes to the leader, reads from followers. Followers lag, so reads may be stale (**read-your-writes** issue: route a user's reads to the leader briefly after they write).
- **Synchronous vs async**: sync = no data loss on failover, slower writes. Async = fast, may lose last writes.
- **Multi-leader**: writes in several regions; needs conflict resolution. Rarely worth it in an interview unless multi-region writes are a requirement.
- **Leaderless / quorum** (Dynamo-style): write to W of N, read from R of N; R + W > N gives overlap.
- **Failover**: detect leader death, promote a follower. Risks: split brain, lost async writes.
`,
  },

  // ---------------- consistency ----------------
  {
    id: "cap-theorem", node: "c-consistency", title: "CAP & consistency levels",
    summary: "Decide per feature: strong or eventual?",
    body: `
During a network partition you choose **consistency** (refuse some requests) or **availability** (serve possibly stale data). Partitions happen, so the real question is which one each feature needs.

- **Strong consistency needed**: money, inventory, seat booking, unique usernames. Double-spend is worse than an error.
- **Eventual is fine**: likes counts, feeds, profiles, search indexes, analytics.

Put it in non-functional requirements explicitly: *"Booking must be strongly consistent; event browsing can be eventually consistent."* Different parts of one system can choose differently.

**Levels** (weak → strong): eventual · read-your-writes · monotonic reads · causal · linearizable.
`,
  },
  {
    id: "transactions-locking", node: "c-consistency", title: "Transactions & locking",
    summary: "Preventing lost updates and double booking.",
    body: `
- **ACID transaction** in one DB: the simplest correct answer when the data lives in one place.
- **Pessimistic lock**: \`SELECT ... FOR UPDATE\`. Correct, but holds locks; bad for long user think-time.
- **Optimistic concurrency**: version column; \`UPDATE ... WHERE version = 7\`; retry on conflict. Great when conflicts are rare.
- **Conditional writes** in NoSQL (DynamoDB condition expressions) do the same.
- **Distributed lock** (Redis with TTL, ZooKeeper/etcd): coordinates across services. Always set a TTL; use fencing tokens if correctness depends on it.
- **Reservation with TTL**: hold an item for N minutes (status = reserved, expires_at), release automatically. Ticketing and checkout.
- **Cross-service**: avoid 2PC; use a **saga** (sequence of local transactions with compensating actions).
`,
  },
  {
    id: "idempotency", node: "c-consistency", title: "Idempotency & exactly-once",
    summary: "Making retries safe.",
    body: `
Networks fail, clients retry, queues redeliver. "Exactly once" in practice = **at-least-once delivery + idempotent processing**.

- **Idempotency key** from the client; server stores \`key → result\` and returns the stored result on repeat.
- **Natural keys / upserts**: \`INSERT ... ON CONFLICT DO NOTHING\` on \`(eventId)\`.
- **Dedup table** with TTL for stream consumers.
- **Transactional outbox**: write the business row and an outbox row in one DB transaction; a relay publishes the outbox to Kafka. Avoids the "DB committed but event lost" gap.
`,
  },
];

export const CONCEPT_BY_ID = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));
