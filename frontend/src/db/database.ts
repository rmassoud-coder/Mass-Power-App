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
  service_date: string;
  created_at: string;
}

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
      service_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_services_vehicle ON services(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_services_customer ON services(customer_id);

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

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
  const services = await db.getAllAsync<Service>(
    `SELECT * FROM services WHERE customer_id = ? ORDER BY service_date DESC`,
    [customerId]
  );
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
  cost: number
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
  await db.runAsync(
    `INSERT INTO services (id, vehicle_id, customer_id, service_description, additional_info, cost, service_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, vehicleId, vehicle.customer_id, serviceDescription, additionalInfo || null, cost, now, now]
  );
  return {
    id,
    vehicle_id: vehicleId,
    customer_id: vehicle.customer_id,
    service_description: serviceDescription,
    additional_info: additionalInfo,
    cost,
    service_date: now,
    created_at: now,
  };
}

export async function updateService(
  id: string,
  serviceDescription: string,
  additionalInfo: string | undefined,
  cost: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE services SET service_description = ?, additional_info = ?, cost = ? WHERE id = ?`,
    [serviceDescription, additionalInfo || null, cost, id]
  );
}

export async function deleteService(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM services WHERE id = ?`, [id]);
}

// ============ Report ============
export async function getReport(
  startDate?: string,
  endDate?: string,
  mobile?: string,
  vin?: string,
  plate?: string
): Promise<{ items: ReportItem[]; total_cost: number; total_services: number }> {
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
      s.service_date
    FROM services s
    JOIN customers c ON s.customer_id = c.id
    JOIN vehicles v ON s.vehicle_id = v.id
    ${whereClause}
    ORDER BY s.service_date DESC
  `;

  const items = await db.getAllAsync<ReportItem>(sql, params);
  const total_cost = items.reduce((sum, i) => sum + i.cost, 0);
  return { items, total_cost, total_services: items.length };
}

// ============ Export / Import ============
export async function exportAllData(): Promise<string> {
  const db = await getDb();
  const customers = await db.getAllAsync<Customer>(`SELECT * FROM customers`);
  const vehicles = await db.getAllAsync<Vehicle>(`SELECT * FROM vehicles`);
  const services = await db.getAllAsync<Service>(`SELECT * FROM services`);
  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    customers,
    vehicles,
    services,
  };
  return JSON.stringify(exportData, null, 2);
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
      `INSERT OR IGNORE INTO services (id, vehicle_id, customer_id, service_description, additional_info, cost, service_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.vehicle_id, s.customer_id, s.service_description, s.additional_info || null, s.cost, s.service_date, s.created_at]
    );
    if (result.changes > 0) servicesAdded++;
  }

  return { customers: customersAdded, vehicles: vehiclesAdded, services: servicesAdded };
}
