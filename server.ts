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

  // SECURITY FIX: Removed the /api/config/canvas-token endpoint.
  // The frontend should NEVER see or handle the master token.

  /**
   * Robust Canvas Request Wrapper
   * Implements exponential backoff for 429 Rate Limiting and 5xx errors
   */
  async function canvasRequest(
    method: string,
    canvasPath: string, 
    body: any = null,
    query: string = "",
    retries = 3
  ): Promise<any> {
    const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || "https://thalesacademy.instructure.com/api/v1";
    // STRICT SECURITY: Never use VITE_ prefix for this token.
    const CANVAS_TOKEN = process.env.CANVAS_API_TOKEN; 

    if (!CANVAS_TOKEN) {
      throw new Error("CANVAS_API_TOKEN not configured in environment. Do not use VITE_ prefix.");
    }

    const url = `${CANVAS_BASE_URL}/${canvasPath.replace(/^\//, '')}${query ? '?' + query : ''}`;
    
    const headers = {
      'Authorization': `Bearer ${CANVAS_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: ["POST", "PUT", "PATCH"].includes(method) ? JSON.stringify(body) : undefined,
      });
      
      // Handle Rate Limiting (429) or Server Errors (5xx)
      if ((response.status === 429 || response.status >= 500) && retries > 0) {
        const waitTime = Math.pow(2, 4 - retries) * 1000;
        console.warn(`[Canvas] ${response.status} detected. Retrying in ${waitTime}ms... (${retries} retries left)`);
        await new Promise(res => setTimeout(res, waitTime));
        return canvasRequest(method, canvasPath, body, query, retries - 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Canvas API Error (${response.status}): ${errorText}`);
      }

      // Some Canvas responses might be empty for successful DELETE or PUT
      if (response.status === 204) return { success: true };
      
      return await response.json();
    } catch (error: any) {
      if (retries > 0 && !error.message.includes('401') && !error.message.includes('403')) {
        return canvasRequest(method, canvasPath, body, query, retries - 1);
      }
      throw error;
    }
  }

  // Canvas Health Check: Verify if token is configured
  app.get("/api/canvas-status", (req, res) => {
    res.json({ configured: !!process.env.CANVAS_API_TOKEN });
  });

  // Canvas API Proxy (Avoids CORS issues and secures token)
  app.all("/api/canvas/*", async (req, res) => {
    const canvasPath = req.params[0];
    const query = new URLSearchParams(req.query as any).toString();

    try {
      const data = await canvasRequest(req.method, canvasPath, req.body, query);
      res.json(data);
    } catch (error: any) {
      console.error("Canvas Proxy Error:", error.message);
      const status = error.message.includes('401') ? 401 : error.message.includes('403') ? 403 : 500;
      res.status(status).json({ error: error.message });
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
      } else if (!url.includes('/export') && !url.includes('output=csv')) {
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
