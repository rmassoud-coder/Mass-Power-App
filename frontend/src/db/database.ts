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
  partial_paid?: number;
  service_date: string;
  created_at: string;
  dash_abs?: boolean;
  dash_check_engine?: boolean;
  dash_brake?: boolean;
  dash_airbag?: boolean;
  dash_immobilizer?: boolean;
  dash_tpms?: boolean;
  dash_oil_leak?: boolean;
  current_mileage?: number | null;
  next_service_date?: string | null;
  next_service_mileage?: number | null;
  oil_grade?: string | null;
  oil_filter_changed?: boolean;
  battery_amp_rate?: string | null;
  battery_install_date?: string | null;
  battery_warranty_months?: number | null;
  battery_parasitic_tested?: boolean;
  hvac_freon_date?: string | null;
  hvac_leak_tested?: boolean;
  outsource_cost?: number;
  reminder_dismissed?: boolean;
  items?: ServiceItem[];
}

export interface InventoryItem {
  id: string;
  item_number: string;
  item_type: string;
  item_quantity: number;
  item_price: number;
  item_retail_price?: number;
  item_supplier?: string | null;
  item_code?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_info?: string | null;
  created_at: string;
  balance?: number;
}

export interface LowStockItemBySupplier {
  supplier_name: string;
  items: InventoryItem[];
}

export interface ServiceItem {
  id: string;
  service_id: string;
  inventory_id: string;
  item_type: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface ServiceItemInput {
  inventory_id: string;
  quantity: number;
}

export const SERVICE_CATEGORIES = [
  'HVAC Services',
  'Locksmith Services',
  'Oil Services',
  'Battery Replacement',
  'Electrical Services',
  'Mechanical Services',
  'Other Services',
] as const;

export type ServiceCategory = typeof SERVICE_CATEGORIES[number];

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
  nextServiceDate: string | null;
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

export interface BatteryReplacement {
  ampRate: string;
  installDate: string | null;
  warrantyMonths: number | null;
  parasiticTested: boolean;
}

export const EMPTY_BATTERY_REPLACEMENT: BatteryReplacement = {
  ampRate: '',
  installDate: null,
  warrantyMonths: 12,
  parasiticTested: false,
};

export interface HvacService {
  freonDate: string | null;
  leakTested: boolean;
}

export const EMPTY_HVAC_SERVICE: HvacService = {
  freonDate: null,
  leakTested: false,
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
  partial_paid?: number;
  outsource_cost?: number;
  service_date: string;
}

/////////////// BLOCK 1 - SETUP, INIT, & CORE TABLES ///////////////

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

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      contact_info TEXT,
      created_at TEXT NOT NULL
    );
    
CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  amount_paid REAL NOT NULL,
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
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

  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS supplier_balances (
        supplier_id TEXT PRIMARY KEY,
        balance REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS wages_paid (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
  } catch (e) { /* Tables already exist */ }

  try {
    await db.execAsync(`ALTER TABLE services ADD COLUMN is_paid INTEGER NOT NULL DEFAULT 1`);
  } catch {}

  try {
    await db.execAsync(`ALTER TABLE services ADD COLUMN partial_paid REAL NOT NULL DEFAULT 0`);
  } catch {}

  const inventoryCols: Array<[string, string]> = [
    ['item_retail_price', 'REAL NOT NULL DEFAULT 0'],
    ['item_supplier', 'TEXT'],
    ['item_code', 'TEXT'],
  ];
  for (const [col, def] of inventoryCols) {
    try {
      await db.execAsync(`ALTER TABLE inventory ADD COLUMN ${col} ${def}`);
    } catch {}
  }

  try {
    await db.execAsync(`ALTER TABLE suppliers ADD COLUMN contact_info TEXT`);
  } catch {}

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
    } catch {}
  }

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
    } catch {}
  }

  const batteryColumns: Array<[string, string]> = [
    ['battery_amp_rate', 'TEXT'],
    ['battery_install_date', 'TEXT'],
    ['battery_warranty_months', 'INTEGER'],
    ['battery_parasitic_tested', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [col, type] of batteryColumns) {
    try {
      await db.execAsync(`ALTER TABLE services ADD COLUMN ${col} ${type}`);
    } catch {}
  }

  const hvacColumns: Array<[string, string]> = [
    ['hvac_freon_date', 'TEXT'],
    ['hvac_leak_tested', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [col, type] of hvacColumns) {
    try {
      await db.execAsync(`ALTER TABLE services ADD COLUMN ${col} ${type}`);
    } catch {}
  }

  try {
    await db.execAsync(
      `ALTER TABLE services ADD COLUMN outsource_cost REAL NOT NULL DEFAULT 0`
    );
  } catch {}

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

export async function createCustomer(name: string, mobileNumber: string): Promise<Customer> {
  const db = await getDb();
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
    partial_paid: Number(s.partial_paid) || 0,
    dash_abs: s.dash_abs === 1,
    dash_check_engine: s.dash_check_engine === 1,
    dash_brake: s.dash_brake === 1,
    dash_airbag: s.dash_airbag === 1,
    dash_immobilizer: s.dash_immobilizer === 1,
    dash_tpms: s.dash_tpms === 1,
    dash_oil_leak: s.dash_oil_leak === 1,
    oil_filter_changed: s.oil_filter_changed === 1,
    battery_parasitic_tested: s.battery_parasitic_tested === 1,
    hvac_leak_tested: s.hvac_leak_tested === 1,
  }));
  for (const svc of services) {
    svc.items = await db.getAllAsync<ServiceItem>(
      `SELECT * FROM service_items WHERE service_id = ? ORDER BY created_at ASC`,
      [svc.id]
    );
  }
  return { customer, vehicles, services };
}

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
  const cleanVin = vin.trim().toUpperCase();
  if (cleanVin) {
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM vehicles WHERE UPPER(TRIM(vin)) = ? LIMIT 1`,
      [cleanVin]
    );
    if (existing) {
      throw new Error(`A vehicle with VIN "${cleanVin}" already exists.`);
    }
  }
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO vehicles (id, customer_id, vin, plate_number, make, model, year, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, customerId, cleanVin, plateNumber, make, model, year || null, now]
  );
  return {
    id,
    customer_id: customerId,
    vin: cleanVin,
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
  const cleanVin = vin.trim().toUpperCase();
  if (cleanVin) {
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM vehicles WHERE UPPER(TRIM(vin)) = ? AND id != ? LIMIT 1`,
      [cleanVin, id]
    );
    if (existing) {
      throw new Error(`Another vehicle with VIN "${cleanVin}" already exists.`);
    }
  }
  await db.runAsync(
    `UPDATE vehicles SET vin = ?, plate_number = ?, make = ?, model = ?, year = ? WHERE id = ?`,
    [cleanVin, plateNumber, make, model, year || null, id]
  );
}

