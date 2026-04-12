import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    deliveryPhone: '',
    address: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Kiểm tra dữ liệu cơ bản
    if (!formData.username || !formData.fullName || !formData.deliveryPhone || !formData.address) {
      alert('Vui lòng điền đầy đủ tất cả các thông tin!');
      return;
    }

    setIsLoading(true);

    // TODO: Tại đây sẽ gọi API lưu dữ liệu lên Firebase Firestore
    // Mô phỏng thời gian delay của mạng (1 giây)
    setTimeout(() => {
      setIsLoading(false);
      alert('Đăng ký tài khoản thành công! Mời bạn tiếp tục đặt hàng.');
      // Chuyển hướng sang trang đặt món và tự động điền username lên URL hoặc state
      navigate(`/order/${formData.username}`);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 md:items-center md:justify-center">
      
      {/* Nút quay lại */}
      <div className="w-full max-w-md mb-4">
        <button 
          onClick={() => navigate('/')} 
          className="text-gray-600 hover:text-gray-900 flex items-center gap-1 font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Quay lại Trang chủ
        </button>
      </div>

      {/* Form Đăng Ký */}
      <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800">Tạo tài khoản mới</h1>
          <p className="text-sm text-gray-500 mt-1">Điền thông tin để đặt món nhanh hơn cho những lần sau</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Username / SĐT Đăng nhập */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Username (Số điện thoại) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Ví dụ: 0901234567"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50/50"
            />
            <p className="text-[12px] text-gray-400 mt-1 italic">Sẽ được dùng để tự động nhận diện bạn lần sau.</p>
          </div>

          {/* Họ và Tên */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Họ và tên người nhận <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Nhập tên của bạn"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50/50"
            />
          </div>

          {/* SĐT Nhận Hàng */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Số điện thoại nhận hàng <span className="text-red-500">*</span>
            </label>
            <div className="flex">
              <input
                type="text"
                name="deliveryPhone"
                value={formData.deliveryPhone}
                onChange={handleChange}
                placeholder="Nhập SĐT người nhận"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50/50"
              />
            </div>
            {/* Nút copy nhanh nếu SĐT nhận giống SĐT đăng nhập */}
            <button 
              type="button"
              onClick={() => setFormData({...formData, deliveryPhone: formData.username})}
              className="text-[12px] text-blue-500 mt-1.5 hover:underline"
            >
              Giống Username (SĐT đăng nhập)
            </button>
          </div>

          {/* Địa chỉ */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Địa chỉ nhận hàng <span className="text-red-500">*</span>
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows="3"
              placeholder="Số nhà, Phân khu, Toà (Ví dụ: S1.01 Origami, Vinhomes)"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50/50 resize-none"
            ></textarea>
          </div>

          {/* Nút Đăng ký */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-sm mt-4 
              ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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