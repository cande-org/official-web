import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(
  new URL(
    process.argv.includes("--dist") ? "../dist/" : "../",
    import.meta.url,
  ),
);
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".otf": "font/otf",
};
const server = createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = resolve(root, "." + (path === "/" ? "/index.html" : path));
    const relative = file.slice(root.length);
    if (
      !file.startsWith(root) ||
      relative.startsWith(".") ||
      relative.split(sep).some((part) => part.startsWith(".")) ||
      !types[extname(file)] ||
      !(
        relative === "index.html" ||
        relative === "main.js" ||
        relative === "style.css" ||
        relative.startsWith("assets" + sep)
      )
    ) {
      res.writeHead(404).end("Not found");
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)],
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Cande preview: http://127.0.0.1:${port} (PID ${process.pid})`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close());