export async function deleteVehicle(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM services WHERE vehicle_id = ?`, [id]);
  await db.runAsync(`DELETE FROM vehicles WHERE id = ?`, [id]);
}

export async function createService(
  vehicleId: string,
  serviceDescription: string,
  additionalInfo: string | undefined,
  cost: number,
  isPaid: boolean,
  dashLights?: DashLights,
  oilReminder?: OilReminder,
  items?: ServiceItemInput[],
  partialPaid: number = 0,
  battery?: BatteryReplacement,
  hvac?: HvacService,
  outsourceCost: number = 0
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
  const b = battery || EMPTY_BATTERY_REPLACEMENT;
  const h = hvac || EMPTY_HVAC_SERVICE;
  const pp = Math.max(0, Number(partialPaid) || 0);
  const oc = Math.max(0, Number(outsourceCost) || 0);
  await db.runAsync(
    `INSERT INTO services (id, vehicle_id, customer_id, service_description, additional_info, cost, is_paid, partial_paid, service_date, created_at, dash_abs, dash_check_engine, dash_brake, dash_airbag, dash_immobilizer, dash_tpms, dash_oil_leak, current_mileage, next_service_date, next_service_mileage, oil_grade, oil_filter_changed, battery_amp_rate, battery_install_date, battery_warranty_months, battery_parasitic_tested, hvac_freon_date, hvac_leak_tested, outsource_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      vehicleId,
      vehicle.customer_id,
      serviceDescription,
      additionalInfo || null,
      cost,
      isPaid ? 1 : 0,
      pp,
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
      b.ampRate?.trim() || null,
      b.installDate || null,
      b.warrantyMonths ?? null,
      b.parasiticTested ? 1 : 0,
      h.freonDate || null,
      h.leakTested ? 1 : 0,
      oc,
    ]
  );

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
    battery_amp_rate: b.ampRate?.trim() || null,
    battery_install_date: b.installDate || null,
    battery_warranty_months: b.warrantyMonths ?? null,
    battery_parasitic_tested: b.parasiticTested,
    hvac_freon_date: h.freonDate || null,
    hvac_leak_tested: h.leakTested,
    outsource_cost: oc,
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
  items?: ServiceItemInput[],
  partialPaid: number = 0,
  battery?: BatteryReplacement,
  hvac?: HvacService,
  outsourceCost: number = 0
): Promise<void> {
  const db = await getDb();
  const d = dashLights || EMPTY_DASH_LIGHTS;
  const o = oilReminder || EMPTY_OIL_REMINDER;
  const b = battery || EMPTY_BATTERY_REPLACEMENT;
  const h = hvac || EMPTY_HVAC_SERVICE;
  const pp = Math.max(0, Number(partialPaid) || 0);
  const oc = Math.max(0, Number(outsourceCost) || 0);
  await db.runAsync(
    `UPDATE services SET service_description = ?, additional_info = ?, cost = ?, is_paid = ?, partial_paid = ?, dash_abs = ?, dash_check_engine = ?, dash_brake = ?, dash_airbag = ?, dash_immobilizer = ?, dash_tpms = ?, dash_oil_leak = ?, current_mileage = ?, next_service_date = ?, next_service_mileage = ?, oil_grade = ?, oil_filter_changed = ?, battery_amp_rate = ?, battery_install_date = ?, battery_warranty_months = ?, battery_parasitic_tested = ?, hvac_freon_date = ?, hvac_leak_tested = ?, outsource_cost = ? WHERE id = ?`,
    [
      serviceDescription,
      additionalInfo || null,
      cost,
      isPaid ? 1 : 0,
      pp,
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
      b.ampRate?.trim() || null,
      b.installDate || null,
      b.warrantyMonths ?? null,
      b.parasiticTested ? 1 : 0,
      h.freonDate || null,
      h.leakTested ? 1 : 0,
      oc,
      id,
    ]
  );

  if (items !== undefined) {
    await restoreInventoryFromServiceItems(id);
    await attachItemsToService(id, items);
  }
}

export async function markServicesPaid(serviceIds: string[]): Promise<void> {
  if (!serviceIds.length) return;
  const db = await getDb();
  const placeholders = serviceIds.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE services SET is_paid = 1, partial_paid = 0 WHERE id IN (${placeholders})`,
    serviceIds
  );
}

export async function deleteService(id: string): Promise<void> {
  const db = await getDb();
  await restoreInventoryFromServiceItems(id);
  await db.runAsync(`DELETE FROM services WHERE id = ?`, [id]);
}

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
    `SELECT * FROM inventory
     ORDER BY CASE WHEN item_quantity < 2 THEN 0 ELSE 1 END ASC,
              CASE WHEN item_quantity < 2 THEN item_quantity END ASC,
              LOWER(item_type) ASC`
  );
  return rows;
}

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
  next_service_date: string;
  next_service_mileage: number | null;
  current_mileage: number | null;
  oil_grade: string | null;
  service_date: string;
  days_overdue: number;
}

export async function listDueOilReminders(): Promise<OilReminderDue[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);

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

export async function dismissReminder(serviceId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE services SET reminder_dismissed = 1 WHERE id = ?`,
    [serviceId]
  );
}

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
  itemPrice: number,
  extras?: {
    item_retail_price?: number;
    item_supplier?: string | null;
    item_code?: string | null;
  }
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
  const retail = extras?.item_retail_price;
  if (retail !== undefined && (!isFinite(retail) || retail < 0)) {
    throw new Error('Retail price must be 0 or greater');
  }
  const id = generateId();
  const itemNumber = await generateInventoryItemNumber();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO inventory (id, item_number, item_type, item_quantity, item_price, item_retail_price, item_supplier, item_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      itemNumber,
      itemType.trim(),
      Math.floor(itemQuantity),
      itemPrice,
      retail ?? 0,
      (extras?.item_supplier || '').trim() || null,
      (extras?.item_code || '').trim() || null,
      now,
      now,
    ]
  );
  return {
    id,
    item_number: itemNumber,
    item_type: itemType.trim(),
    item_quantity: Math.floor(itemQuantity),
    item_price: itemPrice,
    item_retail_price: retail ?? 0,
    item_supplier: (extras?.item_supplier || '').trim() || null,
    item_code: (extras?.item_code || '').trim() || null,
    created_at: now,
    updated_at: now,
  };
}

