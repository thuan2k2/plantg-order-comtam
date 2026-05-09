import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';

const ManageDance = () => {
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // --- ĐÃ THÊM: State Quản lý Chỉnh sửa ---
  const [editingTrackId, setEditingTrackId] = useState(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState('');

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

  const [coverInputType, setCoverInputType] = useState('file'); 
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

  // --- ĐÃ THÊM: Xử lý khi nhấn nút Sửa ---
  const handleEdit = (track) => {
    setEditingTrackId(track.id);
    setOriginalAudioUrl(track.src);
    
    // Convert dữ liệu Beatmap Object trong Database trở lại thành Array để hiển thị lên UI
    const beatmapArray = [];
    if (track.beatmap) {
       const keys = Object.keys(track.beatmap).sort((a,b) => parseInt(a) - parseInt(b));
       keys.forEach(k => beatmapArray.push(track.beatmap[k]));
    }

    setFormData({
      title: track.title || '',
      artist: track.artist || '',
      bpm: track.bpm || '',
      difficulty: track.difficulty || 'Normal',
      genre: track.genre || 'Pop',
      requiredRank: track.requiredRank || '',
      beatmapJson: JSON.stringify(beatmapArray, null, 2)
    });
    
    setCoverInputType('url');
    setCoverUrlInput(track.cover || '');
    setAudioFile(null);
    setCoverFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Tự động cuộn lên đầu form
  };

  // --- ĐÃ THÊM: Xử lý khi Hủy Sửa ---
  const cancelEdit = () => {
    setEditingTrackId(null);
    setOriginalAudioUrl('');
    setFormData({ title: '', artist: '', bpm: '', difficulty: 'Normal', genre: 'Pop', requiredRank: '', beatmapJson: '' });
    setCoverInputType('file');
    setCoverUrlInput('');
    setAudioFile(null);
    setCoverFile(null);
    document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate cơ bản (Linh động hơn khi đang Edit)
    if (!formData.beatmapJson) {
      alert("Vui lòng nhập Beatmap JSON!");
      return;
    }
    if (!editingTrackId && !audioFile) {
      alert("Vui lòng chọn File Nhạc khi thêm mới!");
      return;
    }
    if (!editingTrackId && coverInputType === 'file' && !coverFile) {
      alert("Vui lòng chọn File ảnh bìa khi thêm mới!");
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

    const firestoreBeatmap = {};
    parsedBeatmap.forEach((measure, index) => {
        firestoreBeatmap[index.toString()] = measure;
    });

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Xử lý ảnh Cover (Ưu tiên File mới -> Link mới -> Link cũ)
      let finalCoverUrl = coverUrlInput; 
      if (coverInputType === 'file' && coverFile) {
        finalCoverUrl = await uploadFile(coverFile, 'au_covers');
      }
      
      // 2. Xử lý file Audio (Ưu tiên File mới -> Link cũ)
      let finalAudioUrl = originalAudioUrl;
      if (audioFile) {
        finalAudioUrl = await uploadFile(audioFile, 'au_audios');
      }

      // 3. Chuẩn bị Data
      const trackData = {
        title: formData.title,
        artist: formData.artist,
        bpm: Number(formData.bpm),
        difficulty: formData.difficulty,
        genre: formData.genre,
        requiredRank: formData.requiredRank || null,
        cover: finalCoverUrl, 
        src: finalAudioUrl,
        beatmap: firestoreBeatmap, 
      };

      // 4. Lưu vào Firestore (Thêm mới hoặc Cập nhật)
      if (editingTrackId) {
          await updateDoc(doc(db, 'au_tracks', editingTrackId), {
              ...trackData,
              updatedAt: serverTimestamp()
          });
          alert("🎉 Cập nhật bài nhạc thành công!");
      } else {
          await addDoc(collection(db, 'au_tracks'), {
              ...trackData,
              createdAt: serverTimestamp()
          });
          alert("🎉 Thêm bài nhạc thành công!");
      }
      
      // Reset form sau khi xong
      cancelEdit();
      fetchTracks();

    } catch (error) {
      console.error("Lỗi Upload:", error);
      alert("Đã xảy ra lỗi khi lưu nhạc!");
    }
    
    setIsUploading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa bài hát này khỏi hệ thống?")) {
      try {
        await deleteDoc(doc(db, 'au_tracks', id));
        if (editingTrackId === id) cancelEdit(); // Nếu đang sửa bài vừa bị xóa thì reset form
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
        
        {/* FORM THÊM / SỬA NHẠC */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 transition-all">
          <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-2">
              <h2 className={`text-lg font-bold ${editingTrackId ? 'text-pink-500' : ''}`}>
                  {editingTrackId ? '✏️ Chỉnh Sửa Bài Hát' : '➕ Thêm Bài Hát Mới'}
              </h2>
              {editingTrackId && (
                  <button onClick={cancelEdit} className="text-xs font-bold bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                      Hủy Sửa
                  </button>
              )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Tên bài hát</label>
                <input required name="title" value={formData.title} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none focus:border-blue-500 transition-colors" placeholder="VD: Sôi Động Vinhomes" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Nghệ sĩ / Ca sĩ</label>
                <input required name="artist" value={formData.artist} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none focus:border-blue-500 transition-colors" placeholder="VD: DJ Plant G" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">BPM (Tốc độ)</label>
                <input required type="number" name="bpm" value={formData.bpm} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none focus:border-blue-500 transition-colors" placeholder="120" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Độ Khó</label>
                <select name="difficulty" value={formData.difficulty} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none focus:border-blue-500 transition-colors">
                  <option value="Easy">Easy</option>
                  <option value="Normal">Normal</option>
                  <option value="Hard">Hard</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Thể loại</label>
                <input required name="genre" value={formData.genre} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none focus:border-blue-500 transition-colors" placeholder="VD: EDM, Lofi..." />
              </div>
            </div>

            <div>
               <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Yêu cầu Rank (Để trống nếu Free)</label>
               <select name="requiredRank" value={formData.requiredRank} onChange={handleInputChange} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none focus:border-blue-500 transition-colors">
                  <option value="">Không yêu cầu (Mọi người đều chơi được)</option>
                  <option value="CHALLENGER">CHALLENGER (Thách đấu VIP)</option>
               </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 rounded-xl text-center flex flex-col justify-center transition-colors hover:border-blue-500">
                 <label className="block text-xs font-bold uppercase mb-2 text-blue-500 cursor-pointer">
                     🎧 Chọn File Nhạc (.mp3) <br/>
                     {editingTrackId && <span className="text-[9px] text-gray-400 font-normal">(Bỏ qua nếu muốn giữ nguyên bản nhạc cũ)</span>}
                 </label>
                 <input type="file" accept="audio/mp3, audio/ogg" onChange={handleAudioChange} className="text-xs w-full overflow-hidden" />
              </div>
              
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 rounded-xl flex flex-col justify-center transition-colors hover:border-pink-500">
                 <div className="flex justify-center gap-2 mb-3">
                     <button type="button" onClick={() => setCoverInputType('file')} className={`text-xs font-bold px-2 py-1 rounded transition-all ${coverInputType === 'file' ? 'bg-pink-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>Tải từ máy</button>
                     <button type="button" onClick={() => setCoverInputType('url')} className={`text-xs font-bold px-2 py-1 rounded transition-all ${coverInputType === 'url' ? 'bg-pink-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>Dùng Link</button>
                 </div>
                 
                 {coverInputType === 'file' ? (
                     <>
                        <input type="file" accept="image/*" onChange={handleCoverChange} className="text-xs w-full overflow-hidden" />
                        {editingTrackId && <p className="text-[9px] text-gray-400 mt-2 text-center">(Bỏ qua nếu muốn giữ nguyên ảnh cũ)</p>}
                     </>
                 ) : (
                     <input required={coverInputType === 'url'} type="url" placeholder="Nhập link ảnh (https://...)" value={coverUrlInput} onChange={(e) => setCoverUrlInput(e.target.value)} className="text-xs w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1.5 rounded outline-none focus:border-pink-500 transition-colors" />
                 )}
              </div>
            </div>

            <div>
                <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Mã Beatmap (Dán JSON từ Beatmap Maker vào đây)</label>
                <textarea required name="beatmapJson" value={formData.beatmapJson} onChange={handleInputChange} rows="6" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 outline-none font-mono text-xs custom-scrollbar focus:border-blue-500 transition-colors" placeholder="[ { 'display': 'UP', ... } ]"></textarea>
            </div>

            <div className="flex gap-4">
                <button disabled={isUploading} type="submit" className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-white transition-all ${isUploading ? 'bg-gray-500 cursor-not-allowed' : editingTrackId ? 'bg-pink-600 hover:bg-pink-500 shadow-lg shadow-pink-500/30' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/30'}`}>
                  {isUploading ? `Đang tải lên... ${Math.floor(uploadProgress)}%` : editingTrackId ? 'Cập Nhật Bản Nhạc' : 'Lưu Bản Nhạc Lên Hệ Thống'}
                </button>
                {editingTrackId && (
                    <button type="button" onClick={cancelEdit} disabled={isUploading} className="px-8 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-xl font-black uppercase text-gray-600 dark:text-gray-300 transition-all">
                        Hủy
                    </button>
                )}
            </div>
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
                <div key={track.id} className={`flex items-center gap-4 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border transition-all ${editingTrackId === track.id ? 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.1)]' : 'border-gray-100 dark:border-gray-700'}`}>
                  <img src={track.cover} alt="cover" className="w-12 h-12 rounded-lg object-cover" />
                  <div className="flex-1 overflow-hidden">
                    <h3 className={`font-bold truncate text-sm ${editingTrackId === track.id ? 'text-pink-500' : ''}`}>{track.title} {track.requiredRank && '👑'}</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest truncate">{track.artist} • {track.bpm} BPM</p>
                  </div>
                  <div className="text-[10px] font-bold px-2 py-1 rounded bg-gray-200 dark:bg-gray-800">{track.difficulty}</div>
                  
                  {/* CỤM NÚT SỬA / XÓA */}
                  <div className="flex gap-2">
                      <button onClick={() => handleEdit(track)} className="bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white p-2 rounded-lg transition-colors" title="Chỉnh sửa">
                         ✏️
                      </button>
                      <button onClick={() => handleDelete(track.id)} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors" title="Xóa">
                         🗑️
                      </button>
                  </div>
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