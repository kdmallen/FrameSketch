let dbPromise;
function db() {
  return (dbPromise ||= new Promise((resolve, reject) => {
    const r = indexedDB.open("framesketch", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("projects", { keyPath: "id" });
      r.result.createObjectStore("media");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
async function request(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode),
      r = fn(tx.objectStore(store));
    let result;
    r.onsuccess = () => {
      result = r.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Storage operation aborted"));
  });
}
export const listProjects = () =>
  request("projects", "readonly", (s) => s.getAll());
export const saveProject = (p) =>
  request("projects", "readwrite", (s) => s.put(p));
export const getMedia = (id) => request("media", "readonly", (s) => s.get(id));
export const saveMedia = (id, blob) =>
  request("media", "readwrite", (s) => s.put(blob, id));
export async function deleteProject(id) {
  await request("projects", "readwrite", (s) => s.delete(id));
  await request("media", "readwrite", (s) => s.delete(id));
}