export async function updateInventoryItem(
  id: string,
  itemType: string,
  itemQuantity: number,
  itemPrice: number,
  extras?: {
    item_retail_price?: number;
    item_supplier?: string | null;
    item_code?: string | null;
  }
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
  const retail = extras?.item_retail_price;
  if (retail !== undefined && (!isFinite(retail) || retail < 0)) {
    throw new Error('Retail price must be 0 or greater');
  }
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE inventory
       SET item_type = ?,
           item_quantity = ?,
           item_price = ?,
           item_retail_price = ?,
           item_supplier = ?,
           item_code = ?,
           updated_at = ?
     WHERE id = ?`,
    [
      itemType.trim(),
      Math.floor(itemQuantity),
      itemPrice,
      retail ?? 0,
      (extras?.item_supplier || '').trim() || null,
      (extras?.item_code || '').trim() || null,
      now,
      id,
    ]
  );
}

export async function adjustInventoryQuantity(
  id: string,
  delta: number
): Promise<number> {
  if (!Number.isFinite(delta) || delta === 0) return 0;
  const db = await getDb();
  const row = await db.getFirstAsync<{ item_quantity: number }>(
    `SELECT item_quantity FROM inventory WHERE id = ?`,
    [id]
  );
  if (!row) throw new Error('Inventory item not found');
  const next = Math.max(0, (row.item_quantity || 0) + Math.round(delta));
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE inventory SET item_quantity = ?, updated_at = ? WHERE id = ?`,
    [next, now, id]
  );
  return next;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM inventory WHERE id = ?`, [id]);
}

export async function getServiceItems(serviceId: string): Promise<ServiceItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ServiceItem>(
    `SELECT * FROM service_items WHERE service_id = ? ORDER BY created_at ASC`,
    [serviceId]
  );
  return rows;
}

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
    if (!inv) continue;
    const qty = Math.floor(it.quantity);
    const rowId = generateId();
    const now = new Date().toISOString();
    const snapshotPrice =
      inv.item_retail_price && inv.item_retail_price > 0
        ? inv.item_retail_price
        : inv.item_price;
    await db.runAsync(
      `INSERT INTO service_items (id, service_id, inventory_id, item_type, quantity, unit_price, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rowId, serviceId, inv.id, inv.item_type, qty, snapshotPrice, now]
    );
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
      unit_price: snapshotPrice,
      created_at: now,
    });
  }
  return saved;
}

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

/////////////// BLOCK 2 - REPORTS, SYNC, SUPPLIERS, WALK-INS, WAGES & MATH ///////////////

