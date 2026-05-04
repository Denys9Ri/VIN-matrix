import React from 'react';
import VisitCard from '../components/visits/VisitCard';

const Dashboard = () => {
  // Фейкові дані для тестування дизайну (точно як на твоєму макеті)
  const mockVisits = [
    { id: 1, plate: 'AA1234BB', client: 'Skoda Octavia A7', phone: '(932) 325-6387', status: 'ORDERED', statusText: 'ORDERED - Waiting for Parts', step: 'Worked in Serving' },
    { id: 2, plate: 'AA1234BB', client: 'Skoda Octavia A7', phone: '(922) 325-6587', status: 'IN_TRANSIT', statusText: 'IN TRANSIT', step: 'Worked in Serving' },
    { id: 3, plate: 'AA1234BB', client: 'Skoda Octavia A7', phone: '(922) 325-6389', status: 'SELECTION', statusText: 'SELECTION - Draft Basket', step: 'Worked in Finalizing' },
    { id: 4, plate: 'AA1234BB', client: 'Jannen Samm', phone: '(912) 325-6589', status: 'ARRIVED', statusText: 'ARRIVED - Finalizing', step: 'Worked in Serving' },
    { id: 5, plate: 'AA1234BB', client: 'Skoda Octavia A7', phone: '(837) 325-5383', status: 'ORDERED', statusText: 'ORDERED - Waiting Parts', step: 'Worked in Serving' },
    { id: 6, plate: 'AA1234BB', client: 'Mary Kelan', phone: '(837) 355-8777', status: 'SELECTION', statusText: 'SELECTION - Draft Basket', step: 'Worked in Serving' },
    { id: 7, plate: 'AA1234BB', client: 'Joanah Aerton', phone: '(837) 375-3538', status: 'ARRIVED', statusText: 'ARRIVED - Finalizing', step: 'Worked in Serving' },
    { id: 8, plate: 'AA1234BB', client: 'Joanon Sonon', phone: '(837) 335-3823', status: 'ARRIVED', statusText: 'ARRIVED - Finalizing', step: 'Worked in Serving' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Заголовок і кнопка додавання */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-wide uppercase">
          Active Car Service Visits
        </h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
          <span>[+] Add Visit</span>
        </button>
      </div>

      {/* Сітка карток (Адаптивна: 1 колонка на мобільному, 2 на планшеті, 4 на широкому екрані) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {mockVisits.map((visit) => (
          <VisitCard key={visit.id} visit={visit} />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
