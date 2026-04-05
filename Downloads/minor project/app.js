const CONFIG = {
  totalSeats: 60,
  zones: [
    { name: 'A', label: 'Zone A — Ground Floor', count: 20 },
    { name: 'B', label: 'Zone B — First Floor',  count: 20 },
    { name: 'C', label: 'Zone C — Reading Hall',  count: 20 },
  ],
  sessionKey: 'lst_student_session',
};

let seats = [];
let activityLog = [];

function initSeats() {
  seats = [];
  let id = 1;
  CONFIG.zones.forEach(zone => {
    for (let i = 1; i <= zone.count; i++) {
      seats.push({
        id: id++,
        label: zone.name + i,
        zone: zone.label,
        zonePrefix: zone.name,
        status: 'free',  // free | busy | booked
        lastUpdated: new Date(),
      });
    }
  });
}

function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const studentId = document.getElementById('studentId').value.trim();

  if (!studentId) {
    showToast('❌ Please enter your Student ID', 'error');
    return false;
  }

  btn.classList.add('loading');

  setTimeout(() => {
    localStorage.setItem(CONFIG.sessionKey, studentId);
    showToast('✅ Welcome, ' + studentId + '! Loading dashboard…', 'success');
    setTimeout(() => {
      showDashboard();
      btn.classList.remove('loading');
    }, 600);
  }, 800);

  return false;
}

function showDashboard() {
  const ws = document.getElementById('welcomeScreen');
  if (ws) ws.classList.add('hidden');
  const dash = document.getElementById('mainDashboard');
  if (dash) dash.classList.remove('hidden');
  
  if (seats.length === 0) initSeats();
  renderSeatMap();
  renderStats();
}

function renderDashboard() {
  // Specifically called by dashboard.html
  if (seats.length === 0) initSeats();
  renderSeatMap();
  renderStats();
}

function goBackToWelcome() {
  localStorage.removeItem(CONFIG.sessionKey);
  const dash = document.getElementById('mainDashboard');
  if (dash) dash.classList.add('hidden');
  const ws = document.getElementById('welcomeScreen');
  if (ws) ws.classList.remove('hidden');
  showToast('👋 See you next time!', 'info');
}

function logout() {
  localStorage.removeItem(CONFIG.sessionKey);
  window.location.href = 'index.html';
}

function checkSession() {
  if (localStorage.getItem(CONFIG.sessionKey)) {
    showDashboard();
  }
}

function renderSeatMap() {
  const mapContainer = document.getElementById('seatMap') || document.getElementById('seatGridContainer');
  if (!mapContainer) return;
  mapContainer.innerHTML = '';

  seats.forEach(seat => {
    const div = document.createElement('div');
    div.className = `seat ${seat.status}`;
    div.id = `seat-${seat.id}`;
    div.title = `${seat.label} — ${capitalize(seat.status)}`;
    div.innerHTML = `
      <span>${seat.label}</span>
      <span class="seat-label">${seat.status === 'free' ? '✓' : seat.status === 'busy' ? '●' : '◎'}</span>
    `;
    mapContainer.appendChild(div);
  });
}

function renderStats() {
  const counts = getCounts();
  // Update index.html
  animateNumber('availableSeats', counts.free);
  animateNumber('occupiedSeats', counts.busy);
  animateNumber('totalSeats', counts.total);

  // Update dashboard.html
  animateNumber('statAvailable', counts.free);
  animateNumber('statOccupied', counts.busy);
  animateNumber('statBooked', counts.booked);
  animateNumber('statTotal', counts.total);

  updateDonutChart(counts);
}

function updateDonutChart(counts) {
  const circAvail = document.getElementById('circleAvailable');
  if (!circAvail) return; // Only process if we are on dashboard.html
  
  const total = counts.total || 1;
  const pAvail = (counts.free / total) * 440;
  const pOcc = (counts.busy / total) * 440;
  const pBook = (counts.booked / total) * 440;

  // Set dasharrays explicitly
  circAvail.style.strokeDasharray = `${pAvail} 440`;
  circAvail.style.strokeDashoffset = `0`;

  const circOcc = document.getElementById('circleOccupied');
  circOcc.style.strokeDasharray = `${pOcc} 440`;
  circOcc.style.strokeDashoffset = `-${pAvail}`;

  const circBook = document.getElementById('circleBooked');
  circBook.style.strokeDasharray = `${pBook} 440`;
  circBook.style.strokeDashoffset = `-${pAvail + pOcc}`;

  const percentEl = document.getElementById('donutPercent');
  if (percentEl) {
    const percent = Math.round((counts.busy / total) * 100);
    percentEl.innerText = `${percent}%`;
  }
}