export async function getReport(
  startDate?: string,
  endDate?: string,
  mobile?: string,
  vin?: string,
  plate?: string,
  unpaidOnly?: boolean
): Promise<{
  items: ReportItem[];
  total_cost: number;
  total_services: number;
  unpaid_count: number;
  unpaid_total: number;
  outsource_total: number;
  net_cash_flow: number;
}> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: any[] = [];

  const today = new Date();
  const dayOfWeek = today.getDay();
  const diffToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday);

  if (startDate) {
    conditions.push('DATE(s.service_date) >= DATE(?)');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('DATE(s.service_date) <= DATE(?)');
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
    conditions.push('s.is_paid = 0 OR s.partial_paid > 0');
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
      s.partial_paid,
      s.outsource_cost,
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
    partial_paid: Number(r.partial_paid) || 0,
    outsource_cost: Number(r.outsource_cost) || 0,
    service_date: r.service_date,
  }));
  const total_cost = items.reduce((sum, i) => sum + i.cost, 0);
  const outsource_total = items.reduce((sum, i) => sum + (i.outsource_cost || 0), 0);
  
  let net_cash_flow = total_cost - outsource_total;
  
  const mondayStr = monday.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  try {
    const wagesResult = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM wages_paid 
       WHERE DATE(date) >= ? AND DATE(date) <= ?`,
      [mondayStr, todayStr]
    );
    const wages = wagesResult?.total || 0;
    net_cash_flow = net_cash_flow - wages;
    console.log(`✅ Subtracted $${wages} in wages`);
  } catch (e) {
    console.log("ℹ️ Wages table not ready yet, skipping...");
  }

  const unpaidItems = items.filter((i) => !i.is_paid);
  const unpaid_total = unpaidItems.reduce((sum, i) => sum + i.cost, 0);
  return {
    items,
    total_cost,
    total_services: items.length,
    unpaid_count: unpaidItems.length,
    unpaid_total,
    outsource_total,
    net_cash_flow,
  };
}

export async function exportAllData(): Promise<string> {
  const db = await getDb();
  const customers = await db.getAllAsync<Customer>(`SELECT * FROM customers`);
  const vehicles = await db.getAllAsync<Vehicle>(`SELECT * FROM vehicles`);
  const rawServices = await db.getAllAsync<any>(`SELECT * FROM services`);
  const services: Service[] = rawServices.map((s) => ({
    ...s,
    is_paid: s.is_paid === 1,
    partial_paid: Number(s.partial_paid) || 0,
    dash_abs: s.dash_abs === 1,
    dash_check_engine: s.dash_check_engine === 1,
    dash_brake: s.dash_brake === 1,
    dash_airbag: s.dash_airbag === 1,
    dash_immobilizer: s.dash_immobilizer === 1,
    dash_tpms: s.dash_tpms === 1,
    dash_oil_leak: s.dash_oil_leak === 1,
    oil_filter_changed: s.oil_filter_changed === 1,
    battery_parasitic_tested: s.battery_parasitic_tested === 1,
    hvac_leak_tested: s.hvac_leak_tested === 1,
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
    partial_paid: Number(s.partial_paid) || 0,
    dash_abs: s.dash_abs === 1,
    dash_check_engine: s.dash_check_engine === 1,
    dash_brake: s.dash_brake === 1,
    dash_airbag: s.dash_airbag === 1,
    dash_immobilizer: s.dash_immobilizer === 1,
    dash_tpms: s.dash_tpms === 1,
    dash_oil_leak: s.dash_oil_leak === 1,
    oil_filter_changed: s.oil_filter_changed === 1,
    battery_parasitic_tested: s.battery_parasitic_tested === 1,
    hvac_leak_tested: s.hvac_leak_tested === 1,
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

export interface FullDbSnapshot {
  version: number;
  exported_at: string;
  customers: Customer[];
  vehicles: Vehicle[];
  services: Service[];
  service_items: ServiceItem[];
  inventory: InventoryItem[];
  suppliers?: Supplier[];
  supplierBalances?: { supplier_id: string; balance: number }[];
  wagesPaid?: { id: number; date: string; amount: number }[];
}

export async function exportFullDatabase(): Promise<FullDbSnapshot> {
  const db = await getDb();
  const customers = await db.getAllAsync<Customer>(`SELECT * FROM customers`);
  const vehicles = await db.getAllAsync<Vehicle>(`SELECT * FROM vehicles`);
  const rawServices = await db.getAllAsync<any>(`SELECT * FROM services`);
  const services: Service[] = rawServices.map((s) => ({
    ...s,
    is_paid: s.is_paid === 1,
    partial_paid: Number(s.partial_paid) || 0,
    dash_abs: s.dash_abs === 1,
    dash_check_engine: s.dash_check_engine === 1,
    dash_brake: s.dash_brake === 1,
    dash_airbag: s.dash_airbag === 1,
    dash_immobilizer: s.dash_immobilizer === 1,
    dash_tpms: s.dash_tpms === 1,
    dash_oil_leak: s.dash_oil_leak === 1,
    oil_filter_changed: s.oil_filter_changed === 1,
    battery_parasitic_tested: s.battery_parasitic_tested === 1,
    hvac_leak_tested: s.hvac_leak_tested === 1,
    reminder_dismissed: s.reminder_dismissed === 1,
  }));
  const service_items = await db.getAllAsync<ServiceItem>(`SELECT * FROM service_items`);
  const inventory = await db.getAllAsync<InventoryItem>(`SELECT * FROM inventory`);
  const suppliers = await db.getAllAsync<Supplier>(`SELECT * FROM suppliers`);
  
  // 🔥 FETCH THE SUPPLIER BALANCES AND WAGES
  const supplierBalances = await db.getAllAsync<{ supplier_id: string; balance: number }>(
    `SELECT * FROM supplier_balances`
  );
  const wagesPaid = await db.getAllAsync<{ id: number; date: string; amount: number }>(
    `SELECT * FROM wages_paid`
  );

  return {
    version: 3,
    exported_at: new Date().toISOString(),
    customers,
    vehicles,
    services,
    service_items,
    inventory,
    suppliers,
    supplierBalances,
    wagesPaid,
  };
}

/** Wipes every table and re-inserts the cloud snapshot. Cloud-wins semantics.
 *  Used only for: (1) restoring your own local pre-Pull safety snapshot,
 *  (2) explicit "Replace" in manual Backup & Restore. Never used by the
 *  normal Push/Pull flow — that uses mergeCloudIntoLocal instead. */
export async function replaceFullDatabase(snap: FullDbSnapshot): Promise<void> {
  if (!snap || !Array.isArray(snap.customers) || !Array.isArray(snap.vehicles) || !Array.isArray(snap.services)) {
    throw new Error('Invalid snapshot');
  }
  const db = await getDb();
  await db.execAsync(
    `DELETE FROM service_items; DELETE FROM services; DELETE FROM vehicles; DELETE FROM customers; DELETE FROM inventory; DELETE FROM suppliers;`
  );
  for (const c of snap.customers) {
    await db.runAsync(
      `INSERT INTO customers (id, name, mobile_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [c.id, c.name, c.mobile_number, c.created_at, c.updated_at]
    );
  }
  for (const v of snap.vehicles) {
    await db.runAsync(
      `INSERT INTO vehicles (id, customer_id, vin, plate_number, make, model, year, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.id, v.customer_id, v.vin, v.plate_number, v.make, v.model, v.year || null, v.created_at]
    );
  }
  for (const s of snap.services) {
    await db.runAsync(
      `INSERT INTO services (
         id, vehicle_id, customer_id, service_description, additional_info, cost, is_paid, partial_paid,
         service_date, created_at,
         dash_abs, dash_check_engine, dash_brake, dash_airbag, dash_immobilizer, dash_tpms, dash_oil_leak,
         current_mileage, next_service_date, next_service_mileage, oil_grade, oil_filter_changed,
         battery_amp_rate, battery_install_date, battery_warranty_months, battery_parasitic_tested,
         hvac_freon_date, hvac_leak_tested, outsource_cost, reminder_dismissed
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id, s.vehicle_id, s.customer_id, s.service_description, s.additional_info || null,
        s.cost, s.is_paid ? 1 : 0, s.partial_paid || 0, s.service_date, s.created_at,
        s.dash_abs ? 1 : 0, s.dash_check_engine ? 1 : 0, s.dash_brake ? 1 : 0,
        s.dash_airbag ? 1 : 0, s.dash_immobilizer ? 1 : 0, s.dash_tpms ? 1 : 0, s.dash_oil_leak ? 1 : 0,
        s.current_mileage || null, s.next_service_date || null, s.next_service_mileage || null,
        s.oil_grade || null, s.oil_filter_changed ? 1 : 0,
        s.battery_amp_rate || null, s.battery_install_date || null, s.battery_warranty_months ?? null,
        s.battery_parasitic_tested ? 1 : 0,
        s.hvac_freon_date || null, s.hvac_leak_tested ? 1 : 0,
        s.outsource_cost || 0, s.reminder_dismissed ? 1 : 0,
      ]
    );
  }
  if (Array.isArray(snap.inventory)) {
    for (const it of snap.inventory) {
      await db.runAsync(
        `INSERT INTO inventory (id, item_number, item_type, item_quantity, item_price, item_retail_price, item_supplier, item_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          it.id,
          it.item_number,
          it.item_type,
          it.item_quantity,
          it.item_price,
          it.item_retail_price ?? 0,
          it.item_supplier ?? null,
          it.item_code ?? null,
          it.created_at,
          it.updated_at,
        ]
      );
    }
  }
  if (Array.isArray(snap.service_items)) {
    for (const si of snap.service_items) {
      await db.runAsync(
        `INSERT INTO service_items (id, service_id, inventory_id, item_type, quantity, unit_price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [si.id, si.service_id, si.inventory_id, si.item_type, si.quantity, si.unit_price, si.created_at]
      );
    }
  }
  if (Array.isArray((snap as any).suppliers)) {
    for (const sup of (snap as any).suppliers as Supplier[]) {
      await db.runAsync(
        `INSERT INTO suppliers (id, name, contact_info, created_at) VALUES (?, ?, ?, ?)`,
        [sup.id, sup.name, sup.contact_info ?? null, sup.created_at]
      );
    }
  }
  
  // 🔥 RESTORE SUPPLIER BALANCES FROM CLOUD
  if (Array.isArray(snap.supplierBalances)) {
    for (const sb of snap.supplierBalances) {
      await db.runAsync(
        `INSERT OR REPLACE INTO supplier_balances (supplier_id, balance, updated_at) VALUES (?, ?, ?)`,
        [sb.supplier_id, sb.balance, sb.updated_at || snap.exported_at]
      );
    }
  }

  // 🔥 RESTORE WAGES FROM CLOUD
  if (Array.isArray(snap.wagesPaid)) {
    for (const wp of snap.wagesPaid) {
      await db.runAsync(
        `INSERT OR REPLACE INTO wages_paid (id, date, amount, created_at) VALUES (?, ?, ?, ?)`,
        [wp.id, wp.date, wp.amount, wp.created_at || snap.exported_at]
      );
    }
  }
}

