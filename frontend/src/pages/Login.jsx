import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarFront, Lock, User, AlertCircle } from 'lucide-react';
import api from '../api/axios';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Робимо запит до нашого бекенду за токеном
      const res = await api.post('/token/', { username, password });
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      navigate('/'); // Перекидаємо на головну
    } catch (err) {
      setError('Невірний логін або пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-4 rounded-2xl text-white mb-4 shadow-lg shadow-blue-200">
            <CarFront size={32} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
            VIN<span className="text-blue-600">-matrix</span>
          </h1>
          <p className="text-slate-500 text-sm font-bold mt-1">Система управління СТО</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2 mb-6 text-sm font-bold">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              required 
              type="text" 
              placeholder="Логін" 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
              value={username} onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              required 
              type="password" 
              placeholder="Пароль" 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase tracking-wide mt-4 shadow-lg shadow-blue-200 transition-all disabled:opacity-70"
          >
            {loading ? 'Вхід...' : 'Увійти'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
