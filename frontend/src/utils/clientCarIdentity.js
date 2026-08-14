const clean = (value) => String(value ?? '').trim();

export const carDisplayName = (car) => {
  const name = [clean(car?.brand), clean(car?.model)].filter(Boolean).join(' ');
  const year = clean(car?.year);
  return [name, year].filter(Boolean).join(' · ');
};

export const primaryClientCar = (client) => {
  const cars = Array.isArray(client?.cars) ? client.cars : [];
  const car = cars[0] || {};
  const plate = clean(car.plate).toUpperCase();
  const title = carDisplayName(car);
  return {
    ...car,
    plate,
    title,
    hasIdentity: Boolean(plate || clean(car.vin_code) || title),
  };
};
