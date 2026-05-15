# ניו לייף - מערכת ניהול תפוסת חדרים

## Overview
מערכת ניהול תפוסת חדרים עבור מרכז השיקום "ניו לייף" המאפשרת מעקב, הוספה, עריכה ומחיקה של מטופלים וחדרים. הפרויקט כולל ממשק בעברית עם תמיכה ב-RTL, ניהול לוח זמנים מקיף עם משימות ואירועים, ומערכת שכפול לוח זמנים מתקדמת. המערכת נועדה לייעל את ניהול תפוסת החדרים והשירותים במרכז, תוך מתן חווית משתמש עשירה ומותאמת אישית.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Technology Stack**: React 18 with TypeScript, Vite, Tailwind CSS, Shadcn/UI, Radix UI.
-   **Localization**: Full Hebrew RTL layout with Heebo font.
-   **State Management**: React Query (TanStack Query) for server state management.
-   **Form Handling**: React Hook Form with Zod validation.
-   **UI/UX**: Responsive, mobile-first design with card-based layouts and accessible components.
-   **Calendar System**: FullCalendar integration for tasks and events management, with custom views, printing, and drag-and-drop functionality.
-   **PWA**: Progressive Web App capabilities including manifest, service worker for offline support, and update notifications.

### Backend
-   **Technology Stack**: Express.js with TypeScript.
-   **API**: RESTful API for CRUD operations on rooms, occupants, tasks, and events.
-   **Storage**: In-memory storage with pre-populated data for development, supporting dynamic room and occupant management.
-   **Real-time**: WebSocket integration for live calendar updates and synchronization.
-   **Middleware**: Integrated Vite middleware for HMR in development.
-   **Deployment Readiness**: Health checks, graceful shutdown, session management, and robust error handling.

### Data Model
-   **Rooms**: Customizable structure including floors, names, and capacity limits.
-   **Occupants**: Managed dynamically with name, room assignment, and stay duration tracking.
-   **Tasks & Events**: Comprehensive system for managing scheduled activities with CRUD operations, recurrence, and real-time updates.
-   **Borrowed Items**: Tracking and management of items borrowed by occupants.
-   **Target Inventory**: Products organized by categories (אוכל ושתייה 🍎, מוצרי נקיון 🧽, מוצרים נלווים, מוצרים רפואיים 💉) with multi-language support (Hebrew, English, other) and target quantity tracking.
-   **Custom Inventory Categories**: User-defined categories stored in PostgreSQL database (custom_inventory_categories table), shared across all users. Supports name and emoji icon customization.
-   **Staff Members**: Team management with unique pastel colors for visual identification in calendar.
-   **Schedule Events**: Two-layer scheduling system (staff/management) with time-based events, staff assignments, and notes.
-   **Medications**: Patient medication management with name, dosage, time-of-day scheduling (morning/noon/afternoon/night), start/end dates, and active status.
-   **Medication Logs**: Tracking when medications were taken, with timestamp, nurse confirmation, and responsible person name for audit trail.
-   **Purchase Transactions**: Tracking patient shopping purchases with items, amounts, and purchase dates. Links to occupants for deposit deduction on cash payments.

### Key Features
-   **Navigation Dashboard**: Modern, glassmorphism-styled navigation dashboard at /main with 8 colorful cards for quick access to all system modules (Rooms, Calendar, Weekly Schedule, Target Inventory, Shopping List, Medications Management, Medication Patients, Patient Shopping). Password-protected access (2026).
-   **Dynamic Room Management**: Create, edit, and delete rooms with customizable capacity.
-   **Occupant Tracking**: Add, edit, and delete occupants with real-time countdowns.
-   **Comprehensive Calendar**: Management of tasks and events, including creation, editing, drag-and-drop, and various views (day, week, month).
-   **Weekly Schedule Calendar**: Two-layer calendar with distinct views:
    - Staff layer: Hour-based grid with drag-and-drop, resizing, and time-slot event placement
    - Management layer: Manager-based table with managers as rows and days as columns, showing hours per manager per day
-   **Staff Management**: Team members with role types (staff, management, other), unique pastel colors, CRUD operations via popover interface. Managers and "other" entries appear in management calendar table.
-   **Schedule Duplication**: Mobile single-day and desktop bulk weekly duplication of schedules with robust validation.
-   **Borrowed Items Management**: Interface for managing items borrowed by clients, including adding and returning.
-   **Inventory Management**: Complete target inventory system with 4 categories (אוכל ושתייה 🍎, מוצרי נקיון 🧽, מוצרים נלווים, מוצרים רפואיים 💉), displayed in organized columns by category, with multi-language product names and shopping list integration.
-   **Automatic Date Calculation**: Smart calculation of end dates based on join date and planned stay duration.
-   **Printing System**: Enhanced print functionality for weekly and daily schedules, optimized for readability.
-   **Mobile Experience**: Optimized mobile UI with swipe navigation, dedicated daily views, and touch-friendly interactions.
-   **Medication Management Module**: Dual-access medication system with two entry modes: (1) Full access via password (2026) for medication CRUD operations, patient management, and audit log viewing; (2) Quick distribution access (no password) for marking medications as taken - requires nurse name entry for accountability. Features time-of-day scheduling (morning/noon/afternoon/night) and audit log tracking who administered each medication.

## External Dependencies
-   **Radix UI**: Accessible component primitives.
-   **Lucide Icons**: Icon library.
-   **FullCalendar**: Calendar component.
-   **Heebo Font**: Hebrew web font.
-   **React Query (TanStack Query)**: Data fetching and state management.
-   **React Hook Form & Zod**: Form management and validation.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **Shadcn/UI**: UI components built on Radix UI and Tailwind CSS.