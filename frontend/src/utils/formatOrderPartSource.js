export function getOrderPartSourceLabel(part) {
  if (!part) return 'Джерело не вказано';
  if (part.source_label) return part.source_label;
  if (part.stock_status === 'sold') return 'Мій склад — списано';
  if (part.stock_status === 'reserved') return 'Мій склад — резерв';
  if (part.stock_status === 'released') return 'Мій склад — резерв знято';
  if (part.inventory_item) return 'Мій склад';
  return part.supplier || 'Постачальник не вказаний';
}

export function getOrderPartStockLabel(part) {
  if (!part) return 'Склад: невідомо';
  if (part.stock_status === 'sold') return 'Склад: списано';
  if (part.stock_status === 'reserved') return 'Склад: зарезервовано';
  if (part.stock_status === 'released') return 'Склад: резерв знято';
  if (part.inventory_item) return 'Склад: знайдено';
  return 'Склад: не знайдено';
}
