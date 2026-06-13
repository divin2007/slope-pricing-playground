const STORAGE_KEY = "kigali-slope-trips";
const DB_NAME = "kigali-slope-pricing-playground";
const STORE_NAME = "datasets";
const DATASET_KEY = "rides";

function readLocalStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readIndexedDb() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(DATASET_KEY);

    request.onsuccess = () => {
      database.close();
      resolve(Array.isArray(request.result) ? request.result : []);
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

async function writeIndexedDb(trips) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(trips, DATASET_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export function loadTripsFromBrowser() {
  return readIndexedDb()
    .then((trips) => (trips.length ? trips : readLocalStorage()))
    .catch(readLocalStorage);
}

export async function saveTripsToBrowser(trips) {
  let localStorageSaved = false;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    localStorageSaved = true;
  } catch {
    // IndexedDB remains the primary store when detailed route samples exceed
    // localStorage's small per-origin quota.
  }

  try {
    await writeIndexedDb(trips);
    return;
  } catch (error) {
    if (!localStorageSaved) throw error;
  }
}

export function loadTripsFromLocalStorage() {
  return readLocalStorage();
}
