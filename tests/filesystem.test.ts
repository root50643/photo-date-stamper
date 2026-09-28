import { describe, expect, it, vi } from "vitest";
import {
  createWriter,
  ensureWritePermission,
  scanDirectory,
  writeUniqueFile,
} from "../src/filesystem";

function mockDirectory(initial: Record<string, "file" | "directory"> = {}) {
  const files = new Map<string, ReturnType<typeof mockFile>>();
  const folders = new Set<string>();
  for (const [name, kind] of Object.entries(initial)) {
    if (kind === "directory") folders.add(name);
    else files.set(name, mockFile(name, new Blob(["original"])));
  }
  const directory = {
    name: "照片",
    kind: "directory",
    entries: vi.fn(async function* () {
      for (const [name, handle] of files) yield [name, handle];
      for (const name of folders) yield [name, { name, kind: "directory" }];
    }),
    values: vi.fn(async function* () {
      for (const handle of files.values()) yield handle;
      for (const name of folders) yield { name, kind: "directory" };
    }),
    getFileHandle: vi.fn(
      async (name: string, options?: { create?: boolean }) => {
        if (folders.has(name))
          throw new DOMException("folder", "TypeMismatchError");
        if (!files.has(name)) {
          if (!options?.create)
            throw new DOMException("missing", "NotFoundError");
          files.set(name, mockFile(name));
        }
        return files.get(name)!;
      },
    ),
    removeEntry: vi.fn(async (name: string) => {
      files.delete(name);
    }),
    queryPermission: vi.fn(async () => "granted"),
    requestPermission: vi.fn(async () => "granted"),
  };
  return {
    directory,
    handle: directory as unknown as FileSystemDirectoryHandle,
    files,
    folders,
  };
}

function mockFile(name: string, initial = new Blob()) {
  let data = initial;
  const writable = {
    write: vi.fn(async (blob: Blob) => {
      pending = blob;
    }),
    close: vi.fn(async () => {
      data = pending;
    }),
    abort: vi.fn(async () => {}),
  };
  let pending = data;
  const file = {
    name,
    kind: "file",
    getFile: vi.fn(async () => data),
    createWritable: vi.fn(async () => writable),
    isSameEntry: vi.fn(async (other: unknown) => file === other),
    writable,
  };
  return file;
}

describe("scanDirectory", () => {
  it("scans only the current directory and sorts filenames numerically without reading bytes", async () => {
    const mock = mockDirectory({
      "照片10.JPG": "file",
      "照片2.jpeg": "file",
      "照片1.png": "file",
      "相片.webp": "file",
      "unsupported.gif": "file",
      "notes.txt": "file",
      "nested.jpg": "directory",
    });
    const result = await scanDirectory(mock.handle);
    expect(result.photos.map((photo) => photo.name)).toEqual([
      "相片.webp",
      "照片1.png",
      "照片2.jpeg",
      "照片10.JPG",
    ]);
    expect(result.photos).toHaveLength(4);
    expect(new Set(result.photos.map((photo) => photo.id)).size).toBe(4);
    expect(result.ignored).toBe(2);
    expect(result.subdirectories).toBe(1);
    for (const file of mock.files.values())
      expect(file.getFile).not.toHaveBeenCalled();
    expect(mock.directory.getFileHandle).not.toHaveBeenCalled();
  });

  it("handles an empty directory", async () => {
    expect(await scanDirectory(mockDirectory().handle)).toEqual({
      photos: [],
      ignored: 0,
      subdirectories: 0,
    });
  });
});

describe("ensureWritePermission", () => {
  it("reuses granted permissions", async () => {
    const mock = mockDirectory();
    await ensureWritePermission(mock.handle);
    expect(mock.directory.queryPermission).toHaveBeenCalledWith({
      mode: "readwrite",
    });
    expect(mock.directory.requestPermission).not.toHaveBeenCalled();
  });

  it("requests readwrite permissions when needed and explains a refusal", async () => {
    const mock = mockDirectory();
    mock.directory.queryPermission.mockResolvedValue("prompt");
    mock.directory.requestPermission.mockResolvedValue("denied");
    await expect(ensureWritePermission(mock.handle)).rejects.toMatchObject({
      name: "NotAllowedError",
    });
    expect(mock.directory.requestPermission).toHaveBeenCalledWith({
      mode: "readwrite",
    });
    mock.directory.requestPermission.mockResolvedValue("granted");
    await expect(ensureWritePermission(mock.handle)).resolves.toBeUndefined();
  });
});

