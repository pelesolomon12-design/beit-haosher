import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { pgTable, text, timestamp, integer, boolean, pgEnum, date } from "drizzle-orm/pg-core";

// Room definition
export interface Room {
  id: string;
  name: string;
  pricePerBed: number;
  maxCapacity: number;
  isWomenOnly?: boolean;
}

// Room management schemas
export const insertRoomSchema = z.object({
  name: z.string().min(1, "יש להזין שם חדר"),
  pricePerBed: z.number().min(1000, "מחיר מינימלי הוא 1,000₪"),
  maxCapacity: z.number().min(1, "קיבולת מינימלית היא 1").max(10, "קיבולת מקסימלית היא 10"),
  isWomenOnly: z.boolean().optional(),
});

export const updateRoomSchema = insertRoomSchema.partial();

export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type UpdateRoom = z.infer<typeof updateRoomSchema>;

// Staying probability enum
export const stayingProbabilityEnum = pgEnum('staying_probability', ['בטוח', 'אולי', 'בטוח שלא']);

// Gender enum
export const genderEnum = pgEnum('gender', ['זכר', 'נקבה']);

// Addiction type enum
export const addictionTypeEnum = pgEnum('addiction_type', ['סמים', 'תרופות', 'הימורים', 'מין', 'אלכוהול']);

// Religion enum - removed, only using isReligious boolean

// Contact relationship enum
export const relationshipEnum = pgEnum('relationship', ['אמא', 'אבא', 'אחות', 'אח', 'בן', 'בת', 'בן/בת זוג', 'חבר/ה', 'אחר']);

// Database schema for occupants
export const occupants = pgTable('occupants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  roomId: text('room_id').notNull(),
  gender: genderEnum('gender').notNull(),
  isReligious: boolean('is_religious').notNull().default(false),
  addictionType: addictionTypeEnum('addiction_type'),
  joinDate: timestamp('join_date').notNull().defaultNow(),
  endDateTime: timestamp('end_date_time').notNull(),
  stayingProbability: stayingProbabilityEnum('staying_probability').notNull().default('אולי'),
  stayingDuration: integer('staying_duration').default(1), // For how many months they are sure/maybe
  plannedMonths: integer('planned_months').notNull().default(1),
  paidMonths: integer('paid_months').notNull().default(0),
  deposits: integer('deposits'),
  initialDeposit: integer('initial_deposit'), // Original deposit amount for tracking
  safeItems: text('safe_items').default('').notNull(),
  borrowedItems: text('borrowed_items').default('').notNull(),
  medicalTreatment: text('medical_treatment').default('').notNull(),
  plannedExitStart: timestamp('planned_exit_start'),
  plannedExitEnd: timestamp('planned_exit_end'),
  privateConsultation: timestamp('private_consultation'),
  clientPhone: text('client_phone'), // Customer's own phone number
  // Contact information
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactRelationship: relationshipEnum('contact_relationship'),
  // Notes
  notes: text('notes').default('').notNull(),
});

// Legacy interface for backward compatibility
export interface Occupant {
  id: string;
  name: string;
  roomId: string;
  gender: 'זכר' | 'נקבה';
  isReligious: boolean;
  addictionType: 'סמים' | 'תרופות' | 'הימורים' | 'מין' | 'אלכוהול' | null;
  joinDate: Date;
  endDateTime: Date;
  stayingProbability: 'בטוח' | 'אולי' | 'בטוח שלא';
  stayingDuration: number | null; // For how many months they are sure/maybe
  plannedMonths: number;
  paidMonths: number;
  deposits: number | null;
  initialDeposit: number | null;
  safeItems: string;
  borrowedItems: string;
  medicalTreatment: string;
  plannedExitStart: Date | null;
  plannedExitEnd: Date | null;
  privateConsultation: Date | null;
  clientPhone: string | null; // Customer's own phone number
  // Contact information
  contactName: string | null;
  contactPhone: string | null;
  contactRelationship: 'אמא' | 'אבא' | 'אחות' | 'אח' | 'בן' | 'בת' | 'בן/בת זוג' | 'חבר/ה' | 'אחר' | null;
  notes: string;
  // Security flags for UI (set by server based on authentication)
  hasMedicalTreatment?: boolean;
  hasNotes?: boolean;
  hasPrivateConsultation?: boolean;
  hasContactInfo?: boolean;
  hasSafeItems?: boolean;
}

// Define the rooms
export const ROOMS: Room[] = [
  { id: "room-gold", name: "חדר גולד", pricePerBed: 25000, maxCapacity: 2 },
  { id: "room-limor", name: "חדר לימור", pricePerBed: 23000, maxCapacity: 3 },
  { id: "room-or", name: "חדר אור", pricePerBed: 25000, maxCapacity: 2 },
  { id: "room-solo", name: "חדר סולו", pricePerBed: 35000, maxCapacity: 1 },
  { id: "room-pela", name: "חדר פלא", pricePerBed: 25000, maxCapacity: 2 },
  { id: "room-agam", name: "חדר אגם", pricePerBed: 25000, maxCapacity: 2, isWomenOnly: true },
];

