function visitIdOf(item) {
  return item?.visit_id || item?.order_id || item?.id || '';
}

function crmSearchValue(item) {
  const explicit = String(item?.client_key || item?.meta || '').trim();
  if (explicit) return explicit;
  const subtitle = String(item?.subtitle || '').trim();
  return subtitle.split(' • ')[0]?.trim() || '';
}

export function notificationActionUrl(section, item) {
  if (!item) return section?.url || '/';

  const visitId = visitIdOf(item);
  const key = section?.key || '';

  if (key === 'debts' && visitId) return `/attention?visit_id=${visitId}&type=debt`;
  if (key === 'payment_due' && visitId) return `/attention?visit_id=${visitId}&type=payment`;

  if (key === 'overdue_orders' && visitId) {
    return `/visits?visit_id=${visitId}&open=board`;
  }

  if (key === 'parts_in_transit' && visitId) {
    return `/visits?visit_id=${visitId}&tab=parts&open=board`;
  }

  if (['np_returns', 'np_received', 'np_cod_waiting'].includes(key) && visitId) {
    return `/visits?visit_id=${visitId}&tab=delivery&open=board`;
  }

  if (['crm_tasks', 'service_reminders', 'recommendations'].includes(key)) {
    const search = crmSearchValue(item);
    const base = item.url || section?.url || '/crm';
    if (search) {
      const separator = base.includes('?') ? '&' : '?';
      return `${base}${separator}search=${encodeURIComponent(search)}&autopen=1`;
    }
    return base;
  }

  if (String(item.url || '').startsWith('/clients') && item.client_key) {
    return `/clients?search=${encodeURIComponent(item.client_key)}&autopen=1`;
  }

  return item.url || section?.url || '/';
}
