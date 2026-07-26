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
const readNameMap = () => JSON.parse(storage.getItem("name_map") || "[]");

const getJobName = (id) => readNameMap().find((e) => e.id === id)?.name || "";

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
};

const removeJobName = (id) => setJobName(id, "");

// --- type_map --------------------------------------------------------------
const readTypeMap = () => JSON.parse(storage.getItem("type_map") || "{}");

const getJobType = (id) => readTypeMap()[id];

// Job type is an immutable property of the job, so once resolved it is cached
// forever and never re-fetched.
const setJobType = (id, type) => {
  if (!id) {
    return;
  }
  const typeMap = readTypeMap();
  typeMap[id] = type;
  storage.setItem("type_map", JSON.stringify(typeMap));
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
