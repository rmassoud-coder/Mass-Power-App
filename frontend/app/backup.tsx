import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('masspower.db');
  }
  return db;
};

// ==================== EXPORT / IMPORT ====================

export interface FullDbSnapshot {
  version: number;
  exported_at: string;
  customers: any[];
  vehicles: any[];
  services: any[];
  service_items: any[];
  inventory: any[];
  suppliers: any[];
}

export const exportFullDatabase = async (): Promise<FullDbSnapshot> => {
  const db = await getDatabase();
  const customers = await db.getAllAsync('SELECT * FROM customers');
  const vehicles = await db.getAllAsync('SELECT * FROM vehicles');
  const services = await db.getAllAsync('SELECT * FROM services');
  const service_items = await db.getAllAsync('SELECT * FROM service_items');
  const inventory = await db.getAllAsync('SELECT * FROM inventory');
  const suppliers = await db.getAllAsync('SELECT * FROM suppliers');

  return {
    version: 3,
    exported_at: new Date().toISOString(),
    customers,
    vehicles,
    services,
    service_items,
    inventory,
    suppliers,
  };
};

export const mergeCloudIntoLocal = async (snapshot: FullDbSnapshot) => {
  const db = await getDatabase();
  const result = {
    customers: { inserted: 0 },
    vehicles: { inserted: 0 },
    services: { inserted: 0 },
    inventory: { inserted: 0 },
  };

  // Merge customers
  for (const customer of snapshot.customers || []) {
    const exists = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM customers WHERE id = ?',
      customer.id
    );
    if (!exists) {
      await db.runAsync(
        `INSERT INTO customers (id, name, mobile_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        customer.id,
        customer.name,
        customer.mobile_number,
        customer.created_at || new Date().toISOString(),
        customer.updated_at || new Date().toISOString()
      );
      result.customers.inserted++;
    }
  }

  // Merge vehicles
  for (const vehicle of snapshot.vehicles || []) {
    const exists = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM vehicles WHERE id = ?',
      vehicle.id
    );
    if (!exists) {
      await db.runAsync(
        `INSERT INTO vehicles (id, customer_id, vin, plate_number, make, model, year, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        vehicle.id,
        vehicle.customer_id,
        vehicle.vin,
        vehicle.plate_number,
        vehicle.make,
        vehicle.model,
        vehicle.year,
        vehicle.created_at || new Date().toISOString()
      );
      result.vehicles.inserted++;
    }
  }

  // Merge services
  for (const service of snapshot.services || []) {
    const exists = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM services WHERE id = ?',
      service.id
    );
    if (!exists) {
      await db.runAsync(
        `INSERT INTO services (
          id, vehicle_id, customer_id, service_description, additional_info,
          cost, is_paid, partial_paid, service_date, created_at, outsource_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        service.id,
        service.vehicle_id,
        service.customer_id,
        service.service_description,
        service.additional_info || null,
        service.cost || 0,
        service.is_paid || 0,
        service.partial_paid || 0,
        service.service_date || new Date().toISOString(),
        service.created_at || new Date().toISOString(),
        service.outsource_cost || 0
      );
      result.services.inserted++;
    }
  }

  // Merge inventory
  for (const item of snapshot.inventory || []) {
    const exists = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM inventory WHERE id = ?',
      item.id
    );
    if (!exists) {
      await db.runAsync(
        `INSERT INTO inventory (
          id, item_number, item_type, item_quantity, item_price,
          item_retail_price, item_supplier, item_code, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.item_number,
        item.item_type,
        item.item_quantity || 0,
        item.item_price || 0,
        item.item_retail_price || 0,
        item.item_supplier || null,
        item.item_code || null,
        item.created_at || new Date().toISOString(),
        item.updated_at || new Date().toISOString()
      );
      result.inventory.inserted++;
    }
  }

  return result;
};

