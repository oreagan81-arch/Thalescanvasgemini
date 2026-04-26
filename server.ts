import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- GitHub OAuth Endpoints ---
  
  app.get("/api/auth/github/url", (req, res) => {
    const client_id = process.env.VITE_GITHUB_CLIENT_ID;
    if (!client_id) {
      return res.status(500).json({ error: "GitHub Client ID not configured" });
    }

    const redirect_uri = `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback/github`;
    const url = `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&scope=repo`;
    
    res.json({ url });
  });

  app.get("/auth/callback/github", async (req, res) => {
    const { code } = req.query;
    const client_id = process.env.VITE_GITHUB_CLIENT_ID;
    const client_secret = process.env.GITHUB_CLIENT_SECRET;

    if (!code || !client_id || !client_secret) {
      return res.send("Missing parameters for GitHub authentication.");
    }

    try {
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id,
          client_secret,
          code,
        }),
      });

      const data = await response.json();
      
      // In a real app, we would store this token securely.
      // For this prototype, we'll send it back to the client to store in state/storage.
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS', token: '${data.access_token}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("GitHub Auth Error:", error);
      res.status(500).send("External Authentication Failed");
    }
  });

  // --- Audit Engine (Simulation) ---
  app.post("/api/audit/run", async (req, res) => {
    const { repoName } = req.body;
    // Simulate auditing a repo
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    res.json({
      status: "complete",
      results: {
        score: 94,
        findings: [
          "Lesson pacing matches Course ID deterministic rules.",
          "GitHub sync verified with Canvas Registry.",
          "No orphan conflicts detected in pilot repo."
        ],
        repo: repoName
      }
    });
  });

  // Pull Secrets Endpoint
  app.get("/api/config/canvas-token", (req, res) => {
    const token = process.env.CANVAS_API_TOKEN || process.env.VITE_CANVAS_API_TOKEN;
    if (token) {
      res.json({ token });
    } else {
      res.status(404).json({ error: "Canvas API Token not found in server environment" });
    }
  });

  // Canvas API Proxy (Avoids CORS issues)
  app.all("/api/canvas/*", async (req, res) => {
    const authHeader = req.headers.authorization;
    const clientToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const token = clientToken || process.env.CANVAS_API_TOKEN || process.env.VITE_CANVAS_API_TOKEN;
    
    if (!token) {
      return res.status(401).json({ error: "Canvas API Token missing. Please provide it in the Authorization header or server environment." });
    }

    const canvasPath = req.params[0];
    const query = new URLSearchParams(req.query as any).toString();
    const url = `https://thalesacademy.instructure.com/api/v1/${canvasPath}${query ? '?' + query : ''}`;

    try {
      const response = await fetch(url, {
        method: req.method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: ["POST", "PUT", "PATCH"].includes(req.method) ? JSON.stringify(req.body) : undefined,
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error("Canvas Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch from Canvas via proxy" });
    }
  });

  // Google Sheets Proxy
  app.get("/api/proxy/google-sheets", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Missing sheet URL" });
    }

    try {
      // Transform edit URL to export CSV URL
      let fetchUrl = url;
      if (url.includes('/edit')) {
        fetchUrl = url.replace(/\/edit.*$/, '/export?format=csv');
      } else if (!url.includes('/export')) {
        fetchUrl = url.endsWith('/') ? `${url}export?format=csv` : `${url}/export?format=csv`;
      }

      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`Google Sheets responded with ${response.status}`);
      }
      const text = await response.text();
      res.send(text);
    } catch (error) {
      console.error("Google Sheets Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch spreadsheet data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
