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
}
