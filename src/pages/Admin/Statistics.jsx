const Statistics = () => {
  const [allOrders, setAllOrders] = useState([]);
  const [filter, setFilter] = useState(''); // Tìm tên/SĐT
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    // Lắng nghe toàn bộ đơn hàng
    return subscribeToAllOrders(setAllOrders);
  }, []);

  const filteredData = allOrders.filter(o => 
    (o.customer.includes(filter) || o.phone.includes(filter)) &&
    (dateFilter === '' || o.time.includes(dateFilter))
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-4 bg-white p-4 rounded-2xl shadow-sm">
        <input 
          placeholder="Tìm tên hoặc SĐT..." 
          onChange={e => setFilter(e.target.value)}
          className="flex-1 border p-2 rounded-lg text-sm"
        />
        <input 
          type="date" 
          onChange={e => {
            const d = new Date(e.target.value).toLocaleDateString('vi-VN');
            setDateFilter(e.target.value ? d : '');
          }}
          className="border p-2 rounded-lg text-sm"
        />
      </div>
      {/* Render bảng hoặc danh sách từ filteredData tương tự trang Admin cũ */}
    </div>
  );
};