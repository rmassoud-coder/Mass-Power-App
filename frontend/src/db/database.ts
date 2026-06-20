import * as SQLite from 'expo-sqlite';
import seedData from './seed.json';

const DB_NAME = 'mass_power.db';

// Lazy-initialized database
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

// Generate a unique ID (simple timestamp + random)
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export interface Customer {
  id: string;
  name: string;
  mobile_number: string;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  vin: string;
  plate_number: string;
  make: string;
  model: string;
  year?: string;
  created_at: string;
}

export interface Service {
  id: string;
  vehicle_id: string;
  customer_id: string;
  service_description: string;
  additional_info?: string;
  cost: number;
  is_paid: boolean;
  service_date: string;
  created_at: string;
  // Dashboard warning lights (booleans stored as 0/1 in SQLite)
  dash_abs?: boolean;
  dash_check_engine?: boolean;
  dash_brake?: boolean;
  dash_airbag?: boolean;
  dash_immobilizer?: boolean;
  dash_tpms?: boolean;
  dash_oil_leak?: boolean;
  // Oil change reminder fields (only relevant when service_description === 'Oil Services')
  current_mileage?: number | null;
  next_service_date?: string | null; // ISO date
  next_service_mileage?: number | null;
  oil_grade?: string | null;
  oil_filter_changed?: boolean;
  // Reminder system: when 1 the oil-change reminder for this service is hidden permanently
  reminder_dismissed?: boolean;
  // Inventory items used on this service (loaded on demand)
  items?: ServiceItem[];
}

