# Deployment Checklist for ניו לייף Room Management System

## Environment Variables Required for Production

### Required
- `NODE_ENV=production` - Enables production mode
- `PORT` - Server port (automatically set by Replit)

### Recommended  
- `SESSION_SECRET` - Secure session secret key for production
  - Generate with: `openssl rand -base64 32`
  - Without this, a warning will be displayed but the app will still work

## Health Check Endpoint
- `GET /health` - Returns application status and environment information
- Use this endpoint to verify deployment success

## Startup Verification
The application now includes:
- ✅ Dependency verification on startup
- ✅ Comprehensive error logging with timestamps
- ✅ Graceful shutdown handling
- ✅ Port configuration validation
- ✅ Session configuration with environment variable support
- ✅ Health check endpoint for deployment verification
- ✅ Process signal handling (SIGTERM, SIGINT)
- ✅ Uncaught exception and unhandled rejection handling

## Production Build Process
1. `npm run build` - Builds frontend and backend
2. `npm start` - Runs production server
3. Server binds to `0.0.0.0:5000` (or PORT env var)
4. Health check available at `/health`

## Logs to Monitor
- Application startup logs with timestamps
- Error logs with stack traces
- Session configuration warnings
- Server binding confirmation
- Health check responses