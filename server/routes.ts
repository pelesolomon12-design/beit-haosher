import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { insertOccupantSchema, insertRoomSchema, updateRoomSchema, insertDailyTaskSchema, updateDailyTaskSchema, insertEventSchema, updateEventSchema, insertDailyNoteSchema, insertWeeklyNoteSchema, duplicateScheduleSchema, duplicateManagementWeekSchema, insertTargetInventorySchema, updateTargetInventorySchema, insertShoppingListSchema, updateShoppingListSchema, insertStaffMemberSchema, updateStaffMemberSchema, insertScheduleEventSchema, updateScheduleEventSchema, insertMedicationSchema, updateMedicationSchema, insertMedicationLogSchema, insertCustomCategorySchema, updateCustomCategorySchema, cashFlowAuthSchema, insertCashFlowTransactionSchema, updateCashFlowTransactionSchema, insertCashFlowCategorySchema, updateCashFlowCategorySchema, insertCashFlowCreditCardSchema, updateCashFlowCreditCardSchema, insertSosMedicationSchema, updateSosMedicationSchema, insertSosMedicationLogSchema } from "@shared/schema";
import { z } from "zod";
import webpush from "web-push";

// Web Push VAPID keys - generate new ones if needed
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BNxkVGmtCuHg4r_rIKKqXpDu8wm6H6r1cKPKZG_5K7FqM2kYQW6rS_8L4U-8R2qU_0YWmTqN8VKjZ3fS7m6HVXY';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'k3L2y9vBfR_pM4sN8xJ7wQ_zT6cH1gE5dA0iY3uO2rK';

webpush.setVapidDetails(
  'mailto:admin@newlife.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Send push notification to all subscribers
async function sendPushNotification(title: string, body: string, data: any = {}) {
  try {
    const subscriptions = await storage.getAllPushSubscriptions();
    console.log(`[Push] Sending notification to ${subscriptions.length} subscriber(s): "${title}"`);
    
    if (subscriptions.length === 0) {
      console.log('[Push] No subscribers found - notification not sent');
      return;
    }
    
    const notifications = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify({ title, body, data })
        );
        console.log('[Push] Notification sent successfully to:', sub.endpoint.substring(0, 50) + '...');
      } catch (error: any) {
        console.error('[Push] Error sending notification to', sub.endpoint.substring(0, 50), error.message);
        // Remove invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('[Push] Removing invalid subscription');
          await storage.deletePushSubscription(sub.endpoint);
        }
      }
    });
    await Promise.all(notifications);
  } catch (error) {
    console.error('[Push] Error sending push notifications:', error);
  }
}

// Store connected WebSocket clients
const connectedClients = new Set<WebSocket>();

// Security: PIN verification rate limiting
const pinAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

// Security: Session store for authenticated users
const authenticatedSessions = new Set<string>();

// Medical data filtering interface
interface PublicOccupant {
  id: string;
  name: string;
  roomId: string;
  gender: string;
  joinDate: Date;
  endDateTime: Date;
  stayingProbability: string;
  plannedMonths: number;
  paidMonths: number;
  deposits: number | null;
  // Explicitly exclude medical data: medicalTreatment, privateConsultation, notes, contact info
}

// Security: Authentication middleware for medical data access
function requireMedicalAuthentication(req: any, res: any, next: any) {
  const sessionToken = req.cookies?.medical_session;
  const isAuthenticated = sessionToken && authenticatedSessions.has(sessionToken);
  
  if (!isAuthenticated) {
    return res.status(401).json({ error: "גישה לנתונים רפואיים דורשת אימות", requiresAuth: true });
  }
  
  next();
}

// Security: Check authentication status
function checkAuthentication(req: any): boolean {
  const sessionToken = req.cookies?.medical_session;
  return sessionToken && authenticatedSessions.has(sessionToken);
}

// Security: Filter medical data from occupant objects
function filterMedicalData(occupant: any, isAuthenticated: boolean): PublicOccupant | any {
  console.log('FilterMedicalData called:', { isAuthenticated, occupantId: occupant?.id });
  
  if (isAuthenticated) {
    console.log('User authenticated, returning full data');
    return occupant; // Return full data if authenticated
  }
  
  // Return filtered data without sensitive medical information
  // But keep flags to indicate medical data exists for UI purposes
  // NOTES: Always visible based on registration data (user requirement)
  const { medicalTreatment, privateConsultation, contactName, contactPhone, contactRelationship, clientPhone, safeItems, ...publicData } = occupant;
  
  // Add flags to indicate existence of medical data without exposing the content
  const filteredData = {
    ...publicData,
    // Keep notes field always visible - user requirement for registration-based visibility
    notes: occupant.notes || '',
    // Add flags for UI to know medical data exists
    hasMedicalTreatment: !!(medicalTreatment && medicalTreatment.trim()),
    hasNotes: !!(occupant.notes && occupant.notes.trim()),
    hasPrivateConsultation: !!privateConsultation,
    hasContactInfo: !!(contactName || contactPhone),
    hasSafeItems: !!(safeItems && safeItems.trim()),
    // Keep other sensitive medical data as empty strings for UI compatibility
    medicalTreatment: '',
    privateConsultation: null,
    contactName: '',
    contactPhone: '',
    contactRelationship: '',
    clientPhone: '',
    safeItems: ''
  };
  
  console.log('Filtered data flags:', {
    hasMedicalTreatment: filteredData.hasMedicalTreatment,
    hasNotes: filteredData.hasNotes,
    hasPrivateConsultation: filteredData.hasPrivateConsultation,
    hasContactInfo: filteredData.hasContactInfo
  });
  
  return filteredData;
}

// Security: Filter medical data from arrays of occupants
function filterOccupantArray(occupants: any[], isAuthenticated: boolean): (PublicOccupant | any)[] {
  return occupants.map(occupant => filterMedicalData(occupant, isAuthenticated));
}

// Date validation schema for YYYY-MM-DD format
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD");

// Enhanced date validation with Hebrew error messages
interface DateValidationResult {
  isValid: boolean;
  date?: Date;
  error?: string;
}

function validateAndParseDate(dateString: string): DateValidationResult {
  try {
    // First check format using existing schema
    const formatValidation = dateStringSchema.safeParse(dateString);
    if (!formatValidation.success) {
      return {
        isValid: false,
        error: "פורמט התאריך שגוי. יש להשתמש בפורמט YYYY-MM-DD"
      };
    }
    
    // Parse the date using safe parsing
    const date = parseUTCDate(dateString);
    
    // Check if the date is valid (not NaN)
    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        error: "התאריך שהוזן אינו תקין"
      };
    }
    
    // Additional validation: Check if the parsed date matches the input
    // This catches cases like "2025-02-30" which gets parsed as "2025-03-02"
    const recreatedDateString = date.toISOString().split('T')[0];
    if (recreatedDateString !== dateString) {
      return {
        isValid: false,
        error: "התאריך שהוזן אינו קיים בלוח השנה"
      };
    }
    
    return {
      isValid: true,
      date: date
    };
  } catch (error) {
    return {
      isValid: false,
      error: "שגיאה בעיבוד התאריך"
    };
  }
}

// Validate multiple dates and return validation results
function validateMultipleDates(dateStrings: string[]): { validDates: Date[], invalidDates: Array<{date: string, error: string}> } {
  const validDates: Date[] = [];
  const invalidDates: Array<{date: string, error: string}> = [];
  
  for (const dateStr of dateStrings) {
    const validation = validateAndParseDate(dateStr);
    if (validation.isValid && validation.date) {
      validDates.push(validation.date);
    } else {
      invalidDates.push({
        date: dateStr,
        error: validation.error || "תאריך לא תקין"
      });
    }
  }
  
  return { validDates, invalidDates };
}

