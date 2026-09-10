// lexicon/loader.js
// Fetch the dictionary once, keep it in IndexedDB, parse it at every start.

const DB_NAME = 'jeux-de-tete';
const STORE = 'dictionary';
const KEY = 'signatures';
const SOURCE = 'data/signatures.txt.gz';
const FREQUENCY_KEY = 'frequences';
const FREQUENCY_SOURCE = 'data/frequences.txt.gz';

/**
 * Bump this whenever data/signatures.txt.gz is rebuilt. The service worker's
 * cache version does not reach IndexedDB, so without a version of its own a
 * phone would keep the dictionary it first downloaded for ever — and quietly
 * refuse words a newer one accepts. A record that fails this check, including
 * one written by an older build that stored a bare string, is re-downloaded.
 */
export const DICTIONARY_VERSION = 1;

/**
 * Bump when data/frequences.txt.gz is rebuilt, exactly as DICTIONARY_VERSION
 * is bumped for the dictionary. The two files are cached independently.
 */
export const FREQUENCY_VERSION = 1;

/** Is this cached record usable as it stands, for the given version? */
export function isCurrent(record, version) {
  return (
    typeof record === 'object' &&
    record !== null &&
    record.version === version &&
    typeof record.text === 'string'
  );
}

/** Read the index file: one line per signature, `signature<TAB>word word`. */
export function parseIndex(text) {
  const index = new Map();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    index.set(line.slice(0, tab), line.slice(tab + 1).split(' '));
  }
  return index;
}

/** One word per line: `mot<TAB>fréquence par million`. */
export function parseFrequencies(text) {
  const frequencies = new Map();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const value = Number(line.slice(tab + 1));
    if (!Number.isFinite(value)) continue;
    frequencies.set(line.slice(0, tab), value);
  }
  return frequencies;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact(db, mode, work) {
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE, mode).objectStore(STORE);
    const request = work(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * The dictionary is served as raw gzip bytes: GitHub Pages and Cloudflare Pages
 * hand back a .gz file untouched rather than decoding it, so the page decodes
 * it itself. DecompressionStream has been in Chrome since version 80.
 */
async function gunzip(response) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('ce navigateur ne sait pas décompresser le dictionnaire');
  }
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

async function readCached(key) {
  try {
    const db = await openDatabase();
    return await transact(db, 'readonly', (store) => store.get(key));
  } catch (error) {
    // A private window, or storage refused: fall back to downloading.
    console.warn('dictionnaire : lecture du cache impossible', error);
    return undefined;
  }
}

async function writeCached(key, record) {
  try {
    const db = await openDatabase();
    await transact(db, 'readwrite', (store) => store.put(record, key));
  } catch (error) {
    // Not fatal: the game works, it will just download again next time.
    console.warn('dictionnaire : écriture du cache impossible', error);
  }
}

/** Fetch once, keep in IndexedDB, hand back the text. */
async function loadText({ key, source, version, onProgress }) {
  onProgress('cache');
  const cached = await readCached(key);
  let text = isCurrent(cached, version) ? cached.text : undefined;

  if (typeof text !== 'string') {
    onProgress('téléchargement');
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`fichier indisponible (${response.status})`);
    }
    text = await gunzip(response);
    await writeCached(key, { version, text });
  }
  return text;
}

/**
 * Returns the signature index, downloading it the first time.
 * `onProgress` is called with 'cache' | 'téléchargement' | 'lecture'.
 */
export async function loadIndex({ onProgress = () => {} } = {}) {
  const text = await loadText({
    key: KEY, source: SOURCE, version: DICTIONARY_VERSION, onProgress,
  });
  onProgress('lecture');
  return parseIndex(text);
}

export async function loadFrequencies({ onProgress = () => {} } = {}) {
  const text = await loadText({
    key: FREQUENCY_KEY, source: FREQUENCY_SOURCE, version: FREQUENCY_VERSION, onProgress,
  });
  onProgress('lecture');
  return parseFrequencies(text);
}
