import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

const inputStyle = {
  marginBottom: '14px',
  padding: '12px',
  borderRadius: '6px',
  border: '1px solid #333',
  background: '#2c2c2c',
  color: '#fff',
};

const labelStyle = { marginBottom: '5px', fontSize: '14px', color: '#aaa' };
const hintStyle = { color: '#777', fontSize: '11px', marginTop: '-9px', marginBottom: '13px', lineHeight: 1.35 };

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    company_name: '',
    full_name: '',
    phone: '',
    email: '',
    referral_code: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/api/register/', formData);
      setSuccess('Успішно! Зараз перекинемо на сторінку входу...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Сталася помилка при реєстрації');
    }
  };

  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', padding: '20px' }}>
      <form onSubmit={handleSubmit} style={{ backgroundColor: '#1e1e1e', padding: '34px', borderRadius: '12px', display: 'flex', flexDirection: 'column', width: '390px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '25px' }}>Реєстрація</h2>
        
        {error && <div style={{ color: '#ff4d4d', marginBottom: '15px', textAlign: 'center', fontSize: '14px' }}>{error}</div>}
        {success && <div style={{ color: '#4CAF50', marginBottom: '15px', textAlign: 'center', fontSize: '14px' }}>{success}</div>}

        <label style={labelStyle}>ПІБ *</label>
        <input name="full_name" value={formData.full_name} onChange={handleChange} required placeholder="Наприклад: Іван Петренко" style={inputStyle} />

        <label style={labelStyle}>Номер телефону *</label>
        <input name="phone" value={formData.phone} onChange={handleChange} required placeholder="Наприклад: +380991234567" style={inputStyle} />

        <label style={labelStyle}>Пошта (за бажанням)</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="client@gmail.com" style={inputStyle} />

        <label style={labelStyle}>Назва вашого СТО / магазину</label>
        <input name="company_name" value={formData.company_name} onChange={handleChange} placeholder="Наприклад: АвтоГараж Плюс" style={inputStyle} />

        <label style={labelStyle}>Код партнера (необов'язково)</label>
        <input name="referral_code" value={formData.referral_code} onChange={handleChange} placeholder="Напр. P6001" style={inputStyle} />

        <label style={labelStyle}>Логін *</label>
        <input name="username" value={formData.username} onChange={handleChange} required placeholder="Denys123" style={inputStyle} />
        <div style={hintStyle}>Мінімум 4 англійські букви, одна велика буква і одна цифра. Без пробілів і спецсимволів.</div>

        <label style={labelStyle}>Пароль *</label>
        <input type="password" name="password" value={formData.password} onChange={handleChange} required placeholder="Denys123!" style={inputStyle} />
        <div style={hintStyle}>Мінімум 8 символів, 4 англійські букви, велика буква, цифра і спецсимвол.</div>

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