export interface InventoryItem {
  id: string;
  item_number: string; // e.g. INV-001
  item_type: string;
  item_quantity: number;
  item_price: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceItem {
  id: string;
  service_id: string;
  inventory_id: string;
  item_type: string; // snapshot of inventory item type at the time of save
  quantity: number;
  unit_price: number; // snapshot of price at the time of save
  created_at: string;
}

// Used by add/edit-service when posting items
export interface ServiceItemInput {
  inventory_id: string;
  quantity: number;
}

// Service category options for dropdown
export const SERVICE_CATEGORIES = [
  'HVAC Services',
  'Locksmith Services',
  'Oil Services',
  'Electrical Services',
  'Mechanical Services',
  'Other Services',
] as const;

export type ServiceCategory = typeof SERVICE_CATEGORIES[number];

// Dashboard warning light definitions
export interface DashLights {
  abs: boolean;
  check_engine: boolean;
  brake: boolean;
  airbag: boolean;
  immobilizer: boolean;
  tpms: boolean;
  oil_leak: boolean;
}

export const EMPTY_DASH_LIGHTS: DashLights = {
  abs: false,
  check_engine: false,
  brake: false,
  airbag: false,
  immobilizer: false,
  tpms: false,
  oil_leak: false,
};

export interface OilReminder {
  oilGrade: string;
  currentMileage: number | null;
  nextServiceDate: string | null; // ISO YYYY-MM-DD
  nextServiceMileage: number | null;
  oilFilterChanged: boolean;
}

export const EMPTY_OIL_REMINDER: OilReminder = {
  oilGrade: '',
  currentMileage: null,
  nextServiceDate: null,
  nextServiceMileage: null,
  oilFilterChanged: false,
};

export interface SearchResult {
  customer: Customer;
  vehicles: Vehicle[];
  total_services: number;
}

export interface CustomerDetail {
  customer: Customer;
  vehicles: Vehicle[];
  services: Service[];
}

export interface ReportItem {
  service_id: string;
  customer_id: string;
  customer_name: string;
  customer_mobile: string;
  vehicle_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year?: string;
  vehicle_vin: string;
  vehicle_plate: string;
  service_description: string;
  additional_info?: string;
  cost: number;
  is_paid: boolean;
  service_date: string;
}

// Initialize database tables and seed data on first run
export async function initDatabase() {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile_number);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      vin TEXT NOT NULL,
      plate_number TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);
    CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      service_description TEXT NOT NULL,
      additional_info TEXT,
      cost REAL NOT NULL,
      is_paid INTEGER NOT NULL DEFAULT 1,
      service_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_services_vehicle ON services(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_services_customer ON services(customer_id);

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      item_number TEXT NOT NULL UNIQUE,
      item_type TEXT NOT NULL,
      item_quantity INTEGER NOT NULL DEFAULT 0,
      item_price REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory(item_type);

    CREATE TABLE IF NOT EXISTS service_items (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      inventory_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_service_items_service ON service_items(service_id);
    CREATE INDEX IF NOT EXISTS idx_service_items_inventory ON service_items(inventory_id);
  `);

  // Migration: add is_paid column if missing (defaults to 1=paid for existing records)
  try {
    await db.execAsync(`ALTER TABLE services ADD COLUMN is_paid INTEGER NOT NULL DEFAULT 1`);
  } catch {
    // Column already exists - ignore
  }

  // Migration: dashboard warning light columns
  const dashColumns = [
    'dash_abs',
    'dash_check_engine',
    'dash_brake',
    'dash_airbag',
    'dash_immobilizer',
    'dash_tpms',
    'dash_oil_leak',
  ];
  for (const col of dashColumns) {
    try {
      await db.execAsync(`ALTER TABLE services ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`);
    } catch {
      // Column already exists - ignore
    }
  }

  // Migration: oil service reminder columns
  const oilReminderColumns: Array<[string, string]> = [
    ['current_mileage', 'INTEGER'],
    ['next_service_date', 'TEXT'],
    ['next_service_mileage', 'INTEGER'],
    ['oil_grade', 'TEXT'],
    ['oil_filter_changed', 'INTEGER NOT NULL DEFAULT 0'],
    ['reminder_dismissed', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [col, type] of oilReminderColumns) {
    try {
      await db.execAsync(`ALTER TABLE services ADD COLUMN ${col} ${type}`);
    } catch {
      // Column already exists - ignore
    }
  }

  // Seed data only once
  const seeded = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = 'seeded'`
  );

  if (!seeded) {
    for (const c of seedData.customers) {
      await db.runAsync(
        `INSERT OR IGNORE INTO customers (id, name, mobile_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [c.id, c.name, c.mobile_number, c.created_at, c.updated_at]
      );
    }
    for (const v of seedData.vehicles) {
      await db.runAsync(
        `INSERT OR IGNORE INTO vehicles (id, customer_id, vin, plate_number, make, model, year, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id, v.customer_id, v.vin, v.plate_number, v.make, v.model, v.year || null, v.created_at]
      );
    }
    for (const s of seedData.services) {
      await db.runAsync(
        `INSERT OR IGNORE INTO services (id, vehicle_id, customer_id, service_description, additional_info, cost, service_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.vehicle_id, s.customer_id, s.service_description, s.additional_info || null, s.cost, s.service_date, s.created_at]
      );
    }
    await db.runAsync(`INSERT INTO app_meta (key, value) VALUES ('seeded', 'true')`);
  }
}

// ============ Customer Operations ============
export async function createCustomer(name: string, mobileNumber: string): Promise<Customer> {
  const db = await getDb();
  // Check duplicate
  const existing = await db.getFirstAsync<Customer>(
    `SELECT * FROM customers WHERE mobile_number = ?`,
    [mobileNumber]
  );
  if (existing) {
    throw new Error('Customer with this mobile number already exists');
  }
  const now = new Date().toISOString();
  const id = generateId();
  await db.runAsync(
    `INSERT INTO customers (id, name, mobile_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [id, name, mobileNumber, now, now]
  );
  return { id, name, mobile_number: mobileNumber, created_at: now, updated_at: now };
}

export async function updateCustomer(id: string, name: string, mobileNumber: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE customers SET name = ?, mobile_number = ?, updated_at = ? WHERE id = ?`,
    [name, mobileNumber, now, id]
  );
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM services WHERE customer_id = ?`, [id]);
  await db.runAsync(`DELETE FROM vehicles WHERE customer_id = ?`, [id]);
  await db.runAsync(`DELETE FROM customers WHERE id = ?`, [id]);
}

export async function searchCustomers(query: string): Promise<SearchResult[]> {
  const db = await getDb();
  const q = `%${query}%`;
  const customers = await db.getAllAsync<Customer>(
    `SELECT * FROM customers WHERE name LIKE ? OR mobile_number LIKE ? ORDER BY name`,
    [q, q]
  );

  const results: SearchResult[] = [];
  for (const customer of customers) {
    const vehicles = await db.getAllAsync<Vehicle>(
      `SELECT * FROM vehicles WHERE customer_id = ?`,
      [customer.id]
    );
    const countRow = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM services WHERE customer_id = ?`,
      [customer.id]
    );
    results.push({
      customer,
      vehicles,
      total_services: countRow?.count ?? 0,
    });
  }
  return results;
}

export async function getCustomerDetails(customerId: string): Promise<CustomerDetail> {
  const db = await getDb();
  const customer = await db.getFirstAsync<Customer>(
    `SELECT * FROM customers WHERE id = ?`,
    [customerId]
  );
  if (!customer) {
    throw new Error('Customer not found');
  }
  const vehicles = await db.getAllAsync<Vehicle>(
    `SELECT * FROM vehicles WHERE customer_id = ?`,
    [customerId]
  );
  const rawServices = await db.getAllAsync<any>(
    `SELECT * FROM services WHERE customer_id = ? ORDER BY service_date DESC`,
    [customerId]
  );
  const services: Service[] = rawServices.map((s) => ({
    ...s,
    is_paid: s.is_paid === 1,
    dash_abs: s.dash_abs === 1,
    dash_check_engine: s.dash_check_engine === 1,
    dash_brake: s.dash_brake === 1,
    dash_airbag: s.dash_airbag === 1,
    dash_immobilizer: s.dash_immobilizer === 1,
    dash_tpms: s.dash_tpms === 1,
    dash_oil_leak: s.dash_oil_leak === 1,
    oil_filter_changed: s.oil_filter_changed === 1,
  }));
  // Attach inventory items used per service (so customer-detail can show them)
  for (const svc of services) {
    svc.items = await db.getAllAsync<ServiceItem>(
      `SELECT * FROM service_items WHERE service_id = ? ORDER BY created_at ASC`,
      [svc.id]
    );
  }
  return { customer, vehicles, services };
}

// ============ Vehicle Operations ============
export async function searchVehiclesByVin(vin: string): Promise<SearchResult[]> {
  const db = await getDb();
  const q = `%${vin}%`;
  const vehicles = await db.getAllAsync<Vehicle>(
    `SELECT * FROM vehicles WHERE vin LIKE ?`,
    [q]
  );
  return collectCustomersFromVehicles(db, vehicles);
}

export async function searchVehiclesByPlate(plate: string): Promise<SearchResult[]> {
  const db = await getDb();
  const q = `%${plate}%`;
  const vehicles = await db.getAllAsync<Vehicle>(
    `SELECT * FROM vehicles WHERE plate_number LIKE ?`,
    [q]
  );
  return collectCustomersFromVehicles(db, vehicles);
}

async function collectCustomersFromVehicles(
  db: SQLite.SQLiteDatabase,
  vehicles: Vehicle[]
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  for (const v of vehicles) {
    if (seen.has(v.customer_id)) continue;
    seen.add(v.customer_id);

    const customer = await db.getFirstAsync<Customer>(
      `SELECT * FROM customers WHERE id = ?`,
      [v.customer_id]
    );
    if (!customer) continue;

    const allVehicles = await db.getAllAsync<Vehicle>(
      `SELECT * FROM vehicles WHERE customer_id = ?`,
      [customer.id]
    );
    const countRow = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM services WHERE customer_id = ?`,
      [customer.id]
    );
    results.push({
      customer,
      vehicles: allVehicles,
      total_services: countRow?.count ?? 0,
    });
  }
  return results;
}

export async function createVehicle(
  customerId: string,
  vin: string,
  plateNumber: string,
  make: string,
  model: string,
  year?: string
): Promise<Vehicle> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO vehicles (id, customer_id, vin, plate_number, make, model, year, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, customerId, vin, plateNumber, make, model, year || null, now]
  );
  return {
    id,
    customer_id: customerId,
    vin,
    plate_number: plateNumber,
    make,
    model,
    year,
    created_at: now,
  };
}