describe("createWriter", () => {
  it("preserves existing files, case variants, Unicode names and same-name directories", async () => {
    const mock = mockDirectory({
      "照片.JPG": "file",
      "照片_1.jpg": "directory",
    });
    const write = await createWriter(mock.handle);
    expect(await write("照片.jpg", new Blob(["first"]))).toBe("照片_2.jpg");
    expect(await write("照片.jpg", new Blob(["second"]))).toBe("照片_3.jpg");
    expect(await (await mock.files.get("照片.JPG")!.getFile()).text()).toBe(
      "original",
    );
    expect(await (await mock.files.get("照片_2.jpg")!.getFile()).text()).toBe(
      "first",
    );
    expect(mock.directory.entries).toHaveBeenCalledTimes(1);
  });

  it("rechecks entries added after enumeration and reserves in-flight names", async () => {
    const mock = mockDirectory();
    const write = await createWriter(mock.handle);
    mock.folders.add("photo.jpg");
    const names = await Promise.all([
      write("photo.jpg", new Blob(["a"])),
      write("photo.jpg", new Blob(["b"])),
    ]);
    expect(new Set(names)).toEqual(new Set(["photo_1.jpg", "photo_2.jpg"]));
  });

  it("writes unchanged names when unused and inserts suffixes before the extension", async () => {
    const mock = mockDirectory();
    expect(
      await writeUniqueFile(mock.handle, "a.b.png", new Blob(["first"])),
    ).toBe("a.b.png");
    expect(
      await writeUniqueFile(mock.handle, "a.b.png", new Blob(["second"])),
    ).toBe("a.b_1.png");
    expect(mock.files.get("a.b.png")!.writable.close).toHaveBeenCalledOnce();
  });

  it("aborts and removes only a newly created empty file, preserving the original error", async () => {
    const mock = mockDirectory();
    const original = mock.directory.getFileHandle.getMockImplementation()!;
    const error = new DOMException("disk full", "QuotaExceededError");
    let failedFile: ReturnType<typeof mockFile> | undefined;
    mock.directory.getFileHandle.mockImplementation(async (name, options) => {
      const file = await original(name, options);
      if (options?.create) {
        failedFile = file;
        file.writable.write.mockRejectedValue(error);
        file.writable.abort.mockRejectedValue(new Error("abort also failed"));
      }
      return file;
    });
    await expect(
      writeUniqueFile(mock.handle, "new.jpg", new Blob(["data"])),
    ).rejects.toBe(error);
    expect(failedFile!.writable.abort).toHaveBeenCalledOnce();
    expect(mock.directory.removeEntry).toHaveBeenCalledWith("new.jpg");
    expect(mock.files.has("new.jpg")).toBe(false);
  });

  it("leaves a nonempty failed output untouched", async () => {
    const mock = mockDirectory();
    const original = mock.directory.getFileHandle.getMockImplementation()!;
    const error = new Error("close failed");
    mock.directory.getFileHandle.mockImplementation(async (name, options) => {
      const file = await original(name, options);
      if (options?.create) {
        const close = file.writable.close.getMockImplementation()!;
        file.writable.close.mockImplementation(async () => {
          await close();
          throw error;
        });
      }
      return file;
    });
    await expect(
      writeUniqueFile(mock.handle, "new.jpg", new Blob(["data"])),
    ).rejects.toBe(error);
    expect(mock.directory.removeEntry).not.toHaveBeenCalled();
    expect(mock.files.has("new.jpg")).toBe(true);
  });

  it("propagates directory errors without trying to overwrite anything", async () => {
    const mock = mockDirectory();
    const write = await createWriter(mock.handle);
    const error = new DOMException("permission lost", "NotAllowedError");
    mock.directory.getFileHandle.mockRejectedValue(error);
    await expect(write("new.jpg", new Blob())).rejects.toBe(error);
    expect(mock.directory.getFileHandle).toHaveBeenCalledTimes(1);
  });
});
