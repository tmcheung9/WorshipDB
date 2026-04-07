import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Add health check endpoint BEFORE routes
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Google Cloud Run uses port 8080 by default
  // Replit and other platforms may use different defaults
  // this serves both the API and the client.
  const port = parseInt(process.env.PORT || '8080', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      log("⚠ DATABASE_URL is not set - database operations will not work");
      log("   Please configure DATABASE_URL in Google Cloud Run environment variables");
      return; // Skip database-dependent operations
    }

    // Ensure default admin user exists (critical for production deployment)
    setImmediate(async () => {
      try {
        const { storage } = await import("./storage");
        const bcrypt = await import("bcryptjs");

        const adminUser = await storage.getUserByUsername("admin");

        if (!adminUser) {
          log("Creating default admin user...");
          const hashedPassword = await bcrypt.hash("admin123", 10);

          await storage.createUser({
            username: "admin",
            password: hashedPassword,
            email: "admin@example.com",
            firstName: "系統管理",
            lastName: "管理員",
            role: "admin",
          });

          log("✓ Default admin user created (username: admin, password: admin123)");
          log("⚠ IMPORTANT: Change the admin password immediately after first login!");
        } else {
          log("✓ Admin user already exists");
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`⚠ Failed to ensure default admin user: ${errorMessage}`);
        log(`   Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
        // Server continues to run even if admin creation fails
      }
    });
    
    // Auto-sync from Google Drive in background with reliability tracking
    // Only sync if credentials are configured
    const hasGoogleDriveCredentials = 
      process.env.REPLIT_CONNECTORS_HOSTNAME && 
      (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL);
    
    if (!hasGoogleDriveCredentials) {
      log("⚠ Google Drive credentials not configured - skipping automatic sync");
      log("   Use manual sync button in admin dashboard to sync when credentials are available");
      return;
    }
    
    // Non-blocking background sync with exponential backoff and failure tracking
    setImmediate(async () => {
      try {
        const { storage } = await import("./storage");
        
        log("Starting initial background sync from Google Drive with reliability tracking...");
        const result = await storage.performSyncWithTracking(false); // isManual = false
        
        if (result.success) {
          log(`✓ ${result.message}`);
        } else {
          log(`⚠ ${result.message}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`⚠ Background sync error: ${errorMessage}`);
        // Server continues to run even if sync fails completely
      }
    });
    
    // Set up periodic auto-sync every 30 minutes
    const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
    setInterval(async () => {
      try {
        const { storage } = await import("./storage");
        
        log("Starting periodic auto-sync from Google Drive...");
        const result = await storage.performSyncWithTracking(false); // isManual = false
        
        if (result.success) {
          log(`✓ Periodic sync: ${result.message}`);
        } else {
          log(`⚠ Periodic sync: ${result.message}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`⚠ Periodic sync error: ${errorMessage}`);
        // Server continues to run even if periodic sync fails
      }
    }, SYNC_INTERVAL_MS);
    
    log(`✓ Periodic auto-sync enabled (every 30 minutes)`);
  });
})();