export interface MergeResult {
  customers: { inserted: number; updated: number };
  vehicles: { inserted: number; updated: number };
  services: { inserted: number; updated: number };
  inventory: { inserted: number; updated: number };
  suppliers: { inserted: number; updated: number };
  service_items: { inserted: number; updated: number };
}

function newer(a?: string | null, b?: string | null): boolean {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  return ta > tb;
}

export async function mergeCloudIntoLocal(snap: FullDbSnapshot): Promise<MergeResult> {
  const db = await getDb();
  const result: MergeResult = {
    customers: { inserted: 0, updated: 0 },
    vehicles: { inserted: 0, updated: 0 },
    services: { inserted: 0, updated: 0 },
    inventory: { inserted: 0, updated: 0 },
    suppliers: { inserted: 0, updated: 0 },
    service_items: { inserted: 0, updated: 0 },
  };

  if (Array.isArray(snap.customers)) {
    for (const c of snap.customers) {
      const local = await db.getFirstAsync<Customer>(`SELECT * FROM customers WHERE id = ?`, [c.id]);
      if (!local) {
        await db.runAsync(
          `INSERT INTO customers (id, name, mobile_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          [c.id, c.name, c.mobile_number, c.created_at, c.updated_at]
        );
        result.customers.inserted++;
      } else if (newer(c.updated_at, local.updated_at)) {
        await db.runAsync(
          `UPDATE customers SET name = ?, mobile_number = ?, updated_at = ? WHERE id = ?`,
          [c.name, c.mobile_number, c.updated_at, c.id]
        );
        result.customers.updated++;
      }
    }
  }

  if (Array.isArray(snap.vehicles)) {
    for (const v of snap.vehicles) {
      const local = await db.getFirstAsync<Vehicle>(`SELECT * FROM vehicles WHERE id = ?`, [v.id]);
      if (!local) {
        await db.runAsync(
          `INSERT INTO vehicles (id, customer_id, vin, plate_number, make, model, year, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [v.id, v.customer_id, v.vin, v.plate_number, v.make, v.model, v.year || null, v.created_at]
        );
        result.vehicles.inserted++;
      }
    }
  }

  if (Array.isArray(snap.services)) {
    for (const s of snap.services) {
      const local = await db.getFirstAsync<any>(`SELECT * FROM services WHERE id = ?`, [s.id]);
      if (!local) {
        await db.runAsync(
          `INSERT INTO services (
             id, vehicle_id, customer_id, service_description, additional_info, cost, is_paid, partial_paid,
             service_date, created_at,
             dash_abs, dash_check_engine, dash_brake, dash_airbag, dash_immobilizer, dash_tpms, dash_oil_leak,
             current_mileage, next_service_date, next_service_mileage, oil_grade, oil_filter_changed,
             battery_amp_rate, battery_install_date, battery_warranty_months, battery_parasitic_tested,
             hvac_freon_date, hvac_leak_tested, outsource_cost, reminder_dismissed
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id, s.vehicle_id, s.customer_id, s.service_description, s.additional_info || null,
            s.cost, s.is_paid ? 1 : 0, s.partial_paid || 0, s.service_date, s.created_at,
            s.dash_abs ? 1 : 0, s.dash_check_engine ? 1 : 0, s.dash_brake ? 1 : 0, s.dash_airbag ? 1 : 0,
            s.dash_immobilizer ? 1 : 0, s.dash_tpms ? 1 : 0, s.dash_oil_leak ? 1 : 0,
            s.current_mileage ?? null, s.next_service_date || null, s.next_service_mileage ?? null,
            s.oil_grade || null, s.oil_filter_changed ? 1 : 0,
            s.battery_amp_rate || null, s.battery_install_date || null, s.battery_warranty_months ?? null,
            s.battery_parasitic_tested ? 1 : 0,
            s.hvac_freon_date || null, s.hvac_leak_tested ? 1 : 0,
            s.outsource_cost || 0, s.reminder_dismissed ? 1 : 0,
          ]
        );
        result.services.inserted++;
      }
    }
  }

  if (Array.isArray(snap.inventory)) {
    for (const it of snap.inventory) {
      const local = await db.getFirstAsync<InventoryItem>(`SELECT * FROM inventory WHERE id = ?`, [it.id]);
      if (!local) {
        await db.runAsync(
          `INSERT INTO inventory (id, item_number, item_type, item_quantity, item_price, item_retail_price, item_supplier, item_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [it.id, it.item_number, it.item_type, it.item_quantity, it.item_price, it.item_retail_price ?? 0, it.item_supplier ?? null, it.item_code ?? null, it.created_at, it.updated_at]
        );
        result.inventory.inserted++;
      } else if (newer(it.updated_at, local.updated_at)) {
        await db.runAsync(
          `UPDATE inventory SET item_number = ?, item_type = ?, item_quantity = ?, item_price = ?, item_retail_price = ?, item_supplier = ?, item_code = ?, updated_at = ? WHERE id = ?`,
          [it.item_number, it.item_type, it.item_quantity, it.item_price, it.item_retail_price ?? 0, it.item_supplier ?? null, it.item_code ?? null, it.updated_at, it.id]
        );
        result.inventory.updated++;
      }
    }
  }

  if (Array.isArray(snap.suppliers)) {
    for (const sup of snap.suppliers) {
      const local = await db.getFirstAsync<Supplier>(`SELECT * FROM suppliers WHERE id = ?`, [sup.id]);
      if (!local) {
        await db.runAsync(
          `INSERT INTO suppliers (id, name, contact_info, created_at) VALUES (?, ?, ?, ?)`,
          [sup.id, sup.name, sup.contact_info ?? null, sup.created_at]
        );
        result.suppliers.inserted++;
      }
    }
  }

  if (Array.isArray(snap.service_items)) {
    for (const si of snap.service_items) {
      const local = await db.getFirstAsync<ServiceItem>(`SELECT * FROM service_items WHERE id = ?`, [si.id]);
      if (!local) {
        await db.runAsync(
          `INSERT INTO service_items (id, service_id, inventory_id, item_type, quantity, unit_price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [si.id, si.service_id, si.inventory_id, si.item_type, si.quantity, si.unit_price, si.created_at]
        );
        result.service_items.inserted++;
      }
    }
  }

  return result;
}

export async function listSuppliers(): Promise<Supplier[]> {
  const db = await getDb();
  return await db.getAllAsync<Supplier>(
    `SELECT * FROM suppliers ORDER BY name ASC`
  );
}

export async function addSupplier(
  name: string,
  contactInfo?: string
): Promise<Supplier> {
  const db = await getDb();
  const clean = (name || '').trim();
  if (!clean) throw new Error('Supplier name is required');
  const existing = await db.getFirstAsync<Supplier>(
    `SELECT * FROM suppliers WHERE LOWER(name) = LOWER(?) LIMIT 1`,
    [clean]
  );
  if (existing) throw new Error(`Supplier "${clean}" already exists.`);
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO suppliers (id, name, contact_info, created_at) VALUES (?, ?, ?, ?)`,
    [id, clean, (contactInfo || '').trim() || null, now]
  );
  return { id, name: clean, contact_info: (contactInfo || '').trim() || null, created_at: now };
}

export async function updateSupplier(
  id: string,
  name: string,
  contactInfo?: string,
  newDebt?: number
): Promise<void> {
  const db = await getDb();
  const clean = (name || '').trim();
  if (!clean) throw new Error('Supplier name is required');
  
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1`,
    [clean, id]
  );
  if (existing) throw new Error(`Another supplier already uses "${clean}".`);
  
  const prev = await db.getFirstAsync<Supplier>(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  
  // Update the supplier's name and contact info
  await db.runAsync(
    `UPDATE suppliers SET name = ?, contact_info = ? WHERE id = ?`,
    [clean, (contactInfo || '').trim() || null, id]
  );
  if (prev && prev.name !== clean) {
    await db.runAsync(
      `UPDATE inventory SET item_supplier = ? WHERE item_supplier = ?`,
      [clean, prev.name]
    );
  }

  // 🔥 RESTORE THE DEBT UPDATE BLOCK
  if (newDebt !== undefined) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO supplier_balances (supplier_id, balance, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(supplier_id) DO UPDATE SET balance = ?, updated_at = ?`,
      [id, newDebt, now, newDebt, now]
    );
  }
}

export async function deleteSupplier(id: string): Promise<void> {
  const db = await getDb();
  const prev = await db.getFirstAsync<Supplier>(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  await db.runAsync(`DELETE FROM suppliers WHERE id = ?`, [id]);
  if (prev) {
    await db.runAsync(
      `UPDATE inventory SET item_supplier = NULL WHERE item_supplier = ?`,
      [prev.name]
    );
  }
}

export async function getLowStockBySupplier(
  threshold: number = 5
): Promise<LowStockItemBySupplier[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<InventoryItem>(
    `SELECT * FROM inventory WHERE item_quantity < ? ORDER BY item_supplier ASC, item_type ASC`,
    [threshold]
  );
  const grouped = new Map<string, InventoryItem[]>();
  for (const r of rows) {
    const key = (r.item_supplier || '').trim() || 'Unassigned Supplier';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }
  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([supplier_name, items]) => ({ supplier_name, items }));
}

export interface CleanupResult {
  customersDeleted: number;
  vehiclesDeleted: number;
  servicesDeleted: number;
  serviceItemsDeleted: number;
}

export async function deleteAllWalkinData(): Promise<CleanupResult> {
  const db = await getDb();
  const BATCH_SIZE = 500;
  
  console.log('🗑️ Starting walk-in data cleanup...');
  
  // 1. Find all walk-in customer IDs - ONLY by NAME!
  const walkinCustomers = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM customers 
     WHERE LOWER(name) LIKE '%walkin%' 
     OR LOWER(name) LIKE '%walk-in%'
     OR LOWER(name) LIKE '%walk in%'`
  );
  
  const customerIds = walkinCustomers.map(c => c.id);
  console.log(`🔍 Found ${customerIds.length} walk-in customers`);
  
  if (customerIds.length === 0) {
    return { customersDeleted: 0, vehiclesDeleted: 0, servicesDeleted: 0, serviceItemsDeleted: 0 };
  }
  
  // 2. Find vehicles belonging to walk-in customers
  let vehicleIds: string[] = [];
  if (customerIds.length > 0) {
    for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
      const batch = customerIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '?').join(',');
      const vehicles = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM vehicles WHERE customer_id IN (${placeholders})`,
        batch
      );
      vehicleIds = vehicleIds.concat(vehicles.map(v => v.id));
    }
  }
  console.log(`🔍 Found ${vehicleIds.length} walk-in vehicles`);
  
  // 3. Find services belonging to walk-in vehicles or customers
  let serviceIds: string[] = [];
  
  if (vehicleIds.length > 0) {
    for (let i = 0; i < vehicleIds.length; i += BATCH_SIZE) {
      const batch = vehicleIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '?').join(',');
      const services = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM services WHERE vehicle_id IN (${placeholders})`,
        batch
      );
      serviceIds = serviceIds.concat(services.map(s => s.id));
    }
  }
  
  if (customerIds.length > 0) {
    for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
      const batch = customerIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '?').join(',');
      const services = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM services WHERE customer_id IN (${placeholders})`,
        batch
      );
      serviceIds = serviceIds.concat(services.map(s => s.id));
    }
  }
  
  serviceIds = [...new Set(serviceIds)];
  console.log(`🔍 Found ${serviceIds.length} walk-in services`);
  
  // 4. Delete service_items
  let serviceItemsDeleted = 0;
  if (serviceIds.length > 0) {
    for (let i = 0; i < serviceIds.length; i += BATCH_SIZE) {
      const batch = serviceIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '?').join(',');
      const result = await db.runAsync(
        `DELETE FROM service_items WHERE service_id IN (${placeholders})`,
        batch
      );
      serviceItemsDeleted += result.changes || 0;
    }
    console.log(`🗑️ Deleted ${serviceItemsDeleted} service items`);
  }
  
  // 5. Delete services
  let servicesDeleted = 0;
  if (serviceIds.length > 0) {
    for (let i = 0; i < serviceIds.length; i += BATCH_SIZE) {
      const batch = serviceIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '?').join(',');
      const result = await db.runAsync(
        `DELETE FROM services WHERE id IN (${placeholders})`,
        batch
      );
      servicesDeleted += result.changes || 0;
    }
    console.log(`🗑️ Deleted ${servicesDeleted} services`);
  }
  
  // 6. Delete vehicles
  let vehiclesDeleted = 0;
  if (vehicleIds.length > 0) {
    for (let i = 0; i < vehicleIds.length; i += BATCH_SIZE) {
      const batch = vehicleIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '?').join(',');
      const result = await db.runAsync(
        `DELETE FROM vehicles WHERE id IN (${placeholders})`,
        batch
      );
      vehiclesDeleted += result.changes || 0;
    }
    console.log(`🗑️ Deleted ${vehiclesDeleted} vehicles`);
  }
  
  // 7. Delete customers
  let customersDeleted = 0;
  if (customerIds.length > 0) {
    for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
      const batch = customerIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '?').join(',');
      const result = await db.runAsync(
        `DELETE FROM customers WHERE id IN (${placeholders})`,
        batch
      );
      customersDeleted += result.changes || 0;
    }
    console.log(`🗑️ Deleted ${customersDeleted} customers`);
  }
  
  console.log('✅ Walk-in cleanup complete!');
  
  return {
    customersDeleted,
    vehiclesDeleted,
    servicesDeleted,
    serviceItemsDeleted,
  };
}

