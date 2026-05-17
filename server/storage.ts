import { Room, Occupant, InsertOccupant, InsertRoom, UpdateRoom, UpdateOccupant, SelectOccupant, occupants, SelectDailyTask, InsertDailyTask, UpdateDailyTask, SelectDailyNote, InsertDailyNote, UpdateDailyNote, SelectWeeklyNote, InsertWeeklyNote, UpdateWeeklyNote, SelectEvent, InsertEvent, UpdateEvent, dailyTasks, dailyNotes, weeklyNotes, events, SelectTargetInventory, InsertTargetInventory, UpdateTargetInventory, SelectShoppingList, InsertShoppingList, UpdateShoppingList, targetInventory, shoppingList, SelectStaffMember, InsertStaffMember, UpdateStaffMember, staffMembers, SelectScheduleEvent, InsertScheduleEvent, UpdateScheduleEvent, scheduleEvents, scheduleEventStaff, SelectScheduleEventStaff, ScheduleEventWithStaff, STAFF_PASTEL_COLORS, SelectMedication, InsertMedication, UpdateMedication, SelectMedicationLog, InsertMedicationLog, medications, medicationLogs, MedicationWithPatient, MedicationDistributionItem, SelectPatientShoppingList, InsertPatientShoppingList, UpdatePatientShoppingList, patientShoppingLists, SelectPurchaseTransaction, InsertPurchaseTransaction, purchaseTransactions, SelectDepositHistory, InsertDepositHistory, depositHistory, SelectCustomCategory, InsertCustomCategory, UpdateCustomCategory, customInventoryCategories, cashFlowSettings, cashFlowOpeningBalances, cashFlowCategories, cashFlowCreditCards, cashFlowTransactions, SelectCashFlowSettings, SelectCashFlowOpeningBalance, SelectCashFlowCategory, SelectCashFlowCreditCard, SelectCashFlowTransaction, InsertCashFlowCategory, UpdateCashFlowCategory, InsertCashFlowCreditCard, UpdateCashFlowCreditCard, InsertCashFlowTransaction, UpdateCashFlowTransaction, InsertCashFlowOpeningBalance, SelectSosMedication, InsertSosMedication, UpdateSosMedication, SelectPatientSosAllergy, InsertPatientSosAllergy, SelectSosMedicationLog, InsertSosMedicationLog, sosMedications, patientSosAllergies, sosMedicationLogs, pushSubscriptions, webauthnCredentials } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, or, gte, lte, gt, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Occupant CRUD operations
  getAllOccupants(): Promise<Occupant[]>;
  getOccupantById(id: string): Promise<Occupant | null>;
  createOccupant(occupant: InsertOccupant): Promise<Occupant>;
  updateOccupant(id: string, occupant: UpdateOccupant): Promise<Occupant | null>;
  deleteOccupant(id: string): Promise<boolean>;
  
  // Room CRUD operations
  getAllRooms(): Promise<Room[]>;
  getRoomById(id: string): Promise<Room | null>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: string, room: UpdateRoom): Promise<Room | null>;
  deleteRoom(id: string): Promise<boolean>;
  getOccupantsByRoom(roomId: string): Promise<Occupant[]>;
  
  // Daily Task CRUD operations
  getDailyTasks(date?: Date): Promise<SelectDailyTask[]>;
  createDailyTask(task: InsertDailyTask): Promise<SelectDailyTask>;
  updateDailyTask(id: string, task: UpdateDailyTask): Promise<SelectDailyTask | null>;
  deleteDailyTask(id: string): Promise<boolean>;
  
  // Event CRUD operations
  getEvents(date?: Date): Promise<SelectEvent[]>;
  createEvent(event: InsertEvent): Promise<SelectEvent>;
  updateEvent(id: string, event: UpdateEvent): Promise<SelectEvent | null>;
  deleteEvent(id: string): Promise<boolean>;
  
  // Daily Note CRUD operations
  getDailyNote(date: Date): Promise<SelectDailyNote | null>;
  createOrUpdateDailyNote(note: InsertDailyNote): Promise<SelectDailyNote>;
  deleteDailyNote(date: Date): Promise<boolean>;
  
  // Weekly Note CRUD operations
  getWeeklyNote(weekStartDate: Date): Promise<SelectWeeklyNote | null>;
  createOrUpdateWeeklyNote(note: InsertWeeklyNote): Promise<SelectWeeklyNote>;
  deleteWeeklyNote(weekStartDate: Date): Promise<boolean>;
  
  // Target Inventory CRUD operations
  getAllTargetInventory(): Promise<SelectTargetInventory[]>;
  getTargetInventoryById(id: string): Promise<SelectTargetInventory | null>;
  getTargetInventoryByProductName(productName: string): Promise<SelectTargetInventory | null>;
  createTargetInventory(item: InsertTargetInventory): Promise<SelectTargetInventory>;
  updateTargetInventory(id: string, item: UpdateTargetInventory): Promise<SelectTargetInventory | null>;
  deleteTargetInventory(id: string): Promise<boolean>;
  
  // Shopping List CRUD operations
  getAllShoppingList(): Promise<SelectShoppingList[]>;
  getShoppingListById(id: string): Promise<SelectShoppingList | null>;
  createShoppingListItem(item: InsertShoppingList): Promise<SelectShoppingList>;
  updateShoppingListItem(id: string, item: UpdateShoppingList): Promise<SelectShoppingList | null>;
  deleteShoppingListItem(id: string): Promise<boolean>;
  clearShoppingList(): Promise<boolean>;
  renameShoppingListCategory(oldCategory: string, newCategory: string): Promise<boolean>;
  renameTargetInventoryCategory(oldCategory: string, newCategory: string): Promise<boolean>;
  
  // Custom Inventory Categories CRUD operations
  getAllCustomCategories(): Promise<SelectCustomCategory[]>;
  createCustomCategory(category: InsertCustomCategory): Promise<SelectCustomCategory>;
  updateCustomCategory(id: string, category: UpdateCustomCategory): Promise<SelectCustomCategory | null>;
  deleteCustomCategory(id: string): Promise<boolean>;
  
  // Staff Members CRUD operations
  getAllStaffMembers(): Promise<SelectStaffMember[]>;
  getStaffMemberById(id: string): Promise<SelectStaffMember | null>;
  createStaffMember(member: InsertStaffMember): Promise<SelectStaffMember>;
  updateStaffMember(id: string, member: UpdateStaffMember): Promise<SelectStaffMember | null>;
  deleteStaffMember(id: string): Promise<boolean>;
  
  // Schedule Events CRUD operations
  getScheduleEvents(startDate: Date, endDate: Date): Promise<ScheduleEventWithStaff[]>;
  getScheduleEventById(id: string): Promise<ScheduleEventWithStaff | null>;
  createScheduleEvent(event: InsertScheduleEvent, staffMemberIds?: string[]): Promise<ScheduleEventWithStaff>;
  updateScheduleEvent(id: string, event: UpdateScheduleEvent, staffMemberIds?: string[]): Promise<ScheduleEventWithStaff | null>;
  deleteScheduleEvent(id: string): Promise<boolean>;
  
  // Schedule Event Staff operations
  getEventStaffMembers(eventId: string): Promise<SelectStaffMember[]>;
  setEventStaffMembers(eventId: string, staffMemberIds: string[]): Promise<void>;
  
  // Medication CRUD operations
  getAllMedications(): Promise<SelectMedication[]>;
  getMedicationById(id: string): Promise<SelectMedication | null>;
  getMedicationsByPatient(patientId: string): Promise<SelectMedication[]>;
  createMedication(medication: InsertMedication): Promise<SelectMedication>;
  updateMedication(id: string, medication: UpdateMedication): Promise<SelectMedication | null>;
  deleteMedication(id: string): Promise<boolean>;
  
  // Medication Log operations
  getMedicationLogs(patientId: string, startDate?: Date, endDate?: Date): Promise<SelectMedicationLog[]>;
  getMedicationLogsByDate(date: Date): Promise<SelectMedicationLog[]>;
  createOrUpdateMedicationLog(log: InsertMedicationLog): Promise<SelectMedicationLog>;
  getDistributionView(date: Date, timeOfDay: string): Promise<MedicationDistributionItem[]>;
  getAuditLog(limit?: number): Promise<any[]>;
  
  // Patient Shopping List operations
  getAllPatientShoppingLists(): Promise<SelectPatientShoppingList[]>;
  getPatientShoppingListById(id: string): Promise<SelectPatientShoppingList | null>;
  createPatientShoppingList(list: InsertPatientShoppingList): Promise<SelectPatientShoppingList>;
  updatePatientShoppingList(id: string, list: UpdatePatientShoppingList): Promise<SelectPatientShoppingList | null>;
  deletePatientShoppingList(id: string): Promise<boolean>;
  deleteAllPatientShoppingLists(): Promise<boolean>;
  
  // Purchase Transaction operations
  getPurchaseTransactionsByPatient(patientId: string): Promise<SelectPurchaseTransaction[]>;
  createPurchaseTransaction(transaction: InsertPurchaseTransaction): Promise<SelectPurchaseTransaction>;
  
  // Deposit History operations
  getDepositHistoryByPatient(patientId: string): Promise<SelectDepositHistory[]>;
  createDepositHistory(entry: InsertDepositHistory): Promise<SelectDepositHistory>;
  
  // Cash Flow Settings operations
  getCashFlowSettings(): Promise<SelectCashFlowSettings | null>;
  updateCashFlowActiveYear(year: number): Promise<SelectCashFlowSettings>;
  
  // Cash Flow Opening Balances operations
  getCashFlowOpeningBalances(): Promise<SelectCashFlowOpeningBalance[]>;
  getCashFlowOpeningBalance(year: number): Promise<SelectCashFlowOpeningBalance | null>;
  setCashFlowOpeningBalance(year: number, balance: number): Promise<SelectCashFlowOpeningBalance>;
  
  // Cash Flow Categories operations
  getCashFlowCategories(): Promise<SelectCashFlowCategory[]>;
  getCashFlowCategoriesByType(type: 'income' | 'expense' | 'both'): Promise<SelectCashFlowCategory[]>;
  createCashFlowCategory(category: InsertCashFlowCategory): Promise<SelectCashFlowCategory>;
  updateCashFlowCategory(id: string, category: UpdateCashFlowCategory): Promise<SelectCashFlowCategory | null>;
  deleteCashFlowCategory(id: string): Promise<boolean>;
  
  // Cash Flow Credit Cards operations
  getCashFlowCreditCards(): Promise<SelectCashFlowCreditCard[]>;
  getCashFlowCreditCardById(id: string): Promise<SelectCashFlowCreditCard | null>;
  createCashFlowCreditCard(card: InsertCashFlowCreditCard): Promise<SelectCashFlowCreditCard>;
  updateCashFlowCreditCard(id: string, card: UpdateCashFlowCreditCard): Promise<SelectCashFlowCreditCard | null>;
  deleteCashFlowCreditCard(id: string): Promise<boolean>;
  
  // Cash Flow Transactions operations
  getCashFlowTransactions(year: number, month?: number): Promise<SelectCashFlowTransaction[]>;
  getCashFlowTransactionById(id: string): Promise<SelectCashFlowTransaction | null>;
  createCashFlowTransaction(transaction: InsertCashFlowTransaction): Promise<SelectCashFlowTransaction>;
  updateCashFlowTransaction(id: string, transaction: UpdateCashFlowTransaction): Promise<SelectCashFlowTransaction | null>;
  deleteCashFlowTransaction(id: string): Promise<boolean>;
  deleteFutureRecurringTransactions?(recurringGroupId: string, afterDate: Date): Promise<number>;
  
  // Cash Flow Balance calculations
  getCashFlowBalances(year: number): Promise<{ openingBalance: number; bankBalance: number; expectedBalance: number }>;
  getCashFlowMonthlySummary(year: number): Promise<Array<{ month: number; income: number; expense: number; net: number }>>;
  
  // SOS Medications CRUD operations
  getAllSosMedications(): Promise<SelectSosMedication[]>;
  getSosMedicationById(id: string): Promise<SelectSosMedication | null>;
  createSosMedication(medication: InsertSosMedication): Promise<SelectSosMedication>;
  updateSosMedication(id: string, medication: UpdateSosMedication): Promise<SelectSosMedication | null>;
  deleteSosMedication(id: string): Promise<boolean>;
  
  // Patient SOS Allergies operations
  getPatientSosAllergies(patientId: string): Promise<SelectPatientSosAllergy[]>;
  setPatientSosAllergies(patientId: string, sosMedicationIds: string[]): Promise<void>;
  
  // SOS Medication Logs operations
  getSosMedicationLogs(limit?: number): Promise<SelectSosMedicationLog[]>;
  getSosMedicationLogsByPatient(patientId: string): Promise<SelectSosMedicationLog[]>;
  getSosMedicationLogsByDate(date: string): Promise<SelectSosMedicationLog[]>;
  createSosMedicationLog(log: InsertSosMedicationLog): Promise<SelectSosMedicationLog>;
  deleteSosMedicationLog(id: string): Promise<boolean>;
  
  // Push Subscriptions operations
  getAllPushSubscriptions(): Promise<any[]>;
  createPushSubscription(subscription: { endpoint: string; p256dh: string; auth: string }): Promise<any>;
  deletePushSubscription(endpoint: string): Promise<boolean>;

  // WebAuthn operations
  getWebauthnCredentials(): Promise<any[]>;
  saveWebauthnCredential(cred: { id: string; credentialId: string; publicKey: string; counter: number; deviceType: string; backedUp: boolean }): Promise<any>;
  updateWebauthnCredentialCounter(id: string, counter: number): Promise<void>;
  deleteWebauthnCredential(credentialId: string): Promise<void>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private occupants: Occupant[] = [];
  private dailyTasks: SelectDailyTask[] = [];
  private events: SelectEvent[] = [];
  private dailyNotes: SelectDailyNote[] = [];
  private weeklyNotes: SelectWeeklyNote[] = [];
  private targetInventory: SelectTargetInventory[] = [];
  private shoppingList: SelectShoppingList[] = [];
  private rooms: Room[] = [
    { id: "room-alef",   name: "חדר א'", pricePerBed: 8500,  maxCapacity: 2 },
    { id: "room-bet",    name: "חדר ב'", pricePerBed: 9000,  maxCapacity: 2 },
    { id: "room-gimel",  name: "חדר ג'", pricePerBed: 10000, maxCapacity: 2 },
    { id: "room-dalet",  name: "חדר ד'", pricePerBed: 11000, maxCapacity: 3 },
    { id: "room-heh",    name: "חדר ה'", pricePerBed: 12000, maxCapacity: 2 },
    { id: "room-vav",    name: "חדר ו'", pricePerBed: 10500, maxCapacity: 2 },
    { id: "room-zayin",  name: "חדר ז'", pricePerBed: 13500, maxCapacity: 1 },
    { id: "room-chet",   name: "חדר ח'", pricePerBed: 9500,  maxCapacity: 2, isWomenOnly: true },
    { id: "room-tet",    name: "חדר ט'", pricePerBed: 11500, maxCapacity: 3, isWomenOnly: true },
  ];

  async getAllOccupants(): Promise<Occupant[]> {
    return [...this.occupants];
  }

  async getOccupantById(id: string): Promise<Occupant | null> {
    return this.occupants.find(o => o.id === id) || null;
  }

  async createOccupant(occupantData: InsertOccupant): Promise<Occupant> {
    console.log('Storage creating occupant:', { 
      name: occupantData.name,
      roomId: occupantData.roomId,
      gender: occupantData.gender,
      hasMedicalTreatment: !!(occupantData.medicalTreatment && occupantData.medicalTreatment.trim()),
      hasNotes: !!(occupantData.notes && occupantData.notes.trim())
    });
    
    const occupant: Occupant = {
      id: randomUUID(),
      name: occupantData.name,
      roomId: occupantData.roomId,
      gender: occupantData.gender,
      isReligious: occupantData.isReligious || false,
      addictionType: occupantData.addictionType || null,
      joinDate: occupantData.joinDate || new Date(),
      endDateTime: occupantData.endDateTime,
      stayingProbability: occupantData.stayingProbability || 'אולי',
      stayingDuration: occupantData.stayingDuration || null,
      plannedMonths: occupantData.plannedMonths || 1,
      paidMonths: occupantData.paidMonths || 0,
      deposits: occupantData.deposits || null,
      initialDeposit: occupantData.initialDeposit || occupantData.deposits || null,
      safeItems: occupantData.safeItems || '',
      borrowedItems: occupantData.borrowedItems || '',
      medicalTreatment: occupantData.medicalTreatment || '',
      plannedExitStart: occupantData.plannedExitStart || null,
      plannedExitEnd: occupantData.plannedExitEnd || null,
      privateConsultation: occupantData.privateConsultation || null,
      clientPhone: occupantData.clientPhone || null,
      // Contact information
      contactName: occupantData.contactName || null,
      contactPhone: occupantData.contactPhone || null,
      contactRelationship: occupantData.contactRelationship || null,
      // Notes
      notes: occupantData.notes || '',
    };
    
    console.log('Storage created occupant:', {
      id: occupant.id,
      name: occupant.name,
      roomId: occupant.roomId,
      hasMedicalData: !!(occupant.medicalTreatment && occupant.medicalTreatment.trim())
    });
    
    this.occupants.push(occupant);
    return occupant;
  }

  async updateOccupant(id: string, occupantData: UpdateOccupant): Promise<Occupant | null> {
    const index = this.occupants.findIndex(o => o.id === id);
    if (index === -1) return null;

    this.occupants[index] = {
      ...this.occupants[index],
      ...occupantData,
    };
    return this.occupants[index];
  }

  async deleteOccupant(id: string): Promise<boolean> {
    const index = this.occupants.findIndex(o => o.id === id);
    if (index === -1) return false;

    this.occupants.splice(index, 1);
    return true;
  }

  async getAllRooms(): Promise<Room[]> {
    return [...this.rooms];
  }

  async getRoomById(id: string): Promise<Room | null> {
    return this.rooms.find(r => r.id === id) || null;
  }

  async createRoom(roomData: InsertRoom): Promise<Room> {
    const room: Room = {
      id: randomUUID(),
      ...roomData,
    };
    this.rooms.push(room);
    return room;
  }

  async updateRoom(id: string, roomData: UpdateRoom): Promise<Room | null> {
    const index = this.rooms.findIndex(r => r.id === id);
    if (index === -1) return null;

    this.rooms[index] = {
      ...this.rooms[index],
      ...roomData,
    };
    return this.rooms[index];
  }

  async deleteRoom(id: string): Promise<boolean> {
    const index = this.rooms.findIndex(r => r.id === id);
    if (index === -1) return false;

    // Check if room has occupants
    const hasOccupants = this.occupants.some(o => o.roomId === id);
    if (hasOccupants) return false; // Cannot delete room with occupants

    this.rooms.splice(index, 1);
    return true;
  }

  async getOccupantsByRoom(roomId: string): Promise<Occupant[]> {
    return this.occupants.filter(o => o.roomId === roomId);
  }

  // Daily Task CRUD operations
  async getDailyTasks(date?: Date): Promise<SelectDailyTask[]> {
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      return this.dailyTasks.filter(task => {
        const taskDate = new Date(task.date);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === targetDate.getTime();
      });
    }
    return [...this.dailyTasks];
  }

  async createDailyTask(taskData: InsertDailyTask): Promise<SelectDailyTask> {
    const now = new Date();
    const task: SelectDailyTask = {
      id: randomUUID(),
      date: taskData.date,
      name: taskData.name,
      time: taskData.time || null,
      occupantId: taskData.occupantId || null,
      note: taskData.note || '',
      createdAt: now,
      updatedAt: now,
    };
    this.dailyTasks.push(task);
    return task;
  }

  async updateDailyTask(id: string, taskData: UpdateDailyTask): Promise<SelectDailyTask | null> {
    const index = this.dailyTasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    this.dailyTasks[index] = {
      ...this.dailyTasks[index],
      ...taskData,
      updatedAt: new Date(),
    };
    return this.dailyTasks[index];
  }

  async deleteDailyTask(id: string): Promise<boolean> {
    const index = this.dailyTasks.findIndex(t => t.id === id);
    if (index === -1) return false;

    this.dailyTasks.splice(index, 1);
    return true;
  }

  // Event CRUD operations
  async getEvents(date?: Date): Promise<SelectEvent[]> {
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      return this.events.filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() === targetDate.getTime();
      });
    }
    return [...this.events];
  }

  async createEvent(eventData: InsertEvent): Promise<SelectEvent> {
    const now = new Date();
    const event: SelectEvent = {
      id: randomUUID(),
      date: eventData.date,
      name: eventData.name,
      time: eventData.time || null,
      note: eventData.note || '',
      color: eventData.color || 'purple',
      createdAt: now,
      updatedAt: now,
    };
    this.events.push(event);
    return event;
  }

  async updateEvent(id: string, eventData: UpdateEvent): Promise<SelectEvent | null> {
    const index = this.events.findIndex(e => e.id === id);
    if (index === -1) return null;

    this.events[index] = {
      ...this.events[index],
      ...eventData,
      updatedAt: new Date(),
    };
    return this.events[index];
  }

  async deleteEvent(id: string): Promise<boolean> {
    const index = this.events.findIndex(e => e.id === id);
    if (index === -1) return false;

    this.events.splice(index, 1);
    return true;
  }

  // Daily Note CRUD operations
  async getDailyNote(date: Date): Promise<SelectDailyNote | null> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    return this.dailyNotes.find(note => {
      const noteDate = new Date(note.date);
      noteDate.setHours(0, 0, 0, 0);
      return noteDate.getTime() === targetDate.getTime();
    }) || null;
  }

  async createOrUpdateDailyNote(noteData: InsertDailyNote): Promise<SelectDailyNote> {
    const existingNote = await this.getDailyNote(noteData.date);
    const now = new Date();

    if (existingNote) {
      // Update existing note
      const index = this.dailyNotes.findIndex(n => n.id === existingNote.id);
      this.dailyNotes[index] = {
        ...existingNote,
        content: noteData.content || '',
        updatedAt: now,
      };
      return this.dailyNotes[index];
    } else {
      // Create new note
      const note: SelectDailyNote = {
        id: randomUUID(),
        date: noteData.date,
        content: noteData.content || '',
        createdAt: now,
        updatedAt: now,
      };
      this.dailyNotes.push(note);
      return note;
    }
  }

  async deleteDailyNote(date: Date): Promise<boolean> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const index = this.dailyNotes.findIndex(note => {
      const noteDate = new Date(note.date);
      noteDate.setHours(0, 0, 0, 0);
      return noteDate.getTime() === targetDate.getTime();
    });
    
    if (index === -1) return false;

    this.dailyNotes.splice(index, 1);
    return true;
  }

  // Weekly Note CRUD operations
  async getWeeklyNote(weekStartDate: Date): Promise<SelectWeeklyNote | null> {
    const targetDate = new Date(weekStartDate);
    targetDate.setHours(0, 0, 0, 0);
    
    return this.weeklyNotes.find(note => {
      const noteDate = new Date(note.weekStartDate);
      noteDate.setHours(0, 0, 0, 0);
      return noteDate.getTime() === targetDate.getTime();
    }) || null;
  }

  async createOrUpdateWeeklyNote(noteData: InsertWeeklyNote): Promise<SelectWeeklyNote> {
    const existingNote = await this.getWeeklyNote(noteData.weekStartDate);
    const now = new Date();

    if (existingNote) {
      // Update existing note
      const index = this.weeklyNotes.findIndex(n => n.id === existingNote.id);
      this.weeklyNotes[index] = {
        ...existingNote,
        content: noteData.content || '',
        updatedAt: now,
      };
      return this.weeklyNotes[index];
    } else {
      // Create new note
      const note: SelectWeeklyNote = {
        id: randomUUID(),
        weekStartDate: noteData.weekStartDate,
        content: noteData.content || '',
        createdAt: now,
        updatedAt: now,
      };
      this.weeklyNotes.push(note);
      return note;
    }
  }

  async deleteWeeklyNote(weekStartDate: Date): Promise<boolean> {
    const targetDate = new Date(weekStartDate);
    targetDate.setHours(0, 0, 0, 0);
    
    const index = this.weeklyNotes.findIndex(note => {
      const noteDate = new Date(note.weekStartDate);
      noteDate.setHours(0, 0, 0, 0);
      return noteDate.getTime() === targetDate.getTime();
    });
    
    if (index === -1) return false;

    this.weeklyNotes.splice(index, 1);
    return true;
  }

  // Target Inventory CRUD operations
  async getAllTargetInventory(): Promise<SelectTargetInventory[]> {
    return [...this.targetInventory];
  }

  async getTargetInventoryById(id: string): Promise<SelectTargetInventory | null> {
    return this.targetInventory.find(item => item.id === id) || null;
  }

  async getTargetInventoryByProductName(productName: string): Promise<SelectTargetInventory | null> {
    const normalizedName = productName.toLowerCase().trim();
    return this.targetInventory.find(item => 
      item.productName.toLowerCase().trim() === normalizedName ||
      (item.productNameHebrew && item.productNameHebrew.toLowerCase().trim() === normalizedName)
    ) || null;
  }

  async createTargetInventory(itemData: InsertTargetInventory): Promise<SelectTargetInventory> {
    const now = new Date();
    const item: SelectTargetInventory = {
      id: randomUUID(),
      productName: itemData.productName,
      productNameHebrew: itemData.productNameHebrew || null,
      category: itemData.category,
      targetQuantity: itemData.targetQuantity,
      createdAt: now,
      updatedAt: now,
    };
    this.targetInventory.push(item);
    return item;
  }

  async updateTargetInventory(id: string, itemData: UpdateTargetInventory): Promise<SelectTargetInventory | null> {
    const index = this.targetInventory.findIndex(item => item.id === id);
    if (index === -1) return null;

    this.targetInventory[index] = {
      ...this.targetInventory[index],
      ...itemData,
      updatedAt: new Date(),
    };
    return this.targetInventory[index];
  }

  async deleteTargetInventory(id: string): Promise<boolean> {
    const index = this.targetInventory.findIndex(item => item.id === id);
    if (index === -1) return false;

    this.targetInventory.splice(index, 1);
    return true;
  }

  // Shopping List CRUD operations
  async getAllShoppingList(): Promise<SelectShoppingList[]> {
    return [...this.shoppingList];
  }

  async getShoppingListById(id: string): Promise<SelectShoppingList | null> {
    return this.shoppingList.find(item => item.id === id) || null;
  }

  async createShoppingListItem(itemData: InsertShoppingList): Promise<SelectShoppingList> {
    const now = new Date();
    const item: SelectShoppingList = {
      id: randomUUID(),
      productName: itemData.productName,
      productNameHebrew: itemData.productNameHebrew || null,
      category: itemData.category || null,
      currentQuantity: itemData.currentQuantity,
      targetQuantity: itemData.targetQuantity || null,
      neededQuantity: itemData.neededQuantity ?? null,
      isFromTargetList: itemData.isFromTargetList ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.shoppingList.push(item);
    return item;
  }

  async updateShoppingListItem(id: string, itemData: UpdateShoppingList): Promise<SelectShoppingList | null> {
    const index = this.shoppingList.findIndex(item => item.id === id);
    if (index === -1) return null;

    this.shoppingList[index] = {
      ...this.shoppingList[index],
      ...itemData,
      updatedAt: new Date(),
    };
    return this.shoppingList[index];
  }

  async deleteShoppingListItem(id: string): Promise<boolean> {
    const index = this.shoppingList.findIndex(item => item.id === id);
    if (index === -1) return false;

    this.shoppingList.splice(index, 1);
    return true;
  }

  async clearShoppingList(): Promise<boolean> {
    this.shoppingList = [];
    return true;
  }

  async renameShoppingListCategory(oldCategory: string, newCategory: string): Promise<boolean> {
    this.shoppingList.forEach(item => {
      if (item.category === oldCategory) {
        item.category = newCategory;
      }
    });
    return true;
  }

  async renameTargetInventoryCategory(oldCategory: string, newCategory: string): Promise<boolean> {
    this.targetInventory.forEach(item => {
      if (item.category === oldCategory) {
        item.category = newCategory;
      }
    });
    return true;
  }

  // Custom Inventory Categories (in-memory storage)
  private customCategoriesData: SelectCustomCategory[] = [];

  async getAllCustomCategories(): Promise<SelectCustomCategory[]> {
    return [...this.customCategoriesData];
  }

  async createCustomCategory(categoryData: InsertCustomCategory): Promise<SelectCustomCategory> {
    const category: SelectCustomCategory = {
      id: randomUUID(),
      name: categoryData.name,
      icon: categoryData.icon || '📦',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.customCategoriesData.push(category);
    return category;
  }

  async updateCustomCategory(id: string, categoryData: UpdateCustomCategory): Promise<SelectCustomCategory | null> {
    const index = this.customCategoriesData.findIndex(c => c.id === id);
    if (index === -1) return null;
    this.customCategoriesData[index] = { ...this.customCategoriesData[index], ...categoryData, updatedAt: new Date() };
    return this.customCategoriesData[index];
  }

  async deleteCustomCategory(id: string): Promise<boolean> {
    const index = this.customCategoriesData.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.customCategoriesData.splice(index, 1);
    return true;
  }

  // Staff Members CRUD operations (stub for MemStorage)
  private staffMembersData: SelectStaffMember[] = [];
  private scheduleEventsList: SelectScheduleEvent[] = [];

  async getAllStaffMembers(): Promise<SelectStaffMember[]> {
    return [...this.staffMembersData];
  }

  async getStaffMemberById(id: string): Promise<SelectStaffMember | null> {
    return this.staffMembersData.find(m => m.id === id) || null;
  }

  async createStaffMember(memberData: InsertStaffMember): Promise<SelectStaffMember> {
    const usedColors = this.staffMembersData.map(m => m.color);
    const availableColor = STAFF_PASTEL_COLORS.find(c => !usedColors.includes(c)) || STAFF_PASTEL_COLORS[0];
    
    const member: SelectStaffMember = {
      id: randomUUID(),
      name: memberData.name,
      color: memberData.color || availableColor,
      role: memberData.role || 'staff',
      isActive: memberData.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.staffMembersData.push(member);
    return member;
  }

  async updateStaffMember(id: string, memberData: UpdateStaffMember): Promise<SelectStaffMember | null> {
    const index = this.staffMembersData.findIndex(m => m.id === id);
    if (index === -1) return null;
    this.staffMembersData[index] = { ...this.staffMembersData[index], ...memberData, updatedAt: new Date() };
    return this.staffMembersData[index];
  }

  async deleteStaffMember(id: string): Promise<boolean> {
    const index = this.staffMembersData.findIndex(m => m.id === id);
    if (index === -1) return false;
    this.staffMembersData.splice(index, 1);
    return true;
  }

  // Schedule Events CRUD operations (stub for MemStorage)
  private eventStaffMap: Map<string, string[]> = new Map();

  async getScheduleEvents(startDate: Date, endDate: Date): Promise<ScheduleEventWithStaff[]> {
    const filtered = this.scheduleEventsList.filter(e => {
      const eventStartDate = new Date(e.date);
      const eventEndDate = e.endDate ? new Date(e.endDate) : eventStartDate;
      
      // Event overlaps with query range if:
      // - Event starts within range, OR
      // - Event ends within range, OR
      // - Event spans the entire range
      return (eventStartDate >= startDate && eventStartDate <= endDate) ||
             (eventEndDate >= startDate && eventEndDate <= endDate) ||
             (eventStartDate <= startDate && eventEndDate >= endDate);
    });
    
    return Promise.all(filtered.map(async e => {
      const eventStaff = await this.getEventStaffMembers(e.id);
      const legacyStaff = e.staffMemberId ? this.staffMembersData.find((s: SelectStaffMember) => s.id === e.staffMemberId) : null;
      return {
        ...e,
        staffMember: legacyStaff || null,
        staffMembers: eventStaff.length > 0 ? eventStaff : (legacyStaff ? [legacyStaff] : []),
      };
    }));
  }

  async getScheduleEventById(id: string): Promise<ScheduleEventWithStaff | null> {
    const event = this.scheduleEventsList.find(e => e.id === id);
    if (!event) return null;
    
    const eventStaff = await this.getEventStaffMembers(id);
    const legacyStaff = event.staffMemberId ? this.staffMembersData.find((s: SelectStaffMember) => s.id === event.staffMemberId) : null;
    return {
      ...event,
      staffMember: legacyStaff || null,
      staffMembers: eventStaff.length > 0 ? eventStaff : (legacyStaff ? [legacyStaff] : []),
    };
  }

  async createScheduleEvent(eventData: InsertScheduleEvent, staffMemberIds?: string[]): Promise<ScheduleEventWithStaff> {
    const eventId = randomUUID();
    const event: SelectScheduleEvent = {
      id: eventId,
      date: eventData.date,
      endDate: eventData.endDate || null,
      title: eventData.title,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      layer: eventData.layer,
      staffMemberId: eventData.staffMemberId || null,
      note: eventData.note || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.scheduleEventsList.push(event);
    
    if (staffMemberIds && staffMemberIds.length > 0) {
      await this.setEventStaffMembers(eventId, staffMemberIds);
    } else if (eventData.staffMemberId) {
      await this.setEventStaffMembers(eventId, [eventData.staffMemberId]);
    }
    
    return (await this.getScheduleEventById(eventId))!;
  }

  async updateScheduleEvent(id: string, eventData: UpdateScheduleEvent, staffMemberIds?: string[]): Promise<ScheduleEventWithStaff | null> {
    const index = this.scheduleEventsList.findIndex(e => e.id === id);
    if (index === -1) return null;
    this.scheduleEventsList[index] = { ...this.scheduleEventsList[index], ...eventData, updatedAt: new Date() };
    
    if (staffMemberIds !== undefined) {
      await this.setEventStaffMembers(id, staffMemberIds);
    }
    
    return await this.getScheduleEventById(id);
  }

  async deleteScheduleEvent(id: string): Promise<boolean> {
    const index = this.scheduleEventsList.findIndex(e => e.id === id);
    if (index === -1) return false;
    this.scheduleEventsList.splice(index, 1);
    this.eventStaffMap.delete(id);
    return true;
  }
  
  async getEventStaffMembers(eventId: string): Promise<SelectStaffMember[]> {
    const staffIds = this.eventStaffMap.get(eventId) || [];
    return this.staffMembersData.filter(s => staffIds.includes(s.id));
  }
  
  async setEventStaffMembers(eventId: string, staffMemberIds: string[]): Promise<void> {
    this.eventStaffMap.set(eventId, staffMemberIds);
  }
  
  // Medication storage
  private medicationsData: SelectMedication[] = [];
  private medicationLogsData: SelectMedicationLog[] = [];
  
  async getAllMedications(): Promise<SelectMedication[]> {
    return [...this.medicationsData];
  }
  
  async getMedicationById(id: string): Promise<SelectMedication | null> {
    return this.medicationsData.find(m => m.id === id) || null;
  }
  
  async getMedicationsByPatient(patientId: string): Promise<SelectMedication[]> {
    return this.medicationsData.filter(m => m.patientId === patientId);
  }
  
  async createMedication(medication: InsertMedication): Promise<SelectMedication> {
    const newMedication: SelectMedication = {
      id: randomUUID(),
      patientId: medication.patientId,
      name: medication.name,
      dosage: medication.dosage,
      timeOfDay: medication.timeOfDay,
      specificTimes: medication.specificTimes || null,
      scheduledDays: medication.scheduledDays || null,
      startDate: medication.startDate,
      endDate: medication.endDate || null,
      note: medication.note || '',
      isActive: medication.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.medicationsData.push(newMedication);
    return newMedication;
  }
  
  async updateMedication(id: string, medication: UpdateMedication): Promise<SelectMedication | null> {
    const index = this.medicationsData.findIndex(m => m.id === id);
    if (index === -1) return null;
    this.medicationsData[index] = { 
      ...this.medicationsData[index], 
      ...medication, 
      updatedAt: new Date() 
    };
    return this.medicationsData[index];
  }
  
  async deleteMedication(id: string): Promise<boolean> {
    const index = this.medicationsData.findIndex(m => m.id === id);
    if (index === -1) return false;
    this.medicationsData.splice(index, 1);
    return true;
  }
  
  async getMedicationLogs(patientId: string, startDate?: Date, endDate?: Date): Promise<SelectMedicationLog[]> {
    return this.medicationLogsData.filter(log => {
      if (log.patientId !== patientId) return false;
      if (startDate && log.date < startDate) return false;
      if (endDate && log.date > endDate) return false;
      return true;
    });
  }
  
  async getMedicationLogsByDate(date: Date): Promise<SelectMedicationLog[]> {
    const dateStr = date.toISOString().split('T')[0];
    return this.medicationLogsData.filter(log => {
      const logDateStr = log.date.toISOString().split('T')[0];
      return logDateStr === dateStr;
    });
  }
  
  async createOrUpdateMedicationLog(log: InsertMedicationLog): Promise<SelectMedicationLog> {
    const dateStr = log.date.toISOString().split('T')[0];
    const existingIndex = this.medicationLogsData.findIndex(l => {
      const logDateStr = l.date.toISOString().split('T')[0];
      return l.medicationId === log.medicationId && 
             logDateStr === dateStr && 
             l.timeOfDay === log.timeOfDay &&
             (l.specificHour || null) === (log.specificHour || null);
    });
    
    if (existingIndex !== -1) {
      this.medicationLogsData[existingIndex] = {
        ...this.medicationLogsData[existingIndex],
        taken: log.taken,
        takenAt: log.taken ? new Date() : null,
        markedBy: log.markedBy || null,
        responsibleName: log.responsibleName || null,
        notes: log.notes || '',
      };
      return this.medicationLogsData[existingIndex];
    }
    
    const newLog: SelectMedicationLog = {
      id: randomUUID(),
      medicationId: log.medicationId,
      patientId: log.patientId,
      date: log.date,
      timeOfDay: log.timeOfDay,
      specificHour: log.specificHour || null,
      taken: log.taken,
      takenAt: log.taken ? new Date() : null,
      markedBy: log.markedBy || null,
      responsibleName: log.responsibleName || null,
      notes: log.notes || '',
      createdAt: new Date(),
    };
    this.medicationLogsData.push(newLog);
    return newLog;
  }
  
  async getDistributionView(date: Date, timeOfDay: string): Promise<MedicationDistributionItem[]> {
    const dateStr = date.toISOString().split('T')[0];
    const todayLogs = await this.getMedicationLogsByDate(date);
    const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = DAY_NAMES[date.getDay()];

    // Get all active medications for the specified time of day
    const activeMedications = this.medicationsData.filter(m => {
      if (!m.isActive) return false;
      if (!m.timeOfDay.includes(timeOfDay)) return false;
      const startDateStr = m.startDate.toISOString().split('T')[0];
      if (startDateStr > dateStr) return false;
      if (m.endDate) {
        const endDateStr = m.endDate.toISOString().split('T')[0];
        if (endDateStr < dateStr) return false;
      }
      if ((m as any).scheduledDays && !(m as any).scheduledDays.includes(dayName)) return false;
      return true;
    });
    
    // Group by patient
    const patientMap = new Map<string, MedicationDistributionItem>();
    
    for (const med of activeMedications) {
      const patient = this.occupants.find(o => o.id === med.patientId);
      if (!patient) continue;
      
      if (!patientMap.has(med.patientId)) {
        patientMap.set(med.patientId, {
          patientId: med.patientId,
          patientName: patient.name,
          medications: [],
        });
      }
      
      // Parse specificTimes - supports both single hour and array of hours
      let specificHours: string[] = [];
      if ((med as any).specificTimes) {
        try {
          const parsedTimes = JSON.parse((med as any).specificTimes);
          const slotValue = parsedTimes[timeOfDay];
          if (slotValue) {
            specificHours = Array.isArray(slotValue) ? slotValue : [slotValue];
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Add one entry per specific hour, or one entry with no hour if none specified
      if (specificHours.length > 0) {
        for (const hour of specificHours) {
          // Look up log for this specific hour
          const log = todayLogs.find(l => 
            l.medicationId === med.id && 
            l.timeOfDay === timeOfDay &&
            l.specificHour === hour
          );
          patientMap.get(med.patientId)!.medications.push({
            id: med.id,
            name: med.name,
            dosage: med.dosage,
            note: med.note || undefined,
            specificTime: hour,
            taken: log?.taken || false,
            logId: log?.id,
          });
        }
      } else {
        // Look up log for this time of day without specific hour
        const log = todayLogs.find(l => 
          l.medicationId === med.id && 
          l.timeOfDay === timeOfDay &&
          !l.specificHour
        );
        patientMap.get(med.patientId)!.medications.push({
          id: med.id,
          name: med.name,
          dosage: med.dosage,
          note: med.note || undefined,
          specificTime: undefined,
          taken: log?.taken || false,
          logId: log?.id,
        });
      }
    }
    
    // Add SOS medications distributed today
    const sosLogs = await this.getSosMedicationLogsByDate(dateStr);
    for (const sosLog of sosLogs) {
      const patient = this.occupants.find(o => o.id === sosLog.patientId);
      if (!patient) continue;
      
      // Add patient to map if not already there
      if (!patientMap.has(sosLog.patientId)) {
        patientMap.set(sosLog.patientId, {
          patientId: sosLog.patientId,
          patientName: patient.name,
          medications: [],
        });
      }
      
      // Add SOS medication entry - pass timestamp for client-side formatting
      patientMap.get(sosLog.patientId)!.medications.push({
        id: sosLog.id,
        name: `🆘 ${sosLog.sosMedicationName}`,
        dosage: '',
        note: sosLog.reason || undefined,
        specificTime: undefined, // Will be formatted on client using sosTimestamp
        taken: true, // SOS medications are always taken when logged
        logId: sosLog.id,
        isSos: true,
        sosReason: sosLog.reason || undefined,
        sosResponsible: sosLog.responsibleName || undefined,
        sosTimestamp: sosLog.createdAt.toISOString(), // Pass raw timestamp for client formatting
      });
    }
    
    // Sort medications: those without specific time first, then by time
    const result = Array.from(patientMap.values());
    for (const item of result) {
      item.medications.sort((a, b) => {
        const aHasTime = !!a.specificTime;
        const bHasTime = !!b.specificTime;
        if (aHasTime !== bHasTime) {
          return aHasTime ? 1 : -1; // No specific time first
        }
        if (aHasTime && bHasTime) {
          return a.specificTime!.localeCompare(b.specificTime!);
        }
        return 0;
      });
    }
    
    return result;
  }
  
  async getAuditLog(limit: number = 50): Promise<any[]> {
    const logs = this.medicationLogsData
      .filter(log => log.taken)
      .sort((a, b) => (b.takenAt?.getTime() || 0) - (a.takenAt?.getTime() || 0))
      .slice(0, limit);
    
    const TIME_LABELS: Record<string, string> = {
      morning: 'בוקר',
      noon: 'צהריים',
      afternoon: 'אחה״צ',
      night: 'לילה',
    };
    
    const regularLogs = logs.map(log => {
      const medication = this.medicationsData.find(m => m.id === log.medicationId);
      const patient = this.occupants.find(o => o.id === log.patientId);
      return {
        ...log,
        medicationName: medication?.name || 'לא ידוע',
        patientName: patient?.name || 'לא ידוע',
        timeOfDayLabel: TIME_LABELS[log.timeOfDay] || log.timeOfDay,
        isSos: false,
      };
    });
    
    // Also include SOS medication logs
    const sosLogs = this.sosMedicationLogsData
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
    
    const formattedSosLogs = sosLogs.map(log => {
      const patient = this.occupants.find(o => o.id === log.patientId);
      return {
        id: log.id,
        medicationName: log.sosMedicationName + ' 🆘',
        patientName: patient?.name || 'לא ידוע',
        takenAt: log.createdAt,
        responsibleName: log.responsibleName,
        notes: log.reason,
        timeOfDayLabel: 'SOS',
        isSos: true,
        nurseOverride: log.nurseOverride,
      };
    });
    
    // Merge and sort by time
    return [...regularLogs, ...formattedSosLogs]
      .sort((a, b) => {
        const timeA = a.takenAt ? new Date(a.takenAt).getTime() : 0;
        const timeB = b.takenAt ? new Date(b.takenAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, limit);
  }
  
  // Patient Shopping List methods
  private patientShoppingListsData: SelectPatientShoppingList[] = [];
  private purchaseTransactionsData: SelectPurchaseTransaction[] = [];
  
  async getAllPatientShoppingLists(): Promise<SelectPatientShoppingList[]> {
    return [...this.patientShoppingListsData];
  }
  
  async getPatientShoppingListById(id: string): Promise<SelectPatientShoppingList | null> {
    return this.patientShoppingListsData.find(l => l.id === id) || null;
  }
  
  async createPatientShoppingList(list: InsertPatientShoppingList): Promise<SelectPatientShoppingList> {
    const newList: SelectPatientShoppingList = {
      id: randomUUID(),
      patientId: list.patientId,
      patientName: list.patientName,
      items: list.items || '',
      checkedItems: list.checkedItems || [],
      totalAmount: list.totalAmount || '',
      paymentMethod: list.paymentMethod || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.patientShoppingListsData.push(newList);
    return newList;
  }
  
  async updatePatientShoppingList(id: string, list: UpdatePatientShoppingList): Promise<SelectPatientShoppingList | null> {
    const index = this.patientShoppingListsData.findIndex(l => l.id === id);
    if (index === -1) return null;
    this.patientShoppingListsData[index] = {
      ...this.patientShoppingListsData[index],
      ...list,
      updatedAt: new Date(),
    };
    return this.patientShoppingListsData[index];
  }
  
  async deletePatientShoppingList(id: string): Promise<boolean> {
    const index = this.patientShoppingListsData.findIndex(l => l.id === id);
    if (index === -1) return false;
    this.patientShoppingListsData.splice(index, 1);
    return true;
  }
  
  async deleteAllPatientShoppingLists(): Promise<boolean> {
    this.patientShoppingListsData = [];
    return true;
  }
  
  // Purchase Transaction methods
  async getPurchaseTransactionsByPatient(patientId: string): Promise<SelectPurchaseTransaction[]> {
    return this.purchaseTransactionsData
      .filter(t => t.patientId === patientId)
      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  }
  
  async createPurchaseTransaction(transaction: InsertPurchaseTransaction): Promise<SelectPurchaseTransaction> {
    const newTransaction: SelectPurchaseTransaction = {
      id: randomUUID(),
      patientId: transaction.patientId,
      patientName: transaction.patientName,
      items: transaction.items,
      totalAmount: transaction.totalAmount,
      purchaseDate: transaction.purchaseDate || new Date(),
      createdAt: new Date(),
    };
    this.purchaseTransactionsData.push(newTransaction);
    return newTransaction;
  }
  
  // Deposit History methods
  private depositHistoryData: SelectDepositHistory[] = [];
  
  async getDepositHistoryByPatient(patientId: string): Promise<SelectDepositHistory[]> {
    return this.depositHistoryData
      .filter(d => d.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async createDepositHistory(entry: InsertDepositHistory): Promise<SelectDepositHistory> {
    const newEntry: SelectDepositHistory = {
      id: randomUUID(),
      patientId: entry.patientId,
      patientName: entry.patientName,
      amount: entry.amount,
      note: entry.note || null,
      createdAt: new Date(),
    };
    this.depositHistoryData.push(newEntry);
    return newEntry;
  }
  
  // Cash Flow Settings (in-memory stub)
  private cashFlowSettingsData: SelectCashFlowSettings = { id: 'default', activeYear: 2025, updatedAt: new Date() };
  private cashFlowOpeningBalancesData: SelectCashFlowOpeningBalance[] = [{ id: 'balance-2025', year: 2025, openingBalance: 0, createdAt: new Date(), updatedAt: new Date() }];
  private cashFlowCategoriesData: SelectCashFlowCategory[] = [];
  private cashFlowCreditCardsData: SelectCashFlowCreditCard[] = [];
  private cashFlowTransactionsData: SelectCashFlowTransaction[] = [];
  
  async getCashFlowSettings(): Promise<SelectCashFlowSettings | null> {
    return this.cashFlowSettingsData;
  }
  
  async updateCashFlowActiveYear(year: number): Promise<SelectCashFlowSettings> {
    this.cashFlowSettingsData = { ...this.cashFlowSettingsData, activeYear: year, updatedAt: new Date() };
    return this.cashFlowSettingsData;
  }
  
  async getCashFlowOpeningBalances(): Promise<SelectCashFlowOpeningBalance[]> {
    return this.cashFlowOpeningBalancesData;
  }
  
  async getCashFlowOpeningBalance(year: number): Promise<SelectCashFlowOpeningBalance | null> {
    return this.cashFlowOpeningBalancesData.find(b => b.year === year) || null;
  }
  
  async setCashFlowOpeningBalance(year: number, balance: number): Promise<SelectCashFlowOpeningBalance> {
    const existing = this.cashFlowOpeningBalancesData.find(b => b.year === year);
    if (existing) {
      existing.openingBalance = balance;
      existing.updatedAt = new Date();
      return existing;
    }
    const newBalance: SelectCashFlowOpeningBalance = { id: `balance-${year}`, year, openingBalance: balance, createdAt: new Date(), updatedAt: new Date() };
    this.cashFlowOpeningBalancesData.push(newBalance);
    return newBalance;
  }
  
  async getCashFlowCategories(): Promise<SelectCashFlowCategory[]> {
    return this.cashFlowCategoriesData.filter(c => !c.isArchived);
  }
  
  async getCashFlowCategoriesByType(type: 'income' | 'expense' | 'both'): Promise<SelectCashFlowCategory[]> {
    return this.cashFlowCategoriesData.filter(c => !c.isArchived && (c.type === type || c.type === 'both'));
  }
  
  async createCashFlowCategory(category: InsertCashFlowCategory): Promise<SelectCashFlowCategory> {
    const newCategory: SelectCashFlowCategory = { id: randomUUID(), ...category, isArchived: category.isArchived || false, createdAt: new Date(), updatedAt: new Date() };
    this.cashFlowCategoriesData.push(newCategory);
    return newCategory;
  }
  
  async updateCashFlowCategory(id: string, category: UpdateCashFlowCategory): Promise<SelectCashFlowCategory | null> {
    const index = this.cashFlowCategoriesData.findIndex(c => c.id === id);
    if (index === -1) return null;
    this.cashFlowCategoriesData[index] = { ...this.cashFlowCategoriesData[index], ...category, updatedAt: new Date() };
    return this.cashFlowCategoriesData[index];
  }
  
  async deleteCashFlowCategory(id: string): Promise<boolean> {
    const index = this.cashFlowCategoriesData.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.cashFlowCategoriesData.splice(index, 1);
    return true;
  }
  
  async getCashFlowCreditCards(): Promise<SelectCashFlowCreditCard[]> {
    return this.cashFlowCreditCardsData.filter(c => c.isActive);
  }
  
  async getCashFlowCreditCardById(id: string): Promise<SelectCashFlowCreditCard | null> {
    return this.cashFlowCreditCardsData.find(c => c.id === id) || null;
  }
  
  async createCashFlowCreditCard(card: InsertCashFlowCreditCard): Promise<SelectCashFlowCreditCard> {
    const newCard: SelectCashFlowCreditCard = { id: randomUUID(), name: card.name, lastFour: card.lastFour || null, chargeDay: card.chargeDay || 10, issuer: card.issuer || null, isActive: card.isActive !== false, createdAt: new Date(), updatedAt: new Date() };
    this.cashFlowCreditCardsData.push(newCard);
    return newCard;
  }
  
  async updateCashFlowCreditCard(id: string, card: UpdateCashFlowCreditCard): Promise<SelectCashFlowCreditCard | null> {
    const index = this.cashFlowCreditCardsData.findIndex(c => c.id === id);
    if (index === -1) return null;
    this.cashFlowCreditCardsData[index] = { ...this.cashFlowCreditCardsData[index], ...card, updatedAt: new Date() };
    return this.cashFlowCreditCardsData[index];
  }
  
  async deleteCashFlowCreditCard(id: string): Promise<boolean> {
    const index = this.cashFlowCreditCardsData.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.cashFlowCreditCardsData[index].isActive = false;
    return true;
  }
  
  async getCashFlowTransactions(year: number, month?: number): Promise<SelectCashFlowTransaction[]> {
    return this.cashFlowTransactionsData.filter(t => t.year === year && (month === undefined || t.month === month));
  }
  
  async getCashFlowTransactionById(id: string): Promise<SelectCashFlowTransaction | null> {
    return this.cashFlowTransactionsData.find(t => t.id === id) || null;
  }
  
  async createCashFlowTransaction(transaction: InsertCashFlowTransaction): Promise<SelectCashFlowTransaction> {
    const dateValue = typeof transaction.date === 'string' ? new Date(transaction.date) : transaction.date;
    const newTransaction: SelectCashFlowTransaction = { 
      id: randomUUID(), 
      ...transaction, 
      date: dateValue, 
      categoryId: transaction.categoryId || null, 
      creditCardId: transaction.creditCardId || null, 
      creditCardName: transaction.creditCardName || null,
      checkChargeDate: transaction.checkChargeDate || null,
      recurringGroupId: transaction.recurringGroupId || null,
      isRecurring: transaction.isRecurring || false,
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
    this.cashFlowTransactionsData.push(newTransaction);
    return newTransaction;
  }
  
  async updateCashFlowTransaction(id: string, transaction: UpdateCashFlowTransaction): Promise<SelectCashFlowTransaction | null> {
    const index = this.cashFlowTransactionsData.findIndex(t => t.id === id);
    if (index === -1) return null;
    const dateValue = transaction.date ? (typeof transaction.date === 'string' ? new Date(transaction.date) : transaction.date) : this.cashFlowTransactionsData[index].date;
    this.cashFlowTransactionsData[index] = { ...this.cashFlowTransactionsData[index], ...transaction, date: dateValue, updatedAt: new Date() };
    return this.cashFlowTransactionsData[index];
  }
  
  async deleteCashFlowTransaction(id: string): Promise<boolean> {
    const index = this.cashFlowTransactionsData.findIndex(t => t.id === id);
    if (index === -1) return false;
    this.cashFlowTransactionsData.splice(index, 1);
    return true;
  }
  
  async getCashFlowBalances(year: number): Promise<{ openingBalance: number; bankBalance: number; expectedBalance: number }> {
    let openingBalanceRecord = await this.getCashFlowOpeningBalance(year);
    let openingBalance = openingBalanceRecord?.openingBalance || 0;
    
    // If no opening balance set for this year, calculate from previous year's closing balance
    if (!openingBalanceRecord && year > 2024) {
      const prevYearBalances = await this.getCashFlowBalances(year - 1);
      openingBalance = prevYearBalances.bankBalance;
    }
    
    const transactions = await this.getCashFlowTransactions(year);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    // Transactions dated today or earlier count as completed for bank balance
    const isEffective = (t: SelectCashFlowTransaction) => {
      const txDate = new Date(t.date);
      return t.status === 'completed' || txDate <= today;
    };
    
    const income = transactions.filter(t => t.type === 'income' && isEffective(t)).reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense' && isEffective(t)).reduce((sum, t) => sum + t.amount, 0);
    const bankBalance = openingBalance + income - expense;
    
    // Only future pending transactions count towards expected
    const pendingIncome = transactions.filter(t => t.type === 'income' && !isEffective(t)).reduce((sum, t) => sum + t.amount, 0);
    const pendingExpense = transactions.filter(t => t.type === 'expense' && !isEffective(t)).reduce((sum, t) => sum + t.amount, 0);
    const expectedBalance = bankBalance + pendingIncome - pendingExpense;
    return { openingBalance, bankBalance, expectedBalance };
  }
  
  async getCashFlowMonthlySummary(year: number): Promise<Array<{ month: number; income: number; expense: number; net: number }>> {
    const transactions = await this.getCashFlowTransactions(year);
    const summary: Array<{ month: number; income: number; expense: number; net: number }> = [];
    for (let month = 1; month <= 12; month++) {
      const monthTransactions = transactions.filter(t => t.month === month);
      const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      summary.push({ month, income, expense, net: income - expense });
    }
    return summary;
  }
  
  // SOS Medications
  private sosMedicationsData: SelectSosMedication[] = [];
  private patientSosAllergiesData: SelectPatientSosAllergy[] = [];
  private sosMedicationLogsData: SelectSosMedicationLog[] = [];
  
  async getAllSosMedications(): Promise<SelectSosMedication[]> {
    return [...this.sosMedicationsData];
  }
  
  async getSosMedicationById(id: string): Promise<SelectSosMedication | null> {
    return this.sosMedicationsData.find(m => m.id === id) || null;
  }
  
  async createSosMedication(medication: InsertSosMedication): Promise<SelectSosMedication> {
    const newMedication: SelectSosMedication = {
      id: randomUUID(),
      name: medication.name,
      description: medication.description || '',
      cooldownHours: medication.cooldownHours ?? 0,
      isActive: medication.isActive ?? true,
      createdAt: new Date(),
    };
    this.sosMedicationsData.push(newMedication);
    return newMedication;
  }
  
  async updateSosMedication(id: string, medication: UpdateSosMedication): Promise<SelectSosMedication | null> {
    const index = this.sosMedicationsData.findIndex(m => m.id === id);
    if (index === -1) return null;
    this.sosMedicationsData[index] = { ...this.sosMedicationsData[index], ...medication };
    return this.sosMedicationsData[index];
  }
  
  async deleteSosMedication(id: string): Promise<boolean> {
    const index = this.sosMedicationsData.findIndex(m => m.id === id);
    if (index === -1) return false;
    this.sosMedicationsData.splice(index, 1);
    return true;
  }
  
  async getPatientSosAllergies(patientId: string): Promise<SelectPatientSosAllergy[]> {
    return this.patientSosAllergiesData.filter(a => a.patientId === patientId);
  }
  
  async setPatientSosAllergies(patientId: string, sosMedicationIds: string[]): Promise<void> {
    this.patientSosAllergiesData = this.patientSosAllergiesData.filter(a => a.patientId !== patientId);
    for (const sosMedicationId of sosMedicationIds) {
      this.patientSosAllergiesData.push({
        id: randomUUID(),
        patientId,
        sosMedicationId,
        createdAt: new Date(),
      });
    }
  }
  
  async getSosMedicationLogs(limit?: number): Promise<SelectSosMedicationLog[]> {
    const sorted = [...this.sosMedicationLogsData].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }
  
  async getSosMedicationLogsByPatient(patientId: string): Promise<SelectSosMedicationLog[]> {
    return this.sosMedicationLogsData.filter(l => l.patientId === patientId);
  }
  
  async getSosMedicationLogsByDate(date: string): Promise<SelectSosMedicationLog[]> {
    return this.sosMedicationLogsData.filter(l => {
      const logDate = new Date(l.date).toISOString().split('T')[0];
      return logDate === date;
    });
  }
  
  async createSosMedicationLog(log: InsertSosMedicationLog): Promise<SelectSosMedicationLog> {
    const newLog: SelectSosMedicationLog = {
      id: randomUUID(),
      patientId: log.patientId,
      sosMedicationId: log.sosMedicationId,
      sosMedicationName: log.sosMedicationName,
      date: log.date,
      reason: log.reason,
      responsibleName: log.responsibleName,
      nurseOverride: log.nurseOverride ?? false,
      createdAt: new Date(),
    };
    this.sosMedicationLogsData.push(newLog);
    return newLog;
  }
  
  async deleteSosMedicationLog(id: string): Promise<boolean> {
    const index = this.sosMedicationLogsData.findIndex(l => l.id === id);
    if (index === -1) return false;
    this.sosMedicationLogsData.splice(index, 1);
    return true;
  }
  
  private pushSubscriptions: any[] = [];
  
  async getAllPushSubscriptions(): Promise<any[]> {
    return [...this.pushSubscriptions];
  }
  
  async createPushSubscription(subscription: { endpoint: string; p256dh: string; auth: string }): Promise<any> {
    const existing = this.pushSubscriptions.find(s => s.endpoint === subscription.endpoint);
    if (existing) return existing;
    
    const newSub = {
      id: randomUUID(),
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      createdAt: new Date(),
    };
    this.pushSubscriptions.push(newSub);
    return newSub;
  }
  
  async deletePushSubscription(endpoint: string): Promise<boolean> {
    const index = this.pushSubscriptions.findIndex(s => s.endpoint === endpoint);
    if (index >= 0) {
      this.pushSubscriptions.splice(index, 1);
      return true;
    }
    return false;
  }

  private webauthnCreds: any[] = [];
  async getWebauthnCredentials(): Promise<any[]> { return [...this.webauthnCreds]; }
  async saveWebauthnCredential(cred: any): Promise<any> { this.webauthnCreds.push(cred); return cred; }
  async updateWebauthnCredentialCounter(id: string, counter: number): Promise<void> {
    const c = this.webauthnCreds.find(c => c.id === id);
    if (c) c.counter = counter;
  }
  async deleteWebauthnCredential(credentialId: string): Promise<void> {
    this.webauthnCreds = this.webauthnCreds.filter(c => c.credentialId !== credentialId);
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  async getAllOccupants(): Promise<Occupant[]> {
    const results = await db.select().from(occupants);
    return results.map(r => ({
      ...r,
      safeItems: r.safeItems || '',
      deposits: r.deposits
    }));
  }

  async getOccupantById(id: string): Promise<Occupant | null> {
    const [result] = await db.select().from(occupants).where(eq(occupants.id, id));
    return result ? { ...result, safeItems: result.safeItems || '', deposits: result.deposits } : null;
  }

  async createOccupant(occupantData: InsertOccupant): Promise<Occupant> {
    const occupantToInsert = {
      id: randomUUID(),
      name: occupantData.name,
      roomId: occupantData.roomId,
      gender: occupantData.gender,
      isReligious: occupantData.isReligious || false,
      addictionType: occupantData.addictionType || null,
      joinDate: occupantData.joinDate || new Date(),
      endDateTime: occupantData.endDateTime,
      stayingProbability: occupantData.stayingProbability || 'אולي',
      stayingDuration: occupantData.stayingDuration || null,
      plannedMonths: occupantData.plannedMonths || 1,
      paidMonths: occupantData.paidMonths || 0,
      deposits: occupantData.deposits || null,
      initialDeposit: occupantData.initialDeposit || occupantData.deposits || null,
      safeItems: occupantData.safeItems || '',
      borrowedItems: occupantData.borrowedItems || '',
      medicalTreatment: occupantData.medicalTreatment || '',
      plannedExitStart: occupantData.plannedExitStart || null,
      plannedExitEnd: occupantData.plannedExitEnd || null,
      privateConsultation: occupantData.privateConsultation || null,
      clientPhone: occupantData.clientPhone || null,
      // Contact information
      contactName: occupantData.contactName || null,
      contactPhone: occupantData.contactPhone || null,
      contactRelationship: occupantData.contactRelationship || null,
      // Notes
      notes: occupantData.notes || '',
    };

    const [result] = await db.insert(occupants).values(occupantToInsert).returning();
    return { ...result, safeItems: result.safeItems || '', deposits: result.deposits };
  }

  async updateOccupant(id: string, occupantData: UpdateOccupant): Promise<Occupant | null> {
    const [result] = await db
      .update(occupants)
      .set(occupantData)
      .where(eq(occupants.id, id))
      .returning();
    return result ? { ...result, safeItems: result.safeItems || '', deposits: result.deposits } : null;
  }

  async deleteOccupant(id: string): Promise<boolean> {
    // First, remove occupant references from daily tasks
    await db.update(dailyTasks)
      .set({ occupantId: null })
      .where(eq(dailyTasks.occupantId, id));
    
    // Now delete the occupant
    const result = await db.delete(occupants).where(eq(occupants.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getOccupantsByRoom(roomId: string): Promise<Occupant[]> {
    const results = await db.select().from(occupants).where(eq(occupants.roomId, roomId));
    return results.map(r => ({
      ...r,
      safeItems: r.safeItems || ''
    }));
  }

  // Room operations (keeping existing MemStorage implementation)
  private memStorage = new MemStorage();

  async getAllRooms(): Promise<Room[]> {
    return await this.memStorage.getAllRooms();
  }

  async getRoomById(id: string): Promise<Room | null> {
    return await this.memStorage.getRoomById(id);
  }

  async createRoom(room: InsertRoom): Promise<Room> {
    return await this.memStorage.createRoom(room);
  }

  async updateRoom(id: string, room: UpdateRoom): Promise<Room | null> {
    return await this.memStorage.updateRoom(id, room);
  }

  async deleteRoom(id: string): Promise<boolean> {
    // Check if room has occupants in database
    const roomOccupants = await this.getOccupantsByRoom(id);
    if (roomOccupants.length > 0) {
      return false;
    }
    return await this.memStorage.deleteRoom(id);
  }

  // Daily Task CRUD operations
  async getDailyTasks(date?: Date): Promise<SelectDailyTask[]> {
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      return await db.select().from(dailyTasks).where(
        and(
          eq(dailyTasks.date, targetDate),
        )
      );
    }
    return await db.select().from(dailyTasks);
  }

  async createDailyTask(taskData: InsertDailyTask): Promise<SelectDailyTask> {
    const taskToInsert = {
      id: randomUUID(),
      date: taskData.date,
      name: taskData.name,
      time: taskData.time || null,
      occupantId: taskData.occupantId || null,
      note: taskData.note || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [result] = await db.insert(dailyTasks).values(taskToInsert).returning();
    return result;
  }

  async updateDailyTask(id: string, taskData: UpdateDailyTask): Promise<SelectDailyTask | null> {
    const [result] = await db
      .update(dailyTasks)
      .set({ ...taskData, updatedAt: new Date() })
      .where(eq(dailyTasks.id, id))
      .returning();
    return result || null;
  }

  async deleteDailyTask(id: string): Promise<boolean> {
    const result = await db.delete(dailyTasks).where(eq(dailyTasks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Daily Note CRUD operations
  async getDailyNote(date: Date): Promise<SelectDailyNote | null> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const [result] = await db.select().from(dailyNotes).where(eq(dailyNotes.date, targetDate));
    return result || null;
  }

  async createOrUpdateDailyNote(noteData: InsertDailyNote): Promise<SelectDailyNote> {
    const existingNote = await this.getDailyNote(noteData.date);
    const now = new Date();

    if (existingNote) {
      // Update existing note
      const [result] = await db
        .update(dailyNotes)
        .set({ content: noteData.content || '', updatedAt: now })
        .where(eq(dailyNotes.id, existingNote.id))
        .returning();
      return result;
    } else {
      // Create new note
      const noteToInsert = {
        id: randomUUID(),
        date: noteData.date,
        content: noteData.content || '',
        createdAt: now,
        updatedAt: now,
      };
      const [result] = await db.insert(dailyNotes).values(noteToInsert).returning();
      return result;
    }
  }

  async deleteDailyNote(date: Date): Promise<boolean> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const result = await db.delete(dailyNotes).where(eq(dailyNotes.date, targetDate));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Weekly Note CRUD operations
  async getWeeklyNote(weekStartDate: Date): Promise<SelectWeeklyNote | null> {
    const targetDate = new Date(weekStartDate);
    targetDate.setHours(0, 0, 0, 0);
    
    const [result] = await db.select().from(weeklyNotes).where(eq(weeklyNotes.weekStartDate, targetDate));
    return result || null;
  }

  async createOrUpdateWeeklyNote(noteData: InsertWeeklyNote): Promise<SelectWeeklyNote> {
    const existingNote = await this.getWeeklyNote(noteData.weekStartDate);
    const now = new Date();

    if (existingNote) {
      // Update existing note
      const [result] = await db
        .update(weeklyNotes)
        .set({ content: noteData.content || '', updatedAt: now })
        .where(eq(weeklyNotes.id, existingNote.id))
        .returning();
      return result;
    } else {
      // Create new note
      const noteToInsert = {
        id: randomUUID(),
        weekStartDate: noteData.weekStartDate,
        content: noteData.content || '',
        createdAt: now,
        updatedAt: now,
      };
      const [result] = await db.insert(weeklyNotes).values(noteToInsert).returning();
      return result;
    }
  }

  async deleteWeeklyNote(weekStartDate: Date): Promise<boolean> {
    const targetDate = new Date(weekStartDate);
    targetDate.setHours(0, 0, 0, 0);
    
    const result = await db.delete(weeklyNotes).where(eq(weeklyNotes.weekStartDate, targetDate));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Event CRUD operations
  async getEvents(date?: Date): Promise<SelectEvent[]> {
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      return await db.select().from(events).where(
        eq(events.date, targetDate)
      );
    }
    return await db.select().from(events);
  }

  async createEvent(eventData: InsertEvent): Promise<SelectEvent> {
    const eventToInsert = {
      id: randomUUID(),
      date: eventData.date,
      name: eventData.name,
      time: eventData.time || null,
      note: eventData.note || '',
      color: eventData.color || 'purple',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [result] = await db.insert(events).values(eventToInsert).returning();
    return result;
  }

  async updateEvent(id: string, eventData: UpdateEvent): Promise<SelectEvent | null> {
    const [result] = await db
      .update(events)
      .set({ ...eventData, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return result || null;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Target Inventory CRUD operations
  async getAllTargetInventory(): Promise<SelectTargetInventory[]> {
    return await db.select().from(targetInventory);
  }

  async getTargetInventoryById(id: string): Promise<SelectTargetInventory | null> {
    const [result] = await db.select().from(targetInventory).where(eq(targetInventory.id, id));
    return result || null;
  }

  async getTargetInventoryByProductName(productName: string): Promise<SelectTargetInventory | null> {
    const allItems = await db.select().from(targetInventory);
    const normalizedName = productName.toLowerCase().trim();
    return allItems.find(item => 
      item.productName.toLowerCase().trim() === normalizedName ||
      (item.productNameHebrew && item.productNameHebrew.toLowerCase().trim() === normalizedName)
    ) || null;
  }

  async createTargetInventory(itemData: InsertTargetInventory): Promise<SelectTargetInventory> {
    const itemToInsert = {
      id: randomUUID(),
      productName: itemData.productName,
      productNameHebrew: itemData.productNameHebrew || null,
      category: itemData.category,
      targetQuantity: itemData.targetQuantity,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [result] = await db.insert(targetInventory).values(itemToInsert).returning();
    return result;
  }

  async updateTargetInventory(id: string, itemData: UpdateTargetInventory): Promise<SelectTargetInventory | null> {
    const [result] = await db
      .update(targetInventory)
      .set({ ...itemData, updatedAt: new Date() })
      .where(eq(targetInventory.id, id))
      .returning();
    return result || null;
  }

  async deleteTargetInventory(id: string): Promise<boolean> {
    const result = await db.delete(targetInventory).where(eq(targetInventory.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Shopping List CRUD operations
  async getAllShoppingList(): Promise<SelectShoppingList[]> {
    return await db.select().from(shoppingList);
  }

  async getShoppingListById(id: string): Promise<SelectShoppingList | null> {
    const [result] = await db.select().from(shoppingList).where(eq(shoppingList.id, id));
    return result || null;
  }

  async createShoppingListItem(itemData: InsertShoppingList): Promise<SelectShoppingList> {
    const itemToInsert = {
      id: randomUUID(),
      productName: itemData.productName,
      productNameHebrew: itemData.productNameHebrew || null,
      category: itemData.category || null,
      currentQuantity: itemData.currentQuantity,
      targetQuantity: itemData.targetQuantity || null,
      neededQuantity: itemData.neededQuantity ?? null,
      isFromTargetList: itemData.isFromTargetList ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [result] = await db.insert(shoppingList).values(itemToInsert).returning();
    return result;
  }

  async updateShoppingListItem(id: string, itemData: UpdateShoppingList): Promise<SelectShoppingList | null> {
    const [result] = await db
      .update(shoppingList)
      .set({ ...itemData, updatedAt: new Date() })
      .where(eq(shoppingList.id, id))
      .returning();
    return result || null;
  }

  async deleteShoppingListItem(id: string): Promise<boolean> {
    const result = await db.delete(shoppingList).where(eq(shoppingList.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async clearShoppingList(): Promise<boolean> {
    const result = await db.delete(shoppingList);
    return true;
  }

  async renameShoppingListCategory(oldCategory: string, newCategory: string): Promise<boolean> {
    await db.update(shoppingList)
      .set({ category: newCategory, updatedAt: new Date() })
      .where(eq(shoppingList.category, oldCategory));
    return true;
  }

  async renameTargetInventoryCategory(oldCategory: string, newCategory: string): Promise<boolean> {
    await db.update(targetInventory)
      .set({ category: newCategory })
      .where(eq(targetInventory.category, oldCategory));
    return true;
  }

  // Custom Inventory Categories CRUD operations
  async getAllCustomCategories(): Promise<SelectCustomCategory[]> {
    return await db.select().from(customInventoryCategories);
  }

  async createCustomCategory(categoryData: InsertCustomCategory): Promise<SelectCustomCategory> {
    const categoryToInsert = {
      id: randomUUID(),
      name: categoryData.name,
      icon: categoryData.icon || '📦',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const [result] = await db.insert(customInventoryCategories).values(categoryToInsert).returning();
    return result;
  }

  async updateCustomCategory(id: string, categoryData: UpdateCustomCategory): Promise<SelectCustomCategory | null> {
    const [result] = await db
      .update(customInventoryCategories)
      .set({ ...categoryData, updatedAt: new Date() })
      .where(eq(customInventoryCategories.id, id))
      .returning();
    return result || null;
  }

  async deleteCustomCategory(id: string): Promise<boolean> {
    const result = await db.delete(customInventoryCategories).where(eq(customInventoryCategories.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Staff Members CRUD operations
  async getAllStaffMembers(): Promise<SelectStaffMember[]> {
    return await db.select().from(staffMembers);
  }

  async getStaffMemberById(id: string): Promise<SelectStaffMember | null> {
    const [result] = await db.select().from(staffMembers).where(eq(staffMembers.id, id));
    return result || null;
  }

  async createStaffMember(memberData: InsertStaffMember): Promise<SelectStaffMember> {
    // Get next available pastel color
    const existingMembers = await this.getAllStaffMembers();
    const usedColors = existingMembers.map(m => m.color);
    const availableColor = STAFF_PASTEL_COLORS.find(c => !usedColors.includes(c)) || STAFF_PASTEL_COLORS[0];
    
    const memberToInsert = {
      id: randomUUID(),
      name: memberData.name,
      color: memberData.color || availableColor,
      role: memberData.role || 'staff',
      isActive: memberData.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [result] = await db.insert(staffMembers).values(memberToInsert).returning();
    return result;
  }

  async updateStaffMember(id: string, memberData: UpdateStaffMember): Promise<SelectStaffMember | null> {
    const [result] = await db
      .update(staffMembers)
      .set({ ...memberData, updatedAt: new Date() })
      .where(eq(staffMembers.id, id))
      .returning();
    return result || null;
  }

  async deleteStaffMember(id: string): Promise<boolean> {
    // First, remove the staff member from all schedule events
    // 1. Delete from junction table (scheduleEventStaff)
    await db.delete(scheduleEventStaff).where(eq(scheduleEventStaff.staffMemberId, id));
    
    // 2. Set staffMemberId to null in scheduleEvents (legacy field)
    await db.update(scheduleEvents)
      .set({ staffMemberId: null })
      .where(eq(scheduleEvents.staffMemberId, id));
    
    // 3. Now delete the staff member
    const result = await db.delete(staffMembers).where(eq(staffMembers.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Schedule Events CRUD operations
  async getScheduleEvents(startDate: Date, endDate: Date): Promise<ScheduleEventWithStaff[]> {
    // For multi-day events, we need to get events that:
    // 1. Start within the date range, OR
    // 2. End within the date range, OR
    // 3. Span the entire date range
    const eventsData = await db.select().from(scheduleEvents)
      .where(or(
        // Event starts within range
        and(
          gte(scheduleEvents.date, startDate),
          lte(scheduleEvents.date, endDate)
        ),
        // Event ends within range (for multi-day events)
        and(
          gte(scheduleEvents.endDate, startDate),
          lte(scheduleEvents.endDate, endDate)
        ),
        // Event spans the entire range
        and(
          lte(scheduleEvents.date, startDate),
          gte(scheduleEvents.endDate, endDate)
        )
      ));
    
    // Hydrate with staff members
    const result: ScheduleEventWithStaff[] = [];
    for (const event of eventsData) {
      const staffMembersList = await this.getEventStaffMembers(event.id);
      // Also get legacy single staff member if exists
      let legacyStaff: SelectStaffMember | null = null;
      if (event.staffMemberId) {
        legacyStaff = await this.getStaffMemberById(event.staffMemberId);
      }
      result.push({
        ...event,
        staffMember: legacyStaff,
        staffMembers: staffMembersList.length > 0 ? staffMembersList : (legacyStaff ? [legacyStaff] : []),
      });
    }
    return result;
  }

  async getScheduleEventById(id: string): Promise<ScheduleEventWithStaff | null> {
    const [event] = await db.select().from(scheduleEvents).where(eq(scheduleEvents.id, id));
    if (!event) return null;
    
    const staffMembersList = await this.getEventStaffMembers(id);
    let legacyStaff: SelectStaffMember | null = null;
    if (event.staffMemberId) {
      legacyStaff = await this.getStaffMemberById(event.staffMemberId);
    }
    
    return {
      ...event,
      staffMember: legacyStaff,
      staffMembers: staffMembersList.length > 0 ? staffMembersList : (legacyStaff ? [legacyStaff] : []),
    };
  }

  async createScheduleEvent(eventData: InsertScheduleEvent, staffMemberIds?: string[]): Promise<ScheduleEventWithStaff> {
    const eventId = randomUUID();
    const eventToInsert = {
      id: eventId,
      date: eventData.date,
      endDate: eventData.endDate || null,
      title: eventData.title,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      layer: eventData.layer,
      staffMemberId: eventData.staffMemberId || null,
      note: eventData.note || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [result] = await db.insert(scheduleEvents).values(eventToInsert).returning();
    
    // Set staff members via junction table
    if (staffMemberIds && staffMemberIds.length > 0) {
      await this.setEventStaffMembers(eventId, staffMemberIds);
    } else if (eventData.staffMemberId) {
      // If legacy staffMemberId is provided, add it to junction table
      await this.setEventStaffMembers(eventId, [eventData.staffMemberId]);
    }
    
    return (await this.getScheduleEventById(eventId))!;
  }

  async updateScheduleEvent(id: string, eventData: UpdateScheduleEvent, staffMemberIds?: string[]): Promise<ScheduleEventWithStaff | null> {
    const [result] = await db
      .update(scheduleEvents)
      .set({ ...eventData, updatedAt: new Date() })
      .where(eq(scheduleEvents.id, id))
      .returning();
    
    if (!result) return null;
    
    // Update staff members if provided
    if (staffMemberIds !== undefined) {
      await this.setEventStaffMembers(id, staffMemberIds);
    }
    
    return await this.getScheduleEventById(id);
  }

  async deleteScheduleEvent(id: string): Promise<boolean> {
    // Junction table entries will be deleted automatically via CASCADE
    const result = await db.delete(scheduleEvents).where(eq(scheduleEvents.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Schedule Event Staff operations
  async getEventStaffMembers(eventId: string): Promise<SelectStaffMember[]> {
    const junctionEntries = await db.select()
      .from(scheduleEventStaff)
      .where(eq(scheduleEventStaff.eventId, eventId));
    
    const staffMembersList: SelectStaffMember[] = [];
    for (const entry of junctionEntries) {
      const member = await this.getStaffMemberById(entry.staffMemberId);
      if (member) staffMembersList.push(member);
    }
    return staffMembersList;
  }
  
  async setEventStaffMembers(eventId: string, staffMemberIds: string[]): Promise<void> {
    // Delete existing entries
    await db.delete(scheduleEventStaff).where(eq(scheduleEventStaff.eventId, eventId));
    
    // Insert new entries
    if (staffMemberIds.length > 0) {
      const entries = staffMemberIds.map(staffMemberId => ({
        id: randomUUID(),
        eventId,
        staffMemberId,
        createdAt: new Date(),
      }));
      await db.insert(scheduleEventStaff).values(entries);
    }
  }
  
  // Medication CRUD operations
  async getAllMedications(): Promise<SelectMedication[]> {
    return await db.select().from(medications);
  }
  
  async getMedicationById(id: string): Promise<SelectMedication | null> {
    const [result] = await db.select().from(medications).where(eq(medications.id, id));
    return result || null;
  }
  
  async getMedicationsByPatient(patientId: string): Promise<SelectMedication[]> {
    return await db.select().from(medications).where(eq(medications.patientId, patientId));
  }
  
  async createMedication(medication: InsertMedication): Promise<SelectMedication> {
    const medicationToInsert = {
      id: randomUUID(),
      patientId: medication.patientId,
      name: medication.name,
      dosage: medication.dosage,
      timeOfDay: medication.timeOfDay,
      specificTimes: medication.specificTimes || null,
      scheduledDays: medication.scheduledDays || null,
      startDate: medication.startDate,
      endDate: medication.endDate || null,
      note: medication.note || '',
      isActive: medication.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const [result] = await db.insert(medications).values(medicationToInsert).returning();
    return result;
  }
  
  async updateMedication(id: string, medication: UpdateMedication): Promise<SelectMedication | null> {
    const [result] = await db
      .update(medications)
      .set({ ...medication, updatedAt: new Date() })
      .where(eq(medications.id, id))
      .returning();
    return result || null;
  }
  
  async deleteMedication(id: string): Promise<boolean> {
    const result = await db.delete(medications).where(eq(medications.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Medication Log operations
  async getMedicationLogs(patientId: string, startDate?: Date, endDate?: Date): Promise<SelectMedicationLog[]> {
    let query = db.select().from(medicationLogs).where(eq(medicationLogs.patientId, patientId));
    // Note: Date filtering would need additional where clauses - for now get all and filter
    const results = await query;
    return results.filter(log => {
      if (startDate && log.date < startDate) return false;
      if (endDate && log.date > endDate) return false;
      return true;
    });
  }
  
  async getMedicationLogsByDate(date: Date): Promise<SelectMedicationLog[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return await db.select().from(medicationLogs)
      .where(and(
        gte(medicationLogs.date, startOfDay),
        lte(medicationLogs.date, endOfDay)
      ));
  }
  
  async createOrUpdateMedicationLog(log: InsertMedicationLog): Promise<SelectMedicationLog> {
    const startOfDay = new Date(log.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(log.date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Check if log exists for this medication, date, time of day, and specific hour
    const whereConditions = [
      eq(medicationLogs.medicationId, log.medicationId),
      eq(medicationLogs.timeOfDay, log.timeOfDay),
      gte(medicationLogs.date, startOfDay),
      lte(medicationLogs.date, endOfDay),
    ];
    
    // Add specificHour condition (match null with null, or value with value)
    if (log.specificHour) {
      whereConditions.push(eq(medicationLogs.specificHour, log.specificHour));
    } else {
      whereConditions.push(sql`${medicationLogs.specificHour} IS NULL`);
    }
    
    const existing = await db.select().from(medicationLogs)
      .where(and(...whereConditions));
    
    if (existing.length > 0) {
      const [result] = await db
        .update(medicationLogs)
        .set({
          taken: log.taken,
          takenAt: log.taken ? new Date() : null,
          markedBy: log.markedBy || null,
          responsibleName: log.responsibleName || null,
          notes: log.notes || '',
        })
        .where(eq(medicationLogs.id, existing[0].id))
        .returning();
      return result;
    }
    
    const logToInsert = {
      id: randomUUID(),
      medicationId: log.medicationId,
      patientId: log.patientId,
      date: log.date,
      timeOfDay: log.timeOfDay,
      specificHour: log.specificHour || null,
      taken: log.taken,
      takenAt: log.taken ? new Date() : null,
      markedBy: log.markedBy || null,
      responsibleName: log.responsibleName || null,
      notes: log.notes || '',
      createdAt: new Date(),
    };
    const [result] = await db.insert(medicationLogs).values(logToInsert).returning();
    return result;
  }
  
  async getAuditLog(limit: number = 50): Promise<any[]> {
    const logs = await db.select().from(medicationLogs)
      .where(eq(medicationLogs.taken, true))
      .orderBy(desc(medicationLogs.takenAt))
      .limit(limit);
    
    const allMedications = await this.getAllMedications();
    const allOccupants = await this.getAllOccupants();
    
    const TIME_LABELS: Record<string, string> = {
      morning: 'בוקר',
      noon: 'צהריים',
      afternoon: 'אחה״צ',
      night: 'לילה',
    };
    
    const regularLogs = logs.map(log => {
      const medication = allMedications.find(m => m.id === log.medicationId);
      const patient = allOccupants.find(o => o.id === log.patientId);
      
      let specificTime: string | undefined;
      if (medication && (medication as any).specificTimes) {
        try {
          const parsedTimes = JSON.parse((medication as any).specificTimes);
          specificTime = parsedTimes[log.timeOfDay];
        } catch (e) {}
      }
      
      return {
        ...log,
        medicationName: medication?.name || 'לא ידוע',
        patientName: patient?.name || 'לא ידוע',
        timeOfDayLabel: TIME_LABELS[log.timeOfDay] || log.timeOfDay,
        specificTime,
        isSos: false,
      };
    });
    
    // Also fetch SOS medication logs and merge them
    const sosLogs = await db.select().from(sosMedicationLogs)
      .orderBy(desc(sosMedicationLogs.createdAt))
      .limit(limit);
    
    const formattedSosLogs = sosLogs.map(log => {
      const patient = allOccupants.find(o => o.id === log.patientId);
      return {
        id: log.id,
        medicationName: log.sosMedicationName + ' 🆘',
        patientName: patient?.name || 'לא ידוע',
        takenAt: log.createdAt,
        responsibleName: log.responsibleName,
        notes: log.reason,
        timeOfDayLabel: 'SOS',
        isSos: true,
        nurseOverride: log.nurseOverride,
      };
    });
    
    // Merge and sort by time
    const allLogs = [...regularLogs, ...formattedSosLogs]
      .sort((a, b) => {
        const timeA = a.takenAt ? new Date(a.takenAt).getTime() : 0;
        const timeB = b.takenAt ? new Date(b.takenAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, limit);
    
    return allLogs;
  }
  
  async getDistributionView(date: Date, timeOfDay: string): Promise<MedicationDistributionItem[]> {
    const todayLogs = await this.getMedicationLogsByDate(date);
    const allMedications = await this.getAllMedications();
    const allOccupants = await this.getAllOccupants();
    
    const dateStr = date.toISOString().split('T')[0];
    
    const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = DAY_NAMES[date.getDay()];

    // Get all active medications for the specified time of day
    const activeMedications = allMedications.filter(m => {
      if (!m.isActive) return false;
      if (!m.timeOfDay.includes(timeOfDay)) return false;
      const startDateStr = m.startDate.toISOString().split('T')[0];
      if (startDateStr > dateStr) return false;
      if (m.endDate) {
        const endDateStr = m.endDate.toISOString().split('T')[0];
        if (endDateStr < dateStr) return false;
      }
      if ((m as any).scheduledDays && !(m as any).scheduledDays.includes(dayName)) return false;
      return true;
    });
    
    // Group by patient
    const patientMap = new Map<string, MedicationDistributionItem>();
    
    for (const med of activeMedications) {
      const patient = allOccupants.find(o => o.id === med.patientId);
      if (!patient) continue;
      
      if (!patientMap.has(med.patientId)) {
        patientMap.set(med.patientId, {
          patientId: med.patientId,
          patientName: patient.name,
          medications: [],
        });
      }
      
      // Parse specificTimes - supports both single hour and array of hours
      let specificHours: string[] = [];
      if ((med as any).specificTimes) {
        try {
          const parsedTimes = JSON.parse((med as any).specificTimes);
          const slotValue = parsedTimes[timeOfDay];
          if (slotValue) {
            specificHours = Array.isArray(slotValue) ? slotValue : [slotValue];
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Add one entry per specific hour, or one entry with no hour if none specified
      if (specificHours.length > 0) {
        for (const hour of specificHours) {
          // Look up log for this specific hour
          const log = todayLogs.find(l => 
            l.medicationId === med.id && 
            l.timeOfDay === timeOfDay &&
            l.specificHour === hour
          );
          patientMap.get(med.patientId)!.medications.push({
            id: med.id,
            name: med.name,
            dosage: med.dosage,
            note: med.note || undefined,
            specificTime: hour,
            taken: log?.taken || false,
            logId: log?.id,
          });
        }
      } else {
        // Look up log for this time of day without specific hour
        const log = todayLogs.find(l => 
          l.medicationId === med.id && 
          l.timeOfDay === timeOfDay &&
          !l.specificHour
        );
        patientMap.get(med.patientId)!.medications.push({
          id: med.id,
          name: med.name,
          dosage: med.dosage,
          note: med.note || undefined,
          specificTime: undefined,
          taken: log?.taken || false,
          logId: log?.id,
        });
      }
    }
    
    // Add SOS medications distributed today - filtered by time slot
    const sosLogs = await this.getSosMedicationLogsByDate(dateStr);
    for (const sosLog of sosLogs) {
      const patient = allOccupants.find(o => o.id === sosLog.patientId);
      if (!patient) continue;
      
      // Determine which time slot this SOS medication belongs to based on createdAt hour (Israel time)
      // Convert UTC to Israel time by getting the locale string and parsing the hour
      const israelTimeStr = sosLog.createdAt.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hour12: false });
      const sosHour = parseInt(israelTimeStr.split(':')[0], 10);
      
      let sosTimeSlot: string;
      if (sosHour >= 6 && sosHour < 12) {
        sosTimeSlot = 'morning';
      } else if (sosHour >= 12 && sosHour < 15) {
        sosTimeSlot = 'noon';
      } else if (sosHour >= 15 && sosHour < 20) {
        sosTimeSlot = 'afternoon';
      } else {
        sosTimeSlot = 'night';
      }
      
      // Only include this SOS medication if it matches the requested time slot
      if (sosTimeSlot !== timeOfDay) continue;
      
      // Add patient to map if not already there
      if (!patientMap.has(sosLog.patientId)) {
        patientMap.set(sosLog.patientId, {
          patientId: sosLog.patientId,
          patientName: patient.name,
          medications: [],
        });
      }
      
      // Add SOS medication entry - pass timestamp for client-side formatting
      patientMap.get(sosLog.patientId)!.medications.push({
        id: sosLog.id,
        name: `🆘 ${sosLog.sosMedicationName}`,
        dosage: '',
        note: sosLog.reason || undefined,
        specificTime: undefined, // Will be formatted on client using sosTimestamp
        taken: true, // SOS medications are always taken when logged
        logId: sosLog.id,
        isSos: true,
        sosReason: sosLog.reason || undefined,
        sosResponsible: sosLog.responsibleName || undefined,
        sosTimestamp: sosLog.createdAt.toISOString(), // Pass raw timestamp for client formatting
      });
    }
    
    // Sort medications: regular medications first (by specificTime), then SOS medications (by timestamp)
    // Earlier times appear first (ascending order)
    const result = Array.from(patientMap.values());
    for (const item of result) {
      item.medications.sort((a, b) => {
        // Regular medications come before SOS medications
        if (a.isSos !== b.isSos) {
          return a.isSos ? 1 : -1;
        }
        
        // Both are SOS medications - sort by timestamp (earlier first)
        if (a.isSos && b.isSos) {
          const aTime = a.sosTimestamp ? new Date(a.sosTimestamp).getTime() : 0;
          const bTime = b.sosTimestamp ? new Date(b.sosTimestamp).getTime() : 0;
          return aTime - bTime; // Earlier times first
        }
        
        // Both are regular medications - sort by specificTime
        // For night slot: times 20:00-23:59 should come before 00:00-05:59
        const aHasTime = !!a.specificTime;
        const bHasTime = !!b.specificTime;
        if (aHasTime !== bHasTime) {
          return aHasTime ? 1 : -1; // No specific time first
        }
        if (aHasTime && bHasTime) {
          const aHour = parseInt(a.specificTime!.split(':')[0], 10);
          const bHour = parseInt(b.specificTime!.split(':')[0], 10);
          // Evening hours (20-23) come before early morning hours (0-5)
          const aIsEvening = aHour >= 20;
          const bIsEvening = bHour >= 20;
          if (aIsEvening !== bIsEvening) {
            return aIsEvening ? -1 : 1; // Evening first
          }
          return a.specificTime!.localeCompare(b.specificTime!);
        }
        return 0;
      });
    }
    
    return result;
  }
  
  // Patient Shopping List operations
  async getAllPatientShoppingLists(): Promise<SelectPatientShoppingList[]> {
    return await db.select().from(patientShoppingLists);
  }
  
  async getPatientShoppingListById(id: string): Promise<SelectPatientShoppingList | null> {
    const [result] = await db.select().from(patientShoppingLists).where(eq(patientShoppingLists.id, id));
    return result || null;
  }
  
  async createPatientShoppingList(list: InsertPatientShoppingList): Promise<SelectPatientShoppingList> {
    const listToInsert = {
      id: randomUUID(),
      patientId: list.patientId,
      patientName: list.patientName,
      items: list.items || '',
      checkedItems: list.checkedItems || [],
      totalAmount: list.totalAmount || '',
      paymentMethod: list.paymentMethod || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const [result] = await db.insert(patientShoppingLists).values(listToInsert).returning();
    return result;
  }
  
  async updatePatientShoppingList(id: string, list: UpdatePatientShoppingList): Promise<SelectPatientShoppingList | null> {
    const [result] = await db
      .update(patientShoppingLists)
      .set({ ...list, updatedAt: new Date() })
      .where(eq(patientShoppingLists.id, id))
      .returning();
    return result || null;
  }
  
  async deletePatientShoppingList(id: string): Promise<boolean> {
    const result = await db.delete(patientShoppingLists).where(eq(patientShoppingLists.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async deleteAllPatientShoppingLists(): Promise<boolean> {
    await db.delete(patientShoppingLists);
    return true;
  }
  
  // Purchase Transaction operations
  async getPurchaseTransactionsByPatient(patientId: string): Promise<SelectPurchaseTransaction[]> {
    return await db
      .select()
      .from(purchaseTransactions)
      .where(eq(purchaseTransactions.patientId, patientId))
      .orderBy(desc(purchaseTransactions.purchaseDate));
  }
  
  async createPurchaseTransaction(transaction: InsertPurchaseTransaction): Promise<SelectPurchaseTransaction> {
    const transactionToInsert = {
      id: randomUUID(),
      patientId: transaction.patientId,
      patientName: transaction.patientName,
      items: transaction.items,
      totalAmount: transaction.totalAmount,
      purchaseDate: transaction.purchaseDate || new Date(),
      createdAt: new Date(),
    };
    const [result] = await db.insert(purchaseTransactions).values(transactionToInsert).returning();
    return result;
  }
  
  // Deposit History operations
  async getDepositHistoryByPatient(patientId: string): Promise<SelectDepositHistory[]> {
    return await db
      .select()
      .from(depositHistory)
      .where(eq(depositHistory.patientId, patientId))
      .orderBy(desc(depositHistory.createdAt));
  }
  
  async createDepositHistory(entry: InsertDepositHistory): Promise<SelectDepositHistory> {
    const entryToInsert = {
      id: randomUUID(),
      patientId: entry.patientId,
      patientName: entry.patientName,
      amount: entry.amount,
      note: entry.note || null,
      createdAt: new Date(),
    };
    const [result] = await db.insert(depositHistory).values(entryToInsert).returning();
    return result;
  }
  
  // Cash Flow Settings operations
  async getCashFlowSettings(): Promise<SelectCashFlowSettings | null> {
    const [settings] = await db.select().from(cashFlowSettings).where(eq(cashFlowSettings.id, 'default'));
    return settings || null;
  }
  
  async updateCashFlowActiveYear(year: number): Promise<SelectCashFlowSettings> {
    const existing = await this.getCashFlowSettings();
    if (existing) {
      const [result] = await db.update(cashFlowSettings).set({ activeYear: year, updatedAt: new Date() }).where(eq(cashFlowSettings.id, 'default')).returning();
      return result;
    }
    const [result] = await db.insert(cashFlowSettings).values({ id: 'default', activeYear: year, updatedAt: new Date() }).returning();
    return result;
  }
  
  // Cash Flow Opening Balances operations
  async getCashFlowOpeningBalances(): Promise<SelectCashFlowOpeningBalance[]> {
    return await db.select().from(cashFlowOpeningBalances);
  }
  
  async getCashFlowOpeningBalance(year: number): Promise<SelectCashFlowOpeningBalance | null> {
    const [balance] = await db.select().from(cashFlowOpeningBalances).where(eq(cashFlowOpeningBalances.year, year));
    return balance || null;
  }
  
  async setCashFlowOpeningBalance(year: number, balance: number): Promise<SelectCashFlowOpeningBalance> {
    const existing = await this.getCashFlowOpeningBalance(year);
    if (existing) {
      const [result] = await db.update(cashFlowOpeningBalances).set({ openingBalance: balance, updatedAt: new Date() }).where(eq(cashFlowOpeningBalances.year, year)).returning();
      return result;
    }
    const [result] = await db.insert(cashFlowOpeningBalances).values({ id: `balance-${year}`, year, openingBalance: balance, createdAt: new Date(), updatedAt: new Date() }).returning();
    return result;
  }
  
  // Cash Flow Categories operations
  async getCashFlowCategories(): Promise<SelectCashFlowCategory[]> {
    return await db.select().from(cashFlowCategories).where(eq(cashFlowCategories.isArchived, false));
  }
  
  async getCashFlowCategoriesByType(type: 'income' | 'expense' | 'both'): Promise<SelectCashFlowCategory[]> {
    return await db.select().from(cashFlowCategories).where(and(eq(cashFlowCategories.isArchived, false), or(eq(cashFlowCategories.type, type), eq(cashFlowCategories.type, 'both'))));
  }
  
  async createCashFlowCategory(category: InsertCashFlowCategory): Promise<SelectCashFlowCategory> {
    const [result] = await db.insert(cashFlowCategories).values({ id: randomUUID(), name: category.name, type: category.type, isArchived: category.isArchived || false, createdAt: new Date(), updatedAt: new Date() }).returning();
    return result;
  }
  
  async updateCashFlowCategory(id: string, category: UpdateCashFlowCategory): Promise<SelectCashFlowCategory | null> {
    const [result] = await db.update(cashFlowCategories).set({ ...category, updatedAt: new Date() }).where(eq(cashFlowCategories.id, id)).returning();
    return result || null;
  }
  
  async deleteCashFlowCategory(id: string): Promise<boolean> {
    const result = await db.delete(cashFlowCategories).where(eq(cashFlowCategories.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Cash Flow Credit Cards operations
  async getCashFlowCreditCards(): Promise<SelectCashFlowCreditCard[]> {
    return await db.select().from(cashFlowCreditCards).where(eq(cashFlowCreditCards.isActive, true));
  }
  
  async getCashFlowCreditCardById(id: string): Promise<SelectCashFlowCreditCard | null> {
    const [card] = await db.select().from(cashFlowCreditCards).where(eq(cashFlowCreditCards.id, id));
    return card || null;
  }
  
  async createCashFlowCreditCard(card: InsertCashFlowCreditCard): Promise<SelectCashFlowCreditCard> {
    const [result] = await db.insert(cashFlowCreditCards).values({ id: randomUUID(), name: card.name, lastFour: card.lastFour || null, chargeDay: card.chargeDay || 10, issuer: card.issuer || null, isActive: card.isActive !== false, createdAt: new Date(), updatedAt: new Date() }).returning();
    return result;
  }
  
  async updateCashFlowCreditCard(id: string, card: UpdateCashFlowCreditCard): Promise<SelectCashFlowCreditCard | null> {
    const [result] = await db.update(cashFlowCreditCards).set({ ...card, updatedAt: new Date() }).where(eq(cashFlowCreditCards.id, id)).returning();
    return result || null;
  }
  
  async deleteCashFlowCreditCard(id: string): Promise<boolean> {
    const [result] = await db.update(cashFlowCreditCards).set({ isActive: false, updatedAt: new Date() }).where(eq(cashFlowCreditCards.id, id)).returning();
    return !!result;
  }
  
  // Cash Flow Transactions operations
  async getCashFlowTransactions(year: number, month?: number): Promise<SelectCashFlowTransaction[]> {
    if (month !== undefined) {
      return await db.select().from(cashFlowTransactions).where(and(eq(cashFlowTransactions.year, year), eq(cashFlowTransactions.month, month))).orderBy(desc(cashFlowTransactions.date));
    }
    return await db.select().from(cashFlowTransactions).where(eq(cashFlowTransactions.year, year)).orderBy(desc(cashFlowTransactions.date));
  }
  
  async getCashFlowTransactionById(id: string): Promise<SelectCashFlowTransaction | null> {
    const [transaction] = await db.select().from(cashFlowTransactions).where(eq(cashFlowTransactions.id, id));
    return transaction || null;
  }
  
  async createCashFlowTransaction(transaction: InsertCashFlowTransaction): Promise<SelectCashFlowTransaction> {
    const dateValue = typeof transaction.date === 'string' ? new Date(transaction.date) : transaction.date;
    const [result] = await db.insert(cashFlowTransactions).values({ 
      id: randomUUID(), 
      date: dateValue, 
      year: transaction.year, 
      month: transaction.month, 
      type: transaction.type, 
      amount: transaction.amount, 
      categoryId: transaction.categoryId || null, 
      categoryLabel: transaction.categoryLabel, 
      paymentMethod: transaction.paymentMethod, 
      status: transaction.status, 
      description: transaction.description || '', 
      creditCardId: transaction.creditCardId || null, 
      creditCardName: transaction.creditCardName || null,
      checkChargeDate: transaction.checkChargeDate || null,
      recurringGroupId: transaction.recurringGroupId || null,
      isRecurring: transaction.isRecurring || false,
      createdAt: new Date(), 
      updatedAt: new Date() 
    }).returning();
    return result;
  }
  
  async updateCashFlowTransaction(id: string, transaction: UpdateCashFlowTransaction): Promise<SelectCashFlowTransaction | null> {
    const updateData: any = { ...transaction, updatedAt: new Date() };
    if (updateData.date && typeof updateData.date === 'string') {
      updateData.date = new Date(updateData.date);
    }
    // Remove convertToOneTime from update data as it's not a DB field
    delete updateData.convertToOneTime;
    
    const [result] = await db.update(cashFlowTransactions).set(updateData).where(eq(cashFlowTransactions.id, id)).returning();
    return result || null;
  }
  
  async deleteFutureRecurringTransactions(recurringGroupId: string, afterDate: Date): Promise<number> {
    const result = await db.delete(cashFlowTransactions).where(
      and(
        eq(cashFlowTransactions.recurringGroupId, recurringGroupId),
        gt(cashFlowTransactions.date, afterDate),
        eq(cashFlowTransactions.status, 'pending')
      )
    );
    return result.rowCount || 0;
  }
  
  async deleteCashFlowTransaction(id: string): Promise<boolean> {
    const result = await db.delete(cashFlowTransactions).where(eq(cashFlowTransactions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Cash Flow Balance calculations
  async getCashFlowBalances(year: number): Promise<{ openingBalance: number; bankBalance: number; expectedBalance: number }> {
    let openingBalanceRecord = await this.getCashFlowOpeningBalance(year);
    let openingBalance = openingBalanceRecord?.openingBalance || 0;
    
    // If no opening balance set for this year, calculate from previous year's closing balance
    if (!openingBalanceRecord && year > 2024) {
      const prevYearBalances = await this.getCashFlowBalances(year - 1);
      openingBalance = prevYearBalances.bankBalance;
    }
    
    const transactions = await this.getCashFlowTransactions(year);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    // Transactions dated today or earlier count as completed for bank balance
    const isEffective = (t: SelectCashFlowTransaction) => {
      const txDate = new Date(t.date);
      return t.status === 'completed' || txDate <= today;
    };
    
    const income = transactions.filter(t => t.type === 'income' && isEffective(t)).reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense' && isEffective(t)).reduce((sum, t) => sum + t.amount, 0);
    const bankBalance = openingBalance + income - expense;
    
    // Only future pending transactions count towards expected
    const pendingIncome = transactions.filter(t => t.type === 'income' && !isEffective(t)).reduce((sum, t) => sum + t.amount, 0);
    const pendingExpense = transactions.filter(t => t.type === 'expense' && !isEffective(t)).reduce((sum, t) => sum + t.amount, 0);
    const expectedBalance = bankBalance + pendingIncome - pendingExpense;
    return { openingBalance, bankBalance, expectedBalance };
  }
  
  async getCashFlowMonthlySummary(year: number): Promise<Array<{ month: number; income: number; expense: number; net: number }>> {
    const transactions = await this.getCashFlowTransactions(year);
    const summary: Array<{ month: number; income: number; expense: number; net: number }> = [];
    for (let month = 1; month <= 12; month++) {
      const monthTransactions = transactions.filter(t => t.month === month);
      const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      summary.push({ month, income, expense, net: income - expense });
    }
    return summary;
  }
  
  // SOS Medications CRUD
  async getAllSosMedications(): Promise<SelectSosMedication[]> {
    return await db.select().from(sosMedications);
  }
  
  async getSosMedicationById(id: string): Promise<SelectSosMedication | null> {
    const [result] = await db.select().from(sosMedications).where(eq(sosMedications.id, id));
    return result || null;
  }
  
  async createSosMedication(medication: InsertSosMedication): Promise<SelectSosMedication> {
    const [result] = await db.insert(sosMedications).values({
      id: randomUUID(),
      name: medication.name,
      description: medication.description || '',
      cooldownHours: medication.cooldownHours ?? 0,
      isActive: medication.isActive ?? true,
      createdAt: new Date(),
    }).returning();
    return result;
  }
  
  async updateSosMedication(id: string, medication: UpdateSosMedication): Promise<SelectSosMedication | null> {
    const [result] = await db.update(sosMedications).set(medication).where(eq(sosMedications.id, id)).returning();
    return result || null;
  }
  
  async deleteSosMedication(id: string): Promise<boolean> {
    const result = await db.delete(sosMedications).where(eq(sosMedications.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Patient SOS Allergies
  async getPatientSosAllergies(patientId: string): Promise<SelectPatientSosAllergy[]> {
    return await db.select().from(patientSosAllergies).where(eq(patientSosAllergies.patientId, patientId));
  }
  
  async setPatientSosAllergies(patientId: string, sosMedicationIds: string[]): Promise<void> {
    await db.delete(patientSosAllergies).where(eq(patientSosAllergies.patientId, patientId));
    if (sosMedicationIds.length > 0) {
      const values = sosMedicationIds.map(sosMedicationId => ({
        id: randomUUID(),
        patientId,
        sosMedicationId,
        createdAt: new Date(),
      }));
      await db.insert(patientSosAllergies).values(values);
    }
  }
  
  // SOS Medication Logs
  async getSosMedicationLogs(limit?: number): Promise<SelectSosMedicationLog[]> {
    let query = db.select().from(sosMedicationLogs).orderBy(desc(sosMedicationLogs.createdAt));
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    return await query;
  }
  
  async getSosMedicationLogsByPatient(patientId: string): Promise<SelectSosMedicationLog[]> {
    return await db.select().from(sosMedicationLogs).where(eq(sosMedicationLogs.patientId, patientId)).orderBy(desc(sosMedicationLogs.createdAt));
  }
  
  async getSosMedicationLogsByDate(date: string): Promise<SelectSosMedicationLog[]> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    return await db.select().from(sosMedicationLogs)
      .where(and(
        sql`${sosMedicationLogs.date} >= ${startDate}`,
        sql`${sosMedicationLogs.date} <= ${endDate}`
      ))
      .orderBy(desc(sosMedicationLogs.createdAt));
  }
  
  async createSosMedicationLog(log: InsertSosMedicationLog): Promise<SelectSosMedicationLog> {
    const [result] = await db.insert(sosMedicationLogs).values({
      id: randomUUID(),
      patientId: log.patientId,
      sosMedicationId: log.sosMedicationId,
      sosMedicationName: log.sosMedicationName,
      date: log.date,
      reason: log.reason,
      responsibleName: log.responsibleName,
      nurseOverride: log.nurseOverride ?? false,
      createdAt: new Date(),
    }).returning();
    return result;
  }
  
  async deleteSosMedicationLog(id: string): Promise<boolean> {
    const result = await db.delete(sosMedicationLogs).where(eq(sosMedicationLogs.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  // Push Subscriptions
  async getAllPushSubscriptions(): Promise<any[]> {
    return await db.select().from(pushSubscriptions);
  }
  
  async createPushSubscription(subscription: { endpoint: string; p256dh: string; auth: string }): Promise<any> {
    const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    if (existing.length > 0) return existing[0];
    
    const [result] = await db.insert(pushSubscriptions).values({
      id: randomUUID(),
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      createdAt: new Date(),
    }).returning();
    return result;
  }
  
  async deletePushSubscription(endpoint: string): Promise<boolean> {
    const result = await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getWebauthnCredentials(): Promise<any[]> {
    return await db.select().from(webauthnCredentials);
  }

  async saveWebauthnCredential(cred: { id: string; credentialId: string; publicKey: string; counter: number; deviceType: string; backedUp: boolean }): Promise<any> {
    const [result] = await db.insert(webauthnCredentials).values(cred).returning();
    return result;
  }

  async updateWebauthnCredentialCounter(id: string, counter: number): Promise<void> {
    await db.update(webauthnCredentials).set({ counter }).where(eq(webauthnCredentials.id, id));
  }

  async deleteWebauthnCredential(credentialId: string): Promise<void> {
    await db.delete(webauthnCredentials).where(eq(webauthnCredentials.credentialId, credentialId));
  }
}

export const storage = new DatabaseStorage();