export const replaceFullDatabase = async (snapshot: FullDbSnapshot) => {
  const db = await getDatabase();
  
  // Delete all existing data
  await db.runAsync('DELETE FROM service_items');
  await db.runAsync('DELETE FROM services');
  await db.runAsync('DELETE FROM vehicles');
  await db.runAsync('DELETE FROM inventory');
  await db.runAsync('DELETE FROM suppliers');
  await db.runAsync('DELETE FROM customers');
  
  // Insert customers
  for (const customer of snapshot.customers || []) {
    await db.runAsync(
      `INSERT INTO customers (id, name, mobile_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      customer.id,
      customer.name,
      customer.mobile_number,
      customer.created_at || new Date().toISOString(),
      customer.updated_at || new Date().toISOString()
    );
  }
  
  // Insert vehicles
  for (const vehicle of snapshot.vehicles || []) {
    await db.runAsync(
      `INSERT INTO vehicles (id, customer_id, vin, plate_number, make, model, year, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      vehicle.id,
      vehicle.customer_id,
      vehicle.vin,
      vehicle.plate_number,
      vehicle.make,
      vehicle.model,
      vehicle.year,
      vehicle.created_at || new Date().toISOString()
    );
  }
  
  // Insert services
  for (const service of snapshot.services || []) {
    await db.runAsync(
      `INSERT INTO services (
        id, vehicle_id, customer_id, service_description, additional_info,
        cost, is_paid, partial_paid, service_date, created_at, outsource_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      service.id,
      service.vehicle_id,
      service.customer_id,
      service.service_description,
      service.additional_info || null,
      service.cost || 0,
      service.is_paid || 0,
      service.partial_paid || 0,
      service.service_date || new Date().toISOString(),
      service.created_at || new Date().toISOString(),
      service.outsource_cost || 0
    );
  }
  
  // Insert inventory
  for (const item of snapshot.inventory || []) {
    await db.runAsync(
      `INSERT INTO inventory (
        id, item_number, item_type, item_quantity, item_price,
        item_retail_price, item_supplier, item_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      item.item_number,
      item.item_type,
      item.item_quantity || 0,
      item.item_price || 0,
      item.item_retail_price || 0,
      item.item_supplier || null,
      item.item_code || null,
      item.created_at || new Date().toISOString(),
      item.updated_at || new Date().toISOString()
    );
  }
  
  // Insert suppliers
  for (const supplier of snapshot.suppliers || []) {
    await db.runAsync(
      `INSERT INTO suppliers (id, name, contact_info, created_at)
       VALUES (?, ?, ?, ?)`,
      supplier.id,
      supplier.name,
      supplier.contact_info || null,
      supplier.created_at || new Date().toISOString()
    );
  }
};

// ==================== CUSTOMERS ====================

export const searchCustomers = async (mobileNumber: string): Promise<any[]> => {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT * FROM customers WHERE mobile_number LIKE ? ORDER BY name ASC`,
    `%${mobileNumber}%`
  );
};

// ==================== VEHICLES ====================

export const searchVehiclesByVin = async (vin: string): Promise<any[]> => {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT v.*, c.name as customer_name, c.mobile_number as customer_mobile 
     FROM vehicles v 
     JOIN customers c ON v.customer_id = c.id 
     WHERE v.vin LIKE ?`,
    `%${vin}%`
  );
};

export const searchVehiclesByPlate = async (plate: string): Promise<any[]> => {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT v.*, c.name as customer_name, c.mobile_number as customer_mobile 
     FROM vehicles v 
     JOIN customers c ON v.customer_id = c.id 
     WHERE v.plate_number LIKE ?`,
    `%${plate}%`
  );
};

export const createVehicle = async (
  customerId: string,
  vin: string,
  plateNumber: string,
  make: string,
  model: string,
  year?: string
): Promise<void> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO vehicles (customer_id, vin, plate_number, make, model, year, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    customerId,
    vin,
    plateNumber,
    make,
    model,
    year || null,
    now
  );
};

// ==================== SERVICES ====================

export const createService = async (
  vehicleId: string,
  customerId: string,
  serviceDescription: string,
  cost: number,
  isPaid: boolean,
  serviceDate?: string,
  additionalInfo?: string,
  partialPaid?: number,
  outsourceCost?: number
): Promise<void> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO services (
      vehicle_id, customer_id, service_description, additional_info, 
      cost, is_paid, service_date, created_at, partial_paid, outsource_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    vehicleId,
    customerId,
    serviceDescription,
    additionalInfo || null,
    cost,
    isPaid ? 1 : 0,
    serviceDate || now,
    now,
    partialPaid || 0,
    outsourceCost || 0
  );
};

export const getReport = async (
  startDate?: string,
  endDate?: string,
  mobileFilter?: string,
  vinFilter?: string,
  plateFilter?: string,
  unpaidOnly?: boolean
): Promise<any> => {
  const db = await getDatabase();
  
  let query = `
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
      s.is_paid,
      s.service_date,
      s.partial_paid,
      s.outsource_cost
    FROM services s
    JOIN customers c ON s.customer_id = c.id
    JOIN vehicles v ON s.vehicle_id = v.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (startDate) {
    query += ` AND s.service_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND s.service_date <= ?`;
    params.push(endDate);
  }
  if (mobileFilter) {
    query += ` AND c.mobile_number LIKE ?`;
    params.push(`%${mobileFilter}%`);
  }
  if (vinFilter) {
    query += ` AND v.vin LIKE ?`;
    params.push(`%${vinFilter}%`);
  }
  if (plateFilter) {
    query += ` AND v.plate_number LIKE ?`;
    params.push(`%${plateFilter}%`);
  }
  if (unpaidOnly) {
    query += ` AND s.is_paid = 0`;
  }
  
  query += ` ORDER BY s.service_date DESC`;
  
  const items = await db.getAllAsync(query, params);
  
  let total_cost = 0;
  let outsource_total = 0;
  let unpaid_count = 0;
  let unpaid_total = 0;
  
  items.forEach((item: any) => {
    total_cost += item.cost || 0;
    outsource_total += item.outsource_cost || 0;
    if (!item.is_paid) {
      unpaid_count++;
      unpaid_total += item.cost || 0;
    }
  });
  
  return {
    items,
    total_cost,
    total_services: items.length,
    unpaid_count,
    unpaid_total,
    outsource_total,
    net_cash_flow: total_cost - outsource_total,
  };
};

// ==================== INVENTORY ====================

export const listInventory = async (): Promise<any[]> => {
  const db = await getDatabase();
  return await db.getAllAsync(`SELECT * FROM inventory ORDER BY item_type ASC`);
};

export const listDueOilReminders = async (): Promise<any[]> => {
  const db = await getDatabase();
  const today = new Date().toISOString().slice(0, 10);
  return await db.getAllAsync(
    `SELECT 
      s.id as service_id,
      s.customer_id,
      c.name as customer_name,
      c.mobile_number,
      s.vehicle_id,
      v.make as vehicle_make,
      v.model as vehicle_model,
      v.plate_number,
      s.next_service_date,
      s.next_service_mileage,
      s.current_mileage,
      s.service_description
    FROM services s
    JOIN customers c ON s.customer_id = c.id
    JOIN vehicles v ON s.vehicle_id = v.id
    WHERE s.next_service_date <= ? 
      AND s.reminder_dismissed = 0
    ORDER BY s.next_service_date ASC`,
    today
  );
};

// ==================== SUPPLIERS ====================

export interface Supplier {
  id: string;
  name: string;
  contact_info: string | null;
  created_at: string;
}

export const listSuppliers = async (): Promise<Supplier[]> => {
  const db = await getDatabase();
  return await db.getAllAsync(`SELECT * FROM suppliers ORDER BY name ASC`);
};

export const addSupplier = async (name: string, contactInfo?: string): Promise<void> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO suppliers (name, contact_info, created_at) VALUES (?, ?, ?)`,
    name,
    contactInfo || null,
    now
  );
};

export const updateSupplier = async (id: string, name: string, contactInfo?: string): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE suppliers SET name = ?, contact_info = ? WHERE id = ?`,
    name,
    contactInfo || null,
    id
  );
};