export async function checkWalkinData(): Promise<{
  customers: number;
  vehicles: number;
  services: number;
}> {
  const db = await getDb();
  
  // ONLY check by NAME!
  const customers = await db.getAllAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM customers 
     WHERE LOWER(name) LIKE '%walkin%' 
     OR LOWER(name) LIKE '%walk-in%'
     OR LOWER(name) LIKE '%walk in%'`
  );
  
  const customerResult = customers[0]?.count || 0;
  
  let vehicles = 0;
  let services = 0;
  
  // Only count vehicles/services if there are walk-in customers
  if (customerResult > 0) {
    const vehicleResult = await db.getAllAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM vehicles 
       WHERE customer_id IN (
         SELECT id FROM customers 
         WHERE LOWER(name) LIKE '%walkin%' 
         OR LOWER(name) LIKE '%walk-in%'
         OR LOWER(name) LIKE '%walk in%'
       )`
    );
    vehicles = vehicleResult[0]?.count || 0;
    
    const serviceResult = await db.getAllAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM services 
       WHERE customer_id IN (
         SELECT id FROM customers 
         WHERE LOWER(name) LIKE '%walkin%' 
         OR LOWER(name) LIKE '%walk-in%'
         OR LOWER(name) LIKE '%walk in%'
       )`
    );
    services = serviceResult[0]?.count || 0;
  }
  
  return {
    customers: customerResult,
    vehicles,
    services,
  };
}

export async function createQuickWalkinService(
  customerName: string | undefined,
  description: string,
  totalCost: number,
  isPaid: boolean,
  partialPaid: number = 0,
  outsourceCost: number = 0
): Promise<Service> {
  const db = await getDb();
  const now = new Date().toISOString();
  
  const finalName = (customerName && customerName.trim()) 
    ? customerName.trim() 
    : 'Walk-in';

  let walkinCustomer = await db.getFirstAsync<Customer>(
    `SELECT * FROM customers WHERE name = ? AND mobile_number = 'N/A' LIMIT 1`,
    [finalName]
  );

  if (!walkinCustomer) {
    const walkinId = generateId();
    await db.runAsync(
      `INSERT INTO customers (id, name, mobile_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [walkinId, finalName, 'N/A', now, now]
    );
    walkinCustomer = await db.getFirstAsync<Customer>(
      `SELECT * FROM customers WHERE id = ?`, [walkinId]
    );
  }

  let walkinVehicle = await db.getFirstAsync<Vehicle>(
    `SELECT * FROM vehicles WHERE customer_id = ? AND plate_number = 'WALK-IN' LIMIT 1`,
    [walkinCustomer!.id]
  );

  if (!walkinVehicle) {
    const vehicleId = generateId();
    await db.runAsync(
      `INSERT INTO vehicles (id, customer_id, vin, plate_number, make, model, year, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [vehicleId, walkinCustomer!.id, 'N/A', 'WALK-IN', 'Walk-in', 'Vehicle', null, now]
    );
    walkinVehicle = await db.getFirstAsync<Vehicle>(
      `SELECT * FROM vehicles WHERE id = ?`, [vehicleId]
    );
  }

  const serviceId = generateId();
  const pp = Math.max(0, Number(partialPaid) || 0);
  const oc = Math.max(0, Number(outsourceCost) || 0);
  const finalCost = Math.max(0, Number(totalCost) || 0);

  await db.runAsync(
    `INSERT INTO services (
      id, vehicle_id, customer_id, service_description, additional_info, cost, is_paid, partial_paid, 
      service_date, created_at, outsource_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      serviceId,
      walkinVehicle!.id,
      walkinCustomer!.id,
      description.trim() || 'Quick Walk-in Service',
      null,
      finalCost,
      isPaid ? 1 : 0,
      pp,
      now,
      now,
      oc
    ]
  );

  return {
    id: serviceId,
    vehicle_id: walkinVehicle!.id,
    customer_id: walkinCustomer!.id,
    service_description: description.trim() || 'Quick Walk-in Service',
    additional_info: undefined,
    cost: finalCost,
    is_paid: isPaid,
    service_date: now,
    created_at: now,
    partial_paid: pp,
    outsource_cost: oc,
  };
}

