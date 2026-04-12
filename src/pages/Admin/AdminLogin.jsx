import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '../../services/authService';

const AdminLogin = () => {
  // Chuyển từ phone sang email để khớp với Firebase Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Đảm bảo nhập đầy đủ thông tin
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ Email và Mật khẩu!');
      setIsLoading(false);
      return;
    }

    // Gọi hàm loginAdmin đã được cập nhật với Firebase Auth SDK
    const result = await loginAdmin(email, password);
    
    if (result.success) {
      navigate('/admin');
    } else {
      // Hiển thị thông báo lỗi thân thiện từ Firebase
      setError(result.error);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo/Icon Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-900/40">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Plant G Admin</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Hệ thống quản trị an toàn</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white p-8 rounded-[2.5rem] shadow-2xl space-y-5">
          {error && (
            <div className="bg-red-50 text-red-500 text-[11px] font-black uppercase p-3 rounded-xl border border-red-100 text-center animate-shake">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Email Quản trị</label>
              <input
                type="email"
                placeholder="admin@plantg.id.vn"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Mật khẩu</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button 
              disabled={isLoading}
              className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl ${
                isLoading 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700 active:scale-95'
              }`}
            >
              {isLoading ? 'Đang xác thực...' : 'Vào hệ thống'}
            </button>
          </div>
        </form>

        <button 
          onClick={() => navigate('/')}
          className="w-full mt-8 text-gray-600 text-[10px] font-black uppercase tracking-widest hover:text-blue-500 transition-colors"
        >
          ← Quay về trang chủ khách hàng
        </button>
      </div>
    </div>
  );
};

export default AdminLogin;