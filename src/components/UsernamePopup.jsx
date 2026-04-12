import React from 'react';
import { useNavigate } from 'react-router-dom';

const UsernamePopup = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  // Nếu state isOpen là false, không render gì cả
  if (!isOpen) return null;

  const handleHasUsername = () => {
    onClose();
    // Chuyển khách qua trang order. Trang này sẽ chịu trách nhiệm
    // hiển thị ô nhập username ở dòng đầu tiên như bạn yêu cầu.
    navigate('/order'); 
  };

  const handleNoUsername = () => {
    onClose();
    // Chuyển hướng thẳng sang trang đăng ký tài khoản mới
    navigate('/dangky');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-11/12 max-w-sm text-center">
        <h2 className="text-xl font-bold mb-3 text-gray-800">Xác nhận thông tin</h2>
        <p className="text-sm text-gray-600 mb-6">
          Để quá trình đặt hàng nhanh chóng hơn, vui lòng cho biết bạn đã có tài khoản chưa?
        </p>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={handleHasUsername}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            Tôi đã có username (SĐT)
          </button>
          
          <button 
            onClick={handleNoUsername}
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            Tôi chưa có username (SĐT)
          </button>
        </div>

        <button 
          onClick={onClose}
          className="mt-5 text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Đóng cửa sổ
        </button>
      </div>
    </div>
  );
};

export default UsernamePopup;