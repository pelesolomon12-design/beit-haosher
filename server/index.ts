import dotenv from "dotenv";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Load environment variables from .env file
dotenv.config();

const app = express();

// Session configuration with proper environment variable handling
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-key-change-in-production';
if (process.env.NODE_ENV === 'production' && sessionSecret === 'dev-secret-key-change-in-production') {
  console.warn('WARNING: Using default session secret in production. Please set SESSION_SECRET environment variable.');
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

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
  try {
    log("Starting application initialization...");
    
    // Verify critical dependencies are available
    try {
      await import('express');
      await import('express-session');
      log("Core dependencies verified");
    } catch (depError) {
      console.error("Critical dependency missing:", depError);
      process.exit(1);
    }

    // Health check endpoint for deployment verification (before other routes)
    app.get('/health', (_req, res) => {
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    const server = await registerRoutes(app);
    log("Routes registered successfully");

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error("Application error:", {
        status,
        message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });

      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
      log("Vite development server configured");
    } else {
      serveStatic(app);
      log("Static file serving configured for production");
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`Server successfully started on port ${port}`);
      log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      log(`Health check available at: http://0.0.0.0:${port}/health`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      console.error("Server error:", {
        error: error.message,
        code: error.code,
        port: port,
        timestamp: new Date().toISOString()
      });
      
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
        process.exit(1);
      } else {
        console.error("Unexpected server error:", error);
        process.exit(1);
      }
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      log(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close((err) => {
        if (err) {
          console.error('Error during server shutdown:', err);
          process.exit(1);
        }
        
        log('Server closed successfully');
        process.exit(0);
      });
      
      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('Force shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle process signals for graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled promise rejection:', {
        reason,
        promise,
        timestamp: new Date().toISOString()
      });
      process.exit(1);
    });

  } catch (startupError) {
    console.error("Failed to start application:", {
      error: startupError instanceof Error ? startupError.message : String(startupError),
      stack: startupError instanceof Error ? startupError.stack : undefined,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
    process.exit(1);
  }
})();