// Helper function for timezone-safe date parsing (kept for backward compatibility)
function parseUTCDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00Z`);
}

// Helper function to get current date as UTC date (without time)
function getCurrentUTCDate(): Date {
  const now = new Date();
  const dateString = now.toISOString().split('T')[0]; // Get YYYY-MM-DD
  return parseUTCDate(dateString);
}

// Helper function to check if a date is empty (no tasks AND no events)
// Profile events from occupant data don't count as "occupied"
async function isDateEmpty(date: Date): Promise<boolean> {
  try {
    // Validate that the date is a valid Date object before database operations
    if (!date || isNaN(date.getTime())) {
      console.error('Invalid date object passed to isDateEmpty:', date);
      throw new Error('Invalid date object provided');
    }
    
    const [tasks, events] = await Promise.all([
      storage.getDailyTasks(date),
      storage.getEvents(date)
    ]);
    
    // Date is empty if it has no tasks AND no events
    return tasks.length === 0 && events.length === 0;
  } catch (error) {
    console.error('Error checking if date is empty:', error, {
      dateValue: date,
      dateISO: date instanceof Date ? date.toISOString() : 'Not a Date object',
      isValidDate: date instanceof Date && !isNaN(date.getTime())
    });
    throw error;
  }
}

// Helper function to copy tasks and events from source date to target date
async function copyScheduleData(sourceDate: Date, targetDate: Date): Promise<{copiedTasks: number, copiedEvents: number}> {
  try {
    const [sourceTasks, sourceEvents] = await Promise.all([
      storage.getDailyTasks(sourceDate),
      storage.getEvents(sourceDate)
    ]);
    
    let copiedTasks = 0;
    let copiedEvents = 0;
    
    // Copy all tasks from source to target date
    for (const task of sourceTasks) {
      await storage.createDailyTask({
        date: targetDate,
        name: task.name,
        time: task.time,
        occupantId: task.occupantId,
        note: task.note,
      });
      copiedTasks++;
    }
    
    // Copy all events from source to target date
    for (const event of sourceEvents) {
      await storage.createEvent({
        date: targetDate,
        name: event.name,
        time: event.time,
        note: event.note,
        color: (event.color as 'purple' | 'blue' | 'orange' | 'gold') || 'purple',
      });
      copiedEvents++;
    }
    
    return { copiedTasks, copiedEvents };
  } catch (error) {
    console.error('Error copying schedule data:', error);
    throw error;
  }
}

// Security: Enhanced broadcast function that filters medical data based on client authentication
function broadcastUpdate(type: string, data: any, originalRequest?: any) {
  // For medical data, we need to broadcast filtered versions to unauthenticated clients
  const isMedicalData = type.includes('occupant') || (data && (data.medicalTreatment !== undefined || data.privateConsultation !== undefined));
  
  if (isMedicalData && data) {
    // Filter medical data for broadcast - only send public information
    const publicData = filterMedicalData(data, false); // Always filter for broadcasts
    const message = JSON.stringify({ type, data: publicData });
    
    connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  } else {
    // Non-medical data can be broadcast normally
    const message = JSON.stringify({ type, data });
    connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Security: PIN verification endpoint
  app.post("/api/verify-pin", async (req, res) => {
    try {
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      
      // Check rate limiting
      const attempts = pinAttempts.get(clientIp);
      if (attempts) {
        if (attempts.count >= MAX_PIN_ATTEMPTS) {
          const timeSinceLastAttempt = now - attempts.lastAttempt;
          if (timeSinceLastAttempt < PIN_LOCKOUT_TIME) {
            const remainingTime = Math.ceil((PIN_LOCKOUT_TIME - timeSinceLastAttempt) / (60 * 1000));
            return res.status(429).json({ 
              error: `יותר מדי ניסיונות שגויים. נסה שוב בעוד ${remainingTime} דקות`,
              lockedOut: true,
              remainingTime
            });
          } else {
            // Reset attempts after lockout period
            pinAttempts.delete(clientIp);
          }
        }
      }

      const { pin } = req.body;
      
      // Validate PIN format
      if (!pin || typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "PIN חייב להיות בן 4 ספרות" });
      }

      // Secure PIN validation (require environment variable, no defaults)
      const correctPin = process.env.MEDICAL_PIN;
      
      if (!correctPin) {
        console.error('SECURITY ERROR: MEDICAL_PIN environment variable not set');
        return res.status(500).json({ error: "שגיאת תצורת אבטחה - פנה למנהל המערכת" });
      }
      
      if (pin === correctPin) {
        // Generate session token
        const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        authenticatedSessions.add(sessionToken);
        
        // Clear any previous failed attempts
        pinAttempts.delete(clientIp);
        
        // Set session cookie (secure in production)
        res.cookie('medical_session', sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 60 * 1000 // 30 minutes
        });
        
        res.json({ success: true, sessionToken });
      } else {
        // Record failed attempt
        if (attempts) {
          attempts.count++;
          attempts.lastAttempt = now;
        } else {
          pinAttempts.set(clientIp, { count: 1, lastAttempt: now });
        }
        
        const remainingAttempts = MAX_PIN_ATTEMPTS - (attempts?.count || 1);
        res.status(401).json({ 
          error: "PIN שגוי",
          remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0
        });
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      res.status(500).json({ error: "שגיאה פנימית בשרת" });
    }
  });

  // Security: Check authentication status
  app.get("/api/auth-status", async (req, res) => {
    try {
      const sessionToken = req.cookies?.medical_session;
      const isAuthenticated = sessionToken && authenticatedSessions.has(sessionToken);
      res.json({ authenticated: isAuthenticated });
    } catch (error) {
      console.error('Auth status check error:', error);
      res.status(500).json({ error: "שגיאה פנימית בשרת" });
    }
  });

  // Security: Logout endpoint
  app.post("/api/logout", async (req, res) => {
    try {
      const sessionToken = req.cookies?.medical_session;
      if (sessionToken) {
        authenticatedSessions.delete(sessionToken);
        res.clearCookie('medical_session');
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: "שגיאה פנימית בשרת" });
    }
  });

  // Get all rooms
  app.get("/api/rooms", async (req, res) => {
    try {
      const rooms = await storage.getAllRooms();
      res.json(rooms);
    } catch (error) {
      console.error('Get rooms error:', error);
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  // Get all occupants (with medical data filtering based on authentication)
  app.get("/api/occupants", async (req, res) => {
    try {
      console.log('GET /api/occupants called');
      const occupants = await storage.getAllOccupants();
      console.log('Raw occupants from storage:', occupants.length, 'occupants');
      console.log('Occupants medical data summary:', {
        totalOccupants: occupants.length,
        occupantsWithMedicalData: occupants.filter(o => o.medicalTreatment && o.medicalTreatment.trim()).length,
        occupantsWithNotes: occupants.filter(o => o.notes && o.notes.trim()).length
      });
      
      const isAuthenticated = checkAuthentication(req);
      console.log('Authentication status:', isAuthenticated);
      
      // Filter medical data based on authentication status
      const filteredOccupants = filterOccupantArray(occupants, isAuthenticated);
      console.log('Filtered occupants returned');
      
      res.json(filteredOccupants);
    } catch (error) {
      console.error('Get occupants error:', error);
      res.status(500).json({ error: "Failed to fetch occupants" });
    }
  });

  // Get occupants by room (with medical data filtering based on authentication)
  app.get("/api/rooms/:roomId/occupants", async (req, res) => {
    try {
      const { roomId } = req.params;
      const occupants = await storage.getOccupantsByRoom(roomId);
      const isAuthenticated = checkAuthentication(req);
      
      // Filter medical data based on authentication status
      const filteredOccupants = filterOccupantArray(occupants, isAuthenticated);
      
      res.json(filteredOccupants);
    } catch (error) {
      console.error('Get room occupants error:', error);
      res.status(500).json({ error: "Failed to fetch room occupants" });
    }
  });

  // Create new occupant (medical data requires authentication)
  app.post("/api/occupants", async (req, res) => {
    try {
      // Parse dates and numbers from strings
      const requestData = {
        ...req.body,
        joinDate: req.body.joinDate ? new Date(req.body.joinDate) : new Date(),
        endDateTime: new Date(req.body.endDateTime),
        ...(req.body.plannedExitStart && { plannedExitStart: new Date(req.body.plannedExitStart) }),
        ...(req.body.plannedExitEnd && { plannedExitEnd: new Date(req.body.plannedExitEnd) }),
        plannedMonths: typeof req.body.plannedMonths === 'string' ? parseInt(req.body.plannedMonths) : req.body.plannedMonths,
        paidMonths: typeof req.body.paidMonths === 'string' ? parseInt(req.body.paidMonths) : req.body.paidMonths,
        deposits: typeof req.body.deposits === 'string' ? parseInt(req.body.deposits) || 0 : req.body.deposits,
        safeItems: req.body.safeItems || '',
        medicalTreatment: req.body.medicalTreatment || '',
        privateConsultation: req.body.privateConsultation && req.body.privateConsultation.trim() !== '' ? new Date(req.body.privateConsultation) : undefined
      };
      
      const result = insertOccupantSchema.safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: result.error.issues 
        });
      }
      
      const occupant = await storage.createOccupant(result.data);
      
      // Broadcast the new occupant to all connected clients (filtered for medical data)
      broadcastUpdate('occupant_created', occupant, req);
      
      // For newly created occupants, if medical data was provided in the request,
      // show it in the response regardless of authentication status
      // This improves UX - user should see what they just entered
      const isAuthenticated = checkAuthentication(req);
      const hasMedicalDataInRequest = !!(req.body.medicalTreatment || req.body.notes);
      const shouldShowMedicalData = isAuthenticated || hasMedicalDataInRequest;
      
      const filteredOccupant = filterMedicalData(occupant, shouldShowMedicalData);
      
      res.status(201).json(filteredOccupant);
    } catch (error) {
      console.error('Create occupant error:', error);
      res.status(500).json({ error: "Failed to create occupant" });
    }
  });

  // Update occupant (medical data requires authentication)
  app.put("/api/occupants/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse dates and numbers from strings
      const requestData = {
        ...req.body,
        ...(req.body.joinDate && { joinDate: new Date(req.body.joinDate) }),
        ...(req.body.endDateTime && { endDateTime: new Date(req.body.endDateTime) }),
        ...(req.body.plannedExitStart && { plannedExitStart: new Date(req.body.plannedExitStart) }),
        ...(req.body.plannedExitEnd && { plannedExitEnd: new Date(req.body.plannedExitEnd) }),
        ...(req.body.plannedMonths && { plannedMonths: parseInt(req.body.plannedMonths) }),
        ...(req.body.paidMonths && { paidMonths: parseInt(req.body.paidMonths) }),
        ...(req.body.deposits && { deposits: typeof req.body.deposits === 'string' ? parseInt(req.body.deposits) || 0 : req.body.deposits }),
        safeItems: req.body.safeItems || '',
        ...(req.body.privateConsultation && { privateConsultation: new Date(req.body.privateConsultation) })
      };

      const partialSchema = insertOccupantSchema.partial();
      const result = partialSchema.safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: result.error.issues 
        });
      }

      const occupant = await storage.updateOccupant(id, result.data);
      if (!occupant) {
        return res.status(404).json({ error: "Occupant not found" });
      }

      // Broadcast the updated occupant to all connected clients (filtered for medical data)
      broadcastUpdate('occupant_updated', occupant, req);

      // For updates, if medical data was provided in the request,
      // show it in the response regardless of authentication status
      const isAuthenticated = checkAuthentication(req);
      const hasMedicalDataInRequest = !!(req.body.medicalTreatment || req.body.notes);
      const shouldShowMedicalData = isAuthenticated || hasMedicalDataInRequest;
      
      const filteredOccupant = filterMedicalData(occupant, shouldShowMedicalData);

      res.json(filteredOccupant);
    } catch (error) {
      console.error('Update occupant error:', error);
      res.status(500).json({ error: "Failed to update occupant" });
    }
  });

  // Delete occupant
  app.delete("/api/occupants/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteOccupant(id);
      
      if (!success) {
        return res.status(404).json({ error: "Occupant not found" });
      }

      // Broadcast the deletion to all connected clients
      broadcastUpdate('occupant_deleted', { id }, req);

      res.json({ success: true });
    } catch (error) {
      console.error('Delete occupant error:', error);
      res.status(500).json({ error: "Failed to delete occupant" });
    }
  });

  // Room management routes
  
  // Create new room
  app.post("/api/rooms", async (req, res) => {
    try {
      const result = insertRoomSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: result.error.issues 
        });
      }

      const room = await storage.createRoom(result.data);
      
      // Broadcast the new room to all connected clients
      broadcastUpdate('room_created', room);
      
      res.status(201).json(room);
    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({ error: "Failed to create room" });
    }
  });

  // Update room
  app.put("/api/rooms/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = updateRoomSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: result.error.issues 
        });
      }

      const room = await storage.updateRoom(id, result.data);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      // Broadcast the updated room to all connected clients
      broadcastUpdate('room_updated', room);

      res.json(room);
    } catch (error) {
      console.error('Update room error:', error);
      res.status(500).json({ error: "Failed to update room" });
    }
  });

  // Delete room
  app.delete("/api/rooms/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteRoom(id);
      if (!success) {
        return res.status(400).json({ error: "Cannot delete room with occupants or room not found" });
      }

      // Broadcast the room deletion to all connected clients
      broadcastUpdate('room_deleted', { id });

      res.json({ success: true });
    } catch (error) {
      console.error('Delete room error:', error);
      res.status(500).json({ error: "Failed to delete room" });
    }
  });

  // Calendar management routes
  
  // Check date availability for multiple dates (used by calendar picker)
  app.get("/api/check-dates-availability", async (req, res) => {
    try {
      const { dates } = req.query;
      if (!dates || typeof dates !== 'string') {
        return res.status(400).json({ error: "נדרש פרמטר dates" });
      }
      
      // Parse comma-separated date strings
      const dateStrings = dates.split(',').filter(d => d.trim());
      if (dateStrings.length === 0) {
        return res.status(400).json({ error: "לא סופקו תאריכים תקינים" });
      }
      
      // Validate date format and check availability
      const availabilityChecks = await Promise.all(
        dateStrings.map(async (dateStr) => {
          const trimmedDateStr = dateStr.trim();
          
          // Use enhanced date validation
          const validation = validateAndParseDate(trimmedDateStr);
          if (!validation.isValid) {
            return {
              date: trimmedDateStr,
              available: false,
              error: validation.error || "תאריך לא תקין"
            };
          }
          
          // Check if date is empty with error handling
          try {
            const isEmpty = await isDateEmpty(validation.date!);
            return {
              date: trimmedDateStr,
              available: isEmpty,
              error: null
            };
          } catch (error) {
            console.error(`Error checking availability for date ${trimmedDateStr}:`, error);
            return {
              date: trimmedDateStr,
              available: false,
              error: "שגיאה בבדיקת זמינות התאריך"
            };
          }
        })
      );
      
      res.json(availabilityChecks);
    } catch (error) {
      console.error('Check dates availability error:', error);
      res.status(500).json({ error: "שגיאה בבדיקת זמינות התאריכים" });
    }
  });

  // Get daily tasks (optionally filtered by date)
  app.get("/api/daily-tasks", async (req, res) => {
    try {
      const { date } = req.query;
      let filterDate: Date | undefined;
      
      if (date) {
        // Validate date format using Zod
        const dateValidation = dateStringSchema.safeParse(date);
        if (!dateValidation.success) {
          return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }
        
        // Parse date using timezone-safe method
        filterDate = parseUTCDate(dateValidation.data);
      }
      
      const tasks = await storage.getDailyTasks(filterDate);
      res.json(tasks);
    } catch (error) {
      console.error('Get daily tasks error:', error);
      res.status(500).json({ error: "Failed to fetch daily tasks" });
    }
  });

  // Create new daily task
  app.post("/api/daily-tasks", async (req, res) => {
    try {
      // Validate and parse date from string with safe parsing
      let parsedDate: Date;
      if (req.body.date) {
        const dateValidation = dateStringSchema.safeParse(req.body.date);
        if (!dateValidation.success) {
          return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }
        parsedDate = parseUTCDate(dateValidation.data);
      } else {
        parsedDate = getCurrentUTCDate();
      }
      
      const requestData = {
        ...req.body,
        date: parsedDate,
      };

      const result = insertDailyTaskSchema.safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: result.error.issues 
        });
      }

      const task = await storage.createDailyTask(result.data);
      
      // Broadcast the new task to all connected clients
      broadcastUpdate('daily_task_created', task);
      
      res.status(201).json(task);
    } catch (error) {
      console.error('Create daily task error:', error);
      res.status(500).json({ error: "Failed to create daily task" });
    }
  });

  // Update daily task
  app.put("/api/daily-tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse date from string if provided with safe parsing
      const requestData = {
        ...req.body,
        ...(req.body.date && {
          date: (() => {
            const dateValidation = dateStringSchema.safeParse(req.body.date);
            if (!dateValidation.success) {
              throw new Error("Invalid date format. Use YYYY-MM-DD");
            }
            return parseUTCDate(dateValidation.data);
          })()
        }),
      };

      const result = updateDailyTaskSchema.safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: result.error.issues 
        });
      }

      const task = await storage.updateDailyTask(id, result.data);
      if (!task) {
        return res.status(404).json({ error: "Daily task not found" });
      }

      // Broadcast the updated task to all connected clients
      broadcastUpdate('daily_task_updated', task);
      
      res.json(task);
    } catch (error) {
      console.error('Update daily task error:', error);
      res.status(500).json({ error: "Failed to update daily task" });
    }
  });

  // Delete daily task
  app.delete("/api/daily-tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteDailyTask(id);
      
      if (!success) {
        return res.status(404).json({ error: "Daily task not found" });
      }

      // Broadcast the deletion to all connected clients
      broadcastUpdate('daily_task_deleted', { id });

      res.json({ success: true });
    } catch (error) {
      console.error('Delete daily task error:', error);
      res.status(500).json({ error: "Failed to delete daily task" });
    }
  });

  // Event API routes
  // Get events (optionally filtered by date)
  app.get("/api/events", async (req, res) => {
    try {
      const { date } = req.query;
      let filterDate: Date | undefined;
      
      if (date) {
        // Validate date format using Zod
        const dateValidation = dateStringSchema.safeParse(date);
        if (!dateValidation.success) {
          return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }
        
        // Parse date using timezone-safe method
        filterDate = parseUTCDate(dateValidation.data);
      }
      
      const events = await storage.getEvents(filterDate);
      res.json(events);
    } catch (error) {
      console.error('Get events error:', error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // Create new event
  app.post("/api/events", async (req, res) => {
    try {
      // Validate and parse date from string with safe parsing
      let parsedDate: Date;
      if (req.body.date) {
        const dateValidation = dateStringSchema.safeParse(req.body.date);
        if (!dateValidation.success) {
          return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }
        parsedDate = parseUTCDate(dateValidation.data);
      } else {
        parsedDate = getCurrentUTCDate();
      }
      
      const requestData = {
        ...req.body,
        date: parsedDate,
      };

      const result = insertEventSchema.safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: result.error.issues 
        });
      }

      const event = await storage.createEvent(result.data);
      
      // Broadcast the new event to all connected clients
      broadcastUpdate('event_created', event);
      
      res.status(201).json(event);
    } catch (error) {
      console.error('Create event error:', error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  // Update event
  app.put("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Parse date from string if provided with safe parsing
      const requestData = {
        ...req.body,
        ...(req.body.date && {
          date: (() => {
            const dateValidation = dateStringSchema.safeParse(req.body.date);
            if (!dateValidation.success) {
              throw new Error("Invalid date format. Use YYYY-MM-DD");
            }
            return parseUTCDate(dateValidation.data);
          })()
        }),
      };

      const result = updateEventSchema.safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: result.error.issues 
        });
      }

      const event = await storage.updateEvent(id, result.data);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      // Broadcast the updated event to all connected clients
      broadcastUpdate('event_updated', event);
      
      res.json(event);
    } catch (error) {
      console.error('Update event error:', error);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  // Delete event
  app.delete("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteEvent(id);
      
      if (!success) {
        return res.status(404).json({ error: "Event not found" });
      }

      // Broadcast the deletion to all connected clients
      broadcastUpdate('event_deleted', { id });

      res.json({ success: true });
    } catch (error) {
      console.error('Delete event error:', error);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  // Get daily note for specific date
  app.get("/api/daily-notes/:date", async (req, res) => {
    try {
      const { date } = req.params;
      
      // Validate date format using Zod
      const dateValidation = dateStringSchema.safeParse(date);
      if (!dateValidation.success) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      // Parse date using timezone-safe method
      const targetDate = parseUTCDate(dateValidation.data);
      
      const note = await storage.getDailyNote(targetDate);
      
      if (!note) {
        return res.status(404).json({ error: "Daily note not found" });
      }
      
      res.json(note);
    } catch (error) {
      console.error('Get daily note error:', error);
      res.status(500).json({ error: "Failed to fetch daily note" });
    }
  });

  // Create or update daily note
  app.post("/api/daily-notes", async (req, res) => {
    try {
      // Validate and parse date from string with safe parsing
      let parsedDate: Date;
      if (req.body.date) {
        const dateValidation = dateStringSchema.safeParse(req.body.date);
        if (!dateValidation.success) {
          return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }
        parsedDate = parseUTCDate(dateValidation.data);
      } else {
        parsedDate = getCurrentUTCDate();
      }
      
      const requestData = {
        ...req.body,
        date: parsedDate,
      };

      const result = insertDailyNoteSchema.safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: result.error.issues 
        });
      }

      // Check if note already exists to determine proper status code
      const existingNote = await storage.getDailyNote(result.data.date);
      const isUpdate = !!existingNote;

      const note = await storage.createOrUpdateDailyNote(result.data);
      
      // Broadcast the note change to all connected clients
      broadcastUpdate('daily_note_updated', note);
      
      // Return 200 for updates, 201 for new notes
      res.status(isUpdate ? 200 : 201).json(note);
    } catch (error) {
      console.error('Create/update daily note error:', error);
      res.status(500).json({ error: "Failed to create or update daily note" });
    }
  });

  // Delete daily note for specific date
  app.delete("/api/daily-notes/:date", async (req, res) => {
    try {
      const { date } = req.params;
      
      // Validate date format using Zod
      const dateValidation = dateStringSchema.safeParse(date);
      if (!dateValidation.success) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      // Parse date using timezone-safe method
      const targetDate = parseUTCDate(dateValidation.data);
      
      const success = await storage.deleteDailyNote(targetDate);
      
      if (!success) {
        return res.status(404).json({ error: "Daily note not found" });
      }

      // Broadcast the deletion to all connected clients
      broadcastUpdate('daily_note_deleted', { date });

      res.json({ success: true });
    } catch (error) {
      console.error('Delete daily note error:', error);
      res.status(500).json({ error: "Failed to delete daily note" });
    }
  });

  // Get weekly note for specific week start date
  app.get("/api/weekly-notes/:weekStartDate", async (req, res) => {
    try {
      const { weekStartDate } = req.params;
      
      // Validate date format using Zod
      const dateValidation = dateStringSchema.safeParse(weekStartDate);
      if (!dateValidation.success) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      // Parse date using timezone-safe method
      const targetDate = parseUTCDate(dateValidation.data);
      
      const note = await storage.getWeeklyNote(targetDate);
      
      if (!note) {
        return res.status(404).json({ error: "Weekly note not found" });
      }
      
      res.json(note);
    } catch (error) {
      console.error('Get weekly note error:', error);
      res.status(500).json({ error: "Failed to fetch weekly note" });
    }
  });

  // Create or update weekly note
  app.post("/api/weekly-notes", async (req, res) => {
    try {
      // Validate and parse date from string with safe parsing
      let parsedDate: Date;
      if (req.body.weekStartDate) {
        const dateValidation = dateStringSchema.safeParse(req.body.weekStartDate);
        if (!dateValidation.success) {
          return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }
        parsedDate = parseUTCDate(dateValidation.data);
      } else {
        return res.status(400).json({ error: "weekStartDate is required" });
      }
      
      const requestData = {
        ...req.body,
        weekStartDate: parsedDate,
      };

      const result = insertWeeklyNoteSchema.safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: result.error.issues 
        });
      }

      // Check if note already exists to determine proper status code
      const existingNote = await storage.getWeeklyNote(result.data.weekStartDate);
      const isUpdate = !!existingNote;

      const note = await storage.createOrUpdateWeeklyNote(result.data);
      
      // Broadcast the note change to all connected clients
      broadcastUpdate('weekly_note_updated', note);
      
      // Return 200 for updates, 201 for new notes
      res.status(isUpdate ? 200 : 201).json(note);
    } catch (error) {
      console.error('Create/update weekly note error:', error);
      res.status(500).json({ error: "Failed to create or update weekly note" });
    }
  });

  // Delete weekly note for specific week start date
  app.delete("/api/weekly-notes/:weekStartDate", async (req, res) => {
    try {
      const { weekStartDate } = req.params;
      
      // Validate date format using Zod
      const dateValidation = dateStringSchema.safeParse(weekStartDate);
      if (!dateValidation.success) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      // Parse date using timezone-safe method
      const targetDate = parseUTCDate(dateValidation.data);
      
      const success = await storage.deleteWeeklyNote(targetDate);
      
      if (!success) {
        return res.status(404).json({ error: "Weekly note not found" });
      }

      // Broadcast the deletion to all connected clients
      broadcastUpdate('weekly_note_deleted', { weekStartDate });

      res.json({ success: true });
    } catch (error) {
      console.error('Delete weekly note error:', error);
      res.status(500).json({ error: "Failed to delete weekly note" });
    }
  });

  // Duplicate schedule endpoint
  app.post("/api/duplicate-schedule", async (req, res) => {
    try {
      // Validate request body using Zod schema
      const result = duplicateScheduleSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: result.error.issues 
        });
      }

      const validatedData = result.data;
      let sourceDates: string[];
      let targetDates: string[];

      // Handle both single and bulk operations
      if ('sourceDate' in validatedData && 'targetDate' in validatedData) {
        // Single date operation
        sourceDates = [validatedData.sourceDate];
        targetDates = [validatedData.targetDate];
      } else {
        // Bulk operation
        sourceDates = validatedData.sourceDates;
        targetDates = validatedData.targetDates;
      }

      // Validate and convert source dates
      const sourceValidation = validateMultipleDates(sourceDates);
      if (sourceValidation.invalidDates.length > 0) {
        return res.status(400).json({
          error: "תאריכי מקור לא תקינים",
          invalidSourceDates: sourceValidation.invalidDates,
          message: "כל תאריכי המקור חייבים להיות תקינים כדי לבצע העתקה"
        });
      }

      // Validate and convert target dates  
      const targetValidation = validateMultipleDates(targetDates);
      if (targetValidation.invalidDates.length > 0) {
        return res.status(400).json({
          error: "תאריכי יעד לא תקינים",
          invalidTargetDates: targetValidation.invalidDates,
          message: "כל תאריכי היעד חייבים להיות תקינים כדי לבצע העתקה"
        });
      }

      const sourceDateObjects = sourceValidation.validDates;
      const targetDateObjects = targetValidation.validDates;

      // Check if all target dates are empty before proceeding
      const emptyChecks = await Promise.all(
        targetDateObjects.map(async (targetDate, index) => {
          try {
            const isEmpty = await isDateEmpty(targetDate);
            return { 
              date: targetDates[index], 
              isEmpty, 
              targetDate 
            };
          } catch (error) {
            console.error(`Error checking if date ${targetDates[index]} is empty:`, error);
            return { 
              date: targetDates[index], 
              isEmpty: false, // Assume not empty on error to be safe
              targetDate,
              error: "שגיאה בבדיקת זמינות התאריך"
            };
          }
        })
      );

      // Find any non-empty target dates or dates with errors
      const problemDates = emptyChecks.filter(check => !check.isEmpty || check.error);
      if (problemDates.length > 0) {
        const nonEmptyDates = problemDates.filter(check => !check.isEmpty && !check.error);
        const errorDates = problemDates.filter(check => check.error);
        
        if (errorDates.length > 0) {
          return res.status(500).json({
            error: "שגיאה בבדיקת זמינות התאריכים",
            errorDates: errorDates.map(check => ({ date: check.date, error: check.error })),
            message: "אירעה שגיאה בבדיקת זמינות תאריכי היעד"
          });
        }
        
        return res.status(400).json({
          error: "תאריכי יעד אינם פנויים",
          nonEmptyDates: nonEmptyDates.map(check => check.date),
          message: "תאריכי היעד חייבים להיות פנויים מכל משימות ואירועים כדי לבצע העתקה"
        });
      }

      // All target dates are empty, proceed with duplication
      let totalCopiedTasks = 0;
      let totalCopiedEvents = 0;
      const copyResults: Array<{sourceDate: string, targetDate: string, copiedTasks: number, copiedEvents: number}> = [];

      for (let i = 0; i < sourceDateObjects.length; i++) {
        const sourceDate = sourceDateObjects[i];
        const targetDate = targetDateObjects[i];
        
        try {
          const { copiedTasks, copiedEvents } = await copyScheduleData(sourceDate, targetDate);
          
          totalCopiedTasks += copiedTasks;
          totalCopiedEvents += copiedEvents;
          
          copyResults.push({
            sourceDate: sourceDates[i],
            targetDate: targetDates[i],
            copiedTasks,
            copiedEvents
          });

          // Broadcast updates for the new data
          if (copiedTasks > 0) {
            broadcastUpdate('schedule_duplicated_tasks', { 
              targetDate: targetDates[i], 
              count: copiedTasks 
            });
          }
          if (copiedEvents > 0) {
            broadcastUpdate('schedule_duplicated_events', { 
              targetDate: targetDates[i], 
              count: copiedEvents 
            });
          }
          
        } catch (copyError) {
          console.error(`Error copying from ${sourceDates[i]} to ${targetDates[i]}:`, copyError);
          return res.status(500).json({
            error: "Failed to copy schedule data",
            sourceDate: sourceDates[i],
            targetDate: targetDates[i]
          });
        }
      }

      // Return success response
      res.status(200).json({
        success: true,
        message: "Schedule duplicated successfully",
        summary: {
          totalCopiedTasks,
          totalCopiedEvents,
          duplicatedDates: copyResults.length
        },
        details: copyResults
      });

    } catch (error) {
      console.error('Duplicate schedule error:', error);
      res.status(500).json({ error: "Failed to duplicate schedule" });
    }
  });

  // Inventory authentication middleware
  // Password can be configured via INVENTORY_PASSWORD environment variable, defaults to "2026"
  const INVENTORY_PASSWORD = process.env.INVENTORY_PASSWORD || "2026";
  const INVENTORY_NOTIFICATION_PASSWORD = "1913"; // Also valid for login + enables notifications
  const INVENTORY_FULL_MODE = "full";
  const INVENTORY_SHORTAGES_MODE = "shortages";
  
  // Store inventory sessions
  const inventorySessions = new Map<string, { mode: string; timestamp: number }>();
  const INVENTORY_SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours

  function requireInventoryAuth(req: any, res: any, next: any) {
    const sessionToken = req.cookies?.inventory_session;
    const session = sessionToken && inventorySessions.get(sessionToken);
    
    if (!session || Date.now() - session.timestamp > INVENTORY_SESSION_TIMEOUT) {
      if (session) inventorySessions.delete(sessionToken);
      return res.status(401).json({ error: "נדרשת הזדהות למלאי", requiresAuth: true });
    }
    
    req.inventoryMode = session.mode;
    next();
  }

  function requireFullInventoryAuth(req: any, res: any, next: any) {
    requireInventoryAuth(req, res, () => {
      if (req.inventoryMode !== INVENTORY_FULL_MODE) {
        return res.status(403).json({ error: "נדרשת גישה מלאה למלאי" });
      }
      next();
    });
  }

  // Inventory authentication routes
  app.post("/api/inventory/auth", async (req, res) => {
    try {
      const { password, mode } = req.body;
      
      // Accept both main password (2026) and notification password (1913)
      const isMainPassword = password === INVENTORY_PASSWORD;
      const isNotificationPassword = password === INVENTORY_NOTIFICATION_PASSWORD;
      
      if (!isMainPassword && !isNotificationPassword) {
        return res.status(401).json({ error: "סיסמה שגויה" });
      }
      
      if (mode !== INVENTORY_FULL_MODE && mode !== INVENTORY_SHORTAGES_MODE) {
        return res.status(400).json({ error: "מצב לא חוקי" });
      }
      
      const sessionToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      inventorySessions.set(sessionToken, { mode, timestamp: Date.now() });
      
      res.cookie('inventory_session', sessionToken, {
        httpOnly: true,
        maxAge: INVENTORY_SESSION_TIMEOUT,
        sameSite: 'strict'
      });
      
      // Include flag indicating if notifications should be enabled
      res.json({ success: true, mode, enableNotifications: isNotificationPassword });
    } catch (error) {
      console.error('Inventory auth error:', error);
      res.status(500).json({ error: "שגיאת אימות" });
    }
  });

  // Password-free access to shopping list only
  app.post("/api/inventory/auth-shortages", async (req, res) => {
    try {
      const sessionToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      inventorySessions.set(sessionToken, { mode: INVENTORY_SHORTAGES_MODE, timestamp: Date.now() });
      
      res.cookie('inventory_session', sessionToken, {
        httpOnly: true,
        maxAge: INVENTORY_SESSION_TIMEOUT,
        sameSite: 'strict'
      });
      
      res.json({ success: true, mode: INVENTORY_SHORTAGES_MODE });
    } catch (error) {
      console.error('Inventory auth-shortages error:', error);
      res.status(500).json({ error: "שגיאת אימות" });
    }
  });

  app.post("/api/inventory/logout", (req, res) => {
    const sessionToken = req.cookies?.inventory_session;
    if (sessionToken) {
      inventorySessions.delete(sessionToken);
      res.clearCookie('inventory_session');
    }
    res.json({ success: true });
  });

  app.get("/api/inventory/status", (req, res) => {
    const sessionToken = req.cookies?.inventory_session;
    const session = sessionToken && inventorySessions.get(sessionToken);
    
    if (!session || Date.now() - session.timestamp > INVENTORY_SESSION_TIMEOUT) {
      if (session) inventorySessions.delete(sessionToken);
      return res.json({ authenticated: false });
    }
    
    res.json({ authenticated: true, mode: session.mode });
  });

  // Target Inventory Routes
  app.get("/api/target-inventory", requireInventoryAuth, async (req, res) => {
    try {
      const items = await storage.getAllTargetInventory();
      res.json(items);
    } catch (error) {
      console.error('Error fetching target inventory:', error);
      res.status(500).json({ error: "Failed to fetch target inventory" });
    }
  });

  app.get("/api/target-inventory/:id", requireInventoryAuth, async (req, res) => {
    try {
      const item = await storage.getTargetInventoryById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error('Error fetching target inventory item:', error);
      res.status(500).json({ error: "Failed to fetch item" });
    }
  });

  app.post("/api/target-inventory", requireFullInventoryAuth, async (req, res) => {
    try {
      const validatedData = insertTargetInventorySchema.parse(req.body);
      const newItem = await storage.createTargetInventory(validatedData);
      res.status(201).json(newItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error('Error creating target inventory item:', error);
      res.status(500).json({ error: "Failed to create item" });
    }
  });

  app.patch("/api/target-inventory/:id", requireFullInventoryAuth, async (req, res) => {
    try {
      const validatedData = updateTargetInventorySchema.parse(req.body);
      
      // Get the old item to check what changed
      const oldItem = await storage.getTargetInventoryById(req.params.id);
      if (!oldItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      // Update the target inventory item
      const updatedItem = await storage.updateTargetInventory(req.params.id, validatedData);
      if (!updatedItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      // Update related items in shopping list
      const allShoppingItems = await storage.getAllShoppingList();
      const relatedItems = allShoppingItems.filter(item => 
        item.isFromTargetList && (
          (item.productName.toLowerCase() === oldItem.productName.toLowerCase()) ||
          (oldItem.productNameHebrew && item.productNameHebrew?.toLowerCase() === oldItem.productNameHebrew.toLowerCase())
        )
      );
      
      // Update each related shopping list item
      for (const item of relatedItems) {
        const updatedShoppingItem = {
          productName: updatedItem.productName,
          productNameHebrew: updatedItem.productNameHebrew,
          targetQuantity: updatedItem.targetQuantity,
          neededQuantity: Math.max(0, updatedItem.targetQuantity - item.currentQuantity),
        };
        await storage.updateShoppingListItem(item.id, updatedShoppingItem);
      }
      
      res.json(updatedItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error('Error updating target inventory item:', error);
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  app.delete("/api/target-inventory/:id", requireFullInventoryAuth, async (req, res) => {
    try {
      const success = await storage.deleteTargetInventory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting target inventory item:', error);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  app.patch("/api/target-inventory/rename-category", requireFullInventoryAuth, async (req, res) => {
    try {
      const { oldCategory, newCategory } = req.body;
      if (!oldCategory || !newCategory) {
        return res.status(400).json({ error: "חובה לספק שם קטגוריה ישן וחדש" });
      }
      await storage.renameTargetInventoryCategory(oldCategory, newCategory);
      await storage.renameShoppingListCategory(oldCategory, newCategory);
      res.json({ success: true });
    } catch (error) {
      console.error('Error renaming target inventory category:', error);
      res.status(500).json({ error: "Failed to rename category" });
    }
  });

  // Custom Inventory Categories Routes - shared across all users
  app.get("/api/inventory-categories", requireInventoryAuth, async (req, res) => {
    try {
      const categories = await storage.getAllCustomCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching custom categories:', error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/inventory-categories", requireFullInventoryAuth, async (req, res) => {
    try {
      const validatedData = insertCustomCategorySchema.parse(req.body);
      const newCategory = await storage.createCustomCategory(validatedData);
      res.status(201).json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error('Error creating custom category:', error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.patch("/api/inventory-categories/:id", requireFullInventoryAuth, async (req, res) => {
    try {
      const validatedData = updateCustomCategorySchema.parse(req.body);
      const updatedCategory = await storage.updateCustomCategory(req.params.id, validatedData);
      if (!updatedCategory) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error('Error updating custom category:', error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/inventory-categories/:id", requireFullInventoryAuth, async (req, res) => {
    try {
      const success = await storage.deleteCustomCategory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting custom category:', error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Shopping List Routes - accessible in both modes
  app.get("/api/shopping-list", requireInventoryAuth, async (req, res) => {
    try {
      const items = await storage.getAllShoppingList();
      res.json(items);
    } catch (error) {
      console.error('Error fetching shopping list:', error);
      res.status(500).json({ error: "Failed to fetch shopping list" });
    }
  });

  app.get("/api/shopping-list/:id", requireInventoryAuth, async (req, res) => {
    try {
      const item = await storage.getShoppingListById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error('Error fetching shopping list item:', error);
      res.status(500).json({ error: "Failed to fetch item" });
    }
  });

  app.post("/api/shopping-list", requireInventoryAuth, async (req, res) => {
    try {
      const validatedData = insertShoppingListSchema.parse(req.body);
      const newItem = await storage.createShoppingListItem(validatedData);
      res.status(201).json(newItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error('Error creating shopping list item:', error);
      res.status(500).json({ error: "Failed to create item" });
    }
  });

  app.patch("/api/shopping-list/:id", requireInventoryAuth, async (req, res) => {
    try {
      const validatedData = updateShoppingListSchema.parse(req.body);
      const updatedItem = await storage.updateShoppingListItem(req.params.id, validatedData);
      if (!updatedItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json(updatedItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error('Error updating shopping list item:', error);
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  app.delete("/api/shopping-list/:id", requireInventoryAuth, async (req, res) => {
    try {
      const success = await storage.deleteShoppingListItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting shopping list item:', error);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  app.delete("/api/shopping-list", requireInventoryAuth, async (req, res) => {
    try {
      await storage.clearShoppingList();
      res.status(204).send();
    } catch (error) {
      console.error('Error clearing shopping list:', error);
      res.status(500).json({ error: "Failed to clear shopping list" });
    }
  });

  app.patch("/api/shopping-list/rename-category", requireInventoryAuth, async (req, res) => {
    try {
      const { oldCategory, newCategory } = req.body;
      if (!oldCategory || !newCategory) {
        return res.status(400).json({ error: "חובה לספק שם קטגוריה ישן וחדש" });
      }
      await storage.renameShoppingListCategory(oldCategory, newCategory);
      await storage.renameTargetInventoryCategory(oldCategory, newCategory);
      res.json({ success: true });
    } catch (error) {
      console.error('Error renaming shopping list category:', error);
      res.status(500).json({ error: "Failed to rename category" });
    }
  });

  // Staff Members Routes
  app.get("/api/staff-members", async (req, res) => {
    try {
      const members = await storage.getAllStaffMembers();
      res.json(members);
    } catch (error) {
      console.error('Error fetching staff members:', error);
      res.status(500).json({ error: "Failed to fetch staff members" });
    }
  });

  app.get("/api/staff-members/:id", async (req, res) => {
    try {
      const member = await storage.getStaffMemberById(req.params.id);
      if (!member) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      res.json(member);
    } catch (error) {
      console.error('Error fetching staff member:', error);
      res.status(500).json({ error: "Failed to fetch staff member" });
    }
  });

  app.post("/api/staff-members", async (req, res) => {
    try {
      const validatedData = insertStaffMemberSchema.parse(req.body);
      const newMember = await storage.createStaffMember(validatedData);
      res.status(201).json(newMember);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error('Error creating staff member:', error);
      res.status(500).json({ error: "Failed to create staff member" });
    }
  });

  app.patch("/api/staff-members/:id", async (req, res) => {
    try {
      const validatedData = updateStaffMemberSchema.parse(req.body);
      const updatedMember = await storage.updateStaffMember(req.params.id, validatedData);
      if (!updatedMember) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      res.json(updatedMember);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error('Error updating staff member:', error);
      res.status(500).json({ error: "Failed to update staff member" });
    }
  });

  app.delete("/api/staff-members/:id", async (req, res) => {
    try {
      const success = await storage.deleteStaffMember(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting staff member:', error);
      res.status(500).json({ error: "Failed to delete staff member" });
    }
  });

  // Schedule Events Routes
  app.get("/api/schedule-events", async (req, res) => {
    try {
      const { start, end } = req.query;
      if (!start || !end) {
        return res.status(400).json({ error: "Start and end dates are required" });
      }
      
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const events = await storage.getScheduleEvents(startDate, endDate);
      res.json(events);
    } catch (error) {
      console.error('Error fetching schedule events:', error);
      res.status(500).json({ error: "Failed to fetch schedule events" });
    }
  });

  app.get("/api/schedule-events/:id", async (req, res) => {
    try {
      const event = await storage.getScheduleEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Schedule event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error('Error fetching schedule event:', error);
      res.status(500).json({ error: "Failed to fetch schedule event" });
    }
  });

  app.post("/api/schedule-events", async (req, res) => {
    try {
      // Extract staffMemberIds before validation
      const { staffMemberIds, ...eventBody } = req.body;
      
      // Convert date strings to Date objects
      const dataToValidate = {
        ...eventBody,
        date: new Date(eventBody.date),
        endDate: eventBody.endDate ? new Date(eventBody.endDate) : null
      };
      const validatedData = insertScheduleEventSchema.parse(dataToValidate);
      
      // Pass staffMemberIds to storage
      const newEvent = await storage.createScheduleEvent(validatedData, staffMemberIds);
      
      // Broadcast to WebSocket clients
      broadcastUpdate('scheduleEventCreated', newEvent);
      
      res.status(201).json(newEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error('Error creating schedule event:', error);
      res.status(500).json({ error: "Failed to create schedule event" });
    }
  });

  app.patch("/api/schedule-events/:id", async (req, res) => {
    try {
      // Extract staffMemberIds before validation
      const { staffMemberIds, ...eventBody } = req.body;
      
      // Convert date strings to Date objects if present
      const dataToValidate = {
        ...eventBody,
        ...(eventBody.date && { date: new Date(eventBody.date) }),
        ...(eventBody.endDate !== undefined && { endDate: eventBody.endDate ? new Date(eventBody.endDate) : null })
      };
      const validatedData = updateScheduleEventSchema.parse(dataToValidate);
      
      // Pass staffMemberIds to storage
      const updatedEvent = await storage.updateScheduleEvent(req.params.id, validatedData, staffMemberIds);
      if (!updatedEvent) {
        return res.status(404).json({ error: "Schedule event not found" });
      }
      
      // Broadcast to WebSocket clients
      broadcastUpdate('scheduleEventUpdated', updatedEvent);
      
      res.json(updatedEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error('Error updating schedule event:', error);
      res.status(500).json({ error: "Failed to update schedule event" });
    }
  });

  // Bulk delete schedule events by dates
  app.delete("/api/schedule-events/bulk", async (req, res) => {
    try {
      const { dates } = req.body;
      
      console.log('Bulk delete request received:', { dates });
      
      if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({ error: "dates array is required" });
      }
      
      let deletedScheduleEvents = 0;
      let deletedTasks = 0;
      let deletedEvents = 0;
      const deletedIds: string[] = [];
      
      // Get all schedule events for the specified dates
      const sortedDates = [...dates].sort();
      const minDate = new Date(sortedDates[0]);
      const maxDate = new Date(sortedDates[sortedDates.length - 1]);
      maxDate.setDate(maxDate.getDate() + 1); // Include the last date
      
      const scheduleEvents = await storage.getScheduleEvents(minDate, maxDate);
      console.log('Schedule events found:', scheduleEvents.length, 'date range:', minDate, maxDate);
      
      // Delete schedule events for selected dates
      for (const dateString of dates) {
        const eventsForDate = scheduleEvents.filter(e => e.date === dateString);
        console.log(`Schedule events for ${dateString}:`, eventsForDate.length);
        
        for (const event of eventsForDate) {
          const success = await storage.deleteScheduleEvent(event.id);
          if (success) {
            deletedScheduleEvents++;
            deletedIds.push(event.id);
          }
        }
      }
      
      // Also delete daily tasks for the selected dates
      const allTasks = await storage.getDailyTasks();
      console.log('Total daily tasks in system:', allTasks.length);
      
      for (const dateString of dates) {
        const tasksForDate = allTasks.filter(t => {
          // Handle both string and Date formats
          const taskDate = typeof t.date === 'string' ? t.date : t.date.toISOString().split('T')[0];
          return taskDate === dateString;
        });
        console.log(`Daily tasks for ${dateString}:`, tasksForDate.length, tasksForDate.map(t => ({ id: t.id, name: t.name, date: t.date })));
        
        for (const task of tasksForDate) {
          const success = await storage.deleteDailyTask(task.id);
          console.log(`Deleted task ${task.id}:`, success);
          if (success) {
            deletedTasks++;
          }
        }
      }
      
      // Also delete events for the selected dates
      const allEvents = await storage.getEvents();
      console.log('Total events in system:', allEvents.length);
      
      for (const dateString of dates) {
        const eventsForDate = allEvents.filter(e => {
          // Handle both string and Date formats
          const eventDate = typeof e.date === 'string' ? e.date : e.date.toISOString().split('T')[0];
          return eventDate === dateString;
        });
        console.log(`Events for ${dateString}:`, eventsForDate.length);
        
        for (const event of eventsForDate) {
          const success = await storage.deleteEvent(event.id);
          if (success) {
            deletedEvents++;
          }
        }
      }
      
      // Broadcast bulk deletion to WebSocket clients
      broadcastUpdate('scheduleEventsBulkDeleted', { dates, deletedIds, deletedTasks, deletedEvents });
      
      res.json({ 
        success: true, 
        deletedScheduleEvents, 
        deletedTasks, 
        deletedEvents,
        totalDeleted: deletedScheduleEvents + deletedTasks + deletedEvents,
        dates 
      });
    } catch (error) {
      console.error('Error bulk deleting schedule events:', error);
      res.status(500).json({ error: "Failed to bulk delete schedule events" });
    }
  });

  app.delete("/api/schedule-events/:id", async (req, res) => {
    try {
      const success = await storage.deleteScheduleEvent(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Schedule event not found" });
      }
      
      // Broadcast to WebSocket clients
      broadcastUpdate('scheduleEventDeleted', { id: req.params.id });
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting schedule event:', error);
      res.status(500).json({ error: "Failed to delete schedule event" });
    }
  });

  // Duplicate management week endpoint
  app.post("/api/schedule-events/duplicate-management-week", async (req, res) => {
    try {
      const result = duplicateManagementWeekSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "נתונים לא תקינים", 
          details: result.error.issues 
        });
      }

      const { sourceWeekStart, targetWeekStart, overwrite } = result.data;

      // Parse dates
      const sourceStart = parseUTCDate(sourceWeekStart);
      const targetStart = parseUTCDate(targetWeekStart);

      // Calculate week ends (6 days after start = Saturday)
      const sourceEnd = new Date(sourceStart);
      sourceEnd.setDate(sourceEnd.getDate() + 6);
      sourceEnd.setHours(23, 59, 59, 999);

      const targetEnd = new Date(targetStart);
      targetEnd.setDate(targetEnd.getDate() + 6);
      targetEnd.setHours(23, 59, 59, 999);

      // Get all management events in source week
      const sourceEvents = await storage.getScheduleEvents(sourceStart, sourceEnd);
      const managementEvents = sourceEvents.filter(e => e.layer === 'management');

      if (managementEvents.length === 0) {
        return res.status(400).json({ 
          error: "אין אירועים לשכפול",
          message: "לא נמצאו אירועים בשבוע המקור"
        });
      }

      // Check for existing events in target week
      const targetEvents = await storage.getScheduleEvents(targetStart, targetEnd);
      const existingManagementEvents = targetEvents.filter(e => e.layer === 'management');

      // If overwriting, delete existing management events in target week
      if (overwrite && existingManagementEvents.length > 0) {
        for (const event of existingManagementEvents) {
          await storage.deleteScheduleEvent(event.id);
        }
      }
      // If not overwriting and there are existing events, we'll just add to them (merge mode)

      // Calculate day offset between source and target week
      const dayOffset = Math.round((targetStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24));

      // Duplicate each management event
      let copiedCount = 0;
      for (const event of managementEvents) {
        // Shift the event date
        const eventDate = new Date(event.date);
        eventDate.setDate(eventDate.getDate() + dayOffset);

        // Shift endDate if exists
        let newEndDate: Date | undefined;
        if (event.endDate) {
          newEndDate = new Date(event.endDate);
          newEndDate.setDate(newEndDate.getDate() + dayOffset);
        }

        // Get staff member IDs from the event
        const staffMemberIds = event.staffMembers?.map(s => s.id) || [];

        // Create the new event
        await storage.createScheduleEvent({
          title: event.title,
          date: eventDate,
          endDate: newEndDate,
          startTime: event.startTime,
          endTime: event.endTime,
          note: event.note || '',
          layer: 'management',
        }, staffMemberIds);

        copiedCount++;
      }

      // Broadcast update
      broadcastUpdate('scheduleEventsBulkCreated', { 
        targetWeekStart, 
        count: copiedCount 
      });

      res.json({ 
        success: true, 
        copiedCount,
        deletedCount: overwrite ? existingManagementEvents.length : 0,
        message: `שוכפלו ${copiedCount} אירועים בהצלחה`
      });
    } catch (error) {
      console.error('Error duplicating management week:', error);
      res.status(500).json({ error: "שגיאה בשכפול השבוע" });
    }
  });

  // ========== MEDICATION MANAGEMENT ROUTES ==========
  
  // Password verification for medication module (password: 2026)
  const MEDICATION_PASSWORD = process.env.MEDICATION_PASSWORD || "2026";
  
  app.post("/api/medications/verify-password", (req, res) => {
    try {
      const { password } = req.body;
      if (password === MEDICATION_PASSWORD) {
        res.json({ success: true });
      } else {
        res.status(401).json({ error: "סיסמה שגויה", success: false });
      }
    } catch (error) {
      console.error('Error verifying medication password:', error);
      res.status(500).json({ error: "שגיאה באימות סיסמה" });
    }
  });
  
  // Get all medications
  app.get("/api/medications", async (req, res) => {
    try {
      const meds = await storage.getAllMedications();
      res.json(meds);
    } catch (error) {
      console.error('Error fetching medications:', error);
      res.status(500).json({ error: "Failed to fetch medications" });
    }
  });
  
  // Get medications for a specific patient
  app.get("/api/medications/patient/:patientId", async (req, res) => {
    try {
      const meds = await storage.getMedicationsByPatient(req.params.patientId);
      res.json(meds);
    } catch (error) {
      console.error('Error fetching patient medications:', error);
      res.status(500).json({ error: "Failed to fetch patient medications" });
    }
  });
  
  // Get single medication
  app.get("/api/medications/:id", async (req, res) => {
    try {
      const med = await storage.getMedicationById(req.params.id);
      if (!med) {
        return res.status(404).json({ error: "Medication not found" });
      }
      res.json(med);
    } catch (error) {
      console.error('Error fetching medication:', error);
      res.status(500).json({ error: "Failed to fetch medication" });
    }
  });
  
  // Create medication
  app.post("/api/medications", async (req, res) => {
    try {
      console.log('Creating medication with data:', JSON.stringify(req.body, null, 2));
      
      // Validate patientId is provided
      if (!req.body.patientId) {
        return res.status(400).json({ error: "יש לבחור מטופל" });
      }
      
      // Validate startDate is provided
      if (!req.body.startDate) {
        return res.status(400).json({ error: "יש להזין תאריך התחלה" });
      }
      
      const startDate = new Date(req.body.startDate);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ error: "תאריך התחלה לא תקין" });
      }
      
      const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
      if (endDate && isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "תאריך סיום לא תקין" });
      }
      
      if (endDate && endDate <= startDate) {
        return res.status(400).json({ error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" });
      }
      
      // Validate specificTimes if provided (supports both single hour and array of hours)
      const timeOfDay = req.body.timeOfDay || [];
      if (req.body.specificTimes) {
        try {
          const specificTimes = typeof req.body.specificTimes === 'string' 
            ? JSON.parse(req.body.specificTimes) 
            : req.body.specificTimes;
          
          const validTimeSlots = ['morning', 'noon', 'afternoon', 'night'];
          const validHourRanges: Record<string, string[]> = {
            morning: ['05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00'],
            noon: ['12:00', '13:00', '14:00'],
            afternoon: ['15:00', '16:00', '17:00', '18:00', '19:00'],
            night: ['20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00', '03:00', '04:00'],
          };
          
          for (const [slot, hours] of Object.entries(specificTimes)) {
            if (!validTimeSlots.includes(slot)) {
              return res.status(400).json({ error: `משבצת זמן לא תקינה: ${slot}` });
            }
            if (!timeOfDay.includes(slot)) {
              return res.status(400).json({ error: `השעות שייכות למשבצת ${slot} שלא נבחרה` });
            }
            // Support both single hour (string) and multiple hours (array)
            const hoursArray = Array.isArray(hours) ? hours : [hours];
            for (const hour of hoursArray) {
              if (!validHourRanges[slot].includes(hour as string)) {
                return res.status(400).json({ error: `השעה ${hour} לא תקינה עבור ${slot}` });
              }
            }
          }
        } catch (e) {
          return res.status(400).json({ error: "פורמט שעות לא תקין" });
        }
      }
      
      const validatedData = insertMedicationSchema.parse({
        ...req.body,
        startDate,
        endDate,
      });
      const medication = await storage.createMedication(validatedData);
      
      // Broadcast to WebSocket clients
      broadcastUpdate('medicationCreated', medication);
      
      res.status(201).json(medication);
    } catch (error) {
      console.error('Error creating medication:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "נתונים לא תקינים", details: error.errors });
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Medication creation error details:', errorMessage);
      res.status(500).json({ error: `שגיאה ביצירת תרופה: ${errorMessage}` });
    }
  });
  
  // Update medication
  app.patch("/api/medications/:id", async (req, res) => {
    try {
      const startDate = req.body.startDate ? new Date(req.body.startDate) : undefined;
      const endDate = req.body.endDate ? new Date(req.body.endDate) : undefined;
      
      if (startDate && endDate && endDate <= startDate) {
        return res.status(400).json({ error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" });
      }
      
      if (endDate && !startDate) {
        const existingMed = await storage.getMedicationById(req.params.id);
        if (existingMed && endDate <= existingMed.startDate) {
          return res.status(400).json({ error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" });
        }
      }
      
      // Validate specificTimes if provided (supports both single hour and array of hours)
      let timeOfDay = req.body.timeOfDay;
      if (req.body.specificTimes) {
        try {
          const specificTimes = typeof req.body.specificTimes === 'string' 
            ? JSON.parse(req.body.specificTimes) 
            : req.body.specificTimes;
          
          // If timeOfDay not provided in update, fetch from existing medication
          if (!timeOfDay) {
            const existingMedForTime = await storage.getMedicationById(req.params.id);
            timeOfDay = existingMedForTime?.timeOfDay || [];
          }
          
          const validTimeSlots = ['morning', 'noon', 'afternoon', 'night'];
          const validHourRanges: Record<string, string[]> = {
            morning: ['05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00'],
            noon: ['12:00', '13:00', '14:00'],
            afternoon: ['15:00', '16:00', '17:00', '18:00', '19:00'],
            night: ['20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00', '03:00', '04:00'],
          };
          
          for (const [slot, hours] of Object.entries(specificTimes)) {
            if (!validTimeSlots.includes(slot)) {
              return res.status(400).json({ error: `משבצת זמן לא תקינה: ${slot}` });
            }
            if (!timeOfDay.includes(slot)) {
              return res.status(400).json({ error: `השעות שייכות למשבצת ${slot} שלא נבחרה` });
            }
            // Support both single hour (string) and multiple hours (array)
            const hoursArray = Array.isArray(hours) ? hours : [hours];
            for (const hour of hoursArray) {
              if (!validHourRanges[slot].includes(hour as string)) {
                return res.status(400).json({ error: `השעה ${hour} לא תקינה עבור ${slot}` });
              }
            }
          }
        } catch (e) {
          return res.status(400).json({ error: "פורמט שעות לא תקין" });
        }
      }
      
      const validatedData = updateMedicationSchema.parse({
        ...req.body,
        startDate,
        endDate,
      });
      const medication = await storage.updateMedication(req.params.id, validatedData);
      if (!medication) {
        return res.status(404).json({ error: "Medication not found" });
      }
      
      // Broadcast to WebSocket clients
      broadcastUpdate('medicationUpdated', medication);
      
      res.json(medication);
    } catch (error) {
      console.error('Error updating medication:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "נתונים לא תקינים", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update medication" });
    }
  });
  
  // Delete medication
  app.delete("/api/medications/:id", async (req, res) => {
    try {
      const success = await storage.deleteMedication(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Medication not found" });
      }
      
      // Broadcast to WebSocket clients
      broadcastUpdate('medicationDeleted', { id: req.params.id });
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting medication:', error);
      res.status(500).json({ error: "Failed to delete medication" });
    }
  });
  
  // Get medication distribution view
  app.get("/api/medications/distribution/:date/:timeOfDay", async (req, res) => {
    try {
      const date = new Date(req.params.date);
      const timeOfDay = req.params.timeOfDay;
      const distribution = await storage.getDistributionView(date, timeOfDay);
      res.json(distribution);
    } catch (error) {
      console.error('Error fetching medication distribution:', error);
      res.status(500).json({ error: "Failed to fetch medication distribution" });
    }
  });
  
  // Get medication logs for a patient
  app.get("/api/medication-logs/patient/:patientId", async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const logs = await storage.getMedicationLogs(req.params.patientId, startDate, endDate);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching medication logs:', error);
      res.status(500).json({ error: "Failed to fetch medication logs" });
    }
  });
  
  // Get medication logs for a date
  app.get("/api/medication-logs/date/:date", async (req, res) => {
    try {
      const date = new Date(req.params.date);
      const logs = await storage.getMedicationLogsByDate(date);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching medication logs by date:', error);
      res.status(500).json({ error: "Failed to fetch medication logs" });
    }
  });
  
  // Mark medication as taken/not taken
  app.post("/api/medication-logs", async (req, res) => {
    try {
      const validatedData = insertMedicationLogSchema.parse({
        ...req.body,
        date: new Date(req.body.date),
      });
      const log = await storage.createOrUpdateMedicationLog(validatedData);
      
      // Broadcast to WebSocket clients
      broadcastUpdate('medicationLogUpdated', log);
      
      res.status(201).json(log);
    } catch (error) {
      console.error('Error creating medication log:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "נתונים לא תקינים", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create medication log" });
    }
  });
  
  // Get audit log for medication administration
  app.get("/api/medication-logs/audit", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getAuditLog(limit);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });
  
  // ==================== SOS Medications ====================
  
  // Get all SOS medications
  app.get("/api/sos-medications", async (req, res) => {
    try {
      const medications = await storage.getAllSosMedications();
      res.json(medications);
    } catch (error) {
      console.error('Error fetching SOS medications:', error);
      res.status(500).json({ error: "Failed to fetch SOS medications" });
    }
  });
  
  // Create a new SOS medication
  app.post("/api/sos-medications", async (req, res) => {
    try {
      const validatedData = insertSosMedicationSchema.parse(req.body);
      const medication = await storage.createSosMedication(validatedData);
      res.status(201).json(medication);
    } catch (error) {
      console.error('Error creating SOS medication:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "נתונים לא תקינים", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create SOS medication" });
    }
  });
  
  // Update an SOS medication
  app.patch("/api/sos-medications/:id", async (req, res) => {
    try {
      const validatedData = updateSosMedicationSchema.parse(req.body);
      const medication = await storage.updateSosMedication(req.params.id, validatedData);
      if (!medication) {
        return res.status(404).json({ error: "SOS medication not found" });
      }
      res.json(medication);
    } catch (error) {
      console.error('Error updating SOS medication:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "נתונים לא תקינים", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update SOS medication" });
    }
  });
  
  // Delete an SOS medication
  app.delete("/api/sos-medications/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSosMedication(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "SOS medication not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting SOS medication:', error);
      res.status(500).json({ error: "Failed to delete SOS medication" });
    }
  });
  
  // Get patient SOS allergies
  app.get("/api/patients/:patientId/sos-allergies", async (req, res) => {
    try {
      const allergies = await storage.getPatientSosAllergies(req.params.patientId);
      res.json(allergies);
    } catch (error) {
      console.error('Error fetching patient SOS allergies:', error);
      res.status(500).json({ error: "Failed to fetch patient SOS allergies" });
    }
  });
  
  // Set patient SOS allergies (replace all)
  app.put("/api/patients/:patientId/sos-allergies", async (req, res) => {
    try {
      const { sosMedicationIds } = req.body;
      if (!Array.isArray(sosMedicationIds)) {
        return res.status(400).json({ error: "sosMedicationIds must be an array" });
      }
      await storage.setPatientSosAllergies(req.params.patientId, sosMedicationIds);
      res.json({ success: true });
    } catch (error) {
      console.error('Error setting patient SOS allergies:', error);
      res.status(500).json({ error: "Failed to set patient SOS allergies" });
    }
  });
  
  // Get SOS medication audit logs
  app.get("/api/sos-medication-logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getSosMedicationLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching SOS medication logs:', error);
      res.status(500).json({ error: "Failed to fetch SOS medication logs" });
    }
  });
  
  // Get SOS medication logs for a specific patient
  app.get("/api/sos-medication-logs/patient/:patientId", async (req, res) => {
    try {
      const logs = await storage.getSosMedicationLogsByPatient(req.params.patientId);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching patient SOS medication logs:', error);
      res.status(500).json({ error: "Failed to fetch patient SOS medication logs" });
    }
  });
  
  // Get SOS medication logs for a specific date
  app.get("/api/sos-medication-logs/date/:date", async (req, res) => {
    try {
      const logs = await storage.getSosMedicationLogsByDate(req.params.date);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching SOS medication logs by date:', error);
      res.status(500).json({ error: "Failed to fetch SOS medication logs by date" });
    }
  });
  
  // Create an SOS medication log (when distributing SOS medication)
  app.post("/api/sos-medication-logs", async (req, res) => {
    try {
      const validatedData = insertSosMedicationLogSchema.parse({
        ...req.body,
        date: new Date(req.body.date),
      });
      const log = await storage.createSosMedicationLog(validatedData);
      
      // Get patient name for notification
      const patientName = req.body.patientName || 'מטופל';
      const nurseName = validatedData.responsibleName;
      const medicationName = validatedData.sosMedicationName;
      
      // Send push notification for SOS medication
      sendPushNotification(
        'תרופת SOS ניתנה',
        `${nurseName} נתן/ה תרופת SOS (${medicationName}) ל${patientName}`,
        { 
          type: 'sosMedication', 
          logId: log.id, 
          patientId: log.patientId,
          sosMedicationId: log.sosMedicationId
        }
      );
      
      // Broadcast to WebSocket clients
      broadcastUpdate('sosMedicationLogCreated', log);
      
      res.status(201).json(log);
    } catch (error) {
      console.error('Error creating SOS medication log:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "נתונים לא תקינים", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create SOS medication log" });
    }
  });
  
  // Delete an SOS medication log (undo)
  app.delete("/api/sos-medication-logs/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSosMedicationLog(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "רשומה לא נמצאה" });
      }
      
      // Broadcast to WebSocket clients
      broadcastUpdate('sosMedicationLogDeleted', { id: req.params.id });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting SOS medication log:', error);
      res.status(500).json({ error: "Failed to delete SOS medication log" });
    }
  });
  
  // ==================== Patient Shopping Lists ====================
  
  // Get all patient shopping lists
  app.get("/api/patient-shopping", async (req, res) => {
    try {
      const lists = await storage.getAllPatientShoppingLists();
      res.json(lists);
    } catch (error) {
      console.error('Error fetching patient shopping lists:', error);
      res.status(500).json({ error: "Failed to fetch patient shopping lists" });
    }
  });
  
  // Reset all patient shopping lists (requires password) - MUST be before :id routes
  app.delete("/api/patient-shopping/reset-all", async (req, res) => {
    try {
      await storage.deleteAllPatientShoppingLists();
      res.json({ success: true });
    } catch (error) {
      console.error('Error resetting patient shopping lists:', error);
      res.status(500).json({ error: "Failed to reset patient shopping lists" });
    }
  });
  
  // Create a new patient shopping list
  app.post("/api/patient-shopping", async (req, res) => {
    try {
      const list = await storage.createPatientShoppingList(req.body);
      res.status(201).json(list);
    } catch (error) {
      console.error('Error creating patient shopping list:', error);
      res.status(500).json({ error: "Failed to create patient shopping list" });
    }
  });
  
  // Update a patient shopping list
  app.patch("/api/patient-shopping/:id", async (req, res) => {
    try {
      const list = await storage.updatePatientShoppingList(req.params.id, req.body);
      if (!list) {
        return res.status(404).json({ error: "Patient shopping list not found" });
      }
      res.json(list);
    } catch (error) {
      console.error('Error updating patient shopping list:', error);
      res.status(500).json({ error: "Failed to update patient shopping list" });
    }
  });
  
  // Delete a patient shopping list
  app.delete("/api/patient-shopping/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePatientShoppingList(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Patient shopping list not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting patient shopping list:', error);
      res.status(500).json({ error: "Failed to delete patient shopping list" });
    }
  });

  // ==================== Purchase Transactions ====================
  
  // Get purchase transactions for a patient
  app.get("/api/purchase-transactions/:patientId", async (req, res) => {
    try {
      const transactions = await storage.getPurchaseTransactionsByPatient(req.params.patientId);
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching purchase transactions:', error);
      res.status(500).json({ error: "Failed to fetch purchase transactions" });
    }
  });
  
  // Deposit History routes
  app.get("/api/deposit-history/:patientId", async (req, res) => {
    try {
      const history = await storage.getDepositHistoryByPatient(req.params.patientId);
      res.json(history);
    } catch (error) {
      console.error('Error fetching deposit history:', error);
      res.status(500).json({ error: "Failed to fetch deposit history" });
    }
  });
  
  app.post("/api/deposit-history", async (req, res) => {
    try {
      const { patientId, patientName, amount, note } = req.body;
      
      if (!patientId || !patientName || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const entry = await storage.createDepositHistory({
        patientId,
        patientName,
        amount: Number(amount),
        note: note || '',
      });
      
      // Also update the occupant's deposit balance
      const occupant = await storage.getOccupantById(patientId);
      if (occupant) {
        const currentDeposit = occupant.deposits || 0;
        const newDeposit = currentDeposit + Number(amount);
        await storage.updateOccupant(patientId, { deposits: newDeposit });
      }
      
      res.json(entry);
    } catch (error) {
      console.error('Error creating deposit history:', error);
      res.status(500).json({ error: "Failed to create deposit history" });
    }
  });
  
  // Complete purchase - creates transactions, deducts from deposits (cash only), and clears purchased items
  app.post("/api/complete-purchase", async (req, res) => {
    try {
      const { purchases } = req.body; // Array of { patientId, patientName, items, totalAmount, listId }
      
      if (!purchases || !Array.isArray(purchases)) {
        return res.status(400).json({ error: "Invalid purchases data" });
      }
      
      const results = [];
      
      for (const purchase of purchases) {
        // Ensure totalAmount is a valid number
        const purchaseAmount = Math.round(Number(purchase.totalAmount) || 0);
        
        // Create the purchase transaction
        const transaction = await storage.createPurchaseTransaction({
          patientId: purchase.patientId,
          patientName: purchase.patientName,
          items: purchase.items,
          totalAmount: purchaseAmount,
        });
        
        // Get current occupant and update their deposit (only for cash payments)
        const occupant = await storage.getOccupantById(purchase.patientId);
        if (occupant) {
          const currentDeposit = occupant.deposits || 0;
          const newDeposit = currentDeposit - purchaseAmount;
          
          // If initialDeposit is not set, set it to the current deposit before deduction
          const updateData: any = { deposits: newDeposit };
          if (!occupant.initialDeposit && occupant.deposits) {
            updateData.initialDeposit = occupant.deposits;
          }
          
          await storage.updateOccupant(purchase.patientId, updateData);
        }
        
        // Clear checked items from shopping list and reset total
        if (purchase.listId) {
          const shoppingList = await storage.getPatientShoppingListById(purchase.listId);
          if (shoppingList) {
            const itemsArray = shoppingList.items ? shoppingList.items.split('\n').filter((item: string) => item.trim() !== '') : [];
            const checkedIndices = shoppingList.checkedItems.map((i: string) => parseInt(i));
            
            // Filter out checked items
            const remainingItems = itemsArray.filter((_: string, index: number) => !checkedIndices.includes(index));
            
            // Update the list with remaining items, clear checked items and total
            await storage.updatePatientShoppingList(purchase.listId, {
              items: remainingItems.join('\n'),
              checkedItems: [],
              totalAmount: '',
            });
          }
        }
        
        results.push(transaction);
      }
      
      res.json({ success: true, transactions: results });
    } catch (error) {
      console.error('Error completing purchase:', error);
      res.status(500).json({ error: "Failed to complete purchase" });
    }
  });

  // Cash Flow Module Routes - Database-backed
  const CASHFLOW_PASSWORD = "4573";
  const CASHFLOW_SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
  const cashflowSessions = new Map<string, { authenticated: boolean; timestamp: number }>();

  function requireCashflowAuth(req: any, res: any, next: any) {
    const sessionId = req.cookies?.cashflow_session;
    const session = sessionId ? cashflowSessions.get(sessionId) : null;
    
    if (!session || !session.authenticated) {
      return res.status(401).json({ error: "נדרש אימות למודול תזרים" });
    }
    
    if (Date.now() - session.timestamp > CASHFLOW_SESSION_TIMEOUT) {
      cashflowSessions.delete(sessionId);
      return res.status(401).json({ error: "הסשן פג תוקף, נא להתחבר מחדש" });
    }
    
    session.timestamp = Date.now();
    next();
  }

  app.post("/api/cashflow/auth", (req, res) => {
    const parsed = cashFlowAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "נתונים לא תקינים" });
    }
    
    const { password } = parsed.data;
    
    if (password === CASHFLOW_PASSWORD) {
      const sessionId = `cashflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      cashflowSessions.set(sessionId, { authenticated: true, timestamp: Date.now() });
      res.cookie('cashflow_session', sessionId, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "סיסמה שגויה" });
    }
  });

  app.get("/api/cashflow/status", (req, res) => {
    const sessionId = req.cookies?.cashflow_session;
    const session = sessionId ? cashflowSessions.get(sessionId) : null;
    
    if (session && session.authenticated) {
      if (Date.now() - session.timestamp > CASHFLOW_SESSION_TIMEOUT) {
        cashflowSessions.delete(sessionId);
        res.clearCookie('cashflow_session');
        return res.json({ authenticated: false });
      }
    }
    
    res.json({ authenticated: session?.authenticated || false });
  });

  app.post("/api/cashflow/logout", (req, res) => {
    const sessionId = req.cookies?.cashflow_session;
    if (sessionId) {
      cashflowSessions.delete(sessionId);
    }
    res.clearCookie('cashflow_session');
    res.json({ success: true });
  });

  // Settings routes
  app.get("/api/cashflow/settings", requireCashflowAuth, async (req, res) => {
    try {
      const settings = await storage.getCashFlowSettings();
      const categories = await storage.getCashFlowCategories();
      const creditCards = await storage.getCashFlowCreditCards();
      res.json({
        activeYear: settings?.activeYear || new Date().getFullYear(),
        categories: {
          income: categories.filter(c => c.type === 'income' || c.type === 'both').map(c => c.name),
          expense: categories.filter(c => c.type === 'expense' || c.type === 'both').map(c => c.name),
        },
        creditCards,
      });
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: error.message || "שגיאה בטעינת ההגדרות" });
    }
  });

  app.get("/api/cashflow/balances", requireCashflowAuth, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const balances = await storage.getCashFlowBalances(year);
      res.json(balances);
    } catch (error: any) {
      console.error('Error calculating balances:', error);
      res.status(500).json({ error: error.message || "שגיאה בחישוב יתרות" });
    }
  });

  // Balance at specific date endpoint
  app.get("/api/cashflow/balance-at-date", requireCashflowAuth, async (req, res) => {
    try {
      const dateStr = req.query.date as string;
      if (!dateStr) {
        return res.status(400).json({ error: "חסר תאריך" });
      }
      
      const targetDate = new Date(dateStr);
      const year = targetDate.getFullYear();
      
      // Get opening balance for the year
      const openingBalanceRecord = await storage.getCashFlowOpeningBalance(year);
      let balance = openingBalanceRecord?.openingBalance || 0;
      
      // Get all transactions up to and including the target date
      const allTransactions = await storage.getCashFlowTransactions(year);
      
      for (const tx of allTransactions) {
        const txDate = new Date(tx.date);
        if (txDate <= targetDate) {
          if (tx.type === 'income') {
            balance += tx.amount;
          } else {
            balance -= tx.amount;
          }
        }
      }
      
      res.json({ balance, date: dateStr });
    } catch (error: any) {
      console.error('Error calculating balance at date:', error);
      res.status(500).json({ error: error.message || "שגיאה בחישוב יתרה" });
    }
  });

  // Transactions routes
  app.get("/api/cashflow/transactions", requireCashflowAuth, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      
      // Auto-update pending transactions whose dates have passed
      const allTransactions = await storage.getCashFlowTransactions(year, month);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (const tx of allTransactions) {
        if (tx.status === 'pending') {
          const txDate = new Date(tx.date);
          txDate.setHours(0, 0, 0, 0);
          if (txDate <= today) {
            // Update status to completed and payment method for income
            const updateData: any = { status: 'completed' };
            if (tx.type === 'income') {
              updateData.paymentMethod = 'מזומן';
            }
            await storage.updateCashFlowTransaction(tx.id, updateData);
          }
        }
      }
      
      // Fetch updated transactions
      const transactions = await storage.getCashFlowTransactions(year, month);
      res.json(transactions);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: error.message || "שגיאה בטעינת תנועות" });
    }
  });

  app.post("/api/cashflow/transactions", requireCashflowAuth, async (req, res) => {
    try {
      const parsed = insertCashFlowTransactionSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error('Transaction validation error:', parsed.error.errors);
        return res.status(400).json({ error: "נתוני תנועה לא תקינים", details: parsed.error.errors });
      }
      
      const transaction = await storage.createCashFlowTransaction(parsed.data);
      res.status(201).json(transaction);
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      res.status(500).json({ error: error.message || "שגיאה בהוספת תנועה" });
    }
  });

  app.patch("/api/cashflow/transactions/:id", requireCashflowAuth, async (req, res) => {
    try {
      const parsed = updateCashFlowTransactionSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error('Update validation error:', parsed.error.errors, 'Body:', req.body);
        return res.status(400).json({ error: "נתוני תנועה לא תקינים", details: parsed.error.errors });
      }
      
      // Handle convert to one-time: delete future recurring transactions
      if (parsed.data.convertToOneTime) {
        const currentTransaction = await storage.getCashFlowTransactionById(req.params.id);
        if (currentTransaction?.recurringGroupId) {
          // Delete all future pending transactions in the same recurring group
          const transactionDate = currentTransaction.date;
          if (storage.deleteFutureRecurringTransactions) {
            await storage.deleteFutureRecurringTransactions(currentTransaction.recurringGroupId, transactionDate);
          }
        }
        // Mark this transaction as non-recurring
        parsed.data.isRecurring = false;
        parsed.data.recurringGroupId = null;
      }
      
      const updated = await storage.updateCashFlowTransaction(req.params.id, parsed.data);
      if (!updated) {
        return res.status(404).json({ error: "תנועה לא נמצאה" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      res.status(500).json({ error: error.message || "שגיאה בעדכון תנועה" });
    }
  });

  app.delete("/api/cashflow/transactions/:id", requireCashflowAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCashFlowTransaction(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "תנועה לא נמצאה" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({ error: error.message || "שגיאה במחיקת תנועה" });
    }
  });

  // Categories routes
  app.get("/api/cashflow/categories", requireCashflowAuth, async (req, res) => {
    try {
      const type = req.query.type as 'income' | 'expense' | 'both' | undefined;
      const categories = type 
        ? await storage.getCashFlowCategoriesByType(type)
        : await storage.getCashFlowCategories();
      res.json(categories);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: error.message || "שגיאה בטעינת קטגוריות" });
    }
  });

  app.post("/api/cashflow/categories", requireCashflowAuth, async (req, res) => {
    try {
      const parsed = insertCashFlowCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "נתוני קטגוריה לא תקינים" });
      }
      const category = await storage.createCashFlowCategory(parsed.data);
      res.status(201).json(category);
    } catch (error: any) {
      console.error('Error adding category:', error);
      res.status(500).json({ error: error.message || "שגיאה בהוספת קטגוריה" });
    }
  });

  app.patch("/api/cashflow/categories/:id", requireCashflowAuth, async (req, res) => {
    try {
      const parsed = updateCashFlowCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "נתוני קטגוריה לא תקינים" });
      }
      const updated = await storage.updateCashFlowCategory(req.params.id, parsed.data);
      if (!updated) {
        return res.status(404).json({ error: "קטגוריה לא נמצאה" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating category:', error);
      res.status(500).json({ error: error.message || "שגיאה בעדכון קטגוריה" });
    }
  });

  app.delete("/api/cashflow/categories/:id", requireCashflowAuth, async (req, res) => {
    try {
      const categoryId = decodeURIComponent(req.params.id);
      const type = req.query.type as 'income' | 'expense' | undefined;
      
      // First try to find by name if type is provided
      if (type) {
        const categories = await storage.getCashFlowCategoriesByType(type);
        const category = categories.find(c => c.name === categoryId);
        if (category) {
          const deleted = await storage.deleteCashFlowCategory(category.id);
          if (deleted) {
            return res.json({ success: true });
          }
        }
      }
      
      // Fallback to direct ID deletion
      const deleted = await storage.deleteCashFlowCategory(categoryId);
      if (!deleted) {
        return res.status(404).json({ error: "קטגוריה לא נמצאה" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting category:', error);
      res.status(500).json({ error: error.message || "שגיאה במחיקת קטגוריה" });
    }
  });

  // Credit cards routes
  app.get("/api/cashflow/credit-cards", requireCashflowAuth, async (req, res) => {
    try {
      const cards = await storage.getCashFlowCreditCards();
      res.json(cards);
    } catch (error: any) {
      console.error('Error fetching credit cards:', error);
      res.status(500).json({ error: error.message || "שגיאה בטעינת כרטיסי אשראי" });
    }
  });

  app.post("/api/cashflow/credit-cards", requireCashflowAuth, async (req, res) => {
    try {
      const parsed = insertCashFlowCreditCardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "נתוני כרטיס לא תקינים" });
      }
      const card = await storage.createCashFlowCreditCard(parsed.data);
      res.status(201).json(card);
    } catch (error: any) {
      console.error('Error adding credit card:', error);
      res.status(500).json({ error: error.message || "שגיאה בהוספת כרטיס אשראי" });
    }
  });

  app.patch("/api/cashflow/credit-cards/:id", requireCashflowAuth, async (req, res) => {
    try {
      const parsed = updateCashFlowCreditCardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "נתוני כרטיס לא תקינים" });
      }
      const updated = await storage.updateCashFlowCreditCard(req.params.id, parsed.data);
      if (!updated) {
        return res.status(404).json({ error: "כרטיס לא נמצא" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating credit card:', error);
      res.status(500).json({ error: error.message || "שגיאה בעדכון כרטיס אשראי" });
    }
  });

  app.delete("/api/cashflow/credit-cards/:id", requireCashflowAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCashFlowCreditCard(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "כרטיס לא נמצא" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting credit card:', error);
      res.status(500).json({ error: error.message || "שגיאה במחיקת כרטיס אשראי" });
    }
  });

  // Opening balance routes
  app.get("/api/cashflow/opening-balances", requireCashflowAuth, async (req, res) => {
    try {
      const balances = await storage.getCashFlowOpeningBalances();
      res.json(balances);
    } catch (error: any) {
      console.error('Error fetching opening balances:', error);
      res.status(500).json({ error: error.message || "שגיאה בטעינת יתרות פתיחה" });
    }
  });

  app.post("/api/cashflow/opening-balances", requireCashflowAuth, async (req, res) => {
    try {
      const { year, balance } = req.body;
      if (!year || typeof balance !== 'number') {
        return res.status(400).json({ error: "יש לספק שנה ויתרה" });
      }
      const result = await storage.setCashFlowOpeningBalance(year, balance);
      res.json(result);
    } catch (error: any) {
      console.error('Error setting opening balance:', error);
      res.status(500).json({ error: error.message || "שגיאה בעדכון יתרת פתיחה" });
    }
  });

  // Active year route
  app.post("/api/cashflow/update-active-year", requireCashflowAuth, async (req, res) => {
    try {
      const { year } = req.body;
      if (!year || typeof year !== 'number') {
        return res.status(400).json({ error: "יש לספק שנה תקינה" });
      }
      const result = await storage.updateCashFlowActiveYear(year);
      res.json({ success: true, activeYear: result.activeYear });
    } catch (error: any) {
      console.error('Error updating active year:', error);
      res.status(500).json({ error: error.message || "שגיאה בעדכון שנה פעילה" });
    }
  });

  // Monthly summary route
  app.get("/api/cashflow/monthly-summary", requireCashflowAuth, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const summary = await storage.getCashFlowMonthlySummary(year);
      res.json(summary);
    } catch (error: any) {
      console.error('Error fetching monthly summary:', error);
      res.status(500).json({ error: error.message || "שגיאה בטעינת סיכום חודשי" });
    }
  });

  // ==================== Push Notifications ====================
  
  // Get VAPID public key for client subscription
  app.get("/api/push/vapid-public-key", (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });
  
  // Subscribe to push notifications (requires password 1913)
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { password, subscription } = req.body;
      console.log('[Push] Subscription request received');
      
      // Verify password
      if (password !== "1913") {
        console.log('[Push] Invalid password for subscription');
        return res.status(401).json({ error: "סיסמה שגויה" });
      }
      
      if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        console.log('[Push] Invalid subscription data');
        return res.status(400).json({ error: "נתוני הרשמה לא תקינים" });
      }
      
      const result = await storage.createPushSubscription({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });
      
      console.log('[Push] Successfully subscribed:', result.id);
      res.json({ success: true, id: result.id });
    } catch (error) {
      console.error('[Push] Error subscribing to push:', error);
      res.status(500).json({ error: "שגיאה בהרשמה להתראות" });
    }
  });
  
  // Unsubscribe from push notifications
  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      
      if (!endpoint) {
        return res.status(400).json({ error: "חסר endpoint" });
      }
      
      await storage.deletePushSubscription(endpoint);
      res.json({ success: true });
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      res.status(500).json({ error: "שגיאה בביטול הרשמה" });
    }
  });

  const httpServer = createServer(app);
  
  // Set up WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    connectedClients.add(ws);
    
    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', data: { message: 'Connected to real-time updates' } }));
    
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
      connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      connectedClients.delete(ws);
    });
  });

  // ===== WebAuthn (Face ID) routes =====
  const RP_ID = process.env.RP_ID || 'localhost';
  const RP_NAME = 'בית האושר';
  const RP_ORIGIN = process.env.RP_ORIGIN || 'http://localhost:5000';
  const webauthnChallenges = new Map<string, { challenge: string; expires: number }>();

  // Get registration options (requires being logged in)
  app.get('/api/webauthn/register-options', requireInventoryAuth, async (req, res) => {
    try {
      const existing = await storage.getWebauthnCredentials();
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: 'admin',
        userDisplayName: 'מנהל מערכת',
        excludeCredentials: existing.map((c: any) => ({ id: c.credentialId, type: 'public-key' as const })),
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
      });
      webauthnChallenges.set('register', { challenge: options.challenge, expires: Date.now() + 5 * 60 * 1000 });
      res.json(options);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Verify registration
  app.post('/api/webauthn/register-verify', requireInventoryAuth, async (req, res) => {
    try {
      const stored = webauthnChallenges.get('register');
      if (!stored || stored.expires < Date.now()) return res.status(400).json({ error: 'Challenge פג תוקף' });

      const verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge: stored.challenge,
        expectedOrigin: RP_ORIGIN,
        expectedRPID: RP_ID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'אימות נכשל' });
      }

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      await storage.saveWebauthnCredential({
        id: randomUUID(),
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      });

      webauthnChallenges.delete('register');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get authentication options
  app.get('/api/webauthn/auth-options', async (req, res) => {
    try {
      const existing = await storage.getWebauthnCredentials();
      if (existing.length === 0) return res.status(404).json({ error: 'לא נמצאו אישורי Face ID' });

      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: existing.map((c: any) => ({ id: c.credentialId, type: 'public-key' as const, transports: ['internal'] as any })),
        userVerification: 'required',
      });

      webauthnChallenges.set('auth', { challenge: options.challenge, expires: Date.now() + 5 * 60 * 1000 });
      res.json(options);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Verify authentication → create session
  app.post('/api/webauthn/auth-verify', async (req, res) => {
    try {
      const stored = webauthnChallenges.get('auth');
      if (!stored || stored.expires < Date.now()) return res.status(400).json({ error: 'Challenge פג תוקף' });

      const creds = await storage.getWebauthnCredentials();
      const credential = creds.find((c: any) => c.credentialId === req.body.id);
      if (!credential) return res.status(404).json({ error: 'אישור לא נמצא' });

      const verification = await verifyAuthenticationResponse({
        response: req.body,
        expectedChallenge: stored.challenge,
        expectedOrigin: RP_ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: credential.credentialId,
          publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')),
          counter: credential.counter,
        },
      });

      if (!verification.verified) return res.status(401).json({ error: 'Face ID לא אומת' });

      await storage.updateWebauthnCredentialCounter(credential.id, verification.authenticationInfo.newCounter);

      const sessionToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      inventorySessions.set(sessionToken, { mode: INVENTORY_FULL_MODE, timestamp: Date.now() });
      res.cookie('inventory_session', sessionToken, { httpOnly: true, maxAge: INVENTORY_SESSION_TIMEOUT, sameSite: 'strict' });

      webauthnChallenges.delete('auth');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Check if any credentials exist (for showing Face ID button)
  app.get('/api/webauthn/has-credentials', async (req, res) => {
    const creds = await storage.getWebauthnCredentials();
    res.json({ hasCredentials: creds.length > 0 });
  });

  // Delete a credential (requires auth)
  app.delete('/api/webauthn/credential/:credentialId', requireInventoryAuth, async (req, res) => {
    await storage.deleteWebauthnCredential(req.params.credentialId);
    res.json({ success: true });
  });

  return httpServer;
}