export async function updateVehicle(
  id: string,
  vin: string,
  plateNumber: string,
  make: string,
  model: string,
  year?: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE vehicles SET vin = ?, plate_number = ?, make = ?, model = ?, year = ? WHERE id = ?`,
    [vin, plateNumber, make, model, year || null, id]
  );
}

export async function deleteVehicle(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM services WHERE vehicle_id = ?`, [id]);
  await db.runAsync(`DELETE FROM vehicles WHERE id = ?`, [id]);
}

// ============ Service Operations ============
export async function createService(
  vehicleId: string,
  serviceDescription: string,
  additionalInfo: string | undefined,
  cost: number,
  isPaid: boolean,
  dashLights?: DashLights,
  oilReminder?: OilReminder,
  items?: ServiceItemInput[]
): Promise<Service> {
  const db = await getDb();
  const vehicle = await db.getFirstAsync<Vehicle>(
    `SELECT * FROM vehicles WHERE id = ?`,
    [vehicleId]
  );
  if (!vehicle) {
    throw new Error('Vehicle not found');
  }
  const id = generateId();
  const now = new Date().toISOString();
  const d = dashLights || EMPTY_DASH_LIGHTS;
  const o = oilReminder || EMPTY_OIL_REMINDER;
  await db.runAsync(
    `INSERT INTO services (id, vehicle_id, customer_id, service_description, additional_info, cost, is_paid, service_date, created_at, dash_abs, dash_check_engine, dash_brake, dash_airbag, dash_immobilizer, dash_tpms, dash_oil_leak, current_mileage, next_service_date, next_service_mileage, oil_grade, oil_filter_changed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      vehicleId,
      vehicle.customer_id,
      serviceDescription,
      additionalInfo || null,
      cost,
      isPaid ? 1 : 0,
      now,
      now,
      d.abs ? 1 : 0,
      d.check_engine ? 1 : 0,
      d.brake ? 1 : 0,
      d.airbag ? 1 : 0,
      d.immobilizer ? 1 : 0,
      d.tpms ? 1 : 0,
      d.oil_leak ? 1 : 0,
      o.currentMileage,
      o.nextServiceDate,
      o.nextServiceMileage,
      o.oilGrade || null,
      o.oilFilterChanged ? 1 : 0,
    ]
  );

  // Attach inventory items + deduct stock
  const savedItems = await attachItemsToService(id, items || []);

  return {
    id,
    vehicle_id: vehicleId,
    customer_id: vehicle.customer_id,
    service_description: serviceDescription,
    additional_info: additionalInfo,
    cost,
    is_paid: isPaid,
    service_date: now,
    created_at: now,
    dash_abs: d.abs,
    dash_check_engine: d.check_engine,
    dash_brake: d.brake,
    dash_airbag: d.airbag,
    dash_immobilizer: d.immobilizer,
    dash_tpms: d.tpms,
    dash_oil_leak: d.oil_leak,
    current_mileage: o.currentMileage,
    next_service_date: o.nextServiceDate,
    next_service_mileage: o.nextServiceMileage,
    oil_grade: o.oilGrade || null,
    oil_filter_changed: o.oilFilterChanged,
    items: savedItems,
  };
}

export async function updateService(
  id: string,
  serviceDescription: string,
  additionalInfo: string | undefined,
  cost: number,
  isPaid: boolean,
  dashLights?: DashLights,
  oilReminder?: OilReminder,
  items?: ServiceItemInput[]
): Promise<void> {
  const db = await getDb();
  const d = dashLights || EMPTY_DASH_LIGHTS;
  const o = oilReminder || EMPTY_OIL_REMINDER;
  await db.runAsync(
    `UPDATE services SET service_description = ?, additional_info = ?, cost = ?, is_paid = ?, dash_abs = ?, dash_check_engine = ?, dash_brake = ?, dash_airbag = ?, dash_immobilizer = ?, dash_tpms = ?, dash_oil_leak = ?, current_mileage = ?, next_service_date = ?, next_service_mileage = ?, oil_grade = ?, oil_filter_changed = ? WHERE id = ?`,
    [
      serviceDescription,
      additionalInfo || null,
      cost,
      isPaid ? 1 : 0,
      d.abs ? 1 : 0,
      d.check_engine ? 1 : 0,
      d.brake ? 1 : 0,
      d.airbag ? 1 : 0,
      d.immobilizer ? 1 : 0,
      d.tpms ? 1 : 0,
      d.oil_leak ? 1 : 0,
      o.currentMileage,
      o.nextServiceDate,
      o.nextServiceMileage,
      o.oilGrade || null,
      o.oilFilterChanged ? 1 : 0,
      id,
    ]
  );

  // Replace inventory items: restore old, attach new
  if (items !== undefined) {
    await restoreInventoryFromServiceItems(id);
    await attachItemsToService(id, items);
  }
}

export async function deleteService(id: string): Promise<void> {
  const db = await getDb();
  // Restore inventory stock before deleting
  await restoreInventoryFromServiceItems(id);
  await db.runAsync(`DELETE FROM services WHERE id = ?`, [id]);
}

// ============ Inventory Operations ============

/** Generate next inventory short code like INV-001, INV-002 */
async function generateInventoryItemNumber(): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ max_num: number | null }>(
    `SELECT MAX(CAST(SUBSTR(item_number, 5) AS INTEGER)) as max_num
     FROM inventory
     WHERE item_number LIKE 'INV-%'`
  );
  const next = (row?.max_num || 0) + 1;
  return `INV-${String(next).padStart(3, '0')}`;
}

export async function listInventory(): Promise<InventoryItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<InventoryItem>(
    `SELECT * FROM inventory ORDER BY item_quantity ASC, item_type ASC`
  );
  return rows;
}

// ---------------------------------------------------------------------------
//  Oil change reminders (WhatsApp follow-ups)
// ---------------------------------------------------------------------------

export interface OilReminderDue {
  service_id: string;
  customer_id: string;
  customer_name: string;
  customer_mobile: string;
  vehicle_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string | null;
  vehicle_plate: string;
  vehicle_vin: string;
  next_service_date: string; // ISO date (YYYY-MM-DD)
  next_service_mileage: number | null;
  current_mileage: number | null;
  oil_grade: string | null;
  service_date: string;
  // days_overdue >= 0 means due today or later. We always return >=0 here.
  days_overdue: number;
}

/**
 * Returns all undismissed oil-change reminders whose next_service_date is
 * today or earlier (i.e., due now). Sorted by most overdue first.
 *
 * Only the *latest* (by service_date / created_at) reminder per vehicle is
 * returned so a vehicle with many historical reminders only shows up once.
 */
export async function listDueOilReminders(): Promise<OilReminderDue[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const rows = await db.getAllAsync<{
    service_id: string;
    customer_id: string;
    customer_name: string;
    customer_mobile: string;
    vehicle_id: string;
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: string | null;
    vehicle_plate: string;
    vehicle_vin: string;
    next_service_date: string;
    next_service_mileage: number | null;
    current_mileage: number | null;
    oil_grade: string | null;
    service_date: string;
    created_at: string;
  }>(
    `SELECT
        s.id            AS service_id,
        c.id            AS customer_id,
        c.name          AS customer_name,
        c.mobile_number AS customer_mobile,
        v.id            AS vehicle_id,
        v.make          AS vehicle_make,
        v.model         AS vehicle_model,
        v.year          AS vehicle_year,
        v.plate_number  AS vehicle_plate,
        v.vin           AS vehicle_vin,
        s.next_service_date,
        s.next_service_mileage,
        s.current_mileage,
        s.oil_grade,
        s.service_date,
        s.created_at
      FROM services s
      INNER JOIN customers c ON c.id = s.customer_id
      INNER JOIN vehicles  v ON v.id = s.vehicle_id
      WHERE
        s.next_service_date IS NOT NULL
        AND TRIM(s.next_service_date) != ''
        AND DATE(s.next_service_date) <= DATE(?)
        AND COALESCE(s.reminder_dismissed, 0) = 0
      ORDER BY s.next_service_date ASC, s.created_at DESC`,
    [today]
  );

  // De-dup: keep only the *latest* reminder per vehicle (latest service_date,
  // tiebreaker created_at). Done in JS so the SQL stays simple & robust.
  const latestByVehicle = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const existing = latestByVehicle.get(r.vehicle_id);
    if (!existing) {
      latestByVehicle.set(r.vehicle_id, r);
      continue;
    }
    const better =
      r.service_date > existing.service_date ||
      (r.service_date === existing.service_date && r.created_at > existing.created_at);
    if (better) latestByVehicle.set(r.vehicle_id, r);
  }
  const deduped = Array.from(latestByVehicle.values()).sort((a, b) =>
    a.next_service_date < b.next_service_date ? -1 : 1
  );

  const todayMs = new Date(today).getTime();
  return deduped.map((r) => {
    const dueMs = new Date(r.next_service_date).getTime();
    const daysOverdue = Math.max(0, Math.floor((todayMs - dueMs) / 86400000));
    return {
      service_id: r.service_id,
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      customer_mobile: r.customer_mobile,
      vehicle_id: r.vehicle_id,
      vehicle_make: r.vehicle_make,
      vehicle_model: r.vehicle_model,
      vehicle_year: r.vehicle_year,
      vehicle_plate: r.vehicle_plate,
      vehicle_vin: r.vehicle_vin,
      next_service_date: r.next_service_date,
      next_service_mileage: r.next_service_mileage,
      current_mileage: r.current_mileage,
      oil_grade: r.oil_grade,
      service_date: r.service_date,
      days_overdue: daysOverdue,
    };
  });
}

/** Permanently hide the oil-change reminder for the given service. */
export async function dismissReminder(serviceId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE services SET reminder_dismissed = 1 WHERE id = ?`,
    [serviceId]
  );
}

