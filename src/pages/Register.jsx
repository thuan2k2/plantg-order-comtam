import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../services/authService'; 

const Register = () => {
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    deliveryPhone: '',
    address: '',
    passcode: '' // Thêm trường passcode
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Kiểm tra dữ liệu đầu vào
    if (!formData.username || !formData.fullName || !formData.deliveryPhone || !formData.address || !formData.passcode) {
      alert('Vui lòng điền đầy đủ tất cả các thông tin!');
      return;
    }

    if (formData.passcode.length !== 6) {
      alert('Passcode phải bao gồm đúng 6 chữ số!');
      return;
    }

    setIsLoading(true);

    try {
      const result = await registerUser(formData);

      if (result.success) {
        setIsLoading(false);
        alert('Đăng ký tài khoản thành công! Mời bạn tiếp tục đặt hàng.');
        
        // Lưu lại SĐT và thông tin cơ bản vào bộ nhớ tạm của trình duyệt
        const currentPhones = JSON.parse(localStorage.getItem('recentPhones') || '[]');
        if (!currentPhones.includes(formData.username)) {
          localStorage.setItem('recentPhones', JSON.stringify([formData.username, ...currentPhones].slice(0, 3)));
        }
        localStorage.setItem('userProfile', JSON.stringify({
          fullName: formData.fullName,
          username: formData.username,
          address: formData.address
        }));

        navigate(`/order?user=${formData.username}`);
      } else {
        setIsLoading(false);
        alert(result.error || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Lỗi đăng ký:", error);
      alert('Lỗi kết nối máy chủ Firebase. Vui lòng kiểm tra lại mạng.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col p-4 md:items-center md:justify-center transition-colors duration-300 font-sans pb-20">
      
      {/* Nút quay lại */}
      <div className="w-full max-w-md mb-4">
        <button 
          onClick={() => navigate('/')} 
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Quay lại Trang chủ
        </button>
      </div>

      {/* Form Đăng Ký */}
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl dark:shadow-none border border-gray-100 dark:border-gray-700 transition-colors">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter">Tạo tài khoản mới</h1>
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Điền thông tin để đặt món nhanh hơn</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Username / SĐT Đăng nhập */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">
              Username (Số điện thoại) <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Ví dụ: 0901234567"
              className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500"
            />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 italic ml-1">Dùng số điện thoại để hệ thống ghi nhớ bạn.</p>
          </div>

          {/* Họ và Tên */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">
              Họ và tên người nhận <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Nhập tên của bạn"
              className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500"
            />
          </div>

          {/* SĐT Nhận Hàng */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">
              Số điện thoại nhận hàng <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="deliveryPhone"
              value={formData.deliveryPhone}
              onChange={handleChange}
              placeholder="Nhập SĐT người nhận"
              className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500"
            />
            <button 
              type="button"
              onClick={() => setFormData({...formData, deliveryPhone: formData.username})}
              className="text-[10px] font-black text-blue-500 dark:text-blue-400 mt-2 hover:underline uppercase tracking-widest ml-1"
            >
              Giống SĐT đăng nhập
            </button>
          </div>

          {/* Địa chỉ */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">
              Địa chỉ nhận hàng <span className="text-red-500">*</span>
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows="3"
              placeholder="Số nhà, Phân khu, Toà (Ví dụ: S1.01 Origami, Vinhomes)"
              className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500 resize-none"
            ></textarea>
          </div>

          {/* PASSCODE BẢO MẬT (THÊM MỚI) */}
          <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
            <label className="block text-[10px] font-black text-green-500 dark:text-green-400 uppercase tracking-widest mb-2 ml-1 mt-4">
              Thiết lập Passcode ví (6 số) <span className="text-red-500">*</span>
            </label>
            <input 
              type="password"
              name="passcode"
              maxLength="6"
              placeholder="••••••"
              value={formData.passcode}
              onChange={e => setFormData({...formData, passcode: e.target.value.replace(/\D/g,'')})} // Chỉ cho phép nhập số
              className="w-full p-4 bg-green-50 dark:bg-gray-700 dark:text-white rounded-2xl border-none outline-none font-black tracking-[0.5em] text-center text-xl focus:ring-2 focus:ring-green-500 transition-colors"
            />
            <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 mt-2 ml-1 italic leading-relaxed">
              * Lớp bảo mật cấp 2. Dùng để xác nhận khi thanh toán hóa đơn bằng tiền trong Ví Plant G. Hãy ghi nhớ mã này!
            </p>
          </div>

          {/* Nút Đăng ký */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full text-white font-black py-5 px-4 rounded-[2rem] transition-all duration-200 shadow-xl mt-6 uppercase text-xs tracking-[0.2em]
              ${isLoading ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100 dark:shadow-none active:scale-95'}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang xử lý...
              </span>
            ) : (
              'Hoàn tất đăng ký'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;