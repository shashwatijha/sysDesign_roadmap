import type { Problem } from "../types";

export const MEDIUM: Problem[] = [
  {
    id: "news-feed", title: "Social News Feed", difficulty: "medium",
    patterns: ["scaling-reads", "scaling-writes"], concepts: ["caching-strategies", "event-streams", "sharding"],
    prompt: "Design the home feed for a social network: users follow others and see a reverse-chronological feed of their posts.",
    hints: {
      requirements: ["Is following one-way or mutual? Is there a cap?", "How fresh must the feed be?"],
      highLevel: ["Build the feed when it's read, or when a post is written?"],
      deepDives: ["What happens when an account with 50M followers posts?"],
    },
    reference: {
      requirements: `
**Functional**
- Users can create posts.
- Users can follow/unfollow others (one-way, no cap on followers).
- Users can view a feed of posts from people they follow, newest first, paginated.

**Non-functional**
- Feed loads p99 < 500 ms.
- New posts appear in followers' feeds within ~1 min (eventual consistency OK).
- 500M DAU, ~100M posts/day, avg 200 follows, some accounts with 100M followers.
- Highly available.
`,
      entities: `- **User**, **Post** (id, authorId, content, createdAt), **Follow** (followerId, followeeId), **FeedEntry** (userId, postId, createdAt)`,
      api: `
\`\`\`
POST /posts                       { content }       -> { postId }
PUT  /users/{id}/follow  /  DELETE /users/{id}/follow
GET  /feed?cursor=&limit=20       -> { posts[], nextCursor }
\`\`\`
`,
      highLevel: `
\`\`\`
Post svc ─► Posts DB (sharded by postId) ─► Kafka "post-created"
                                               └─► Fan-out workers ─► Feed cache (Redis list per user)
Follow svc ─► Follows table (two indexes: by follower, by followee)
Feed svc ─► Feed cache ─► hydrate posts (post cache) ─► client
\`\`\`
**Simple version first**: on read, get followees, query their recent posts, merge. Works for small scale; too slow at 200 followees × large fan-in.
**Then fan-out-on-write**: when a post is created, workers push \`postId\` to each follower's precomputed feed (capped at ~800 entries). Reading = one list read + hydration.
`,
      deepDives: [
        {
          question: "How do you handle celebrities with 100M followers?",
          answer: `
Fan-out-on-write means 100M list writes per post: slow and wasteful.
**Hybrid** ✅: fan out on write for normal users; for accounts above a threshold (e.g. 100k followers) **don't fan out**. On read, merge the precomputed feed with recent posts pulled from the few celebrities the user follows (cached per celebrity). Read cost stays bounded because a user follows few celebrities.
`,
        },
        {
          question: "How do you make reads fast and paginate correctly?",
          answer: `
- Feed list stores only ids; hydrate from a **post cache** (multi-get). Author info from a user cache.
- **Cursor = (createdAt, postId)** of the last item; stable as new posts arrive at the top.
- Inactive users: don't maintain their feed; rebuild on next login (fan-out-on-read fallback). Saves most of the write work.
`,
        },
        {
          question: "How do the follow table and fan-out workers scale?",
          answer: `
- Follows in a wide-column store with two tables: \`followers_by_user\` (partition: followeeId) and \`following_by_user\` (partition: followerId).
- Fan-out workers consume Kafka partitioned by authorId; batch writes to Redis via pipelining. Lag is the freshness SLO: autoscale on consumer lag.
- Unfollow: filter on read (cheap) and lazily clean.
`,
        },
      ],
    },
  },

  {
    id: "chat-app", title: "1:1 and Group Chat", difficulty: "medium",
    patterns: ["realtime"], concepts: ["networking-basics", "sql-vs-nosql", "message-queues"],
    prompt: "Design a messaging app supporting 1:1 and small group chats (up to 100 members) with online delivery and offline sync.",
    hints: {
      requirements: ["Delivery receipts? Multiple devices per user?", "How long are messages kept?"],
      highLevel: ["How does a message sent to server A reach a recipient connected to server B?"],
      deepDives: ["Recipient is offline. What happens?", "How do you order messages?"],
    },
    reference: {
      requirements: `
**Functional**
- Users can start 1:1 and group chats (≤ 100 members).
- Users can send/receive text messages in real time.
- Users receive messages sent while offline when they reconnect.
- (Nice to have) delivery/read receipts, media attachments.

**Non-functional**
- Delivery latency < 500 ms for online users.
- Guaranteed delivery: no lost messages; per-chat ordering.
- 200M DAU, ~50 messages/user/day ≈ 100k msg/s peak.
- Multiple devices per user.
`,
      entities: `- **User**, **Chat** (id, type, members), **Message** (chatId, seq, senderId, body, ts), **Inbox/DeviceCursor** (userId/deviceId → last delivered seq per chat)`,
      api: `
WebSocket (persistent), events:
\`\`\`
→ sendMessage { chatId, clientMsgId, body }     ← ack { clientMsgId, seq }
← newMessage  { chatId, seq, senderId, body }
→ ackDelivered { chatId, seq }
REST: POST /chats, GET /chats/{id}/messages?afterSeq=  (sync on reconnect)
\`\`\`
`,
      highLevel: `
\`\`\`
Client ═WS═► Chat server (stateful)  ─► Message svc ─► Messages DB (Cassandra, partition chatId, cluster seq)
                 ▲                          │
                 │                          └─► Pub/Sub (Redis) channel per user / or route via registry
Connection registry (Redis): userId → [chatServerIds]
\`\`\`
Send: chat server → message svc assigns per-chat seq, persists, acks sender, then for each member looks up their connected servers and publishes; those servers push over the socket.
`,
      deepDives: [
        {
          question: "How do you guarantee delivery to offline users and multiple devices?",
          answer: `
- Messages are **persisted before ack**: the DB is the source of truth.
- Each device keeps **lastSeq per chat**; on reconnect it calls \`GET /messages?afterSeq\` for each chat with new activity (a per-user "chats updated" list makes this cheap).
- Offline users also get a **push notification** via APNs/FCM.
- Client dedups by \`(chatId, seq)\`; sender retries with the same \`clientMsgId\` (idempotent).
`,
        },
        {
          question: "How do you order messages?",
          answer: `
- Wall clocks across servers drift. Assign a **monotonic seq per chat** at the message service (e.g. Redis \`INCR chat:{id}:seq\`, or single-writer per chat partition).
- Clients order by seq; gaps trigger a fetch.
`,
        },
        {
          question: "How do you scale WebSocket servers?",
          answer: `
- ~1M connections per tuned server is optimistic; plan ~100-200k. 200M DAU, maybe 50M concurrent → hundreds of servers.
- L4 load balancer; on connect, register in the registry with TTL heartbeat.
- **Routing**: Redis pub/sub channel per user (server subscribes for its connected users) or direct gRPC to the server found in the registry.
- Deploys drop connections: drain gradually, clients reconnect with jittered backoff and resync via afterSeq.
`,
        },
      ],
    },
  },

  {
    id: "ticket-booking", title: "Event Ticket Booking", difficulty: "medium",
    patterns: ["contention", "scaling-reads"], concepts: ["transactions-locking", "idempotency", "caching-strategies"],
    prompt: "Design a ticketing platform where users browse events, pick seats, and buy tickets. Popular concerts sell out in minutes.",
    hints: {
      requirements: ["Which parts need strong consistency and which don't?"],
      highLevel: ["Payment takes a minute. What state is the seat in meanwhile?"],
      deepDives: ["10M people show up for 50k seats at 10:00:00. What breaks?"],
    },
    reference: {
      requirements: `
**Functional**
- Users can browse/search events.
- Users can view an event's seat map with availability.
- Users can reserve seats and complete purchase.

**Non-functional**
- **No double booking** (strong consistency for seat state).
- Browsing is read-heavy (100:1) and can be eventually consistent.
- Handle flash-sale spikes: 10M users for one event.
- Search p99 < 500 ms.
`,
      entities: `- **Event**, **Venue**, **Seat/Ticket** (eventId, seatId, status: available|reserved|sold, reservedBy, expiresAt), **Booking** (id, userId, tickets, status, paymentId)`,
      api: `
\`\`\`
GET  /events/search?q=&date=&city=
GET  /events/{id}                    -> details + seat map
POST /bookings   { eventId, seatIds } -> { bookingId, expiresAt }   (reserve)
POST /bookings/{id}/confirm  { paymentToken }  (Idempotency-Key header)
\`\`\`
`,
      highLevel: `
\`\`\`
Client ─► CDN (event pages) ─► Gateway ─► Event svc ─► Postgres ◄─ CDC ─► Elasticsearch (search)
                                    └─► Booking svc ─► Postgres (tickets, bookings)
                                                  └─► Payment provider (webhook back)
\`\`\`
Reserve: in one transaction, \`UPDATE tickets SET status='reserved', reserved_by=?, expires_at=now()+10m WHERE id IN (...) AND (status='available' OR expires_at < now())\`; succeed only if all rows updated.
Confirm: charge via provider; on success mark sold, booking confirmed.
`,
      deepDives: [
        {
          question: "How do you prevent double booking while users pay?",
          answer: `
- **DB row lock across payment** ❌: locks held for minutes.
- **Distributed lock in Redis with TTL**: works, but two sources of truth.
- **Reservation status + expiresAt in the ticket row** ✅: the conditional update is atomic; expired holds count as available, so no cleanup job is needed for correctness (a sweeper just tidies up). Payment confirm checks the hold is still yours.
`,
        },
        {
          question: "How do you survive a flash sale?",
          answer: `
- **Virtual waiting room**: users enter a queue (Redis sorted set by arrival); admit N per second to the booking flow; push their position via SSE/WebSocket.
- Seat map reads served from cache, refreshed every few seconds; real truth checked at reserve time.
- Booking DB load is bounded by admission rate, not by demand.
`,
        },
        {
          question: "How do you make search fast?",
          answer: `
- Elasticsearch fed by CDC from Postgres; indexes for text, date, location.
- Cache popular queries; CDN for event pages.
- Search results tolerate seconds of staleness.
`,
        },
      ],
    },
  },

  {
    id: "file-sync", title: "Cloud File Storage & Sync", difficulty: "medium",
    patterns: ["large-files", "realtime"], concepts: ["blob-storage", "cdn", "sql-vs-nosql"],
    prompt: "Design a Dropbox-like service: users upload files, see them on all devices, and share them.",
    hints: {
      requirements: ["Max file size? How fast must other devices see changes?"],
      highLevel: ["Should file bytes go through your servers?"],
      deepDives: ["A 10 GB upload fails at 90%.", "A 1 GB file changes by one byte."],
    },
    reference: {
      requirements: `
**Functional**
- Users can upload and download files (up to 50 GB).
- Files sync automatically across a user's devices.
- Users can share files/folders with others.

**Non-functional**
- Durable: never lose a file.
- Uploads and downloads as fast as the network allows; resumable.
- Changes appear on other devices within seconds.
- Availability over consistency for metadata reads; conflicts resolved explicitly.
`,
      entities: `- **File** (id, ownerId, path/name, size, versions, chunk list), **Chunk** (hash, size, s3Key), **Share** (fileId, userId, permission), **Device**`,
      api: `
\`\`\`
POST /files                   { name, size, chunkHashes[] } -> { fileId, uploadUrls for missing chunks }
POST /files/{id}/complete
GET  /files/{id}              -> metadata + presigned download URLs
GET  /changes?cursor=         -> files changed since cursor (sync)
POST /files/{id}/shares       { userId, permission }
\`\`\`
`,
      highLevel: `
\`\`\`
Client (chunker + local DB) ─► Metadata svc ─► Metadata DB (Postgres/Dynamo)
        │                            └─► S3 presigned URLs
        └──────── chunks ──────────► S3  ─(event)─► mark chunk uploaded
Other devices ◄─ notifications (long poll / WebSocket) ◄─ change log
Downloads ◄─ CDN ◄─ S3
\`\`\`
Upload: client splits into ~4-8 MB chunks, hashes them, asks metadata svc which chunks are missing, uploads those directly to S3 with presigned URLs, then commits the new version.
`,
      deepDives: [
        {
          question: "Large and resumable uploads",
          answer: `
- Chunking makes uploads **parallel and resumable**: on retry, re-ask which chunks exist.
- Use S3 multipart upload or per-chunk objects; verify via S3 event or HEAD before marking complete.
- Lifecycle rule cleans abandoned uploads.
`,
        },
        {
          question: "Efficient sync of edits",
          answer: `
- Content-addressed chunks (key = hash): only changed chunks upload (**delta sync**), and identical chunks across users **dedup**.
- Variable-size chunking (rolling hash / content-defined) avoids shifting all chunk boundaries on an insert.
- Each device holds a cursor into a per-user **change log**; notifications say "something changed", device pulls \`/changes\`.
`,
        },
        {
          question: "Conflicts and consistency",
          answer: `
- Commits carry the base version. If the server's version moved, it's a conflict: keep both ("file (conflicted copy)") rather than silently overwriting.
- Metadata commit is a single transaction (version row + chunk list).
- Durability from S3 (multi-AZ); metadata DB with sync replicas + backups.
`,
        },
      ],
    },
  },

  {
    id: "web-crawler", title: "Web Crawler", difficulty: "medium",
    patterns: ["long-running", "scaling-writes"], concepts: ["message-queues", "idempotency", "blob-storage"],
    prompt: "Design a crawler that fetches 10 billion web pages within a week for a search index.",
    hints: {
      requirements: ["How do you avoid getting banned by websites?"],
      highLevel: ["What's the unit of work in the queue?"],
      deepDives: ["How do you avoid crawling the same page twice?", "What if a worker crashes mid-fetch?"],
    },
    reference: {
      requirements: `
**Functional**
- Start from seed URLs, fetch pages, extract links, continue.
- Store raw HTML for the indexing pipeline.

**Non-functional**
- 10B pages / 7 days ≈ 16.5k pages/s.
- **Politeness**: obey robots.txt, ≤ 1 req/s per domain by default.
- Fault tolerant: resume after crashes without losing progress.
- Don't recrawl duplicates (URL and content dedup).
`,
      entities: `- **URL task** (url, domain, depth, priority), **Page** (urlHash, s3Key, contentHash, fetchedAt), **Domain** (robots rules, nextAllowedAt)`,
      api: `Internal only: \`enqueue(urls[])\`, worker \`fetch(task)\`; output to S3 + "page-fetched" stream for indexing.`,
      highLevel: `
\`\`\`
Seeds ─► Frontier queue ─► Fetcher workers ─► DNS cache ─► web
                                   │
                                   ├─► S3 (raw HTML)  ─► "fetched" stream ─► Parser workers
                                   │                                     └─► new URLs ─► dedup ─► Frontier
Domain table (robots, rate state)
\`\`\`
Split **fetching** (I/O bound) from **parsing** (CPU bound) so each scales separately.
`,
      deepDives: [
        {
          question: "How do you enforce politeness at 16k pages/s?",
          answer: `
- Partition the frontier **by domain** (e.g. Kafka keyed by domain, or per-domain queues). One fetcher owns a domain at a time, so per-domain rate is easy to enforce.
- Store \`nextAllowedAt\` per domain; tasks that arrive early are delayed (re-queue with delay).
- Cache robots.txt per domain (refresh daily).
`,
        },
        {
          question: "How do you dedup URLs and content?",
          answer: `
- Normalize URLs (lowercase host, strip fragments/tracking params) then hash.
- 10B URLs × 8-byte hash = 80 GB: a sharded **key-value set**, or a **Bloom filter** (~12 GB at 1% FP) as a fast pre-check.
- Content dedup: hash of normalized HTML (or SimHash for near-duplicates) skips mirrors.
`,
        },
        {
          question: "How do you survive failures?",
          answer: `
- Queue with visibility timeout: a dead worker's task reappears. Fetch is idempotent (writing the same S3 key twice is harmless).
- Retries with backoff for 5xx/timeouts; give up after N and record.
- Traps (infinite calendars): max depth, max pages per domain.
`,
        },
      ],
    },
  },
];
