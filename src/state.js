// src/state.js

function formatTime(minutes) {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}h ${m}m`;
}

// Safely convert Firebase sparse objects back to true arrays
function toArray(data, length, defaultVal) {
    if (Array.isArray(data)) return data;
    if (typeof data === "object" && data !== null) {
        const arr = Array(length).fill(defaultVal);
        for (let key in data) {
            if (!isNaN(key) && key < length) {
                arr[parseInt(key)] = data[key];
            }
        }
        return arr;
    }
    return Array(length).fill(defaultVal);
}

export const DeviceStore = {
    activeDeviceId: null,
    devices: {},

    init() {
        try {
            const storedData = localStorage.getItem("aquasync_ecosystem");
            if (storedData) {
                this.devices = JSON.parse(storedData);
                for (let hwid in this.devices) {
                    let dev = this.devices[hwid];
                    if (!dev.companion) dev.companion = { current: "v1.0.0", latest: "Checking...", downloadUrl: "" };
                    if (!dev.firmware) dev.firmware = { current: "v1.0.0", latest: "Checking...", downloadUrl: "" };
                }
            }
        } catch (error) {
            console.error("Failed to parse device store", error);
            this.devices = {};
        }

        const activeId = localStorage.getItem("aquasync_active_hwid");
        if (activeId && this.devices[activeId]) {
            this.activeDeviceId = activeId;
        } else if (Object.keys(this.devices).length > 0) {
            this.activeDeviceId = Object.keys(this.devices)[0];
        }
    },

    async syncFromCloud(uid) {
        if (!uid) return;
        
        console.log("☁️ Fetching devices from cloud for:", uid);
        const userDevicesRef = ref(db, `users/${uid}/devices`);
        
        try {
            const snapshot = await get(userDevicesRef);
            if (snapshot.exists()) {
                const cloudDevices = snapshot.val();
                // Merge cloud devices into local storage
                this.devices = { ...this.devices, ...cloudDevices };
                this.save();
                console.log("✅ Cloud devices synced:", Object.keys(cloudDevices));
                // Reload UI to show the dashboard
                window.location.reload();
            }
        } catch (e) {
            console.error("Failed to sync devices from cloud", e);
        }
    },

    addDevice(hwid, model, name) {
        if (!this.devices[hwid]) {
            this.devices[hwid] = {
                hwid: hwid,
                model: model,
                name: name,
                localIP: null,
                network: { isWiFiConnected: false, ssid: "" },
                metrics: {
                    isAutoMode: true,
                    isLightOn: false,
                    isCO2On: false,
                    isFanOn: false,
                    isFanEnabled: false,
                    currentBrightness: 0,
                    startTime: "12:00",
                    photoperiod: 8,
                    maxBrightness: 100,
                    isDimmerEnabled: false,
                    sunriseMins: 30,
                    sunsetMins: 30,
                    isCO2ScheduleSeparate: false,
                    co2OnTime: "11:00",
                    co2OffTime: "20:00",
                    recoveryMins: 15,
                    fanOnTime: "12:00",
                    fanOffTime: "20:00",
                    fanSpeed: 50,
                    colorW: 100, colorR: 100, colorG: 100, colorB: 100
                },
                capabilities: { hasLight: true, hasCO2: true, hasFan: true, hasColorSpectrum: true },
                analyticsData: {
                    today: { totalActive: "00h 00m", loadShedding: "00h 00m", hourlyGraph: Array(24).fill(0), awakeData: Array(24).fill(0) },
                    week: { totalActive: "00h 00m", avgLight: "00h 00m", loadShedding: "00h 00m", dailyGraph: Array(7).fill(0) },
                    month: { totalActive: "00h 00m", avgLight: "00h 00m", loadShedding: "00h 00m", dailyGraph: Array(30).fill(0) }
                },
                companion: { current: "v1.0.0", latest: "Checking...", downloadUrl: "" },
                firmware: { current: "v1.0.0", latest: "Checking...", downloadUrl: "" }
            };
        } else {
            this.devices[hwid].name = name;
        }
        
        this.activeDeviceId = hwid;
        this.save();
    },

    removeDevice(hwid) {
        if (this.devices[hwid]) {
            delete this.devices[hwid];
            if (this.activeDeviceId === hwid) {
                const keys = Object.keys(this.devices);
                this.activeDeviceId = keys.length > 0 ? keys[0] : null;
            }
            this.save();
        }
    },

    setActiveDevice(hwid) {
        if (this.devices[hwid]) {
            this.activeDeviceId = hwid;
            this.save();
        }
    },

    updateNetwork(hwid, ip, isConnected) {
        if (!this.devices[hwid]) return;
        if (ip !== null) this.devices[hwid].localIP = ip;
        this.devices[hwid].network.isWiFiConnected = isConnected;
        this.save();
    },

    updateDeviceState(hwid, newMetrics, newCapabilities) {
        if (!this.devices[hwid]) return;

        if (newMetrics) {
            this.devices[hwid].metrics = { ...this.devices[hwid].metrics, ...newMetrics };

            if (newMetrics.hourlyData || newMetrics.dailyData) {
                const h = toArray(newMetrics.hourlyData, 24, 0);
                const d = toArray(newMetrics.dailyData, 30, 0);
                const awake = toArray(newMetrics.awakeData, 24, 1);

                let sumOfFirebaseHours = 0;
                for (let i = 0; i < 24; i++) {
                    if (h[i] > 60) h[i] = 60;
                    sumOfFirebaseHours += h[i];
                }

                let todayTotal = sumOfFirebaseHours;
                const currentHour = new Date().getHours();

                if (newMetrics.liveActiveMins !== undefined && newMetrics.liveActiveMins > sumOfFirebaseHours) {
                    const unpushedMinutes = newMetrics.liveActiveMins - sumOfFirebaseHours;
                    h[currentHour] += unpushedMinutes;
                    if (h[currentHour] > 60) h[currentHour] = 60; 
                    todayTotal = newMetrics.liveActiveMins;
                }

                d[0] = Math.max(d[0] || 0, todayTotal);

                let weekTotal = 0;
                const weekGraphData = [];
                let weekDivisor = 0;
                for (let i = 0; i < 7; i++) {
                    const val = d[i] || 0;
                    weekTotal += val;
                    if (val > 0) weekDivisor++;
                    weekGraphData.unshift(+(val / 60).toFixed(1));
                }
                if (weekDivisor === 0) weekDivisor = 1;

                let monthTotal = 0;
                const monthGraphData = [];
                let monthDivisor = 0;
                for (let i = 0; i < 30; i++) {
                    const val = d[i] || 0;
                    monthTotal += val;
                    if (val > 0) monthDivisor++;
                    monthGraphData.unshift(+(val / 60).toFixed(1));
                }
                if (monthDivisor === 0) monthDivisor = 1;

                const lightOutageMins = newMetrics.lightLoadSheddingToday || 0;
                const totalOutageMins = newMetrics.totalLoadSheddingToday || 0;

                this.devices[hwid].analyticsData = {
                    today: { 
                        totalActive: formatTime(todayTotal), 
                        loadShedding: formatTime(lightOutageMins), 
                        hourlyGraph: h,
                        awakeData: awake 
                    },
                    week: { 
                        totalActive: formatTime(weekTotal), 
                        avgLight: formatTime(Math.round(weekTotal / weekDivisor)), 
                        loadShedding: formatTime(lightOutageMins), 
                        dailyGraph: weekGraphData 
                    },
                    month: { 
                        totalActive: formatTime(monthTotal), 
                        avgLight: formatTime(Math.round(monthTotal / monthDivisor)), 
                        loadShedding: formatTime(lightOutageMins), 
                        totalBlackout: formatTime(totalOutageMins),
                        dailyGraph: monthGraphData
                    }
                };
            }
        }
        
        if (newCapabilities) {
            this.devices[hwid].capabilities = { ...this.devices[hwid].capabilities, ...newCapabilities };
        }
        
        this.save();
    },

    getActiveDevice() {
        if (this.activeDeviceId && this.devices[this.activeDeviceId]) {
            return this.devices[this.activeDeviceId];
        }
        return null;
    },

    save() {
        try {
            const clone = JSON.parse(JSON.stringify(this.devices));
            for (let id in clone) clone[id].historicalData = [];
            localStorage.setItem("aquasync_ecosystem", JSON.stringify(clone));
            
            if (this.activeDeviceId) {
                localStorage.setItem("aquasync_active_hwid", this.activeDeviceId);
            } else {
                localStorage.removeItem("aquasync_active_hwid");
            }
        } catch (error) {
            console.error("Failed to save device store", error);
        }
    }
};

// ==========================================
// 🔥 SDK-FREE AUTH: Simulated Identity Store
// ==========================================

export const IdentityStore = {
    currentUser: null, 
    isGuest: true,

    init() {
        // 🔥 THE FIX: Check browser memory on load so you stay logged in!
        const savedSession = localStorage.getItem("aquasync_session");
        
        if (savedSession) {
            try {
                this.currentUser = JSON.parse(savedSession);
                this.isGuest = false;
                console.log("🔒 Simulated session restored for:", this.currentUser.email);
            } catch (e) {
                this.currentUser = null;
                this.isGuest = true;
            }
        } else {
            this.currentUser = null;
            this.isGuest = true;
            console.log("🔒 No active session.");
        }
        
        // Broadcast that Auth has loaded so main.js knows to redraw the Account Panel!
        window.dispatchEvent(new CustomEvent("aquasync_auth_resolved"));
    },

    async login(email, password) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1200));

        if (email && password) {
            // Create a secure local session
            this.currentUser = { 
                email: email, 
                uid: "user_" + Math.random().toString(36).substr(2, 9),
                token: "mock_secure_token_123" 
            };
            this.isGuest = false;
            
            // Save it so it survives page refreshes
            localStorage.setItem("aquasync_session", JSON.stringify(this.currentUser));
            return { success: true };
        }
        return { success: false, message: "Invalid email or password. Please try again." };
    },

    async signup(email, password) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (email.includes("@") && password.length >= 6) {
            return { success: true };
        }
        return { success: false, message: "Password must be at least 6 characters." };
    },

    async resetPassword(email) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (email) {
            return { success: true, message: "Password reset link sent to " + email };
        }
        return { success: false, message: "Please enter a valid email address." };
    },

    logout() {
        this.currentUser = null;
        this.isGuest = true;
        // Wipe it from memory
        localStorage.removeItem("aquasync_session");
        window.location.reload();
    }
};