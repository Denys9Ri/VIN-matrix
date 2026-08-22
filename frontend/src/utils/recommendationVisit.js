const pad2 = (value) => String(value).padStart(2, '0');

export const localDateISO = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const tomorrowISO = (now = new Date()) => {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  return localDateISO(date);
};

export const recommendationScheduleDefaults = (recommendation = {}, now = new Date()) => {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  let date = '';
  if (recommendation.due_date) {
    const due = new Date(`${recommendation.due_date}T12:00:00`);
    if (!Number.isNaN(due.getTime()) && due >= todayStart) date = recommendation.due_date;
  }

  return {
    date: date || tomorrowISO(now),
    time: '09:00',
    mileage: recommendation.due_mileage || '',
    comment: '',
  };
};

export const buildRecommendationVisitPayload = ({
  recommendation = {},
  sourceVisit = {},
  carData = {},
  schedule = {},
}) => {
  const client = recommendation.client || sourceVisit.client || '';
  const phone = recommendation.phone || sourceVisit.phone || '';
  const plate = String(recommendation.plate || sourceVisit.plate || '').trim().toUpperCase();
  const date = schedule.date || '';
  const time = schedule.time || '';

  if (!client || !phone || !plate || !date || !time) {
    throw new Error('missing_followup_fields');
  }

  const scheduledDate = new Date(`${date}T${time}`);
  if (Number.isNaN(scheduledDate.getTime())) throw new Error('invalid_followup_datetime');

  const mileage = schedule.mileage || recommendation.due_mileage || carData.mileage || '';
  const extraComment = String(schedule.comment || '').trim();
  const recommendationTitle = String(recommendation.title || 'Рекомендація').trim();

  return {
    plate,
    vin_code: sourceVisit.vin_code || '',
    client,
    phone,
    scheduled_datetime: scheduledDate.toISOString(),
    delivery_type: 'pickup',
    delivery_data: JSON.stringify({
      ...carData,
      mileage,
      source: 'recommendation',
      recommendation_id: recommendation.id || null,
    }),
    payment_status: 'unpaid',
    prepayment_amount: 0,
    comment: `[З рекомендації] ${recommendationTitle}${extraComment ? ` — ${extraComment}` : ''}`,
  };
};
