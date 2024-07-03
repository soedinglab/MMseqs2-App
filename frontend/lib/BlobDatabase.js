const indexedDBEnabled = typeof indexedDB !== 'undefined';

const Database = (() => {
    let dbInstance = null;

    async function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('BlobStorageDB', 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('blobs')) {
                    db.createObjectStore('blobs', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject('Error opening database: ' + event.target.errorCode);
            };
        });
    }

    return {
        getInstance: async () => {
            if (!dbInstance) {
                dbInstance = await openDatabase();
            }
            return dbInstance;
        }
    };
})();

const IndexedDBStorage = () => {
    return {
        async getItem(key) {
            const db = await Database.getInstance();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['blobs'], 'readonly');
                const objectStore = transaction.objectStore('blobs');
                const request = objectStore.get(key);

                request.onsuccess = (event) => {
                    const result = event.target.result;
                    if (result) {
                        resolve(result.blob);
                    } else {
                        resolve(null);
                    }
                };

                request.onerror = (event) => {
                    reject('Error retrieving item: ' + event.target.errorCode);
                };
            });
        },
        async setItem(key, value) {
            const db = await Database.getInstance();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['blobs'], 'readwrite');
                const objectStore = transaction.objectStore('blobs');
                const request = objectStore.put({ key: key, blob: value });

                request.onsuccess = () => {
                    resolve();
                };

                request.onerror = (event) => {
                    reject('Error setting item: ' + event.target.errorCode);
                };
            });
        },
        async removeItem(key) {
            const db = await Database.getInstance();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['blobs'], 'readwrite');
                const objectStore = transaction.objectStore('blobs');
                const request = objectStore.delete(key);

                request.onsuccess = () => {
                    resolve();
                };

                request.onerror = (event) => {
                    reject('Error removing item: ' + event.target.errorCode);
                };
            });
        },
        async clear() {
            const db = await Database.getInstance();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['blobs'], 'readwrite');
                const objectStore = transaction.objectStore('blobs');
                const request = objectStore.clear();

                request.onsuccess = () => {
                    resolve();
                };

                request.onerror = (event) => {
                    reject('Error clearing database: ' + event.target.errorCode);
                };
            });
        }
    };
};

const fakeAsyncStorage = (() => {
    let store = {};
    return {
        async getItem(key) {
            return new Promise((resolve, _) => {
                resolve(store[key] || null);
            });
        },
        async setItem(key, value) {
            return new Promise((resolve, _) => {
                store[key] = value.toString();
                resolve();
            });
        },
        async removeItem(key) {
            return new Promise((resolve, _) => {
                delete store[key];
                resolve();
            });
        },
        async clear() {
            return new Promise((resolve, _) => {
                store = {};
                resolve();
            });
        }
    };
})();

const BlobDatabase = indexedDBEnabled ? IndexedDBStorage : fakeAsyncStorage;
export { BlobDatabase };