/** Restore a previously dismissed reminder (used for "Undo" if needed). */
export async function undismissReminder(serviceId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE services SET reminder_dismissed = 0 WHERE id = ?`,
    [serviceId]
  );
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<InventoryItem>(
    `SELECT * FROM inventory WHERE id = ?`,
    [id]
  );
  return row || null;
}

export async function addInventoryItem(
  itemType: string,
  itemQuantity: number,
  itemPrice: number
): Promise<InventoryItem> {
  const db = await getDb();
  if (!itemType.trim()) {
    throw new Error('Item Type is required');
  }
  if (!isFinite(itemQuantity) || itemQuantity < 0) {
    throw new Error('Quantity must be 0 or greater');
  }
  if (!isFinite(itemPrice) || itemPrice < 0) {
    throw new Error('Price must be 0 or greater');
  }
  const id = generateId();
  const itemNumber = await generateInventoryItemNumber();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO inventory (id, item_number, item_type, item_quantity, item_price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, itemNumber, itemType.trim(), Math.floor(itemQuantity), itemPrice, now, now]
  );
  return {
    id,
    item_number: itemNumber,
    item_type: itemType.trim(),
    item_quantity: Math.floor(itemQuantity),
    item_price: itemPrice,
    created_at: now,
    updated_at: now,
  };
}

export async function updateInventoryItem(
  id: string,
  itemType: string,
  itemQuantity: number,
  itemPrice: number
): Promise<void> {
  const db = await getDb();
  if (!itemType.trim()) {
    throw new Error('Item Type is required');
  }
  if (!isFinite(itemQuantity) || itemQuantity < 0) {
    throw new Error('Quantity must be 0 or greater');
  }
  if (!isFinite(itemPrice) || itemPrice < 0) {
    throw new Error('Price must be 0 or greater');
  }
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE inventory SET item_type = ?, item_quantity = ?, item_price = ?, updated_at = ? WHERE id = ?`,
    [itemType.trim(), Math.floor(itemQuantity), itemPrice, now, id]
  );
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM inventory WHERE id = ?`, [id]);
}

/** Get all service_items linked to a service, with current inventory snapshot */
export async function getServiceItems(serviceId: string): Promise<ServiceItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ServiceItem>(
    `SELECT * FROM service_items WHERE service_id = ? ORDER BY created_at ASC`,
    [serviceId]
  );
  return rows;
}

/** Internal: link items[] to a service & deduct from inventory. Returns the saved rows. */
async function attachItemsToService(
  serviceId: string,
  items: ServiceItemInput[]
): Promise<ServiceItem[]> {
  const db = await getDb();
  const saved: ServiceItem[] = [];
  for (const it of items) {
    if (!it.inventory_id || !it.quantity || it.quantity <= 0) continue;
    const inv = await db.getFirstAsync<InventoryItem>(
      `SELECT * FROM inventory WHERE id = ?`,
      [it.inventory_id]
    );
    if (!inv) continue; // ignore deleted inventory items silently
    const qty = Math.floor(it.quantity);
    const rowId = generateId();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO service_items (id, service_id, inventory_id, item_type, quantity, unit_price, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rowId, serviceId, inv.id, inv.item_type, qty, inv.item_price, now]
    );
    // Deduct from stock (don't go below 0)
    const newQty = Math.max(0, inv.item_quantity - qty);
    await db.runAsync(
      `UPDATE inventory SET item_quantity = ?, updated_at = ? WHERE id = ?`,
      [newQty, now, inv.id]
    );
    saved.push({
      id: rowId,
      service_id: serviceId,
      inventory_id: inv.id,
      item_type: inv.item_type,
      quantity: qty,
      unit_price: inv.item_price,
      created_at: now,
    });
  }
  return saved;
}

/** Internal: restore stock for every item linked to this service, then delete the links. */
async function restoreInventoryFromServiceItems(serviceId: string): Promise<void> {
  const db = await getDb();
  const rows = await db.getAllAsync<ServiceItem>(
    `SELECT * FROM service_items WHERE service_id = ?`,
    [serviceId]
  );
  const now = new Date().toISOString();
  for (const r of rows) {
    await db.runAsync(
      `UPDATE inventory SET item_quantity = item_quantity + ?, updated_at = ? WHERE id = ?`,
      [r.quantity, now, r.inventory_id]
    );
  }
  await db.runAsync(`DELETE FROM service_items WHERE service_id = ?`, [serviceId]);
}

// ============ Report ============
export async function getReport(
  startDate?: string,
  endDate?: string,
  mobile?: string,
  vin?: string,
  plate?: string,
  unpaidOnly?: boolean
): Promise<{ items: ReportItem[]; total_cost: number; total_services: number; unpaid_count: number; unpaid_total: number }> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: any[] = [];

  if (startDate) {
    conditions.push('s.service_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('s.service_date <= ?');
    params.push(endDate);
  }
  if (mobile) {
    conditions.push('c.mobile_number LIKE ?');
    params.push(`%${mobile}%`);
  }
  if (vin) {
    conditions.push('v.vin LIKE ?');
    params.push(`%${vin}%`);
  }
  if (plate) {
    conditions.push('v.plate_number LIKE ?');
    params.push(`%${plate}%`);
  }
  if (unpaidOnly) {
    conditions.push('s.is_paid = 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT 
      s.id as service_id,
      s.customer_id,
      c.name as customer_name,
      c.mobile_number as customer_mobile,
      s.vehicle_id,
      v.make as vehicle_make,
      v.model as vehicle_model,
      v.year as vehicle_year,
      v.vin as vehicle_vin,
      v.plate_number as vehicle_plate,
      s.service_description,
      s.additional_info,
      s.cost,
      s.is_paid as is_paid_int,
      s.service_date
    FROM services s
    JOIN customers c ON s.customer_id = c.id
    JOIN vehicles v ON s.vehicle_id = v.id
    ${whereClause}
    ORDER BY s.service_date DESC
  `;

  const rawItems = await db.getAllAsync<any>(sql, params);
  const items: ReportItem[] = rawItems.map((r) => ({
    service_id: r.service_id,
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    customer_mobile: r.customer_mobile,
    vehicle_id: r.vehicle_id,
    vehicle_make: r.vehicle_make,
    vehicle_model: r.vehicle_model,
    vehicle_year: r.vehicle_year,
    vehicle_vin: r.vehicle_vin,
    vehicle_plate: r.vehicle_plate,
    service_description: r.service_description,
    additional_info: r.additional_info,
    cost: r.cost,
    is_paid: r.is_paid_int === 1,
    service_date: r.service_date,
  }));
  const total_cost = items.reduce((sum, i) => sum + i.cost, 0);
  const unpaidItems = items.filter((i) => !i.is_paid);
  const unpaid_total = unpaidItems.reduce((sum, i) => sum + i.cost, 0);
  return {
    items,
    total_cost,
    total_services: items.length,
    unpaid_count: unpaidItems.length,
    unpaid_total,
  };
}

