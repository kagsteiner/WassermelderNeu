// Wassermelder Frontend Application
(function() {
    'use strict';

    // DOM Elements
    const elements = {
        loginScreen: document.getElementById('login-screen'),
        dashboard: document.getElementById('dashboard'),
        loginForm: document.getElementById('login-form'),
        passwordInput: document.getElementById('password-input'),
        loginError: document.getElementById('login-error'),
        logoutBtn: document.getElementById('logout-btn'),
        captureBtn: document.getElementById('capture-btn'),
        photoInput: document.getElementById('photo-input'),
        cameraModal: document.getElementById('camera-modal'),
        cameraVideo: document.getElementById('camera-video'),
        cameraCanvas: document.getElementById('camera-canvas'),
        cameraPreview: document.getElementById('camera-preview'),
        capturedPreview: document.getElementById('captured-preview'),
        capturedImage: document.getElementById('captured-image'),
        analysisResult: document.getElementById('analysis-result'),
        detectedValue: document.getElementById('detected-value'),
        analysisConfidence: document.getElementById('analysis-confidence'),
        snapBtn: document.getElementById('snap-btn'),
        retakeBtn: document.getElementById('retake-btn'),
        analyzeBtn: document.getElementById('analyze-btn'),
        saveBtn: document.getElementById('save-btn'),
        loadingOverlay: document.getElementById('loading-overlay'),
        loadingText: document.getElementById('loading-text'),
        toastContainer: document.getElementById('toast-container'),
        lastIntervalContent: document.getElementById('last-interval-content'),
        yearStatsContent: document.getElementById('year-stats-content'),
        monthlyHeaders: document.getElementById('monthly-headers'),
        monthlyValues: document.getElementById('monthly-values'),
        historyList: document.getElementById('history-list')
    };

    // State
    let state = {
        authenticated: false,
        readings: [],
        stats: null,
        chart: null,
        mediaStream: null,
        capturedBlob: null,
        analysisData: null
    };

    // ===== API Functions =====
    async function api(endpoint, options = {}) {
        const headers = { ...options.headers };
        
        // Only set Content-Type for non-FormData bodies
        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        
        const response = await fetch(endpoint, {
            ...options,
            headers,
            credentials: 'same-origin' // Include cookies for session auth
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    }

    // ===== Auth Functions =====
    async function checkAuth() {
        try {
            const { authenticated } = await api('/api/auth/status');
            state.authenticated = authenticated;
            
            if (authenticated) {
                showDashboard();
                loadData();
            } else {
                showLogin();
            }
        } catch (error) {
            showLogin();
        }
    }

    async function login(password) {
        try {
            await api('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ password })
            });
            
            state.authenticated = true;
            showDashboard();
            loadData();
        } catch (error) {
            elements.loginError.classList.remove('hidden');
            elements.passwordInput.focus();
        }
    }

    async function logout() {
        try {
            await api('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            // Ignore
        }
        
        state.authenticated = false;
        state.readings = [];
        state.stats = null;
        showLogin();
    }

    function showLogin() {
        elements.loginScreen.classList.remove('hidden');
        elements.dashboard.classList.add('hidden');
        elements.passwordInput.value = '';
        elements.loginError.classList.add('hidden');
        elements.passwordInput.focus();
    }

    function showDashboard() {
        elements.loginScreen.classList.add('hidden');
        elements.dashboard.classList.remove('hidden');
    }

    // ===== Data Functions =====
    async function loadData() {
        try {
            const data = await api('/api/data');
            state.readings = data.readings;
            state.stats = data.stats;
            renderDashboard();
        } catch (error) {
            showToast('Failed to load data: ' + error.message, 'error');
        }
    }

    function renderDashboard() {
        renderLastInterval();
        renderYearStats();
        renderMonthlyTable();
        renderWeeklyChart();
        renderHistory();
    }

    function renderLastInterval() {
        const { lastInterval } = state.stats || {};
        
        if (!lastInterval) {
            elements.lastIntervalContent.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>
                    <p>Take at least 2 readings to see interval data</p>
                </div>
            `;
            return;
        }

        elements.lastIntervalContent.innerHTML = `
            <div class="stat-main">
                <span class="stat-value">${lastInterval.litersPerDay.toFixed(1)}</span>
                <span class="stat-unit">L/day</span>
            </div>
            <div class="stat-detail">
                <span class="stat-detail-label">Duration</span>
                <span class="stat-detail-value">${lastInterval.days.toFixed(1)} days</span>
            </div>
            <div class="stat-detail">
                <span class="stat-detail-label">Total</span>
                <span class="stat-detail-value">${lastInterval.liters.toFixed(1)} L</span>
            </div>
            <div class="stat-period">
                ${formatDate(lastInterval.startDate)} → ${formatDate(lastInterval.endDate)}
            </div>
        `;
    }

    function renderYearStats() {
        const { yearStats } = state.stats || {};
        
        if (!yearStats) {
            elements.yearStatsContent.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <p>Take readings this year to see statistics</p>
                </div>
            `;
            return;
        }

        elements.yearStatsContent.innerHTML = `
            <div class="stat-main">
                <span class="stat-value">${yearStats.avgLitersPerDay.toFixed(1)}</span>
                <span class="stat-unit">L/day avg</span>
            </div>
            <div class="stat-detail">
                <span class="stat-detail-label">Total Consumption</span>
                <span class="stat-detail-value">${formatNumber(yearStats.totalLiters)} L</span>
            </div>
            <div class="stat-detail">
                <span class="stat-detail-label">Tracking Period</span>
                <span class="stat-detail-value">${yearStats.days} days</span>
            </div>
        `;
    }

    function renderMonthlyTable() {
        const { monthlyData } = state.stats || {};
        
        if (!monthlyData || monthlyData.length === 0) {
            elements.monthlyHeaders.innerHTML = '<th>No data</th>';
            elements.monthlyValues.innerHTML = '<td class="no-data">—</td>';
            return;
        }

        elements.monthlyHeaders.innerHTML = monthlyData
            .map(m => `<th>${m.month}</th>`)
            .join('');

        elements.monthlyValues.innerHTML = monthlyData
            .map(m => m.litersPerDay !== null 
                ? `<td>${m.litersPerDay.toFixed(1)}</td>` 
                : `<td class="no-data">—</td>`)
            .join('');
    }

    function renderWeeklyChart() {
        const { weeklyData } = state.stats || {};
        
        if (!weeklyData || weeklyData.length === 0) {
            return;
        }

        const ctx = document.getElementById('weekly-chart').getContext('2d');
        
        // Destroy existing chart
        if (state.chart) {
            state.chart.destroy();
        }

        const labels = weeklyData.map(w => w.week);
        const data = weeklyData.map(w => w.litersPerDay);

        state.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'L/day',
                    data: data,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 3,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e1e21',
                        titleColor: '#f4f4f5',
                        bodyColor: '#a1a1aa',
                        borderColor: '#2a2a2e',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return context.raw !== null ? `${context.raw.toFixed(1)} L/day` : 'No data';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#71717a',
                            font: {
                                family: "'Outfit', sans-serif",
                                size: 10
                            },
                            maxRotation: 45,
                            minRotation: 45,
                            maxTicksLimit: 12
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#1f1f22'
                        },
                        ticks: {
                            color: '#71717a',
                            font: {
                                family: "'Outfit', sans-serif",
                                size: 11
                            },
                            callback: function(value) {
                                return value + ' L';
                            }
                        }
                    }
                }
            }
        });
    }

    function renderHistory() {
        if (!state.readings || state.readings.length === 0) {
            elements.historyList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <p>No readings yet. Take your first photo!</p>
                </div>
            `;
            return;
        }

        const sorted = [...state.readings].sort((a, b) => new Date(b.date) - new Date(a.date));

        elements.historyList.innerHTML = sorted.map(reading => `
            <div class="history-item" data-id="${reading.id}">
                <div class="history-info">
                    <span class="history-date">${formatDate(reading.date)}</span>
                    <span class="history-value">${reading.value.toFixed(3)} m³</span>
                    <span class="history-confidence ${reading.confidence || ''}">${reading.confidence || 'N/A'}</span>
                </div>
                <button class="history-delete" onclick="deleteReading('${reading.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    // ===== Camera Functions =====
    async function openCamera() {
        elements.cameraModal.classList.remove('hidden');
        resetCameraModal();
        
        try {
            state.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            
            elements.cameraVideo.srcObject = state.mediaStream;
        } catch (error) {
            // If camera fails, use file input instead
            console.log('Camera not available, using file picker');
            closeCamera();
            elements.photoInput.click();
        }
    }

    function closeCamera() {
        elements.cameraModal.classList.add('hidden');
        
        if (state.mediaStream) {
            state.mediaStream.getTracks().forEach(track => track.stop());
            state.mediaStream = null;
        }
        
        elements.cameraVideo.srcObject = null;
        state.capturedBlob = null;
        state.analysisData = null;
    }

    function resetCameraModal() {
        elements.cameraPreview.classList.remove('hidden');
        elements.capturedPreview.classList.add('hidden');
        elements.analysisResult.classList.add('hidden');
        elements.snapBtn.classList.remove('hidden');
        elements.retakeBtn.classList.add('hidden');
        elements.analyzeBtn.classList.add('hidden');
        elements.saveBtn.classList.add('hidden');
        state.capturedBlob = null;
        state.analysisData = null;
    }

    function capturePhoto() {
        const video = elements.cameraVideo;
        const canvas = elements.cameraCanvas;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        canvas.toBlob(blob => {
            state.capturedBlob = blob;
            elements.capturedImage.src = URL.createObjectURL(blob);
            
            elements.cameraPreview.classList.add('hidden');
            elements.capturedPreview.classList.remove('hidden');
            elements.snapBtn.classList.add('hidden');
            elements.retakeBtn.classList.remove('hidden');
            elements.analyzeBtn.classList.remove('hidden');
            
            // Stop camera stream
            if (state.mediaStream) {
                state.mediaStream.getTracks().forEach(track => track.stop());
                state.mediaStream = null;
            }
        }, 'image/jpeg', 0.9);
    }

    async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        state.capturedBlob = file;
        
        // Show modal with captured image
        elements.cameraModal.classList.remove('hidden');
        elements.cameraPreview.classList.add('hidden');
        elements.capturedPreview.classList.remove('hidden');
        elements.capturedImage.src = URL.createObjectURL(file);
        elements.snapBtn.classList.add('hidden');
        elements.retakeBtn.classList.remove('hidden');
        elements.analyzeBtn.classList.remove('hidden');
        elements.analysisResult.classList.add('hidden');
        elements.saveBtn.classList.add('hidden');
        
        // Reset file input
        event.target.value = '';
    }

    async function analyzePhoto() {
        if (!state.capturedBlob) return;

        showLoading('Analyzing water meter...');
        
        try {
            const formData = new FormData();
            formData.append('photo', state.capturedBlob, 'photo.jpg');

            const response = await fetch('/api/reading', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin' // Include cookies for session auth
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Analysis failed');
            }

            state.analysisData = result.reading;
            
            // Update UI
            elements.detectedValue.textContent = result.reading.value.toFixed(3);
            elements.analysisConfidence.textContent = `Confidence: ${result.reading.confidence}`;
            if (result.reading.notes) {
                elements.analysisConfidence.textContent += ` • ${result.reading.notes}`;
            }
            
            elements.analysisResult.classList.remove('hidden');
            elements.analyzeBtn.classList.add('hidden');
            elements.saveBtn.classList.add('hidden'); // Already saved
            
            // Reload data to show new reading
            await loadData();
            
            showToast('Reading saved successfully!', 'success');
            
            // Close modal after delay
            setTimeout(() => {
                closeCamera();
            }, 2000);

        } catch (error) {
            showToast('Analysis failed: ' + error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // ===== Delete Reading =====
    window.deleteReading = async function(id) {
        if (!confirm('Delete this reading?')) return;
        
        try {
            await api(`/api/reading/${id}`, { method: 'DELETE' });
            await loadData();
            showToast('Reading deleted', 'success');
        } catch (error) {
            showToast('Delete failed: ' + error.message, 'error');
        }
    };

    // ===== Utilities =====
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('de-DE', { 
            day: '2-digit', 
            month: '2-digit', 
            year: '2-digit'
        });
    }

    function formatNumber(num) {
        return num.toLocaleString('de-DE');
    }

    function showLoading(text = 'Processing...') {
        elements.loadingText.textContent = text;
        elements.loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        elements.loadingOverlay.classList.add('hidden');
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' 
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;
        
        elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ===== Event Listeners =====
    elements.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        login(elements.passwordInput.value);
    });

    elements.logoutBtn.addEventListener('click', logout);

    elements.captureBtn.addEventListener('click', openCamera);
    
    elements.photoInput.addEventListener('change', handleFileSelect);

    elements.cameraModal.querySelector('.modal-backdrop').addEventListener('click', closeCamera);
    elements.cameraModal.querySelector('.modal-close').addEventListener('click', closeCamera);

    elements.snapBtn.addEventListener('click', capturePhoto);
    
    elements.retakeBtn.addEventListener('click', () => {
        resetCameraModal();
        openCamera();
    });

    elements.analyzeBtn.addEventListener('click', analyzePhoto);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCamera();
        }
    });

    // ===== Initialize =====
    checkAuth();
})();
