import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CarFront, Briefcase, LineChart, Settings, Users, Search } from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Universal Search', icon: <Search size={20} />, path: '/search' },
    { name: 'Active Visits', icon: <CarFront size={20} />, path: '/visits' },
    { name: 'Inventory', icon: <Briefcase size={20} />, path: '/inventory' },
    { name: 'Analytics', icon: <LineChart size={20} />, path: '/analytics' },
    { name: 'Settings', icon: <Settings size={20} />, path: '/settings' },
    { name: 'Clients', icon: <Users size={20} />, path: '/clients' },
  ];

  return (
    <div className="w-64 h-screen bg-slate-900 text-slate-300 flex flex-col fixed left-0 top-0">
      <div className="h-16 flex items-center px-6 text-white font-bold text-xl tracking-wider border-b border-slate-800">
        VIN-matrix
      </div>
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-3 transition-colors ${
                    isActive 
                      ? 'bg-slate-800 text-white border-l-4 border-blue-500' 
                      : 'hover:bg-slate-800/50 hover:text-white border-l-4 border-transparent'
                  }`
                }
              >
                {item.icon}
                <span className="font-medium">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
