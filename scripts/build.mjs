import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const path of [
  "index.html",
  "privacy.html",
  "terms.html",
  "style.css",
  "legal.css",
  "main.js",
  "assets",
]) {
  await cp(new URL(path, root), new URL(path, dist), { recursive: true });
}
console.log("Built homepage/dist");

await mkdir(new URL('admin/', dist), { recursive: true });
for (const file of ['index.html', 'admin.css']) {
  await cp(new URL(`admin/${file}`, root), new URL(`admin/${file}`, dist));
}
await build({ entryPoints: [new URL('admin/admin.js', root).pathname],
  outfile: new URL('admin/admin.js', dist).pathname, bundle: true,
  format: 'esm', minify: true, target: 'es2022' });
const url = process.env.ADMIN_SUPABASE_URL;
const key = process.env.ADMIN_SUPABASE_PUBLISHABLE_KEY;
if (Boolean(url) !== Boolean(key)) throw Error('Both public Supabase settings are required');
if (key && !key.startsWith('sb_publishable_')) throw Error('Use a publishable key, never a secret or service role key');
await writeFile(new URL('admin/config.json', dist), JSON.stringify({ url, key }));
