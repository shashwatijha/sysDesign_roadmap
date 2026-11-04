import { useSyncExternalStore } from "react";
import { getVersion, subscribe } from "./db";

/** Re-render whenever the database changes; returns a version number usable as a memo dep. */
export function useDbVersion(): number {
  return useSyncExternalStore(subscribe, getVersion);
}