export const deleteSupplier = async (id: string): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM suppliers WHERE id = ?`, id);
};

export interface LowStockItemBySupplier {
  supplier_name: string;
  items: {
    id: string;
    item_number: string;
    item_type: string;
    item_quantity: number;
    item_price: number;
    item_retail_price: number;
    item_code: string | null;
  }[];
}

export const getLowStockBySupplier = async (threshold: number): Promise<LowStockItemBySupplier[]> => {
  const db = await getDatabase();
  const items = await db.getAllAsync(
    `SELECT * FROM inventory WHERE item_quantity <= ? ORDER BY item_quantity ASC`,
    threshold
  );
  
  const grouped: { [key: string]: LowStockItemBySupplier['items'] } = {};
  
  items.forEach((item: any) => {
    const supplier = item.item_supplier || 'Unknown Supplier';
    if (!grouped[supplier]) {
      grouped[supplier] = [];
    }
    grouped[supplier].push({
      id: item.id,
      item_number: item.item_number,
      item_type: item.item_type,
      item_quantity: item.item_quantity,
      item_price: item.item_price,
      item_retail_price: item.item_retail_price,
      item_code: item.item_code,
    });
  });
  
  return Object.keys(grouped).map((supplier_name) => ({
    supplier_name,
    items: grouped[supplier_name],
  }));
};

// ==================== WALK-IN SERVICES ====================

export const getWalkInCustomerId = async (): Promise<string | null> => {
  const db = await getDatabase();
  try {
    const result = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM customers WHERE name = 'Walk-in Customer' LIMIT 1`
    );
    return result ? result.id : null;
  } catch (error) {
    console.warn('Error getting walk-in customer:', error);
    return null;
  }
};