export async function createWalkinProductSale(
  inventoryId: string,
  quantity: number,
): Promise<Service> {
  const db = await getDb();
  const now = new Date().toISOString();

  const inv = await db.getFirstAsync<InventoryItem>(
    `SELECT * FROM inventory WHERE id = ?`,
    [inventoryId]
  );
  if (!inv) {
    throw new Error('Product not found in inventory.');
  }
  if (inv.item_quantity < quantity) {
    throw new Error(`Insufficient stock. Only ${inv.item_quantity} available.`);
  }

  let walkinCustomer = await db.getFirstAsync<Customer>(
    `SELECT * FROM customers WHERE name = 'Walk-in' AND mobile_number = 'N/A' LIMIT 1`
  );
  if (!walkinCustomer) {
    const walkinId = generateId();
    await db.runAsync(
      `INSERT INTO customers (id, name, mobile_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [walkinId, 'Walk-in', 'N/A', now, now]
    );
    walkinCustomer = await db.getFirstAsync<Customer>(`SELECT * FROM customers WHERE id = ?`, [walkinId]);
  }

  let walkinVehicle = await db.getFirstAsync<Vehicle>(
    `SELECT * FROM vehicles WHERE customer_id = ? AND plate_number = 'WALK-IN' LIMIT 1`,
    [walkinCustomer!.id]
  );
  if (!walkinVehicle) {
    const vehicleId = generateId();
    await db.runAsync(
      `INSERT INTO vehicles (id, customer_id, vin, plate_number, make, model, year, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [vehicleId, walkinCustomer!.id, 'N/A', 'WALK-IN', 'Walk-in', 'Vehicle', null, now]
    );
    walkinVehicle = await db.getFirstAsync<Vehicle>(
      `SELECT * FROM vehicles WHERE id = ?`, [vehicleId]
    );
  }

  const unitPrice = (inv.item_retail_price && inv.item_retail_price > 0) 
    ? inv.item_retail_price 
    : inv.item_price;
  const totalCost = unitPrice * quantity;

  const serviceId = generateId();
  await db.runAsync(
    `INSERT INTO services (
      id, vehicle_id, customer_id, service_description, additional_info, cost, is_paid, partial_paid,
      service_date, created_at, outsource_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      serviceId,
      walkinVehicle!.id,
      walkinCustomer!.id,
      `Product Sale: ${inv.item_type} (x${quantity})`,
      null,
      totalCost,
      1,
      0,
      now,
      now,
      0
    ]
  );

  const newQty = Math.max(0, inv.item_quantity - quantity);
  await db.runAsync(
    `UPDATE inventory SET item_quantity = ?, updated_at = ? WHERE id = ?`,
    [newQty, now, inv.id]
  );

  const rowId = generateId();
  await db.runAsync(
    `INSERT INTO service_items (id, service_id, inventory_id, item_type, quantity, unit_price, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [rowId, serviceId, inv.id, inv.item_type, quantity, unitPrice, now]
  );

  return {
    id: serviceId,
    vehicle_id: walkinVehicle!.id,
    customer_id: walkinCustomer!.id,
    service_description: `Product Sale: ${inv.item_type}`,
    additional_info: undefined,
    cost: totalCost,
    is_paid: true,
    service_date: now,
    created_at: now,
    partial_paid: 0,
    outsource_cost: 0,
  };
}

// 🔥 FIXED: getSupplierBalances with error catching
export async function getSupplierBalances(): Promise<{ id: string; name: string; balance: number }[]> {
  const db = await getDb();
  try {
    const rows = await db.getAllAsync<{ id: string; name: string; balance: number }>(
      `SELECT s.id, s.name, COALESCE(b.balance, 0) as balance
       FROM suppliers s
       LEFT JOIN supplier_balances b ON s.id = b.supplier_id
       ORDER BY s.name ASC`
    );
    return rows;
  } catch (error) {
    console.error("❌ getSupplierBalances failed:", error);
    // Return empty array instead of crashing
    return [];
  }
}

export async function updateSupplierBalance(supplierId: string, newBalance: number): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  
  // 1. Get OLD balance
  const oldRecord = await db.getFirstAsync<{ balance: number }>(
    `SELECT balance FROM supplier_balances WHERE supplier_id = ?`,
    [supplierId]
  );
  const oldBalance = oldRecord?.balance || 0;
  
  // 2. Update the balance
  await db.runAsync(
    `INSERT INTO supplier_balances (supplier_id, balance, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(supplier_id) DO UPDATE SET balance = ?, updated_at = ?`,
    [supplierId, newBalance, now, newBalance, now]
  );

  // 3. Log the payment if money was paid
  if (newBalance < oldBalance) {
    const amountPaid = oldBalance - newBalance;
    const paymentId = generateId();
    await db.runAsync(
      `INSERT INTO supplier_payments (id, supplier_id, amount_paid, paid_at, created_at) VALUES (?, ?, ?, ?, ?)`,
      [paymentId, supplierId, amountPaid, now, now]
    );
  }
}

export async function saveWeeklyWages(amount: number): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diffToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday);
  const mondayStr = monday.toISOString().slice(0, 10);

  await db.runAsync(
    `DELETE FROM wages_paid WHERE DATE(date) >= ? AND DATE(date) <= ?`,
    [mondayStr, mondayStr]
  );

  await db.runAsync(
    `INSERT INTO wages_paid (date, amount, created_at) VALUES (?, ?, ?)`,
    [mondayStr, amount, now]
  );
}