function getCounts() {
  const c = { total: seats.length, free: 0, busy: 0, booked: 0 };
  seats.forEach(s => { c[s.status]++; });
  return c;
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;

  const diff = target - current;
  const step = diff > 0 ? 1 : -1;
  let value = current;
  const interval = setInterval(() => {
    value += step;
    el.textContent = value;
    if (value === target) clearInterval(interval);
  }, 30);
}

function renderActivityLog() {
  const list = document.getElementById('activityList');
  if (!list) return;
  list.innerHTML = '';

  activityLog.slice(-15).reverse().forEach(entry => {
    const li = document.createElement('li');
    li.className = 'activity-item';
    const dotClass = entry.status === 'free' ? 'green' : entry.status === 'busy' ? 'red' : 'orange';
    const statusText = entry.status === 'free' ? 'Available' : entry.status === 'busy' ? 'Occupied' : 'Booked';

    li.innerHTML = `
      <span class="activity-dot ${dotClass}"></span>
      <div>
        <div class="activity-text">Seat <strong>${entry.seat}</strong> unmarked as ${statusText}</div>
        <div class="activity-time">${formatTime(entry.time)}</div>
      </div>
    `;
    list.appendChild(li);
  });
}

function refreshData() {
  const btn = document.getElementById('refreshBtn');
  if (btn) {
    btn.classList.add('spinning');
    setTimeout(() => btn.classList.remove('spinning'), 800);
  }
  showToast('🔄 Syncing with Firebase...', 'info');
}

// ---- Firebase Integration ----
function updateSeatFromFirebase(seatLabel, status) {
  const seat = seats.find(s => s.label === seatLabel);
  if (!seat) return;

  if (seat.status !== status) {
    seat.status = status;
    seat.lastUpdated = new Date();

    activityLog.push({ seat: seat.label, status, time: new Date() });

    const seatEl = document.getElementById(`seat-${seat.id}`);
    if (seatEl) {
      seatEl.className = `seat ${status}`;
      seatEl.title = `${seat.label} — ${capitalize(status)}`;
      seatEl.innerHTML = `
        <span>${seat.label}</span>
        <span class="seat-label">${status === 'free' ? '✓' : status === 'busy' ? '●' : '◎'}</span>
      `;
      seatEl.classList.add('flash');
      setTimeout(() => seatEl.classList.remove('flash'), 600);
    }

    renderStats();
    renderActivityLog();
  }
}

function connectToFirebase(firebaseConfig) {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const db = firebase.database();
  const seatsRef = db.ref('seats');

  const modeLabel = document.getElementById('modeLabel');
  if (modeLabel) modeLabel.textContent = 'FIREBASE LIVE';

  // Listen for realtime updates
  seatsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      // Loop through each seat key (e.g., 'A1', 'A2')
      for (const [seatLabel, seatData] of Object.entries(data)) {
        const status = (typeof seatData === 'string') ? seatData : seatData.status;
        
        let mappedStatus = status;
        if (status === 'occupied') mappedStatus = 'busy';
        if (status === 'available') mappedStatus = 'free';

        updateSeatFromFirebase(seatLabel, mappedStatus);
      }
    }
  }, (error) => {
    console.error('Firebase read failed:', error);
    showToast('❌ Firebase connection error', 'error');
  });
}

// ---- Toast Notifications ----
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// ---- Utilities ----
function formatTime(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  checkSession();

  const firebaseConfig = {
    apiKey: "58rZCsF1L6BfKrA02HO9f7U1mkaum4lkeLlH2ssUQjU",
    authDomain: "library-seat-occupancy-tracker.firebaseapp.com",
    databaseURL: "https://library-seat-occupancy-tracker-default-rtdb.firebaseio.com",
    projectId: "library-seat-occupancy-tracker",
    storageBucket: "library-seat-occupancy-tracker.appspot.com",
    messagingSenderId: "660542335886",
    appId: ""
  };
  
  if (seats.length === 0) initSeats(); // Ensure seats exist before binding firebase
  connectToFirebase(firebaseConfig);
});
