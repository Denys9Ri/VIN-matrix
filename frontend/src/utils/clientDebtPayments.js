const arr = (value) => Array.isArray(value) ? value : [];

export const orderDebtAmount = (order) => Number(
  order?.debt_amount
  ?? order?.revenue
  ?? order?.total_revenue
  ?? order?.total
  ?? 0,
) || 0;

export const isDebtOrder = (order) => (
  orderDebtAmount(order) > 0
  || ['unpaid', 'debt', 'cod', 'prepaid'].includes(String(order?.payment_status || '').toLowerCase())
);

export const debtOrdersOf = (client) => arr(client?.orders).filter((order) => order?.id && isDebtOrder(order));

export async function closeClientDebt(api, client, options = {}) {
  if (!api || !client) return { closed: 0, clientKey: '', orders: [], target: client };

  let target = client;
  if (!Array.isArray(client.orders) && client.key) {
    const response = await api.get(`/api/store-clients/detail/?key=${encodeURIComponent(client.key)}`);
    target = response.data || client;
  }

  const orders = debtOrdersOf(target);
  const clientKey = target?.key || client?.key || options.fallbackClientKey || '';
  const paymentType = options.paymentType || 'cash';
  const comment = options.comment || 'Закриття боргу з картки клієнта';

  await Promise.all(orders.map((order) => api.post(`/api/visits/${order.id}/mark-paid/`, {
    payment_type: paymentType,
    comment,
  })));

  return { closed: orders.length, clientKey, orders, target };
}