export async function getWeeklyCashSummary(): Promise<{
  revenue: number;
  totalOutstandingDebt: number;
  paidTowardsDebtToday: number;
  wages: number;
  netDrawer: number;
}> {
  const db = await getDb();
  
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diffToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday);
  const mondayStr = monday.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const revenueResult = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cost), 0) as total FROM services 
     WHERE DATE(service_date) >= ? AND DATE(service_date) <= ? AND (is_paid = 1 OR partial_paid > 0)`,
    [mondayStr, todayStr]
  );
  const revenue = revenueResult?.total || 0;

  const debtResult = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(balance), 0) as total FROM supplier_balances WHERE balance > 0`
  );
  const totalDebt = debtResult?.total || 0;

// 🔥 FIX: Simple, cross-version SQLite math (No LAG, no window functions)
// 🔥 FIX: Read from the supplier_payments table
let paidToday = 0;
try {
  const paidResult = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_paid), 0) as total FROM supplier_payments 
     WHERE DATE(paid_at) >= ? AND DATE(paid_at) <= ?`,
    [mondayStr, todayStr]
  );
  paidToday = paidResult?.total || 0;
} catch (e) {
  paidToday = 0;
}

  const wagesResult = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM wages_paid 
     WHERE DATE(date) >= ? AND DATE(date) <= ?`,
    [mondayStr, todayStr]
  );
  const wages = wagesResult?.total || 0;

  const netDrawer = revenue - paidToday - wages;

  return {
    revenue,
    totalOutstandingDebt: totalDebt,
    paidTowardsDebtToday: paidToday,
    wages,
    netDrawer,
  };
}

export async function emergencyNukeDatabase() {
  try {
    const db = await getDb();
    
    // 🔥 SAFE NUKE: Only drops the broken supplier and wages tables
    await db.execAsync(`
      PRAGMA foreign_keys = OFF;
      
      DROP TABLE IF EXISTS supplier_balances;
      DROP TABLE IF EXISTS wages_paid;
      
      PRAGMA foreign_keys = ON;
    `);
    
    console.log("💥 Corrupted supplier/wage tables wiped safely!");
    
    // IMPORTANT: Recreate the empty tables immediately
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS supplier_balances (
        supplier_id TEXT PRIMARY KEY,
        balance REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS wages_paid (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
    
    return true;
  } catch (error) {
    console.error("Safe Nuke failed:", error);
    return false;
  }
}
