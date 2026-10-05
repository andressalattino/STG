const prefix = "stg-file:";

function openFiles(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("stg-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error("No se pudo abrir el almacenamiento de este dispositivo."),
      );
  });
}

export async function storeLocalFile(file: File): Promise<string> {
  const db = await openFiles();
  const id = crypto.randomUUID();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(file, id);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            "No hay espacio para guardar el archivo en este dispositivo.",
          ),
        );
    });
    return prefix + id;
  } finally {
    db.close();
  }
}

export async function readLocalFile(reference: string): Promise<File> {
  const db = await openFiles();
  try {
    return await new Promise<File>((resolve, reject) => {
      const request = db
        .transaction("files")
        .objectStore("files")
        .get(reference.slice(prefix.length));
      request.onsuccess = () =>
        request.result
          ? resolve(request.result)
          : reject(
              new Error(
                "Este archivo solo esta disponible en el dispositivo donde se cargo.",
              ),
            );
      request.onerror = () =>
        reject(new Error("No se pudo leer el archivo local."));
    });
  } finally {
    db.close();
  }
}

export function isLocalFile(value: string) {
  return value.startsWith(prefix);
}

export function documentUrl(value: string): string | null {
  const trimmed = value.trim();
  // The template never included these PDFs. Do not send visitors to a false link.
  if (
    /^\/pdfs\/(mendoza-aventura|norte-magico|bariloche-grupal)\.pdf$/.test(
      trimmed,
    )
  )
    return null;
  if (isLocalFile(trimmed)) return trimmed;
  try {
    const url = new URL(
      trimmed,
      typeof window === "undefined"
        ? "http://localhost"
        : window.location.origin,
    );
    if (!trimmed || !["https:", "http:"].includes(url.protocol)) return null;
    if (!trimmed.startsWith("/") && !/^https?:\/\//i.test(trimmed)) return null;
    return url.href;
  } catch {
    return null;
  }
}
