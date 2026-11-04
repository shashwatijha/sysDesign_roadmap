import type { Problem } from "../types";
import { EASY } from "./easy";
import { MEDIUM } from "./medium";
import { HARD } from "./hard";

/**
 * Stub problems: prompt + patterns only. The reference answer for each step
 * can be drafted by Claude from the problem page (saved to your DB), or added
 * here later.
 */
const STUBS: Problem[] = [
  { id: "pastebin", title: "Pastebin", difficulty: "easy", patterns: ["scaling-reads", "large-files"], concepts: ["blob-storage", "cdn"],
    prompt: "Design a service where users paste text, get a shareable link, and pastes can expire." },
  { id: "typeahead", title: "Search Autocomplete", difficulty: "easy", patterns: ["scaling-reads"], concepts: ["caching-strategies", "indexing"],
    prompt: "Design the suggestion dropdown for a search box: show the top 10 completions as the user types." },
  { id: "notification-service", title: "Notification Service", difficulty: "easy", patterns: ["long-running", "scaling-writes"], concepts: ["message-queues", "idempotency"],
    prompt: "Design a service other teams call to send push, email and SMS notifications to users, respecting preferences." },
  { id: "photo-sharing", title: "Photo Sharing Feed", difficulty: "medium", patterns: ["large-files", "scaling-reads"], concepts: ["blob-storage", "cdn", "caching-strategies"],
    prompt: "Design an Instagram-like app: users upload photos, follow others and scroll a feed." },
  { id: "local-search", title: "Nearby Places Search", difficulty: "medium", patterns: ["proximity", "scaling-reads"], concepts: ["indexing", "caching-strategies"],
    prompt: "Design a Yelp-like service to search businesses near a location and read reviews." },
  { id: "job-scheduler", title: "Distributed Job Scheduler", difficulty: "medium", patterns: ["long-running", "contention"], concepts: ["message-queues", "transactions-locking"],
    prompt: "Design a system that runs millions of scheduled and recurring jobs (cron-like) reliably across a cluster." },
  { id: "online-auction", title: "Online Auction", difficulty: "medium", patterns: ["contention", "realtime"], concepts: ["transactions-locking", "event-streams"],
    prompt: "Design an eBay-style auction: users bid on items and everyone sees the current highest bid live." },
  { id: "code-judge", title: "Online Code Judge", difficulty: "medium", patterns: ["long-running", "realtime"], concepts: ["message-queues"],
    prompt: "Design a LeetCode-like platform: users submit code, it runs against tests in isolation, and contests show a live leaderboard." },
  { id: "payment-system", title: "Payment Processing", difficulty: "hard", patterns: ["contention", "long-running"], concepts: ["idempotency", "transactions-locking", "event-streams"],
    prompt: "Design a payment service that charges customers via external processors and never double-charges or loses money." },
  { id: "metrics-monitoring", title: "Metrics & Alerting", difficulty: "hard", patterns: ["scaling-writes", "long-running"], concepts: ["event-streams", "sql-vs-nosql"],
    prompt: "Design a monitoring system that ingests metrics from 1M servers, shows dashboards, and fires alerts." },
  { id: "distributed-cache", title: "Distributed Cache", difficulty: "hard", patterns: ["scaling-reads"], concepts: ["consistent-hashing", "replication", "caching-strategies"],
    prompt: "Design a distributed in-memory key-value cache like Memcached/Redis Cluster." },
  { id: "message-queue", title: "Distributed Message Queue", difficulty: "hard", patterns: ["scaling-writes"], concepts: ["event-streams", "replication", "sharding"],
    prompt: "Design a durable, partitioned message queue like Kafka." },
];

export const PROBLEMS: Problem[] = [...EASY, ...MEDIUM, ...HARD, ...STUBS];
export const PROBLEM_BY_ID = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));
export const problemsByDifficulty = (d: Problem["difficulty"]) => PROBLEMS.filter((p) => p.difficulty === d);
