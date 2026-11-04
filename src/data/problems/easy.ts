import type { Problem } from "../types";

export const EASY: Problem[] = [
  {
    id: "url-shortener", title: "URL Shortener", difficulty: "easy",
    patterns: ["scaling-reads"], concepts: ["caching-strategies", "indexing", "estimation"],
    prompt: "Design a service like bit.ly that turns long URLs into short links and redirects visitors.",
    hints: {
      requirements: ["Who creates links and who clicks them? Are those rates similar?", "Do links expire? Can users pick a custom alias?"],
      highLevel: ["How do you generate a short code that never collides?", "Which HTTP status code do you return for the redirect?"],
      deepDives: ["Redirects are ~100× creates. Where do reads get served from?", "What happens if two servers generate codes at the same time?"],
    },
    reference: {
      requirements: `
**Functional**
- Users can create a short URL from a long URL (optional custom alias, optional expiry).
- Anyone with a short URL is redirected to the original.

**Out of scope**: analytics dashboards, user accounts beyond basic auth, spam detection.

**Non-functional**
- Short codes are unique; no collisions ever.
- Redirect latency p99 < 100 ms.
- Read-heavy: ~100M DAU, ~1B redirects/day (≈12k/s, 30k/s peak) vs ~1M creates/day.
- High availability for redirects (eventual consistency for new links is fine, a link may take a second to resolve).
- Storage: ~1B links × ~500 B ≈ 500 GB over years.
`,
      entities: `
- **Url**: shortCode (PK), longUrl, createdAt, expiresAt?, ownerId?
- **User** (only for ownership/limits)
`,
      api: `
\`\`\`
POST /urls            { longUrl, alias?, expiresAt? } -> 201 { shortUrl }
GET  /{shortCode}     -> 302 Location: <longUrl>   (404 if unknown/expired)
\`\`\`
**302 vs 301**: 301 is cached by browsers forever (saves load, loses control and click counts). 302 keeps every hit flowing through you. Pick 302 unless offloading traffic matters more.
`,
      highLevel: `
\`\`\`
Client ─► LB ─► Write service ─► Counter (Redis INCR) ─► DB (Postgres)
Client ─► LB ─► Read service ─► Cache (Redis) ─► DB
\`\`\`
1. **Create**: write service gets the next id, encodes it in base62 (7 chars = 3.5 trillion codes), inserts \`(code, longUrl)\`. Custom alias: insert with a unique constraint, 409 on conflict.
2. **Redirect**: read service looks up code in cache; on miss reads DB (PK lookup), populates cache, returns 302. Expired → 404.
Read and write services are split so redirects scale independently.
`,
      deepDives: [
        {
          question: "How do you generate unique short codes?",
          answer: `
- **Hash the URL** (MD5 → first 7 chars): collisions possible, need check-and-retry; same URL gives same code (sometimes desired).
- **Random 7-char base62** + unique insert: collision odds tiny at first, grow with fill; retries needed.
- **Global counter → base62** ✅: no collisions by construction. Use Redis \`INCR\` (single-threaded, atomic). To avoid a round trip per create and survive Redis restarts, each write server **leases a block** of 1,000 ids (\`INCRBY 1000\`) and hands them out locally. Codes are guessable: add a bijective shuffle (e.g. multiply by a large prime mod 62^7) if that matters.
`,
        },
        {
          question: "How do redirects stay under 100 ms at 30k/s?",
          answer: `
- PK lookup on Postgres is ~1-5 ms but one node won't love 30k/s.
- **Redis cache-aside** in front: links are immutable, so invalidation is trivial (only on delete/expiry); LRU keeps the hot set. Hit rate is very high because traffic is skewed toward recent/popular links.
- **CDN/edge** caching of the 302 for very hot links.
- Read replicas behind the cache for misses.
`,
        },
        {
          question: "How do you scale storage and handle expiry?",
          answer: `
- 500 GB fits one primary + replicas. If it grows past a few TB, shard by \`shortCode\` hash: every query includes it, so no scatter-gather.
- Expiry: check \`expiresAt\` on read (correctness), plus a background job that deletes expired rows in batches (cleanup). Cache TTL ≤ time to expiry.
`,
        },
      ],
    },
  },

  {
    id: "rate-limiter", title: "Distributed Rate Limiter", difficulty: "easy",
    patterns: ["scaling-writes"], concepts: ["caching-strategies", "load-balancing"],
    prompt: "Design a rate limiter that an API gateway uses to cap requests per client across many servers.",
    hints: {
      requirements: ["Limit by what: user, IP, API key? Per endpoint?", "What should the client receive when limited?"],
      highLevel: ["Where does the check run, and where does the counter live?"],
      deepDives: ["Compare fixed window, sliding window, and token bucket.", "What if Redis is down?"],
    },
    reference: {
      requirements: `
**Functional**
- Limit requests per client identifier (user id, API key or IP) with per-rule limits (e.g. 100/min, burst 20).
- Rejected requests get \`429\` with \`Retry-After\` and \`X-RateLimit-*\` headers.
- Rules are configurable without deploys.

**Non-functional**
- Adds < 5 ms to request latency.
- 1M req/s across the fleet.
- Approximate accuracy is OK (a few % over the limit briefly is acceptable).
- Fail open if the limiter is unavailable: don't take the API down.
`,
      entities: `
- **Rule**: matcher (route, tier), limit, window, burst
- **Counter/bucket state**: key = \`rule:clientId\`, tokens, lastRefill
`,
      api: `
Internal call from the gateway (or a library inside it):
\`\`\`
check(clientId, route) -> { allowed, remaining, resetAt }
\`\`\`
Admin: \`PUT /rules/{id}\` to change limits.
`,
      highLevel: `
\`\`\`
Client ─► API Gateway (limiter middleware) ─► Services
                 │
                 └─► Redis cluster (bucket state, sharded by key)
Rules service ─► config pushed to gateways (cached in memory)
\`\`\`
Gateway identifies the client, finds matching rules (in-memory), runs an atomic check-and-decrement in Redis, then forwards or returns 429.
`,
      deepDives: [
        {
          question: "Which algorithm?",
          answer: `
- **Fixed window counter** (\`INCR key:minute\`): simplest, allows 2× burst at window edges.
- **Sliding window log** (sorted set of timestamps): exact, memory heavy at high limits.
- **Sliding window counter** (weighted current + previous window): good approximation, cheap.
- **Token bucket** ✅: tokens refill at rate r up to capacity b; each request takes one. Natively supports bursts. State = 2 numbers.
`,
        },
        {
          question: "How do you keep it atomic and fast across servers?",
          answer: `
- Read-modify-write from multiple gateways races. Use a **Redis Lua script** that refills, checks and decrements in one atomic step.
- Shard Redis by key (consistent hashing in cluster mode); 1M ops/s ≈ 10+ nodes.
- Keep connections pooled, same-AZ: ~1 ms round trip.
- Optional: **local pre-check** in each gateway for obviously abusive clients to save Redis calls.
`,
        },
        {
          question: "What happens when Redis fails or is slow?",
          answer: `
- **Fail open** with a short timeout (e.g. 10 ms) so the API stays up; log and alert.
- Fallback to a **local in-memory limiter** with limit ÷ number of gateways: approximate but protective.
- Replicas for Redis failover; lost counters only cause brief over-admission.
`,
        },
      ],
    },
  },

  {
    id: "leaderboard", title: "Real-time Game Leaderboard", difficulty: "easy",
    patterns: ["scaling-reads", "scaling-writes"], concepts: ["sql-vs-nosql", "sharding"],
    prompt: "Design a leaderboard for an online game with 50M players. Players see the top 100 and their own rank.",
    hints: {
      requirements: ["Global only, or also per region / per friends / per season?"],
      highLevel: ["Which data structure gives you rank in O(log n)?"],
      deepDives: ["Can one Redis node hold 50M members? What if not?"],
    },
    reference: {
      requirements: `
**Functional**
- Game servers submit score updates for a player.
- Players can view the top N (100) global leaderboard.
- Players can see their own rank and the players around them (±5).
- Leaderboards reset per season.

**Non-functional**
- Score updates visible on the board within ~1 s.
- Reads p99 < 100 ms.
- 50M players, ~10k score updates/s peak, ~50k reads/s.
- Durable: scores survive cache loss.
`,
      entities: `
- **Player**: id, name, region
- **Score**: playerId, seasonId, score, updatedAt
- **Leaderboard**: seasonId (+ region)
`,
      api: `
\`\`\`
POST /seasons/{s}/scores          { playerId, delta | score }    (game-server auth)
GET  /seasons/{s}/top?limit=100
GET  /seasons/{s}/players/{id}/rank?around=5
\`\`\`
`,
      highLevel: `
\`\`\`
Game servers ─► Score service ─► Postgres (scores, source of truth)
                     └────────► Redis sorted set  lb:{season}
Clients ─► Leaderboard service ─► Redis (ZREVRANGE / ZREVRANK)
\`\`\`
- Update: write DB, then \`ZADD lb:s1 score playerId\` (or \`ZINCRBY\`).
- Top 100: \`ZREVRANGE lb:s1 0 99 WITHSCORES\`.
- My rank: \`ZREVRANK\` then \`ZREVRANGE rank-5 rank+5\`.
Sorted sets are skip lists: O(log n) updates and rank queries.
`,
      deepDives: [
        {
          question: "Does it fit, and how does it scale?",
          answer: `
- 50M members × ~100 B ≈ 5 GB: fits one Redis node. 10k writes/s and 50k reads/s are fine for one primary + read replicas.
- If it didn't fit: **shard by score range** (each shard knows its count, so global rank = rank in shard + counts of higher shards) or keep an exact top-K set plus **approximate ranks** for the long tail (score histogram buckets). Hashing by playerId breaks rank queries.
`,
        },
        {
          question: "How do you keep Redis and the DB consistent?",
          answer: `
- DB is the source of truth. Write DB first, then Redis; a failed Redis write is retried from a **stream/outbox** consumer.
- On Redis loss, rebuild from DB (\`SELECT playerId, score\` → pipelined ZADD); minutes for 50M rows. Redis AOF persistence shortens this.
`,
        },
        {
          question: "Ties, seasons, and friend leaderboards?",
          answer: `
- **Ties**: encode \`score * 2^k + (MAX_TS - timestamp)\` so earlier achievers rank higher.
- **Seasons**: new key per season; old ones archived to DB and expired.
- **Friends**: small set, compute on read: fetch friends' scores with \`ZMSCORE\` and sort in app.
`,
        },
      ],
    },
  },
];
