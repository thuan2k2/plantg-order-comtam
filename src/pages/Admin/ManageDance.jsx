import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';

const ManageDance = () => {
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    bpm: '',
    difficulty: 'Normal',
    genre: 'Pop',
    requiredRank: '',
    beatmapJson: ''
  });
  const [audioFile, setAudioFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // --- ĐÃ THÊM: State hỗ trợ 2 kiểu nhập Cover ---
  const [coverInputType, setCoverInputType] = useState('file'); // 'file' hoặc 'url'
  const [coverFile, setCoverFile] = useState(null);
  const [coverUrlInput, setCoverUrlInput] = useState('');

  // Lấy danh sách nhạc hiện có
  const fetchTracks = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'au_tracks'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTracks(list);
    } catch (error) {
      console.error("Lỗi lấy danh sách nhạc:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAudioChange = (e) => {
    if (e.target.files[0]) setAudioFile(e.target.files[0]);
  };

  const handleCoverChange = (e) => {
    if (e.target.files[0]) setCoverFile(e.target.files[0]);
  };

  // Upload file lên Firebase Storage
  const uploadFile = async (file, folderPath) => {
    return new Promise((resolve, reject) => {
      const fileRef = ref(storage, `${folderPath}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => reject(error),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate cơ bản
    if (!audioFile || !formData.beatmapJson) {
      alert("Vui lòng chọn File Nhạc và nhập Beatmap JSON!");
      return;
    }

    // Validate riêng cho Cover
    if (coverInputType === 'file' && !coverFile) {
      alert("Vui lòng chọn File ảnh bìa!");
      return;
    }
    if (coverInputType === 'url' && !coverUrlInput) {
      alert("Vui lòng nhập Link ảnh bìa!");
      return;
    }

    let parsedBeatmap = [];
    try {
      parsedBeatmap = JSON.parse(formData.beatmapJson);
      if (!Array.isArray(parsedBeatmap)) throw new Error("Beatmap phải là một mảng (Array)");
    } catch (err) {
      alert("Lỗi cú pháp JSON Beatmap: " + err.message);
      return;
    }

    // Chuyển mảng 2 chiều [ [phím], [phím] ] thành Object { "0": [phím], "1": [phím] }
    const firestoreBeatmap = {};
    parsedBeatmap.forEach((measure, index) => {
        firestoreBeatmap[index.toString()] = measure;
    });

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Xử lý ảnh Cover (Tải lên file HOẶC dùng link trực tiếp)
      let finalCoverUrl = '';
      if (coverInputType === 'file') {
        finalCoverUrl = await uploadFile(coverFile, 'au_covers');
      } else {
        finalCoverUrl = coverUrlInput;
      }
      
      // 2. Upload file audio
      const audioUrl = await uploadFile(audioFile, 'au_audios');

      // 3. Lưu thông tin vào Firestore
      const trackData = {
        title: formData.title,
        artist: formData.artist,
        bpm: Number(formData.bpm),
        difficulty: formData.difficulty,
        genre: formData.genre,
        requiredRank: formData.requiredRank || null,
        cover: finalCoverUrl, // Dùng biến cover cuối cùng đã xử lý
        src: audioUrl,
        beatmap: firestoreBeatmap, 
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'au_tracks'), trackData);

      alert("🎉 Thêm bài nhạc thành công!");
      
      // Reset form
      setFormData({ title: '', artist: '', bpm: '', difficulty: 'Normal', genre: 'Pop', requiredRank: '', beatmapJson: '' });
      setAudioFile(null);
      setCoverFile(null);
      setCoverUrlInput('');
      
      document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');

      fetchTracks();

    } catch (error) {
      console.error("Lỗi Upload:", error);
      alert("Đã xảy ra lỗi khi thêm nhạc!");
    }
    
    setIsUploading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa bài hát này khỏi hệ thống?")) {
      try {
        await deleteDoc(doc(db, 'au_tracks', id));
        fetchTracks();
      } catch (error) {
        console.error("Lỗi xóa bài hát:", error);
      }
    }
  };

  return (
    <div className="p-6 text-gray-800 dark:text-white">
      <h1 className="text-3xl font-black mb-8 uppercase text-blue-600 dark:text-blue-400">🎵 Quản lý Nhạc (Au Plant G)</h1>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* FORM THÊM NHẠC MỚI */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold mb-6 border-b dark:border-gray-700 pb-2">➕ Thêm Bài Hát Mới</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Tên bài hát</label>
                <input required name="title" value={formData.title} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none" placeholder="VD: Sôi Động Vinhomes" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Nghệ sĩ / Ca sĩ</label>
                <input required name="artist" value={formData.artist} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none" placeholder="VD: DJ Plant G" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">BPM (Tốc độ)</label>
                <input required type="number" name="bpm" value={formData.bpm} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none" placeholder="120" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Độ Khó</label>
                <select name="difficulty" value={formData.difficulty} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none">
                  <option value="Easy">Easy</option>
                  <option value="Normal">Normal</option>
                  <option value="Hard">Hard</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Thể loại</label>
                <input required name="genre" value={formData.genre} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none" placeholder="VD: EDM, Lofi..." />
              </div>
            </div>

            <div>
               <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Yêu cầu Rank (Để trống nếu Free)</label>
               <select name="requiredRank" value={formData.requiredRank} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none">
                  <option value="">Không yêu cầu (Mọi người đều chơi được)</option>
                  <option value="CHALLENGER">CHALLENGER (Thách đấu VIP)</option>
               </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 rounded-xl text-center flex flex-col justify-center">
                 <label className="block text-xs font-bold uppercase mb-2 text-blue-500 cursor-pointer">🎧 Chọn File Nhạc (.mp3, .ogg)</label>
                 <input required type="file" accept="audio/mp3, audio/ogg" onChange={handleAudioChange} className="text-xs w-full overflow-hidden" />
              </div>
              
              {/* ĐÃ THÊM: Khu vực Chọn Ảnh Bìa tích hợp 2 chế độ */}
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 rounded-xl flex flex-col justify-center">
                 <div className="flex justify-center gap-2 mb-3">
                     <button type="button" onClick={() => setCoverInputType('file')} className={`text-xs font-bold px-2 py-1 rounded transition-all ${coverInputType === 'file' ? 'bg-pink-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>Tải từ máy</button>
                     <button type="button" onClick={() => setCoverInputType('url')} className={`text-xs font-bold px-2 py-1 rounded transition-all ${coverInputType === 'url' ? 'bg-pink-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>Dùng Link</button>
                 </div>
                 
                 {coverInputType === 'file' ? (
                     <input required={coverInputType === 'file'} type="file" accept="image/*" onChange={handleCoverChange} className="text-xs w-full overflow-hidden" />
                 ) : (
                     <input required={coverInputType === 'url'} type="url" placeholder="Nhập link ảnh (https://...)" value={coverUrlInput} onChange={(e) => setCoverUrlInput(e.target.value)} className="text-xs w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1.5 rounded outline-none" />
                 )}
              </div>
            </div>

            <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Mã Beatmap (Dán JSON từ Beatmap Maker vào đây)</label>
                <textarea required name="beatmapJson" value={formData.beatmapJson} onChange={handleInputChange} rows="6" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none font-mono text-xs custom-scrollbar" placeholder="[ { 'display': 'UP', ... } ]"></textarea>
            </div>

            <button disabled={isUploading} type="submit" className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-white transition-all ${isUploading ? 'bg-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-lg'}`}>
              {isUploading ? `Đang tải lên... ${Math.floor(uploadProgress)}%` : 'Lưu Bản Nhạc Lên Hệ Thống'}
            </button>
          </form>
        </div>

        {/* DANH SÁCH BÀI NHẠC */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 h-fit max-h-[85vh] flex flex-col">
          <h2 className="text-lg font-bold mb-6 border-b dark:border-gray-700 pb-2">📋 Danh sách Bài hát ({tracks.length})</h2>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
            {isLoading ? (
              <p className="text-center text-gray-500 italic">Đang tải dữ liệu...</p>
            ) : tracks.length === 0 ? (
              <p className="text-center text-gray-500 italic">Chưa có bài hát nào trên hệ thống.</p>
            ) : (
              tracks.map(track => (
                <div key={track.id} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                  <img src={track.cover} alt="cover" className="w-12 h-12 rounded-lg object-cover" />
                  <div className="flex-1 overflow-hidden">
                    <h3 className="font-bold truncate text-sm">{track.title} {track.requiredRank && '👑'}</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest truncate">{track.artist} • {track.bpm} BPM</p>
                  </div>
                  <div className="text-[10px] font-bold px-2 py-1 rounded bg-gray-200 dark:bg-gray-800">{track.difficulty}</div>
                  <button onClick={() => handleDelete(track.id)} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors" title="Xóa">
                     🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ManageDance;