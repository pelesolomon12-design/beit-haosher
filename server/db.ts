import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create pool with proper error handling
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Add connection timeout and retry settings
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

// Handle pool errors to prevent uncaught exceptions
pool.on('error', (err) => {
  console.error('Database pool error:', {
    message: err.message,
    timestamp: new Date().toISOString(),
    stack: err.stack
  });
  // Don't crash the application, just log the error
});

// Handle individual connection errors
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('Database client error:', {
      message: err.message,
      timestamp: new Date().toISOString()
    });
    // Don't crash the application, just log the error
  });
});

export const db = drizzle({ client: pool, schema });