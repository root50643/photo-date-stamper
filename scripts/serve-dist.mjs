// Local production-build fixture: exercises the same subpath layout as project Pages.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const prefix = "/photo-date-stamper/";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (!pathname.startsWith(prefix)) {
      response.writeHead(404).end();
      return;
    }
    const path = resolve(root, pathname.slice(prefix.length) || "index.html");
    if (!path.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    const data = await readFile(path);
    response
      .writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
      })
      .end(data);
  } catch {
    response.writeHead(404).end();
  }
}).listen(4174, "127.0.0.1");
