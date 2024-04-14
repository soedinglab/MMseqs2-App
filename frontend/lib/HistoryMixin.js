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
        }
    };
})();

let localStorageEnabled = false;
try {
    if (typeof window.localStorage !== 'undefined') {
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
        }
    }
};

// Mixin for history-related methods
const HistoryMixin = {
    methods: {
        addToHistory(uuid) {
            if (!uuid) {
                return;
            }

            let history = JSON.parse(storage.getItem('history') || '[]');

            let foundIndex = history.findIndex(item => item.id === uuid);
            if (foundIndex === -1) {
                history.unshift({ time: +new Date(), id: uuid });
            } else {
                history[foundIndex].time = +new Date();
            }

            storage.setItem('history', JSON.stringify(history));
        }
    }
};

export { localStorageEnabled, storage, StorageWrapper, HistoryMixin };
