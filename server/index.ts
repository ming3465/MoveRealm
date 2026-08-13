import { existsSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 4173;
const isProduction = process.env.NODE_ENV === "production";
const rootDirectory = process.cwd();
for (const filename of [".env", ".env.local"]) {
  const path = join(rootDirectory, filename);
  if (existsSync(path)) process.loadEnvFile(path);
}
const host = process.env.HOST ?? (isProduction ? "0.0.0.0" : "127.0.0.1");
const app = createApp();

if (isProduction) {
  const distributionDirectory = join(rootDirectory, "dist");
  if (!existsSync(distributionDirectory)) {
    throw new Error("Production bundle missing. Run `npm run build` first.");
  }
  app.use(express.static(distributionDirectory));
  app.use((request, response, next) => {
    if (request.method !== "GET" || !request.accepts("html")) {
      next();
      return;
    }
    response.sendFile(join(distributionDirectory, "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: rootDirectory,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});

app.listen(port, host, () => {
  console.log(`MoveRealm ready at http://${host}:${port}`);
  console.log(
    process.env.MOVEREALM_FORCE_FALLBACK === "1"
      ? "Movement Director: deterministic fallback (forced)"
      : `Movement Director: ${process.env.CODEBUDDY_BASE_URL ?? "http://127.0.0.1:8080"}`,
  );
});
