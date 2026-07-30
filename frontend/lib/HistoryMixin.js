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
//   status_map { id: {                  resolved job status cache
//                      s: status, 
//                      t: epoch } }

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
const nameState = Vue.observable({ names: null });

const readNameMap = () => JSON.parse(storage.getItem("name_map") || "[]");

// Filled on first read, never at module scope: the migration has to be able to rewrite name_map
// before anything caches it. Each hydrate calls the migration itself rather than trusting a caller
// to have done it — it is version-guarded, so after the first run it costs an integer compare, and
// the alternative is a silent dependency on which component happens to be created first.
const hydrateNames = () => {
  if (nameState.names === null) {
    migrateHistoryStorage();
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
const typeState = Vue.observable({ types: null });

const readTypeMap = () => JSON.parse(storage.getItem("type_map") || "{}");

const hydrateTypes = () => {
  if (typeState.types === null) {
    migrateHistoryStorage();
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
  if (ui !== RAW_TYPE) {
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

// --- status_map ------------------------------------------------------------
// { [id]: { s: status, t: epochMs } }, observable and hydrated once, same as the two maps above.
const statusState = Vue.observable({ statuses: null });

const TERMINAL_STATUS = { COMPLETE: true, ERROR: true };

/** Terminal means "will never change again", which is exactly what makes a status cacheable. */
const isTerminalStatus = (status) => TERMINAL_STATUS[status] === true;

const STATUS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const readStatusMap = () => JSON.parse(storage.getItem("status_map") || "{}");

const hydrateStatuses = () => {
  if (statusState.statuses === null) {
    migrateHistoryStorage();
    const stored = readStatusMap();
    const now = +new Date();
    const statuses = {};
    let changed = false;
    for (const id of Object.keys(stored)) {
      const entry = stored[id];
      if (entry && isTerminalStatus(entry.s) && now - (entry.t || 0) < STATUS_TTL_MS) {
        statuses[id] = entry;
      } else {
        changed = true;
      }
    }
    if (changed) {
      storage.setItem("status_map", JSON.stringify(statuses));
    }
    statusState.statuses = statuses;
  }
  return statusState.statuses;
};

const getJobStatus = (id) => hydrateStatuses()[id]?.s;

const setJobStatus = (id, status) => {
  if (!id) {
    return;
  }
  const statusMap = readStatusMap();
  if (isTerminalStatus(status)) {
    statusMap[id] = { s: status, t: +new Date() };
    storage.setItem("status_map", JSON.stringify(statusMap));
  } else if (id in statusMap) {
    // Reconciliation: a job that was cached as finished and now reports PENDING or UNKNOWN has been
    // requeued or reaped, so the persisted verdict has to go rather than outlive the truth.
    delete statusMap[id];
    storage.setItem("status_map", JSON.stringify(statusMap));
  }
  statusState.statuses = { ...hydrateStatuses(), [id]: { s: status, t: +new Date() } };
};

const removeJobStatus = (id) => {
  if (!id) {
    return;
  }
  const statusMap = readStatusMap();
  if (id in statusMap) {
    delete statusMap[id];
    storage.setItem("status_map", JSON.stringify(statusMap));
  }
  const statuses = { ...hydrateStatuses() };
  delete statuses[id];
  statusState.statuses = statuses;
};

// --- Migration -------------------------------------------------------------
const HISTORY_SCHEMA_VERSION = 2;

const migrateHistoryStorage = () => {
  try {
    if (
      parseInt(storage.getItem("history_schema_version"), 10) >= HISTORY_SCHEMA_VERSION
    ) {
      return;
    }

    const raw = JSON.parse(storage.getItem("history") || "[]");
    const nameMap = readNameMap();
    const typeMap = readTypeMap();
    const statusMap = readStatusMap();
    let nameMapChanged = false;
    let typeMapChanged = false;
    let statusMapChanged = false;

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
        const ui = asUiType(item.type);
        if (ui !== RAW_TYPE) {
          typeMap[item.id] = ui;
          typeMapChanged = true;
        }
      }
      if (item.status && isTerminalStatus(item.status) && !(item.id in statusMap)) {
        statusMap[item.id] = { s: item.status, t: +new Date() };
        statusMapChanged = true;
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
    if (statusMapChanged) {
      storage.setItem("status_map", JSON.stringify(statusMap));
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
  STATUS_TTL_MS,
  isTerminalStatus,
  getJobStatus,
  setJobStatus,
  removeJobStatus,
};
