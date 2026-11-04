import type { RoadmapNode, StepDef } from "./types";

// Grid coords: x = column (0..6), y = row. Rendered by RoadmapGraph.
export const NODES: RoadmapNode[] = [
  { id: "framework", title: "Interview Framework", kind: "framework", x: 3, y: 0, parents: [],
    blurb: "How to run 45 minutes: requirements, entities, API, high-level design, deep dives." },

  { id: "c-networking", title: "Networking & APIs", kind: "concept", x: 1.5, y: 1, parents: ["framework"],
    blurb: "Protocols, load balancers, API styles." },
  { id: "c-storage", title: "Data Storage", kind: "concept", x: 4.5, y: 1, parents: ["framework"],
    blurb: "SQL vs NoSQL, indexes, blob storage." },

  { id: "c-async", title: "Async Processing", kind: "concept", x: 0.5, y: 2, parents: ["c-networking"],
    blurb: "Queues, streams, workers." },
  { id: "c-caching", title: "Caching", kind: "concept", x: 2, y: 2, parents: ["c-networking", "c-storage"],
    blurb: "Where to cache, eviction, invalidation." },
  { id: "c-scaling", title: "Partitioning & Replication", kind: "concept", x: 4, y: 2, parents: ["c-storage"],
    blurb: "Sharding, consistent hashing, replicas." },
  { id: "c-consistency", title: "Consistency", kind: "concept", x: 5.8, y: 2, parents: ["c-storage"],
    blurb: "CAP, transactions, locks, idempotency." },

  { id: "p-reads", title: "Scaling Reads", kind: "pattern", x: 1.5, y: 3, parents: ["c-caching", "c-scaling"],
    blurb: "Read-heavy workloads." },
  { id: "p-writes", title: "Scaling Writes", kind: "pattern", x: 3, y: 3, parents: ["c-scaling", "c-async"],
    blurb: "Write-heavy and bursty workloads." },
  { id: "p-contention", title: "Contention", kind: "pattern", x: 6, y: 3, parents: ["c-consistency"],
    blurb: "Many users, one scarce resource." },

  { id: "easy", title: "Easy Problems", kind: "problems", x: 3, y: 4, parents: ["p-reads", "p-writes"],
    blurb: "Single core pattern, few moving parts." },

  { id: "p-realtime", title: "Real-time Updates", kind: "pattern", x: 0, y: 3, parents: ["c-async"],
    blurb: "Push data to clients as it changes." },
  { id: "p-longrunning", title: "Long-running Tasks", kind: "pattern", x: 0.5, y: 4, parents: ["c-async"],
    blurb: "Work that outlives a request." },
  { id: "p-blobs", title: "Large Files", kind: "pattern", x: 5, y: 4, parents: ["p-writes"],
    blurb: "Uploading and serving big binaries." },
  { id: "p-geo", title: "Proximity Search", kind: "pattern", x: 4.5, y: 3, parents: ["c-scaling"],
    blurb: "Find things near a point." },

  { id: "medium", title: "Medium Problems", kind: "problems", x: 3, y: 5, parents: ["easy", "p-realtime", "p-longrunning", "p-contention", "p-blobs", "p-geo"],
    blurb: "Two or three patterns interacting." },
  { id: "hard", title: "Hard Problems", kind: "problems", x: 3, y: 6, parents: ["medium"],
    blurb: "Many patterns, tight constraints, deep dives decide the outcome." },
];

export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

export const STEPS: StepDef[] = [
  { id: "requirements", title: "Requirements", minutes: 5,
    guide: "List 3-5 **functional** requirements as user capabilities (\"users can…\"). Then the **non-functional** requirements that shape the design: scale, latency, availability vs consistency, durability. Quantify where you can. Call out what's out of scope." },
  { id: "entities", title: "Core Entities", minutes: 2,
    guide: "Name the nouns your system stores and moves around. Just names and a few key fields; the full schema can wait until you need it." },
  { id: "api", title: "API", minutes: 5,
    guide: "One endpoint (or event) per functional requirement. Show method, path, inputs, outputs. Take identity from the auth token, not the request body." },
  { id: "highLevel", title: "High-Level Design", minutes: 15,
    guide: "Walk each API through the system: clients → gateway → services → storage. Get a design that **works** for every functional requirement before optimizing. Draw it." },
  { id: "deepDives", title: "Deep Dives", minutes: 15,
    guide: "Go back to the non-functional requirements and make the design meet them. Pick the 2-3 hardest problems (scale, consistency, failure) and compare options with their tradeoffs." },
];