// ============ Export / Import ============
export async function exportAllData(): Promise<string> {
  const db = await getDb();
  const customers = await db.getAllAsync<Customer>(`SELECT * FROM customers`);
  const vehicles = await db.getAllAsync<Vehicle>(`SELECT * FROM vehicles`);
  const rawServices = await db.getAllAsync<any>(`SELECT * FROM services`);
  const services: Service[] = rawServices.map((s) => ({
    ...s,
    is_paid: s.is_paid === 1,
    dash_abs: s.dash_abs === 1,
    dash_check_engine: s.dash_check_engine === 1,
    dash_brake: s.dash_brake === 1,
    dash_airbag: s.dash_airbag === 1,
    dash_immobilizer: s.dash_immobilizer === 1,
    dash_tpms: s.dash_tpms === 1,
    dash_oil_leak: s.dash_oil_leak === 1,
    oil_filter_changed: s.oil_filter_changed === 1,
  }));
  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    customers,
    vehicles,
    services,
  };
  return JSON.stringify(exportData, null, 2);
}

/** Returns every vehicle joined with its customer and all its services (for bulk HTML export). */
export async function getAllVehiclesWithDetails(): Promise<
  { customer: Customer; vehicle: Vehicle; services: Service[] }[]
> {
  const db = await getDb();
  const customers = await db.getAllAsync<Customer>(`SELECT * FROM customers`);
  const vehicles = await db.getAllAsync<Vehicle>(`SELECT * FROM vehicles`);
  const rawServices = await db.getAllAsync<any>(`SELECT * FROM services`);
  const services: Service[] = rawServices.map((s) => ({
    ...s,
    is_paid: s.is_paid === 1,
    dash_abs: s.dash_abs === 1,
    dash_check_engine: s.dash_check_engine === 1,
    dash_brake: s.dash_brake === 1,
    dash_airbag: s.dash_airbag === 1,
    dash_immobilizer: s.dash_immobilizer === 1,
    dash_tpms: s.dash_tpms === 1,
    dash_oil_leak: s.dash_oil_leak === 1,
    oil_filter_changed: s.oil_filter_changed === 1,
  }));

  const customerById = new Map(customers.map((c) => [c.id, c]));
  const out: { customer: Customer; vehicle: Vehicle; services: Service[] }[] = [];
  for (const v of vehicles) {
    const customer = customerById.get(v.customer_id);
    if (!customer) continue;
    const vehicleServices = services
      .filter((s) => s.vehicle_id === v.id)
      .sort((a, b) => (a.service_date < b.service_date ? 1 : -1));
    out.push({ customer, vehicle: v, services: vehicleServices });
  }
  return out;
}

