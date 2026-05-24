import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

const Register = () => {
  const [formData, setFormData] = useState({ username: '', password: '', company_name: '', full_name: '', referral_code: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Відправляємо дані на бекенд
      await api.post('/api/register/', formData);
      setSuccess('Успішно! Зараз перекинемо на сторінку входу...');
      
      // Чекаємо 2 секунди і перекидаємо на логін
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Сталася помилка при реєстрації');
    }
  };

  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
      <form onSubmit={handleSubmit} style={{ backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '12px', display: 'flex', flexDirection: 'column', width: '350px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '25px' }}>Реєстрація</h2>
        
        {error && <div style={{ color: '#ff4d4d', marginBottom: '15px', textAlign: 'center', fontSize: '14px' }}>{error}</div>}
        {success && <div style={{ color: '#4CAF50', marginBottom: '15px', textAlign: 'center', fontSize: '14px' }}>{success}</div>}

        <label style={{ marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>ПІБ (для клієнта/партнера)</label>
        <input name="full_name" onChange={handleChange} placeholder="Наприклад: Іван Петренко" style={{ marginBottom: '16px', padding: '12px', borderRadius: '6px', border: '1px solid #333', background: '#2c2c2c', color: '#fff' }} />

        <label style={{ marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Назва вашого СТО (для адміна)</label>
        <input name="company_name" onChange={handleChange} placeholder="Наприклад: АвтоГараж Плюс" style={{ marginBottom: '16px', padding: '12px', borderRadius: '6px', border: '1px solid #333', background: '#2c2c2c', color: '#fff' }} />

        <label style={{ marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Referral code представника (необов'язково)</label>
        <input name="referral_code" onChange={handleChange} placeholder="Напр. PARTNER1001" style={{ marginBottom: '20px', padding: '12px', borderRadius: '6px', border: '1px solid #333', background: '#2c2c2c', color: '#fff' }} />

        <label style={{ marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Логін адміністратора</label>
        <input name="username" onChange={handleChange} required placeholder="admin_auto" style={{ marginBottom: '20px', padding: '12px', borderRadius: '6px', border: '1px solid #333', background: '#2c2c2c', color: '#fff' }} />

        <label style={{ marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>Пароль</label>
        <input type="password" name="password" onChange={handleChange} required placeholder="••••••••" style={{ marginBottom: '30px', padding: '12px', borderRadius: '6px', border: '1px solid #333', background: '#2c2c2c', color: '#fff' }} />

        <button type="submit" style={{ padding: '12px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginBottom: '15px' }}>
          Зареєструватися
        </button>

        <div style={{ textAlign: 'center', fontSize: '14px', color: '#aaa' }}>
          Вже є акаунт? <Link to="/login" style={{ color: '#007bff', textDecoration: 'none' }}>Увійти</Link>
        </div>
      </form>
    </div>
  );
};

export default Register;