export const getWalkInVehicleId = async (customerId: string): Promise<string | null> => {
  const db = await getDatabase();
  try {
    const result = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM vehicles WHERE customer_id = ? AND vin = 'WALKIN' LIMIT 1`,
      customerId
    );
    return result ? result.id : null;
  } catch (error) {
    console.warn('Error getting walk-in vehicle:', error);
    return null;
  }
};

export const createWalkinService = async (
  customerName: string | undefined,
  serviceDescription: string,
  cost: number,
  isPaid: boolean,
  partialPaid: number,
  additionalInfo?: string
): Promise<void> => {
  const db = await getDatabase();
  const now = new Date().toISOString();

  try {
    let walkInCustomerId = await getWalkInCustomerId();

    if (!walkInCustomerId) {
      const result = await db.runAsync(
        `INSERT INTO customers (name, mobile_number, created_at, updated_at) 
         VALUES (?, ?, ?, ?)`,
        'Walk-in Customer',
        '00000000',
        now,
        now
      );
      walkInCustomerId = result.lastInsertRowId?.toString() || null;
      
      if (!walkInCustomerId) {
        throw new Error('Failed to create walk-in customer');
      }
    }

    let walkInVehicleId = await getWalkInVehicleId(walkInCustomerId);

    if (!walkInVehicleId) {
      const result = await db.runAsync(
        `INSERT INTO vehicles (customer_id, vin, plate_number, make, model, year, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        walkInCustomerId,
        'WALKIN',
        'WALKIN',
        'Walk-in',
        'Service',
        new Date().getFullYear().toString(),
        now
      );
      walkInVehicleId = result.lastInsertRowId?.toString() || null;
      
      if (!walkInVehicleId) {
        throw new Error('Failed to create walk-in vehicle');
      }
    }

    let finalDescription = serviceDescription;
    if (customerName && customerName.trim()) {
      finalDescription = `${serviceDescription} (${customerName.trim()})`;
    }

    let isPaidFinal = isPaid ? 1 : 0;
    let partialPaidFinal = partialPaid || 0;

    await db.runAsync(
      `INSERT INTO services (
        vehicle_id, 
        customer_id, 
        service_description, 
        additional_info, 
        cost, 
        is_paid, 
        partial_paid,
        service_date, 
        created_at,
        outsource_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      walkInVehicleId,
      walkInCustomerId,
      finalDescription,
      additionalInfo || null,
      cost,
      isPaidFinal,
      partialPaidFinal,
      now,
      now,
      0
    );
  } catch (error) {
    console.error('Error creating walk-in service:', error);
    throw error;
  }
};