// Occupant management schemas
export const insertOccupantSchema = z.object({
  name: z.string().min(1, "יש להזין שם"),
  roomId: z.string().min(1, "יש לבחור חדר"),
  gender: z.enum(['זכר', 'נקבה'], { required_error: "יש לבחור מין" }),
  isReligious: z.boolean().default(false),
  addictionType: z.enum(['סמים', 'תרופות', 'הימורים', 'מין', 'אלכוהול']).optional(),
  joinDate: z.date().optional().default(new Date()),
  endDateTime: z.date(),
  stayingProbability: z.enum(['בטוח', 'אולי', 'בטוח שלא']).default('אולי'),
  stayingDuration: z.number().min(1, "מינימום חודש אחד").max(2, "מקסימום 2 חודשים").optional(),
  plannedMonths: z.number().min(1, "מינימום חודש אחד").max(3, "מקסימום 3 חודשים").default(1),
  paidMonths: z.number().min(0, "לא יכול להיות שלילי").max(3, "מקסימום 3 חודשים").default(0),
  deposits: z.number().optional(),
  initialDeposit: z.number().nonnegative().optional(),
  safeItems: z.string().default(''),
  borrowedItems: z.string().default(''),
  medicalTreatment: z.string().default(''),
  plannedExitStart: z.date().optional(),
  plannedExitEnd: z.date().optional(),
  privateConsultation: z.date().optional(),
  clientPhone: z.string().optional(),
  // Contact information - all optional
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactRelationship: z.enum(['אמא', 'אבא', 'אחות', 'אח', 'בן', 'בת', 'בן/בת זוג', 'חבר/ה', 'אחר']).optional(),
  // Notes
  notes: z.string().default(''),
});

export const updateOccupantSchema = insertOccupantSchema.partial();

export type InsertOccupant = z.infer<typeof insertOccupantSchema>;
export type UpdateOccupant = z.infer<typeof updateOccupantSchema>;
export type SelectOccupant = typeof occupants.$inferSelect;

// UI type that includes optional flags for filtered responses
export type UiOccupant = SelectOccupant & {
  hasMedicalTreatment?: boolean;
  hasNotes?: boolean;
  hasPrivateConsultation?: boolean;
  hasContactInfo?: boolean;
  hasSafeItems?: boolean;
};

// Calendar Models

