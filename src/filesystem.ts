import type { PhotoItem } from "./types";

const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp)$/i;

/** Read names and handles only. Image bytes are loaded one at a time by the batch. */
export async function scanDirectory(
  directory: FileSystemDirectoryHandle,
): Promise<{
  photos: PhotoItem[];
  ignored: number;
  subdirectories: number;
}> {
  const photos: PhotoItem[] = [];
  let ignored = 0;
  let subdirectories = 0;
  for await (const handle of directory.values()) {
    if (handle.kind === "directory") {
      subdirectories++;
    } else if (IMAGE_EXTENSION.test(handle.name)) {
      photos.push({
        id: `photo-${photos.length}`,
        name: handle.name,
        handle,
        status: "pending",
      });
    } else {
      ignored++;
    }
  }
  photos.sort((a, b) =>
    a.name.localeCompare(b.name, "zh-Hant", { numeric: true }),
  );
  return { photos, ignored, subdirectories };
}

/** Must be called from the user-initiated start flow, before rendering begins. */
export async function ensureWritePermission(
  directory: FileSystemDirectoryHandle,
): Promise<void> {
  const descriptor: FileSystemHandlePermissionDescriptor = {
    mode: "readwrite",
  };
  if ((await directory.queryPermission(descriptor)) === "granted") return;
  if ((await directory.requestPermission(descriptor)) !== "granted") {
    throw new DOMException(
      "未取得輸出目錄的寫入權限，請重新選擇目錄並允許存取。",
      "NotAllowedError",
    );
  }
}

function errorName(error: unknown): string | undefined {
  return error && typeof error === "object" && "name" in error
    ? String(error.name)
    : undefined;
}

async function entryExists(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch (error) {
    if (errorName(error) === "NotFoundError") return false;
    // A directory with this name also reserves the name.
    if (errorName(error) === "TypeMismatchError") return true;
    throw error;
  }
}

async function removeEmptyFailedFile(
  directory: FileSystemDirectoryHandle,
  name: string,
  createdHandle: FileSystemFileHandle,
): Promise<void> {
  try {
    const current = await directory.getFileHandle(name);
    if (
      (await current.isSameEntry(createdHandle)) &&
      (await current.getFile()).size === 0
    ) {
      await directory.removeEntry(name);
    }
  } catch {
    // Cleanup must never hide the original write/permission/quota error.
  }
}

/**
 * Cache the directory's reserved names once per batch, including directories.
 * Each candidate is rechecked immediately before creation. The browser API has
 * no exclusive-create operation; avoid other apps writing here during a batch.
 */
export async function createWriter(
  directory: FileSystemDirectoryHandle,
): Promise<(name: string, blob: Blob) => Promise<string>> {
  const reserved = new Set<string>();
  for await (const [name] of directory.entries())
    reserved.add(name.toLowerCase());

  return async (name, blob) => {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : "";
    let candidate = name;
    let suffix = 0;
    // Reserve before yielding so even concurrent calls through this writer use
    // distinct names. Normally runBatch calls the writer sequentially.
    while (true) {
      const folded = candidate.toLowerCase();
      if (!reserved.has(folded)) {
        reserved.add(folded);
        if (!(await entryExists(directory, candidate))) break;
      }
      candidate = `${stem}_${++suffix}${extension}`;
    }

    const handle = await directory.getFileHandle(candidate, { create: true });
    let writable: FileSystemWritableFileStream | undefined;
    try {
      writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return candidate;
    } catch (error) {
      try {
        await writable?.abort();
      } catch {
        /* Preserve the original error. */
      }
      await removeEmptyFailedFile(directory, candidate, handle);
      throw error;
    }
  };
}

export async function writeUniqueFile(
  directory: FileSystemDirectoryHandle,
  name: string,
  blob: Blob,
): Promise<string> {
  return (await createWriter(directory))(name, blob);
}
