import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('entry'); 
  const [records, setRecords] = useState([]);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().substring(0, 7));
  const [schemeOptions, setSchemeOptions] = useState([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showPassModal, setShowPassModal] = useState(false);
  const [newPass, setNewPass] = useState('');

  const [loginData, setLoginData] = useState({ id: '', pass: '' });
  const [formData, setFormData] = useState({
    campDate: '', plvName: '', campSthan: '', campVishay: '',
    scheme: '', pratibhagi: '', labharthi: '',
    photo1: '', photo2: '', location: ''
  });

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWkF8qYH-3N4aQqCHNvgeH_r-nFATVIiWd_DVPYpDDa_a1qTxOW8isdJWviczWGfgyig/exec";

  // --- 1. Image Compression Logic ---
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Professional width for web
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // 70% quality (Best balance)
        };
      };
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await fetch(`${SCRIPT_URL}?action=login&id=${loginData.id}&pass=${loginData.pass}`);
      const result = await resp.text();
      
      if (result !== "fail") {
        setFormData(prev => ({ ...prev, plvName: result }));
        
        // AGAR PASSWORD 1111 HAI TO MODAL KHULEGA
        if (loginData.pass === "1111") {
          setShowPassModal(true);
        } else {
          setIsLoggedIn(true);
        }
      } else { 
        alert("Ghalat ID ya Password!"); 
      }
    } catch (err) { 
      console.error(err); 
      alert("Server error!"); 
    }
    setLoading(false);
  };

  const handlePasswordChange = async () => {
    if (newPass.length < 4 || newPass === "1111") {
      return alert("Naya password kam se kam 4 characters ka aur '1111' se alag hona chahiye!");
    }
    
    setLoading(true);
    try {
      const resp = await fetch(`${SCRIPT_URL}?action=updatePassword&id=${loginData.id}&newPass=${newPass}`);
      const status = await resp.text();
      
      if (status === "success") {
        alert("✅ Password badal gaya hai! Ab naye password se login karein.");
        setShowPassModal(false);
        setLoginData({ id: '', pass: '' }); // Reset login fields
        setNewPass('');
      } else {
        alert("❌ Password update fail ho gaya!");
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchRecords = useCallback(async () => {
    if (!isLoggedIn || view !== 'history') return;
    setLoading(true);
    try {
      const resp = await fetch(`${SCRIPT_URL}?action=getRecords&plvName=${formData.plvName}&month=${filterMonth}`);
      const data = await resp.json();
      setRecords(data);
    } catch (err) { console.error("Fetch Error:", err); }
    finally { setLoading(false); }
  }, [isLoggedIn, view, filterMonth, formData.plvName, SCRIPT_URL]);

  const fetchSettings = useCallback(async () => {
    try {
      const resp = await fetch(`${SCRIPT_URL}?action=getSettings`);
      const data = await resp.json();
      setSchemeOptions(data.schemes);
    } catch (err) { console.error("Settings load nahi hui:", err); }
  }, [SCRIPT_URL]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (isLoggedIn && view === 'history') { fetchRecords(); }
  }, [isLoggedIn, view, filterMonth, formData.plvName, fetchRecords]);

  // --- 2. Handlers with Compression ---
  const handleImg = async (e) => {
    const file = e.target.files[0];
    const { name } = e.target;
    if (file) {
      setLoading(true);
      const compressedData = await compressImage(file);
      setFormData(prev => ({ ...prev, [name]: compressedData }));
      setLoading(false);
    }
  };

  const openEditModal = (record) => {
    setEditingRecord({ ...record });
    setIsEditModalOpen(true);
  };

  const handleUpdateSave = async () => {
    setLoading(true);
    try {
      const updateData = {
        action: "update",
        row: editingRecord.row,
        campSthan: editingRecord.sthan,
        campVishay: editingRecord.vishay,
        scheme: editingRecord.scheme,
        photo1: editingRecord.newPhoto1 || null,
        photo2: editingRecord.newPhoto2 || null
      };
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(updateData)
      });
      alert("✅ Record successfully updated!");
      setIsEditModalOpen(false);
      fetchRecords();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const getGPS = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      // Correctly formatted GPS Link
      const link = `http://googleusercontent.com/maps.google.com/${pos.coords.latitude},${pos.coords.longitude}`;
      setFormData(prev => ({ ...prev, location: link }));
      alert("📍 Location Saved!");
    }, () => { alert("GPS permission den!"); });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. GPS Validation
    if (!formData.location) return alert("❌ Pehle GPS capture karein!");

    // 2. Photo Validation
    if (!formData.photo1 || !formData.photo2) {
      return alert("❌ Dono Photos upload karna zaroori hai!");
    }

    // --- 3. Date Validation (String Comparison - Super Stable) ---
    const selectedDateStr = formData.campDate; 
    
    const todayObj = new Date();
    const todayStr = todayObj.toISOString().split('T')[0]; 

    const sevenDaysAgoObj = new Date();
    sevenDaysAgoObj.setDate(todayObj.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgoObj.toISOString().split('T')[0];

    // Future Date Check
    if (selectedDateStr > todayStr) {
      return alert("❌ Aap future date ki entry nahi kar sakte!");
    }

    // 7-Day Back-date Check
    if (selectedDateStr < sevenDaysAgoStr) {
      return alert("❌ Error: Aap 7 din se zyada purani report submit nahi kar sakte.");
    }
    // -------------------------------------------------------------

    setLoading(true);
    try {
      await fetch(SCRIPT_URL, { 
        method: "POST", 
        mode: "no-cors", 
        body: JSON.stringify({...formData, action: "submit"}) 
      });
      alert("✅ Report Successfully Submitted!");
      
      // Form reset (plvName ko chhod kar sab khali)
      setFormData({ 
        ...formData, campDate: '', campSthan: '', campVishay: '', 
        scheme: '', pratibhagi: '', labharthi: '', 
        photo1: '', photo2: '', location: '' 
      });
    } catch (err) { 
      console.error("Submission error:", err);
      alert("❌ Submission failed!"); 
    }
    setLoading(false);
  };

  // ===================== LOGIN SCREEN & PASSWORD MODAL =====================
  if (!isLoggedIn) return (
    <div className="container">
      {loading && <div className="loading-overlay"><b>Processing...</b></div>}
      
      <div className="header"><h2>PLV Portal</h2></div>
      <div className="card">
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>User ID</label>
            <input type="text" value={loginData.id} required onChange={(e) => setLoginData({ ...loginData, id: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={loginData.pass} required onChange={(e) => setLoginData({ ...loginData, pass: e.target.value })} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Logging in... Please wait" : "Login"}
          </button>
        </form>
      </div>

      {/* MODAL YAHI HONA CHAHIYE TAARI LOGIN SCREEN PAR DIKHE */}
      {showPassModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 style={{color: 'var(--navy)', marginTop: '0'}}>🔐 Security Update</h3>
            <p style={{fontSize: '0.9rem', color: '#666', marginBottom: '15px'}}>
              Aap "1111" password use kar rahe hain. Kripya apna ek naya secret password banayein.
            </p>
            <div className="form-group">
              <label>Naya Password (New Password)</label>
              <input 
                type="password" 
                placeholder="Enter New Password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)} 
              />
            </div>
            <button className="btn btn-submit" onClick={handlePasswordChange} disabled={loading}>
              {loading ? "Updating..." : "Set New Password & Login"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ===================== MAIN DASHBOARD =====================
  return (
    <div className="container">
      {loading && <div className="loading-overlay"><b>Processing...</b></div>}
      
      <div className="header">
        <h3>{view === 'entry' ? 'Camp Entry' : 'My Records'}</h3>
        <div className="user-badge">User: {formData.plvName}</div>
        <div className="nav-tabs">
            <button onClick={() => setView('entry')} className={view === 'entry' ? 'active' : ''}>New Entry</button>
            <button onClick={() => setView('history')} className={view === 'history' ? 'active' : ''}>History</button>
            <button onClick={() => setIsLoggedIn(false)} className="logout-btn">Logout</button>
        </div>
      </div>

      {view === 'entry' ? (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label>Date</label><input type="date" value={formData.campDate} required onChange={(e) => setFormData({ ...formData, campDate: e.target.value })} /></div>
            <div className="form-group">
              <label>Scheme</label>
              <select value={formData.scheme} required onChange={(e) => setFormData({ ...formData, scheme: e.target.value })}>
                <option value="">-- Choose --</option>
                {schemeOptions.map((opt, index) => <option key={index} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="form-group"><label>स्‍थान:</label><input type="text" value={formData.campSthan} required onChange={(e) => setFormData({ ...formData, campSthan: e.target.value })} /></div>
            <div className="form-group"><label>शिवir ka vivran:</label><input type="text" value={formData.campVishay} required onChange={(e) => setFormData({ ...formData, campVishay: e.target.value })} /></div>
            
            <div className="grid">
              <div className="form-group"><label>Prt. Sankhya:</label><input type="number" value={formData.pratibhagi} required onChange={(e) => setFormData({...formData, pratibhagi: e.target.value})} /></div>
              <div className="form-group"><label>Labharthi:</label><input type="number" value={formData.labharthi} required onChange={(e) => setFormData({...formData, labharthi: e.target.value})} /></div>
            </div>

            <div className="form-group"><label>Photo 1</label><input type="file" name="photo1" accept="image/*" required onChange={handleImg} /></div>
            <div className="form-group"><label>Photo 2</label><input type="file" name="photo2" accept="image/*" required onChange={handleImg} /></div>
            
            <button type="button" className="btn btn-gps" onClick={getGPS}>📍 {formData.location ? "GPS Saved" : "Capture Location"}</button>
            <button className="btn btn-submit" type="submit" disabled={loading}>
              {loading ? "Submitting Report... ⏳" : "Submit Daily Report"}
            </button>
          </form>
        </div>
      ) : (
        <div className="history-section">
          <div className="filter-card">
            <label>Month Filter:</label>
            <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
          </div>

          {records.length === 0 ? <p style={{textAlign:'center', color:'#999'}}>No records found.</p> : (
            records.map((rec, i) => (
              <div className="record-card" key={i}>
                <p><b>Date:</b> {new Date(rec.date).toLocaleDateString()}</p>
                <div className="photo-slider">
                  {[rec.photo1, rec.photo2].map((p, idx) => p && (
                    <img key={idx} src={p} alt="Camp" className="dash-img" referrerPolicy="no-referrer" loading="lazy"
                         onClick={() => window.open(p.replace("uc?export=view&id=", "file/d/").concat("/view"), '_blank')}
                         onError={(e) => { e.target.onerror = null; e.target.src = p.replace("uc?export=view&id=", "thumbnail?id="); }} />
                  ))}
                </div>
                <div className="record-details">
                  <p><b>Sthan:</b> {rec.sthan}</p>
                  <p><b>Vishay:</b> {rec.vishay} ({rec.scheme})</p>
                </div>
                <div className="edit-area" style={{marginTop:'10px'}}>
                  {rec.status === 'm' ? (
                    <button className="edit-btn" onClick={() => openEditModal(rec)}>Sudharein (Edit)</button>
                  ) : ( <span className="locked-msg">🔒 Locked</span> )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* EDIT MODAL FOR RECORDS */}
      {isEditModalOpen && editingRecord && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h4>Edit Record</h4>
            <div className="form-group">
              <label>Scheme</label>
              <select value={editingRecord.scheme} onChange={(e) => setEditingRecord({...editingRecord, scheme: e.target.value})}>
                <option value="">-- Choose --</option>
                {schemeOptions.map((opt, index) => <option key={index} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Sthan</label>
              <input type="text" value={editingRecord.sthan} onChange={(e) => setEditingRecord({...editingRecord, sthan: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Vishay</label>
              <input type="text" value={editingRecord.vishay} onChange={(e) => setEditingRecord({...editingRecord, vishay: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Update Photo 1 (Optional)</label>
              <input type="file" accept="image/*" onChange={async (e) => {
                if(e.target.files[0]) {
                  setLoading(true);
                  const compressed = await compressImage(e.target.files[0]);
                  setEditingRecord({...editingRecord, newPhoto1: compressed});
                  setLoading(false);
                }
              }} />
            </div>
            <div className="form-group">
              <label>Update Photo 2 (Optional)</label>
              <input type="file" accept="image/*" onChange={async (e) => {
                if(e.target.files[0]) {
                  setLoading(true);
                  const compressed = await compressImage(e.target.files[0]);
                  setEditingRecord({...editingRecord, newPhoto2: compressed});
                  setLoading(false);
                }
              }} />
            </div>
            <div style={{display:'flex', gap:'10px'}}>
              <button className="btn btn-submit" onClick={handleUpdateSave}>Save</button>
              <button className="btn" style={{background:'#ccc'}} onClick={() => setIsEditModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;