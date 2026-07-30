import Vue from "vue";
import { RAW_TYPE, asUiType } from "./ticketRoute.js";

const fakeLocalStorage = (() => {
  let store = {};
  return {
    getItem(key) {
      return store[key] || null;
    },
    setItem(key, value) {
      store[key] = value.toString();
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

let localStorageEnabled = false;
try {
  if (typeof window.localStorage !== "undefined") {
    localStorageEnabled = true;
  }
} catch (e) {
  localStorageEnabled = false;
}

const storage = localStorageEnabled ? window.localStorage : fakeLocalStorage;

const StorageWrapper = (prefix) => {
  return {
    getItem(key) {
      return storage.getItem(`${prefix}.${key}`);
    },
    setItem(key, value) {
      storage.setItem(`${prefix}.${key}`, value);
    },
    removeItem(key) {
      storage.removeItem(`${prefix}.${key}`);
    },
    baseStorage: storage,
    clear() {
      let keys = Object.keys(storage);
      for (let key of keys) {
        if (key.startsWith(prefix)) {
          storage.removeItem(key);
        }
      }
    },
  };
};

// --- Granular localStorage helpers -----------------------------------------
// Each operation reads-modifies-writes only the key it owns, so we never
// re-serialize the whole history array on every reactive change.
//
// Keys:
//   history:  [{ time, id }]            structural list (source of truth)
//   name_map: [{ id, name }]            user-assigned job names
//   type_map: { [id]: type }            resolved job type cache (new key)

const readHistory = () => JSON.parse(storage.getItem("history") || "[]");

// Update (or insert) a single history item, touching only the `history` key.
const upsertHistoryItem = (id, patch = {}) => {
  if (!id) {
    return;
  }
  const history = readHistory();
  const idx = history.findIndex((item) => item.id === id);
  if (idx === -1) {
    history.unshift({ time: +new Date(), id, ...patch });
  } else {
    history[idx] = { ...history[idx], ...patch };
  }
  storage.setItem("history", JSON.stringify(history));
  return history;
};

// Remove a single history item (used by the delete/forget feature).
const removeHistoryItem = (id) => {
  if (!id) {
    return;
  }
  const history = readHistory().filter((item) => item.id !== id);
  storage.setItem("history", JSON.stringify(history));
  return history;
};

// --- name_map --------------------------------------------------------------
// Stored as [{ id, name }]; held in memory as { [id]: name }, parsed once per page.
// The map is observable so a consumer can express "the name of this ticket" as a
// computed property. That matters more than the saved parses: NameField used to read
// the name once in created(), which runs before the route component has assigned
// `ticket`, so the name was looked up under "" and never looked up again.
const nameState = Vue.observable({ names: null });

const readNameMap = () => JSON.parse(storage.getItem("name_map") || "[]");

// Filled on first read, never at module scope: migrateHistoryStorage() has to be able
// to rewrite name_map before anything caches it.
const hydrateNames = () => {
  if (nameState.names === null) {
    const names = {};
    for (const e of readNameMap()) {
      names[e.id] = e.name;
    }
    nameState.names = names;
  }
  return nameState.names;
};

const getJobName = (id) => hydrateNames()[id] || "";

// Set (or clear, when name is empty) the name for a single id.
const setJobName = (id, name) => {
  if (!id) {
    return;
  }
  // Still a read-modify-write of the stored map rather than a dump of the cached one:
  // two tabs renaming different jobs have to merge through localStorage, and writing
  // our own copy back would drop the other tab's rename. A rename costs one parse.
  const nameMap = readNameMap();
  const idx = nameMap.findIndex((e) => e.id === id);
  if (name) {
    if (idx === -1) {
      nameMap.push({ id, name });
    } else {
      nameMap[idx].name = name;
    }
  } else if (idx !== -1) {
    nameMap.splice(idx, 1);
  }
  storage.setItem("name_map", JSON.stringify(nameMap));

  // Replaced, not mutated: Vue 2 cannot observe a key added to an existing object, so
  // mutating would leave the first name a job is ever given unrendered.
  const names = { ...hydrateNames() };
  if (name) {
    names[id] = name;
  } else {
    delete names[id];
  }
  nameState.names = names;
};

const removeJobName = (id) => setJobName(id, "");

// --- type_map --------------------------------------------------------------
// { [id]: normalisedUiType }, parsed once and observable, same shape as name_map above.
// A job's type is immutable, so a resolved entry is kept across sessions.
//
// Being the only writer is what lets the store hold two invariants that callers used to have
// to remember individually:
//   - only NORMALISED types get in. HistoryAvatar switches on those, so a raw backend string
//     stored by mistake routes correctly (routeForTicket accepts both) while rendering as the
//     unknown-type glyph — a split that is very hard to read from the symptom.
//   - RAW_TYPE never reaches localStorage, so "this frontend cannot map that type" is not a
//     permanent verdict — but it IS remembered in memory, so nothing re-asks all session. See
//     setJobType. Callers therefore get three distinct answers: a drawable type, RAW_TYPE
//     ("asked, nothing to draw"), or undefined ("never asked").
const typeState = Vue.observable({ types: null });

const readTypeMap = () => JSON.parse(storage.getItem("type_map") || "{}");

// Also repairs the stored map in place: entries written before the store existed may be raw or
// unmappable. Dropping them costs one re-fetch and lets them come back normalised.
const hydrateTypes = () => {
  if (typeState.types === null) {
    const stored = readTypeMap();
    const types = {};
    let changed = false;
    for (const id of Object.keys(stored)) {
      const ui = asUiType(stored[id]);
      if (ui === RAW_TYPE) {
        changed = true;
      } else {
        types[id] = ui;
        changed = changed || ui !== stored[id];
      }
    }
    if (changed) {
      storage.setItem("type_map", JSON.stringify(types));
    }
    typeState.types = types;
  }
  return typeState.types;
};

const getJobType = (id) => hydrateTypes()[id];

// Accepts either spelling — callers can hand over an `api/ticket/type/{id}` response verbatim.
const setJobType = (id, type) => {
  if (!id) {
    return;
  }
  const ui = asUiType(type);
  // RAW_TYPE is remembered in memory but never persisted, and the split is deliberate.
  // Remembering it for the page's lifetime is what stops fetchWindowTypes — which runs from
  // created(), the drawer watcher, the page watcher and a 5s poll — from re-asking for the same
  // job on every trigger. Not persisting it means a release that learns the type still picks it
  // up on the next visit instead of being locked out by its own cache.
  if (ui !== RAW_TYPE) {
    // Read-modify-write for the same reason setJobName does it: another tab may have resolved a
    // different job since this one hydrated.
    const typeMap = readTypeMap();
    typeMap[id] = ui;
    storage.setItem("type_map", JSON.stringify(typeMap));
  }
  typeState.types = { ...hydrateTypes(), [id]: ui };
};

const removeJobType = (id) => {
  if (!id) {
    return;
  }
  const typeMap = readTypeMap();
  if (id in typeMap) {
    delete typeMap[id];
    storage.setItem("type_map", JSON.stringify(typeMap));
  }
  const types = { ...hydrateTypes() };
  delete types[id];
  typeState.types = types;
};

// --- Migration -------------------------------------------------------------
const HISTORY_SCHEMA_VERSION = 2;

// One-time migration from older localStorage layouts. Idempotent and guarded by
// a version flag so it only does real work once per browser.
//   - Oldest layout: `history` was an array of bare id strings.
//   - Old layout: the whole reactive `items` array was serialized back into
//     `history`, so entries carried runtime fields (status/name). We strip them
//     back down to { time, id } and lift any embedded name/type into
//     name_map/type_map so nothing the user set is lost.
const migrateHistoryStorage = () => {
  try {
    if (
      parseInt(storage.getItem("history_schema_version"), 10) >= HISTORY_SCHEMA_VERSION
    ) {
      return;
    }

    const raw = JSON.parse(storage.getItem("history") || "[]");
    const nameMap = JSON.parse(storage.getItem("name_map") || "[]");
    const typeMap = readTypeMap();
    let nameMapChanged = false;
    let typeMapChanged = false;

    const cleaned = [];
    for (const entry of raw) {
      // Oldest format tolerance: an entry that is just an id string.
      const item = typeof entry === "string" ? { id: entry } : entry;
      if (!item || !item.id) {
        continue;
      }
      if (item.name && !nameMap.some((e) => e.id === item.id)) {
        nameMap.push({ id: item.id, name: item.name });
        nameMapChanged = true;
      }
      if (item.type && !(item.id in typeMap)) {
        typeMap[item.id] = item.type;
        typeMapChanged = true;
      }
      cleaned.push({ time: item.time || +new Date(), id: item.id });
    }

    storage.setItem("history", JSON.stringify(cleaned));
    if (nameMapChanged) {
      storage.setItem("name_map", JSON.stringify(nameMap));
    }
    if (typeMapChanged) {
      storage.setItem("type_map", JSON.stringify(typeMap));
    }
    storage.setItem("history_schema_version", String(HISTORY_SCHEMA_VERSION));
  } catch (e) {
    // A migration hiccup must never break history loading.
    console.error("History storage migration failed:", e);
  }
};

// Mixin for history-related methods
const HistoryMixin = {
  methods: {
    addToHistory(uuid) {
      upsertHistoryItem(uuid, { time: +new Date() });
    },
  },
};

export {
  localStorageEnabled,
  storage,
  StorageWrapper,
  HistoryMixin,
  migrateHistoryStorage,
  readHistory,
  upsertHistoryItem,
  removeHistoryItem,
  readNameMap,
  getJobName,
  setJobName,
  removeJobName,
  readTypeMap,
  getJobType,
  setJobType,
  removeJobType,
};