export async function importData(jsonString: string, mergeMode: boolean): Promise<{
  customers: number;
  vehicles: number;
  services: number;
}> {
  const data = JSON.parse(jsonString);
  if (!data.customers || !data.vehicles || !data.services) {
    throw new Error('Invalid backup file');
  }

  const db = await getDb();

  if (!mergeMode) {
    // Replace mode - clear all data
    await db.execAsync(`DELETE FROM services; DELETE FROM vehicles; DELETE FROM customers;`);
  }

  let customersAdded = 0;
  let vehiclesAdded = 0;
  let servicesAdded = 0;

  for (const c of data.customers) {
    const result = await db.runAsync(
      `INSERT OR IGNORE INTO customers (id, name, mobile_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [c.id, c.name, c.mobile_number, c.created_at, c.updated_at]
    );
    if (result.changes > 0) customersAdded++;
  }
  for (const v of data.vehicles) {
    const result = await db.runAsync(
      `INSERT OR IGNORE INTO vehicles (id, customer_id, vin, plate_number, make, model, year, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.id, v.customer_id, v.vin, v.plate_number, v.make, v.model, v.year || null, v.created_at]
    );
    if (result.changes > 0) vehiclesAdded++;
  }
  for (const s of data.services) {
    const result = await db.runAsync(
      `INSERT OR IGNORE INTO services (id, vehicle_id, customer_id, service_description, additional_info, cost, is_paid, service_date, created_at, dash_abs, dash_check_engine, dash_brake, dash_airbag, dash_immobilizer, dash_tpms, dash_oil_leak) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.vehicle_id,
        s.customer_id,
        s.service_description,
        s.additional_info || null,
        s.cost,
        s.is_paid === false ? 0 : 1,
        s.service_date,
        s.created_at,
        s.dash_abs ? 1 : 0,
        s.dash_check_engine ? 1 : 0,
        s.dash_brake ? 1 : 0,
        s.dash_airbag ? 1 : 0,
        s.dash_immobilizer ? 1 : 0,
        s.dash_tpms ? 1 : 0,
        s.dash_oil_leak ? 1 : 0,
      ]
    );
    if (result.changes > 0) servicesAdded++;
  }

  return { customers: customersAdded, vehicles: vehiclesAdded, services: servicesAdded };
}