// Daily Tasks table
export const dailyTasks = pgTable('daily_tasks', {
  id: text('id').primaryKey(),
  date: date('date', { mode: 'date' }).notNull(),
  name: text('name').notNull(),
  time: text('time'), // Optional time in HH:mm format (e.g., "09:30", "14:15")
  occupantId: text('occupant_id').references(() => occupants.id), // optional reference to occupant
  note: text('note').default('').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Daily Notes table
export const dailyNotes = pgTable('daily_notes', {
  id: text('id').primaryKey(),
  date: date('date', { mode: 'date' }).notNull().unique(), // one note per day
  content: text('content').default('').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Weekly Notes table
export const weeklyNotes = pgTable('weekly_notes', {
  id: text('id').primaryKey(),
  weekStartDate: date('week_start_date', { mode: 'date' }).notNull().unique(), // Sunday of the week
  content: text('content').default('').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Events table
export const events = pgTable('events', {
  id: text('id').primaryKey(),
  date: date('date', { mode: 'date' }).notNull(),
  name: text('name').notNull(),
  time: text('time'), // Optional time in HH:mm format (e.g., "09:30", "14:15")
  note: text('note').default('').notNull(),
  color: text('color').default('purple').notNull(), // Event color: purple, blue, orange, gold
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Daily Task management schemas
export const insertDailyTaskSchema = createInsertSchema(dailyTasks, {
  date: z.date(),
  name: z.string().min(1, "יש להזין שם משימה"),
  time: z.preprocess(
    (val) => val === '' ? null : val,
    z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "יש להזין שעה תקינה בפורמט HH:mm").nullable().optional()
  ),
  occupantId: z.string().nullable().optional(),
  note: z.string().default(''),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDailyTaskSchema = insertDailyTaskSchema.partial();

export type InsertDailyTask = z.infer<typeof insertDailyTaskSchema>;
export type UpdateDailyTask = z.infer<typeof updateDailyTaskSchema>;
export type SelectDailyTask = typeof dailyTasks.$inferSelect;

// Daily Note management schemas
export const insertDailyNoteSchema = createInsertSchema(dailyNotes, {
  date: z.date(),
  content: z.string().default(''),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDailyNoteSchema = insertDailyNoteSchema.partial();

export type InsertDailyNote = z.infer<typeof insertDailyNoteSchema>;
export type UpdateDailyNote = z.infer<typeof updateDailyNoteSchema>;
export type SelectDailyNote = typeof dailyNotes.$inferSelect;

// Weekly Note management schemas
export const insertWeeklyNoteSchema = createInsertSchema(weeklyNotes, {
  weekStartDate: z.date(),
  content: z.string().default(''),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateWeeklyNoteSchema = insertWeeklyNoteSchema.partial();

export type InsertWeeklyNote = z.infer<typeof insertWeeklyNoteSchema>;
export type UpdateWeeklyNote = z.infer<typeof updateWeeklyNoteSchema>;
export type SelectWeeklyNote = typeof weeklyNotes.$inferSelect;

// Event color options
export const EVENT_COLORS = ['purple', 'blue', 'orange', 'gold'] as const;
export type EventColor = typeof EVENT_COLORS[number];

// Event management schemas
export const insertEventSchema = createInsertSchema(events, {
  date: z.date(),
  name: z.string().min(1, "יש להזין שם אירוע"),
  time: z.preprocess(
    (val) => val === '' ? null : val,
    z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "יש להזין שעה תקינה בפורמט HH:mm").nullable().optional()
  ),
  note: z.string().default(''),
  color: z.enum(EVENT_COLORS).default('purple'),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateEventSchema = insertEventSchema.partial();

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type UpdateEvent = z.infer<typeof updateEventSchema>;
export type SelectEvent = typeof events.$inferSelect;

// Duplicate Schedule schemas
export const duplicateScheduleSchema = z.union([
  // Single date duplication
  z.object({
    sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
  }),
  // Bulk date duplication
  z.object({
    sourceDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD")).min(1, "At least one source date is required"),
    targetDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD")).min(1, "At least one target date is required"),
  }).refine(
    (data) => data.sourceDates.length === data.targetDates.length,
    {
      message: "Source dates and target dates arrays must have the same length",
    }
  ),
]);

export type DuplicateScheduleRequest = z.infer<typeof duplicateScheduleSchema>;

// Duplicate Management Week schema
export const duplicateManagementWeekSchema = z.object({
  sourceWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
  targetWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
  overwrite: z.boolean().default(false),
}).refine(
  (data) => data.sourceWeekStart !== data.targetWeekStart,
  { message: "שבוע המקור ושבוע היעד חייבים להיות שונים" }
);

export type DuplicateManagementWeekRequest = z.infer<typeof duplicateManagementWeekSchema>;

// Inventory Management Models

// Product category enum
export const productCategoryEnum = pgEnum('product_category', ['אוכל ושתייה', 'מוצרי נקיון', 'מוצרים נלווים', 'מוצרים רפואיים']);

// Target Inventory table - defines expected quantities for products
export const targetInventory = pgTable('target_inventory', {
  id: text('id').primaryKey(),
  productName: text('product_name').notNull(), // Can be Hebrew or English
  productNameHebrew: text('product_name_hebrew'), // Hebrew translation if name is in English
  category: text('category').notNull(), // Category name (supports custom categories)
  targetQuantity: integer('target_quantity').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Shopping List table - items to buy
export const shoppingList = pgTable('shopping_list', {
  id: text('id').primaryKey(),
  productName: text('product_name').notNull(),
  productNameHebrew: text('product_name_hebrew'), // Hebrew translation
  category: text('category'), // Category name (supports custom categories)
  currentQuantity: integer('current_quantity').notNull(), // How much we have now
  targetQuantity: integer('target_quantity'), // From target inventory, null if not in target list
  neededQuantity: integer('needed_quantity'), // How much to buy - optional, can be calculated
  isFromTargetList: boolean('is_from_target_list').notNull().default(false), // False for ad-hoc items
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Target Inventory management schemas
export const insertTargetInventorySchema = createInsertSchema(targetInventory, {
  productName: z.string().min(1, "יש להזין שם מוצר"),
  productNameHebrew: z.string().optional(),
  category: z.string().min(1, "יש לבחור קטגוריה"),
  targetQuantity: z.number().min(1, "כמות יעד חייבת להיות לפחות 1"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTargetInventorySchema = insertTargetInventorySchema.partial();

export type InsertTargetInventory = z.infer<typeof insertTargetInventorySchema>;
export type UpdateTargetInventory = z.infer<typeof updateTargetInventorySchema>;
export type SelectTargetInventory = typeof targetInventory.$inferSelect;

// Shopping List management schemas
export const insertShoppingListSchema = createInsertSchema(shoppingList, {
  productName: z.string().min(1, "יש להזין שם מוצר"),
  productNameHebrew: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  currentQuantity: z.number().min(0, "כמות נוכחית לא יכולה להיות שלילית"),
  targetQuantity: z.number().min(0).optional().nullable(),
  neededQuantity: z.number().min(1, "כמות דרושה חייבת להיות לפחות 1").optional().nullable(),
  isFromTargetList: z.boolean().default(false),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateShoppingListSchema = insertShoppingListSchema.partial();

export type InsertShoppingList = z.infer<typeof insertShoppingListSchema>;
export type UpdateShoppingList = z.infer<typeof updateShoppingListSchema>;
export type SelectShoppingList = typeof shoppingList.$inferSelect;

// Custom Inventory Categories table - shared across all users
export const customInventoryCategories = pgTable('custom_inventory_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  icon: text('icon').notNull().default('📦'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Custom Inventory Categories management schemas
export const insertCustomCategorySchema = z.object({
  name: z.string().min(1, "יש להזין שם קטגוריה"),
  icon: z.string().default('📦'),
});

export const updateCustomCategorySchema = insertCustomCategorySchema.partial();

export type InsertCustomCategory = z.infer<typeof insertCustomCategorySchema>;
export type UpdateCustomCategory = z.infer<typeof updateCustomCategorySchema>;
export type SelectCustomCategory = typeof customInventoryCategories.$inferSelect;

// ============================================================
// Weekly Schedule Calendar Models
// ============================================================

// Schedule layer enum - staff schedule vs management schedule
export const scheduleLayerEnum = pgEnum('schedule_layer', ['staff', 'management']);

// Staff role enum - distinguishes staff, management, and other entries
export const staffRoleEnum = pgEnum('staff_role', ['staff', 'management', 'other']);

// Staff Members table - employees with assigned colors
export const staffMembers = pgTable('staff_members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(), // Pastel color hex code
  role: staffRoleEnum('role').notNull().default('staff'), // staff, management, or other
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Schedule Events table - for both staff and management schedules
export const scheduleEvents = pgTable('schedule_events', {
  id: text('id').primaryKey(),
  date: date('date', { mode: 'date' }).notNull(),
  endDate: date('end_date', { mode: 'date' }), // Optional end date for multi-day shifts (null = same day as start)
  title: text('title').notNull(),
  startTime: text('start_time').notNull(), // HH:mm format (e.g., "08:00")
  endTime: text('end_time').notNull(), // HH:mm format (e.g., "16:00")
  layer: scheduleLayerEnum('layer').notNull(),
  staffMemberId: text('staff_member_id').references(() => staffMembers.id), // Legacy - kept for backward compatibility
  note: text('note').default('').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Junction table for multiple staff members per event
export const scheduleEventStaff = pgTable('schedule_event_staff', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().references(() => scheduleEvents.id, { onDelete: 'cascade' }),
  staffMemberId: text('staff_member_id').notNull().references(() => staffMembers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Staff Members management schemas
export const insertStaffMemberSchema = createInsertSchema(staffMembers, {
  name: z.string().min(1, "יש להזין שם עובד"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "יש להזין צבע תקין בפורמט HEX").optional(),
  role: z.enum(['staff', 'management', 'other']).default('staff'),
  isActive: z.boolean().default(true),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateStaffMemberSchema = insertStaffMemberSchema.partial();

export type InsertStaffMember = z.infer<typeof insertStaffMemberSchema>;
export type UpdateStaffMember = z.infer<typeof updateStaffMemberSchema>;
export type SelectStaffMember = typeof staffMembers.$inferSelect;

// Schedule Events management schemas
export const insertScheduleEventSchema = createInsertSchema(scheduleEvents, {
  date: z.date(),
  endDate: z.date().nullable().optional(), // Optional end date for multi-day shifts
  title: z.string().min(1, "יש להזין כותרת"),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "יש להזין שעת התחלה תקינה בפורמט HH:mm"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "יש להזין שעת סיום תקינה בפורמט HH:mm"),
  layer: z.enum(['staff', 'management']),
  staffMemberId: z.string().nullable().optional(),
  note: z.string().default(''),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateScheduleEventSchema = insertScheduleEventSchema.partial();

export type InsertScheduleEvent = z.infer<typeof insertScheduleEventSchema>;
export type UpdateScheduleEvent = z.infer<typeof updateScheduleEventSchema>;
export type SelectScheduleEvent = typeof scheduleEvents.$inferSelect;

// Schedule Event Staff junction schemas
export const insertScheduleEventStaffSchema = createInsertSchema(scheduleEventStaff, {
  eventId: z.string().min(1),
  staffMemberId: z.string().min(1),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertScheduleEventStaff = z.infer<typeof insertScheduleEventStaffSchema>;
export type SelectScheduleEventStaff = typeof scheduleEventStaff.$inferSelect;

// Extended type with multiple staff members
export type ScheduleEventWithStaff = SelectScheduleEvent & {
  staffMember?: SelectStaffMember | null;
  staffMembers?: SelectStaffMember[];
};

// Pastel colors for staff members
export const STAFF_PASTEL_COLORS = [
  '#FFB3BA', // Light pink
  '#BAFFC9', // Light green
  '#BAE1FF', // Light blue
  '#FFFFBA', // Light yellow
  '#FFD1BA', // Light peach
  '#E0BBE4', // Light purple
  '#C9FFE5', // Mint green
  '#FFC3A0', // Light coral
  '#A0E7E5', // Aqua
  '#D4A5A5', // Dusty rose
];

// ==================== Medication Management ====================

// Time of day enum for medications
export const medicationTimeOfDayEnum = pgEnum('medication_time_of_day', ['בוקר', 'צהריים', 'אחה"צ', 'לילה']);

// Medications table - stores the prescription/schedule for each patient
export const medications = pgTable('medications', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').notNull(), // References occupant id
  name: text('name').notNull(), // Medication name
  dosage: text('dosage').notNull(), // e.g., "500mg", "2 tablets"
  timeOfDay: text('time_of_day').array().notNull(), // Array of times: ['בוקר', 'צהריים', 'אחה"צ', 'לילה']
  specificTimes: text('specific_times'), // JSON string mapping timeOfDay to specific hours, e.g., {"morning": "08:00", "noon": "14:00"}
  scheduledDays: text('scheduled_days').array(), // Array of days: ['ראשון','שני',...] or null = every day
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'), // Optional end date
  note: text('note').default(''), // Optional operational note
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Medication logs - tracks when medications were taken
export const medicationLogs = pgTable('medication_logs', {
  id: text('id').primaryKey(),
  medicationId: text('medication_id').notNull(), // References medication id
  patientId: text('patient_id').notNull(), // References occupant id
  date: timestamp('date').notNull(), // The date this log is for
  timeOfDay: text('time_of_day').notNull(), // morning, noon, afternoon, night
  specificHour: text('specific_hour'), // Specific hour for this log, e.g., "14:00" - null if medication has no specific hour
  taken: boolean('taken').notNull().default(false),
  takenAt: timestamp('taken_at'), // When the medication was marked as taken
  markedBy: text('marked_by'), // Who marked it (nurse name or identifier)
  responsibleName: text('responsible_name'), // Name of person who marked medication (for quick access users)
  notes: text('notes').default(''), // Notes from the responsible person - never deleted
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Medication interfaces
export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  timeOfDay: string[];
  specificTimes: string | null; // JSON string mapping timeOfDay to specific hours
  scheduledDays: string[] | null; // null = every day, array = specific days
  startDate: Date;
  endDate: Date | null;
  note: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Helper type for specific times - supports multiple hours per slot
export type SpecificTimesMap = {
  morning?: string | string[];
  noon?: string | string[];
  afternoon?: string | string[];
  night?: string | string[];
};

export interface MedicationLog {
  id: string;
  medicationId: string;
  patientId: string;
  date: Date;
  timeOfDay: string;
  specificHour: string | null;
  taken: boolean;
  takenAt: Date | null;
  markedBy: string | null;
  responsibleName: string | null;
  notes: string | null;
  createdAt: Date;
}

// Medication time of day options
export const MEDICATION_TIMES = ['בוקר', 'צהריים', 'אחה"צ', 'לילה'] as const;
export type MedicationTimeOfDay = typeof MEDICATION_TIMES[number];

// Medication management schemas
export const insertMedicationSchema = z.object({
  patientId: z.string().min(1, "יש לבחור מטופל"),
  name: z.string().min(1, "יש להזין שם תרופה"),
  dosage: z.string().optional().default(''),
  timeOfDay: z.array(z.enum(['morning', 'noon', 'afternoon', 'night'])).optional().default([]),
  specificTimes: z.string().nullable().optional(), // JSON string for specific times
  scheduledDays: z.array(z.string()).nullable().optional(), // null = every day
  startDate: z.date().optional().default(() => new Date()),
  endDate: z.date().nullable().optional(),
  note: z.string().optional().default(''),
  isActive: z.boolean().optional().default(true),
});

export const updateMedicationSchema = insertMedicationSchema.partial();

export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type UpdateMedication = z.infer<typeof updateMedicationSchema>;
export type SelectMedication = typeof medications.$inferSelect;

// Medication log schemas
export const insertMedicationLogSchema = z.object({
  medicationId: z.string().min(1),
  patientId: z.string().min(1),
  date: z.date(),
  timeOfDay: z.enum(['morning', 'noon', 'afternoon', 'night']),
  specificHour: z.string().nullable().optional(), // Specific hour, e.g., "14:00"
  taken: z.boolean().default(false),
  takenAt: z.date().nullable().optional(),
  markedBy: z.string().nullable().optional(),
  responsibleName: z.string().optional(),
  notes: z.string().optional().default(''),
});

export type InsertMedicationLog = z.infer<typeof insertMedicationLogSchema>;
export type SelectMedicationLog = typeof medicationLogs.$inferSelect;

// Extended type for medication with patient info
export type MedicationWithPatient = SelectMedication & {
  patientName: string;
};

// Type for distribution view - grouped by time of day
export interface MedicationDistributionItem {
  patientId: string;
  patientName: string;
  medications: Array<{
    id: string;
    name: string;
    dosage: string;
    note?: string;
    specificTime?: string; // Specific hour for this medication, e.g., "14:00"
    taken: boolean;
    logId?: string;
    isSos?: boolean; // True if this is an SOS medication
    sosReason?: string; // Reason for SOS distribution
    sosResponsible?: string; // Name of responsible person for SOS
    sosTimestamp?: string; // ISO timestamp for SOS medication (client formats it)
  }>;
}

// ==================== Patient Shopping Lists ====================

// Patient shopping list table - stores shopping items per patient
export const patientShoppingLists = pgTable('patient_shopping_lists', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').notNull(),
  patientName: text('patient_name').notNull(),
  items: text('items').notNull().default(''), // Newline-separated list of items
  checkedItems: text('checked_items').array().notNull().default([]), // Array of checked item indices
  totalAmount: text('total_amount').default(''), // Total amount spent
  paymentMethod: text('payment_method').default(''), // Payment method: "", "מזומן", "אשראי"
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export interface PatientShoppingList {
  id: string;
  patientId: string;
  patientName: string;
  items: string;
  checkedItems: string[];
  totalAmount: string | null;
  paymentMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const insertPatientShoppingListSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  items: z.string().default(''),
  checkedItems: z.array(z.string()).default([]),
  totalAmount: z.string().default(''),
  paymentMethod: z.string().default(''),
});

export const updatePatientShoppingListSchema = insertPatientShoppingListSchema.partial();

export type InsertPatientShoppingList = z.infer<typeof insertPatientShoppingListSchema>;
export type UpdatePatientShoppingList = z.infer<typeof updatePatientShoppingListSchema>;
export type SelectPatientShoppingList = typeof patientShoppingLists.$inferSelect;

// ==================== Purchase Transactions ====================

// Purchase transactions table - tracks purchases that deduct from patient deposits
export const purchaseTransactions = pgTable('purchase_transactions', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').notNull(),
  patientName: text('patient_name').notNull(),
  items: text('items').notNull(), // Newline-separated list of purchased items
  totalAmount: integer('total_amount').notNull(), // Amount in shekels
  purchaseDate: timestamp('purchase_date').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export interface PurchaseTransaction {
  id: string;
  patientId: string;
  patientName: string;
  items: string;
  totalAmount: number;
  purchaseDate: Date;
  createdAt: Date;
}

export const insertPurchaseTransactionSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  items: z.string().min(1),
  totalAmount: z.number().min(0),
  purchaseDate: z.date().optional(),
});

export type InsertPurchaseTransaction = z.infer<typeof insertPurchaseTransactionSchema>;
export type SelectPurchaseTransaction = typeof purchaseTransactions.$inferSelect;

// ==================== Deposit History ====================

// Deposit history table - tracks deposits added to patient accounts
export const depositHistory = pgTable('deposit_history', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').notNull(),
  patientName: text('patient_name').notNull(),
  amount: integer('amount').notNull(), // Amount in shekels (positive for additions)
  note: text('note'), // Optional note for the deposit
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export interface DepositHistoryEntry {
  id: string;
  patientId: string;
  patientName: string;
  amount: number;
  note: string | null;
  createdAt: Date;
}

export const insertDepositHistorySchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  amount: z.number().min(1),
  note: z.string().optional(),
});

export type InsertDepositHistory = z.infer<typeof insertDepositHistorySchema>;
export type SelectDepositHistory = typeof depositHistory.$inferSelect;

// ==================== Cash Flow System ====================

// Cash Flow Settings table - stores system settings per year
export const cashFlowSettings = pgTable('cash_flow_settings', {
  id: text('id').primaryKey().default('default'),
  activeYear: integer('active_year').notNull().default(2025),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Cash Flow Opening Balances table - one per year
export const cashFlowOpeningBalances = pgTable('cash_flow_opening_balances', {
  id: text('id').primaryKey(),
  year: integer('year').notNull().unique(),
  openingBalance: integer('opening_balance').notNull().default(0), // In shekels
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Cash Flow Categories table
export const cashFlowCategories = pgTable('cash_flow_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'income', 'expense', or 'both'
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Cash Flow Credit Cards table
export const cashFlowCreditCards = pgTable('cash_flow_credit_cards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  lastFour: text('last_four'), // Last 4 digits
  chargeDay: integer('charge_day').notNull().default(10), // Day of month when charged
  issuer: text('issuer'), // e.g., "ויזה", "מאסטרקארד", "ישראכרט"
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Cash Flow Transactions table
export const cashFlowTransactions = pgTable('cash_flow_transactions', {
  id: text('id').primaryKey(),
  date: timestamp('date').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1-12
  type: text('type').notNull(), // 'income' or 'expense'
  amount: integer('amount').notNull(), // In shekels (positive number)
  categoryId: text('category_id'),
  categoryLabel: text('category_label').notNull(), // Store category name for display
  paymentMethod: text('payment_method').notNull(), // 'העברה מיידית', 'העברה מתוזמנת', 'מזומן', 'אשראי'
  status: text('status').notNull().default('completed'), // 'completed' or 'pending'
  description: text('description').notNull().default(''),
  creditCardId: text('credit_card_id'), // Only for credit card payments
  creditCardName: text('credit_card_name'), // Store card name for display
  checkChargeDate: text('check_charge_date'), // For check payments - when check will be cashed
  recurringGroupId: text('recurring_group_id'), // UUID to group recurring transactions
  isRecurring: boolean('is_recurring').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Types
export type SelectCashFlowSettings = typeof cashFlowSettings.$inferSelect;
export type SelectCashFlowOpeningBalance = typeof cashFlowOpeningBalances.$inferSelect;
export type SelectCashFlowCategory = typeof cashFlowCategories.$inferSelect;
export type SelectCashFlowCreditCard = typeof cashFlowCreditCards.$inferSelect;
export type SelectCashFlowTransaction = typeof cashFlowTransactions.$inferSelect;

// Cash Flow Validation Schemas
export const cashFlowAuthSchema = z.object({
  password: z.string().min(1, "יש להזין סיסמה"),
});

// Insert schemas
export const insertCashFlowCategorySchema = z.object({
  name: z.string().min(1, "יש להזין שם קטגוריה"),
  type: z.enum(['income', 'expense', 'both']),
  isArchived: z.boolean().optional().default(false),
});

export const updateCashFlowCategorySchema = insertCashFlowCategorySchema.partial();
export type InsertCashFlowCategory = z.infer<typeof insertCashFlowCategorySchema>;
export type UpdateCashFlowCategory = z.infer<typeof updateCashFlowCategorySchema>;

export const insertCashFlowCreditCardSchema = z.object({
  name: z.string().min(1, "יש להזין שם כרטיס"),
  lastFour: z.string().length(4, "יש להזין 4 ספרות אחרונות").optional(),
  chargeDay: z.number().min(1).max(31).default(10),
  issuer: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateCashFlowCreditCardSchema = insertCashFlowCreditCardSchema.partial();
export type InsertCashFlowCreditCard = z.infer<typeof insertCashFlowCreditCardSchema>;
export type UpdateCashFlowCreditCard = z.infer<typeof updateCashFlowCreditCardSchema>;

export const insertCashFlowTransactionSchema = z.object({
  date: z.string().min(1, "יש להזין תאריך"),
  year: z.number().min(2020).max(2100),
  month: z.number().min(1).max(12),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive("הסכום חייב להיות חיובי"),
  categoryId: z.string().optional(),
  categoryLabel: z.string().min(1, "יש לבחור קטגוריה"),
  paymentMethod: z.string().min(1, "יש לבחור אמצעי תשלום"),
  status: z.enum(['completed', 'pending']).default('completed'),
  description: z.string().default(''),
  creditCardId: z.string().optional(),
  creditCardName: z.string().optional(),
  checkChargeDate: z.string().optional(),
  recurringGroupId: z.string().optional(),
  isRecurring: z.boolean().optional(),
});

export const updateCashFlowTransactionSchema = z.object({
  date: z.string().optional(),
  year: z.number().min(2020).max(2100).optional(),
  month: z.number().min(1).max(12).optional(),
  type: z.enum(['income', 'expense']).optional(),
  amount: z.number().positive().optional(),
  categoryId: z.string().nullable().optional(),
  categoryLabel: z.string().optional(),
  paymentMethod: z.string().optional(),
  status: z.enum(['completed', 'pending']).optional(),
  description: z.string().optional(),
  creditCardId: z.string().nullable().optional(),
  creditCardName: z.string().nullable().optional(),
  checkChargeDate: z.string().nullable().optional(),
  recurringGroupId: z.string().nullable().optional(),
  isRecurring: z.boolean().optional(),
  convertToOneTime: z.boolean().optional(),
});
export type InsertCashFlowTransaction = z.infer<typeof insertCashFlowTransactionSchema>;
export type UpdateCashFlowTransaction = z.infer<typeof updateCashFlowTransactionSchema>;

export const insertCashFlowOpeningBalanceSchema = z.object({
  year: z.number().min(2020).max(2100),
  openingBalance: z.number(),
});

export type InsertCashFlowOpeningBalance = z.infer<typeof insertCashFlowOpeningBalanceSchema>;

// ==================== SOS Medications ====================

// SOS Medications catalog - nurse-managed
export const sosMedications = pgTable('sos_medications', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  cooldownHours: integer('cooldown_hours').notNull().default(0), // Hours between doses (0 = no limit)
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Patient SOS allergies - per-patient allergies to SOS medications
export const patientSosAllergies = pgTable('patient_sos_allergies', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').notNull(),
  sosMedicationId: text('sos_medication_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// SOS Medication logs - audit trail for SOS distributions
export const sosMedicationLogs = pgTable('sos_medication_logs', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').notNull(),
  sosMedicationId: text('sos_medication_id').notNull(),
  sosMedicationName: text('sos_medication_name').notNull(),
  date: timestamp('date').notNull(),
  reason: text('reason').notNull(),
  responsibleName: text('responsible_name').notNull(),
  nurseOverride: boolean('nurse_override').notNull().default(false), // True if given before cooldown with nurse approval
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// SOS Medication interfaces
export interface SosMedication {
  id: string;
  name: string;
  description: string;
  cooldownHours: number;
  isActive: boolean;
  createdAt: Date;
}

export interface PatientSosAllergy {
  id: string;
  patientId: string;
  sosMedicationId: string;
  createdAt: Date;
}

export interface SosMedicationLog {
  id: string;
  patientId: string;
  sosMedicationId: string;
  sosMedicationName: string;
  date: Date;
  reason: string;
  responsibleName: string;
  nurseOverride: boolean;
  createdAt: Date;
}

// SOS Medication schemas
export const insertSosMedicationSchema = z.object({
  name: z.string().min(1, "יש להזין שם תרופה"),
  description: z.string().optional().default(''),
  cooldownHours: z.number().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateSosMedicationSchema = insertSosMedicationSchema.partial();

export type InsertSosMedication = z.infer<typeof insertSosMedicationSchema>;
export type UpdateSosMedication = z.infer<typeof updateSosMedicationSchema>;
export type SelectSosMedication = typeof sosMedications.$inferSelect;

// Patient SOS allergy schemas
export const insertPatientSosAllergySchema = z.object({
  patientId: z.string().min(1),
  sosMedicationId: z.string().min(1),
});

export type InsertPatientSosAllergy = z.infer<typeof insertPatientSosAllergySchema>;
export type SelectPatientSosAllergy = typeof patientSosAllergies.$inferSelect;

// SOS Medication log schemas
export const insertSosMedicationLogSchema = z.object({
  patientId: z.string().min(1),
  sosMedicationId: z.string().min(1),
  sosMedicationName: z.string().min(1),
  date: z.date(),
  reason: z.string().min(1, "יש להזין סיבה"),
  responsibleName: z.string().min(1, "יש להזין שם אחראי"),
  nurseOverride: z.boolean().optional().default(false),
});

export type InsertSosMedicationLog = z.infer<typeof insertSosMedicationLogSchema>;
export type SelectSosMedicationLog = typeof sosMedicationLogs.$inferSelect;

// ==================== Push Subscriptions ====================

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
}

export const insertPushSubscriptionSchema = z.object({
  endpoint: z.string().min(1),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type SelectPushSubscription = typeof pushSubscriptions.$inferSelect;

// Default categories for initialization
export const DEFAULT_INCOME_CATEGORIES = ['כללי', 'מטופלים', 'תרומות', 'אחר'];
export const DEFAULT_EXPENSE_CATEGORIES = ['כללי', 'ציוד', 'מזון', 'תחזוקה', 'חשמל', 'מים', 'גז', 'ביטוח', 'שכר', 'אחר'];

// Payment methods
export const PAYMENT_METHODS = {
  income: ['העברה מיידית', 'העברה מתוזמנת', 'מזומן', 'צ\'ק'],
  expense: ['העברה מיידית', 'העברה מתוזמנת', 'מזומן', 'צ\'ק', 'אשראי'],
} as const;

// WebAuthn credentials table
export const webauthnCredentials = pgTable('webauthn_credentials', {
  id: text('id').primaryKey(),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  deviceType: text('device_type').notNull().default('singleDevice'),
  backedUp: boolean('backed_up').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type WebauthnCredential = typeof webauthnCredentials.$inferSelect;

// Hebrew month names
export const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
] as const;
