// vite.config.ts
import tailwindcss from "file:///C:/Users/risha/Journi_MVP_new/node_modules/@tailwindcss/vite/dist/index.mjs";
import react from "file:///C:/Users/risha/Journi_MVP_new/node_modules/@vitejs/plugin-react/dist/index.js";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "file:///C:/Users/risha/Journi_MVP_new/node_modules/vite/dist/node/index.js";
var __vite_injected_original_dirname = "C:\\Users\\risha\\Journi_MVP_new";
var PROJECT_ROOT = __vite_injected_original_dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "client", "src"),
      "@shared": path.resolve(__vite_injected_original_dirname, "shared"),
      "@assets": path.resolve(__vite_injected_original_dirname, "attached_assets")
    }
  },
  envDir: path.resolve(__vite_injected_original_dirname),
  root: path.resolve(__vite_injected_original_dirname, "client"),
  build: {
    outDir: path.resolve(__vite_injected_original_dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    port: 3001,
    strictPort: false,
    // Will find next available port if 3001 is busy
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    },
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    root: ".",
    include: ["client/src/**/__tests__/**/*.test.ts"],
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "client", "src")
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxyaXNoYVxcXFxKb3VybmlfTVZQX25ld1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxccmlzaGFcXFxcSm91cm5pX01WUF9uZXdcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3Jpc2hhL0pvdXJuaV9NVlBfbmV3L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gXCJAdGFpbHdpbmRjc3Mvdml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XHJcbmltcG9ydCBmcyBmcm9tIFwibm9kZTpmc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwibm9kZTpwYXRoXCI7XHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZywgdHlwZSBQbHVnaW4sIHR5cGUgVml0ZURldlNlcnZlciB9IGZyb20gXCJ2aXRlXCI7XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyBNYW51cyBEZWJ1ZyBDb2xsZWN0b3IgLSBWaXRlIFBsdWdpblxyXG4vLyBXcml0ZXMgYnJvd3NlciBsb2dzIGRpcmVjdGx5IHRvIGZpbGVzLCB0cmltbWVkIHdoZW4gZXhjZWVkaW5nIHNpemUgbGltaXRcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbmNvbnN0IFBST0pFQ1RfUk9PVCA9IGltcG9ydC5tZXRhLmRpcm5hbWU7XHJcbmNvbnN0IExPR19ESVIgPSBwYXRoLmpvaW4oUFJPSkVDVF9ST09ULCBcIi5tYW51cy1sb2dzXCIpO1xyXG5jb25zdCBNQVhfTE9HX1NJWkVfQllURVMgPSAxICogMTAyNCAqIDEwMjQ7IC8vIDFNQiBwZXIgbG9nIGZpbGVcclxuY29uc3QgVFJJTV9UQVJHRVRfQllURVMgPSBNYXRoLmZsb29yKE1BWF9MT0dfU0laRV9CWVRFUyAqIDAuNik7IC8vIFRyaW0gdG8gNjAlIHRvIGF2b2lkIGNvbnN0YW50IHJlLXRyaW1taW5nXHJcblxyXG50eXBlIExvZ1NvdXJjZSA9IFwiYnJvd3NlckNvbnNvbGVcIiB8IFwibmV0d29ya1JlcXVlc3RzXCIgfCBcInNlc3Npb25SZXBsYXlcIjtcclxuXHJcbmZ1bmN0aW9uIGVuc3VyZUxvZ0RpcigpIHtcclxuICBpZiAoIWZzLmV4aXN0c1N5bmMoTE9HX0RJUikpIHtcclxuICAgIGZzLm1rZGlyU3luYyhMT0dfRElSLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRyaW1Mb2dGaWxlKGxvZ1BhdGg6IHN0cmluZywgbWF4U2l6ZTogbnVtYmVyKSB7XHJcbiAgdHJ5IHtcclxuICAgIGlmICghZnMuZXhpc3RzU3luYyhsb2dQYXRoKSB8fCBmcy5zdGF0U3luYyhsb2dQYXRoKS5zaXplIDw9IG1heFNpemUpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGxpbmVzID0gZnMucmVhZEZpbGVTeW5jKGxvZ1BhdGgsIFwidXRmLThcIikuc3BsaXQoXCJcXG5cIik7XHJcbiAgICBjb25zdCBrZXB0TGluZXM6IHN0cmluZ1tdID0gW107XHJcbiAgICBsZXQga2VwdEJ5dGVzID0gMDtcclxuXHJcbiAgICAvLyBLZWVwIG5ld2VzdCBsaW5lcyAoZnJvbSBlbmQpIHRoYXQgZml0IHdpdGhpbiA2MCUgb2YgbWF4U2l6ZVxyXG4gICAgY29uc3QgdGFyZ2V0U2l6ZSA9IFRSSU1fVEFSR0VUX0JZVEVTO1xyXG4gICAgZm9yIChsZXQgaSA9IGxpbmVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgIGNvbnN0IGxpbmVCeXRlcyA9IEJ1ZmZlci5ieXRlTGVuZ3RoKGAke2xpbmVzW2ldfVxcbmAsIFwidXRmLThcIik7XHJcbiAgICAgIGlmIChrZXB0Qnl0ZXMgKyBsaW5lQnl0ZXMgPiB0YXJnZXRTaXplKSBicmVhaztcclxuICAgICAga2VwdExpbmVzLnVuc2hpZnQobGluZXNbaV0pO1xyXG4gICAgICBrZXB0Qnl0ZXMgKz0gbGluZUJ5dGVzO1xyXG4gICAgfVxyXG5cclxuICAgIGZzLndyaXRlRmlsZVN5bmMobG9nUGF0aCwga2VwdExpbmVzLmpvaW4oXCJcXG5cIiksIFwidXRmLThcIik7XHJcbiAgfSBjYXRjaCB7XHJcbiAgICAvKiBpZ25vcmUgdHJpbSBlcnJvcnMgKi9cclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlVG9Mb2dGaWxlKHNvdXJjZTogTG9nU291cmNlLCBlbnRyaWVzOiB1bmtub3duW10pIHtcclxuICBpZiAoZW50cmllcy5sZW5ndGggPT09IDApIHJldHVybjtcclxuXHJcbiAgZW5zdXJlTG9nRGlyKCk7XHJcbiAgY29uc3QgbG9nUGF0aCA9IHBhdGguam9pbihMT0dfRElSLCBgJHtzb3VyY2V9LmxvZ2ApO1xyXG5cclxuICAvLyBGb3JtYXQgZW50cmllcyB3aXRoIHRpbWVzdGFtcHNcclxuICBjb25zdCBsaW5lcyA9IGVudHJpZXMubWFwKChlbnRyeSkgPT4ge1xyXG4gICAgY29uc3QgdHMgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XHJcbiAgICByZXR1cm4gYFske3RzfV0gJHtKU09OLnN0cmluZ2lmeShlbnRyeSl9YDtcclxuICB9KTtcclxuXHJcbiAgLy8gQXBwZW5kIHRvIGxvZyBmaWxlXHJcbiAgZnMuYXBwZW5kRmlsZVN5bmMobG9nUGF0aCwgYCR7bGluZXMuam9pbihcIlxcblwiKX1cXG5gLCBcInV0Zi04XCIpO1xyXG5cclxuICAvLyBUcmltIGlmIGV4Y2VlZHMgbWF4IHNpemVcclxuICB0cmltTG9nRmlsZShsb2dQYXRoLCBNQVhfTE9HX1NJWkVfQllURVMpO1xyXG59XHJcblxyXG4vKipcclxuICogVml0ZSBwbHVnaW4gdG8gY29sbGVjdCBicm93c2VyIGRlYnVnIGxvZ3NcclxuICogLSBQT1NUIC9fX21hbnVzX18vbG9nczogQnJvd3NlciBzZW5kcyBsb2dzLCB3cml0dGVuIGRpcmVjdGx5IHRvIGZpbGVzXHJcbiAqIC0gRmlsZXM6IGJyb3dzZXJDb25zb2xlLmxvZywgbmV0d29ya1JlcXVlc3RzLmxvZywgc2Vzc2lvblJlcGxheS5sb2dcclxuICogLSBBdXRvLXRyaW1tZWQgd2hlbiBleGNlZWRpbmcgMU1CIChrZWVwcyBuZXdlc3QgZW50cmllcylcclxuICovXHJcbmZ1bmN0aW9uIHZpdGVQbHVnaW5NYW51c0RlYnVnQ29sbGVjdG9yKCk6IFBsdWdpbiB7XHJcbiAgcmV0dXJuIHtcclxuICAgIG5hbWU6IFwibWFudXMtZGVidWctY29sbGVjdG9yXCIsXHJcblxyXG4gICAgdHJhbnNmb3JtSW5kZXhIdG1sKGh0bWwpIHtcclxuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcInByb2R1Y3Rpb25cIikge1xyXG4gICAgICAgIHJldHVybiBodG1sO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgaHRtbCxcclxuICAgICAgICB0YWdzOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHRhZzogXCJzY3JpcHRcIixcclxuICAgICAgICAgICAgYXR0cnM6IHtcclxuICAgICAgICAgICAgICBzcmM6IFwiL19fbWFudXNfXy9kZWJ1Zy1jb2xsZWN0b3IuanNcIixcclxuICAgICAgICAgICAgICBkZWZlcjogdHJ1ZSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgaW5qZWN0VG86IFwiaGVhZFwiLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdLFxyXG4gICAgICB9O1xyXG4gICAgfSxcclxuXHJcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyOiBWaXRlRGV2U2VydmVyKSB7XHJcbiAgICAgIC8vIFBPU1QgL19fbWFudXNfXy9sb2dzOiBCcm93c2VyIHNlbmRzIGxvZ3MgKHdyaXR0ZW4gZGlyZWN0bHkgdG8gZmlsZXMpXHJcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvX19tYW51c19fL2xvZ3NcIiwgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XHJcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7XHJcbiAgICAgICAgICByZXR1cm4gbmV4dCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgaGFuZGxlUGF5bG9hZCA9IChwYXlsb2FkOiBhbnkpID0+IHtcclxuICAgICAgICAgIC8vIFdyaXRlIGxvZ3MgZGlyZWN0bHkgdG8gZmlsZXNcclxuICAgICAgICAgIGlmIChwYXlsb2FkLmNvbnNvbGVMb2dzPy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHdyaXRlVG9Mb2dGaWxlKFwiYnJvd3NlckNvbnNvbGVcIiwgcGF5bG9hZC5jb25zb2xlTG9ncyk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZiAocGF5bG9hZC5uZXR3b3JrUmVxdWVzdHM/Lmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgd3JpdGVUb0xvZ0ZpbGUoXCJuZXR3b3JrUmVxdWVzdHNcIiwgcGF5bG9hZC5uZXR3b3JrUmVxdWVzdHMpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKHBheWxvYWQuc2Vzc2lvbkV2ZW50cz8ubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICB3cml0ZVRvTG9nRmlsZShcInNlc3Npb25SZXBsYXlcIiwgcGF5bG9hZC5zZXNzaW9uRXZlbnRzKTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMCwgeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9KTtcclxuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBjb25zdCByZXFCb2R5ID0gKHJlcSBhcyB7IGJvZHk/OiB1bmtub3duIH0pLmJvZHk7XHJcbiAgICAgICAgaWYgKHJlcUJvZHkgJiYgdHlwZW9mIHJlcUJvZHkgPT09IFwib2JqZWN0XCIpIHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGhhbmRsZVBheWxvYWQocmVxQm9keSk7XHJcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNDAwLCB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0pO1xyXG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBTdHJpbmcoZSkgfSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGJvZHkgPSBcIlwiO1xyXG4gICAgICAgIHJlcS5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XHJcbiAgICAgICAgICBib2R5ICs9IGNodW5rLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJlcS5vbihcImVuZFwiLCAoKSA9PiB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgICAgaGFuZGxlUGF5bG9hZChwYXlsb2FkKTtcclxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDAsIHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSk7XHJcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFN0cmluZyhlKSB9KSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSxcclxuICB9O1xyXG59XHJcblxyXG5jb25zdCBwbHVnaW5zID0gW3JlYWN0KCksIHRhaWx3aW5kY3NzKCksIHZpdGVQbHVnaW5NYW51c0RlYnVnQ29sbGVjdG9yKCldO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoaW1wb3J0Lm1ldGEuZGlybmFtZSwgXCJjbGllbnRcIiwgXCJzcmNcIiksXHJcbiAgICAgIFwiQHNoYXJlZFwiOiBwYXRoLnJlc29sdmUoaW1wb3J0Lm1ldGEuZGlybmFtZSwgXCJzaGFyZWRcIiksXHJcbiAgICAgIFwiQGFzc2V0c1wiOiBwYXRoLnJlc29sdmUoaW1wb3J0Lm1ldGEuZGlybmFtZSwgXCJhdHRhY2hlZF9hc3NldHNcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgZW52RGlyOiBwYXRoLnJlc29sdmUoaW1wb3J0Lm1ldGEuZGlybmFtZSksXHJcbiAgcm9vdDogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwiY2xpZW50XCIpLFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBvdXREaXI6IHBhdGgucmVzb2x2ZShpbXBvcnQubWV0YS5kaXJuYW1lLCBcImRpc3QvcHVibGljXCIpLFxyXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDMwMDEsXHJcbiAgICBzdHJpY3RQb3J0OiBmYWxzZSwgLy8gV2lsbCBmaW5kIG5leHQgYXZhaWxhYmxlIHBvcnQgaWYgMzAwMSBpcyBidXN5XHJcbiAgICBob3N0OiB0cnVlLFxyXG4gICAgYWxsb3dlZEhvc3RzOiB0cnVlLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9hcGknOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgZnM6IHtcclxuICAgICAgc3RyaWN0OiB0cnVlLFxyXG4gICAgICBkZW55OiBbXCIqKi8uKlwiXSxcclxuICAgIH0sXHJcbiAgfSxcclxuICB0ZXN0OiB7XHJcbiAgICBnbG9iYWxzOiB0cnVlLFxyXG4gICAgZW52aXJvbm1lbnQ6IFwianNkb21cIixcclxuICAgIHJvb3Q6IFwiLlwiLFxyXG4gICAgaW5jbHVkZTogW1wiY2xpZW50L3NyYy8qKi9fX3Rlc3RzX18vKiovKi50ZXN0LnRzXCJdLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoaW1wb3J0Lm1ldGEuZGlybmFtZSwgXCJjbGllbnRcIiwgXCJzcmNcIiksXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWlSLE9BQU8saUJBQWlCO0FBQ3pTLE9BQU8sV0FBVztBQUNsQixPQUFPLFFBQVE7QUFDZixPQUFPLFVBQVU7QUFDakIsU0FBUyxvQkFBcUQ7QUFKOUQsSUFBTSxtQ0FBbUM7QUFXekMsSUFBTSxlQUFlO0FBQ3JCLElBQU0sVUFBVSxLQUFLLEtBQUssY0FBYyxhQUFhO0FBQ3JELElBQU0scUJBQXFCLElBQUksT0FBTztBQUN0QyxJQUFNLG9CQUFvQixLQUFLLE1BQU0scUJBQXFCLEdBQUc7QUFJN0QsU0FBUyxlQUFlO0FBQ3RCLE1BQUksQ0FBQyxHQUFHLFdBQVcsT0FBTyxHQUFHO0FBQzNCLE9BQUcsVUFBVSxTQUFTLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBQSxFQUMzQztBQUNGO0FB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
