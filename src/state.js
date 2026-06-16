// src/state.js

import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import { ref, onValue, off, set, get, query, orderByKey, limitToLast } from "firebase/database";
import { auth, db } from "./firebase-config.js";

function formatTime(minutes) {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}h ${m}m`;
}

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

export const IdentityStore = {
    currentUser: null,
    isGuest: true,

    init() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                if (!user.emailVerified) {
                    console.log("🔒 Login blocked: Email not verified.");
                    signOut(auth);
                    return; 
                }
                console.log("🔓 User logged in:", user.email);
                this.currentUser = user;
                this.isGuest = false;
                
                await DeviceStore.syncLocalToCloud();
                DeviceStore.loadFromCloud(user.uid);
                window.dispatchEvent(new CustomEvent("aquasync_auth_changed", { detail: { isGuest: false, email: user.email } }));
            } else {
                console.log("👤 Running in Local Guest Mode");
                this.currentUser = null;
                this.isGuest = true;
                DeviceStore.initLocal(); 
                window.dispatchEvent(new CustomEvent("aquasync_auth_changed", { detail: { isGuest: true, email: null } }));
            }
        });
    },

    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            if (!userCredential.user.emailVerified) {
                signOut(auth);
                return { success: false, message: "⚠️ Please check your inbox and verify your email before logging in." };
            }
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async signup(email, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);
            signOut(auth);
            return { success: true, requireVerification: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async resetPassword(email) {
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true, message: "✅ Password reset email sent! Please check your inbox." };
        } catch (error) {
            let msg = error.message;
            if (msg.includes("user-not-found") || msg.includes("invalid-credential")) msg = "No account found with this email.";
            if (msg.includes("missing-email")) msg = "Please enter an email address.";
            return { success: false, message: msg };
        }
    },

    logout() {
        if (DeviceStore._activeStreamRef) {
            off(DeviceStore._activeStreamRef);
            DeviceStore._activeStreamRef = null;
        }
        signOut(auth);
    }
};

export const DeviceStore = {
    devices: {},
    activeDeviceId: null,
    _activeStreamRef: null,

    initLocal() {
        try {
            const storedData = localStorage.getItem("aquasync_ecosystem");
            if (storedData) {
                this.devices = JSON.parse(storedData);
                for (let hwid in this.devices) {
                    if (!this.devices[hwid].historicalData) this.devices[hwid].historicalData = []; 
                }
            }
        } catch (error) {
            this.devices = {};
        }

        const activeId = localStorage.getItem("aquasync_active_hwid");
        if (activeId && this.devices[activeId]) {
            this.activeDeviceId = activeId;
        } else if (Object.keys(this.devices).length > 0) {
            this.activeDeviceId = Object.keys(this.devices)[0];
        }
        
        // 🔥 THE FIX: Guests MUST start the telemetry stream when the page loads!
        if (this.activeDeviceId) {
            this.startCloudStream(this.activeDeviceId);
        }

        window.dispatchEvent(new Event("aquasync_data_ready"));
    },

    async syncLocalToCloud() {
        if (IdentityStore.isGuest) return;
        for (let hwid in this.devices) {
            const dev = this.devices[hwid];
            await this.claimDevice(hwid, dev.model, dev.name);
        }
    },

    loadFromCloud(uid) {
        const ecoRef = ref(db, `users/${uid}/ecosystem`);
        onValue(ecoRef, (snapshot) => {
            if (snapshot.exists()) {
                const ecosystem = snapshot.val();
                for (let hwid in ecosystem) {
                    if (!this.devices[hwid]) {
                         this.addDeviceLocal(hwid, ecosystem[hwid].model, ecosystem[hwid].name);
                    } else {
                         this.devices[hwid].name = ecosystem[hwid].name;
                    }
                }
                
                if (!this.activeDeviceId && Object.keys(this.devices).length > 0) {
                    this.activeDeviceId = Object.keys(this.devices)[0];
                }

                if (this.activeDeviceId) {
                    this.startCloudStream(this.activeDeviceId);
                }
            } else {
                this.devices = {};
            }
            window.dispatchEvent(new Event("aquasync_data_ready"));
        });
    },

    async claimDevice(hwid, model, name) {
        if (IdentityStore.isGuest) {
            this.addDeviceLocal(hwid, model, name);
            return { success: true };
        }

        const uid = IdentityStore.currentUser.uid;
        const deviceRef = ref(db, `devices/${hwid}/ownerUid`);
        
        try {
            const snapshot = await get(deviceRef);
            const currentOwner = snapshot.val();

            if (currentOwner === null || currentOwner === uid) {
                await set(ref(db, `devices/${hwid}/ownerUid`), uid);
                await set(ref(db, `users/${uid}/ecosystem/${hwid}`), { hwid, model, name });
                return { success: true };
            } else {
                return { success: false, message: "⚠️ This device is already registered to another account." };
            }
        } catch (error) {
            return { success: false, message: "Permission denied or network error." };
        }
    },

    addDeviceLocal(hwid, model, name) {
        if (!this.devices[hwid]) {
            this.devices[hwid] = {
                hwid: hwid,
                model: model,
                name: name,
                localIP: null,
                network: { isWiFiConnected: false, ssid: "" },
                metrics: {
                    isAutoMode: true, isLightOn: false, isCO2On: false, isFanOn: false, isFanEnabled: false,
                    currentBrightness: 0, startTime: "12:00", photoperiod: 8, maxBrightness: 100,
                    isDimmerEnabled: false, sunriseMins: 30, sunsetMins: 30, isCO2ScheduleSeparate: false,
                    co2OnTime: "11:00", co2OffTime: "20:00", recoveryMins: 15, fanOnTime: "12:00",
                    fanOffTime: "20:00", fanSpeed: 50, colorW: 100, colorR: 100, colorG: 100, colorB: 100
                },
                capabilities: { hasLight: true, hasCO2: true, hasFan: true, hasColorSpectrum: true },
                historicalData: [], 
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

    async removeDevice(hwid) {
        if (this.devices[hwid]) {
            delete this.devices[hwid];
            if (this.activeDeviceId === hwid) {
                const keys = Object.keys(this.devices);
                this.activeDeviceId = keys.length > 0 ? keys[0] : null;
            }
            this.save();

            if (!IdentityStore.isGuest && IdentityStore.currentUser) {
                const uid = IdentityStore.currentUser.uid;
                try {
                    await set(ref(db, `users/${uid}/ecosystem/${hwid}`), null);
                    await set(ref(db, `devices/${hwid}/ownerUid`), null);
                } catch(e) {}
            }
        }
    },

    setActiveDevice(hwid) {
        if (this.devices[hwid]) {
            this.activeDeviceId = hwid;
            this.save();
            this.startCloudStream(hwid); 
        }
    },

    updateNetwork(hwid, ip, isConnected) {
        if (!this.devices[hwid]) return;
        if (ip !== null) this.devices[hwid].localIP = ip;
        this.devices[hwid].network.isWiFiConnected = isConnected;
        this.save();
    },

    async fetchHistoricalAnalytics(hwid) {
        // 🔥 THE FIX: Removed `if (IdentityStore.isGuest) return;`
        try {
            const analyticsRef = query(ref(db, `devices/${hwid}/analytics`), orderByKey(), limitToLast(30));
            const snapshot = await get(analyticsRef);
            const history = [];
            
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    history.push({ date: child.key, ...child.val() });
                });
            }
            
            if (this.devices[hwid]) {
                this.devices[hwid].historicalData = history;
                this.recalculateAnalytics(hwid);
            }
        } catch (error) {
            console.error("Failed to load historical analytics:", error);
        }
    },

    startCloudStream(hwid) {
        // 🔥 THE FIX: Removed `if (IdentityStore.isGuest) return;`
        
        if (this._activeStreamRef) {
            off(this._activeStreamRef);
        }

        this.fetchHistoricalAnalytics(hwid);

        this._activeStreamRef = ref(db, `devices/${hwid}/telemetry`);
        console.log(`📡 [STREAM] Live socket opened for ${hwid}/telemetry`);

        onValue(this._activeStreamRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (data.localIP) this.updateNetwork(hwid, data.localIP, true);
                
                get(ref(db, `devices/${hwid}/config`)).then((configSnap) => {
                    const configData = configSnap.exists() ? configSnap.val() : {};
                    this.updateDeviceState(hwid, { ...configData, ...data });
                    window.dispatchEvent(new CustomEvent("aquasync_stream_update"));
                });
            }
        });
    },

    recalculateAnalytics(hwid) {
        const dev = this.devices[hwid];
        if (!dev) return;

        const m = dev.metrics;
        const history = dev.historicalData || [];
        
        const h = toArray(m.hourlyData, 24, 0);
        const awake = toArray(m.awakeData, 24, 1);
        let todayTotal = m.liveActiveMins || 0;
        
        const lightOutageMins = m.lightLoadSheddingToday || 0;
        const totalOutageMins = m.totalLoadSheddingToday || 0;

        const last30Graph = [];
        let monthTotalMins = todayTotal;
        let monthValidDays = 1;
        
        const last7Graph = [];
        let weekTotalMins = todayTotal;
        let weekValidDays = 1;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 1; i <= 30; i++) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() - i);
            const dateStr = targetDate.toISOString().split('T')[0];

            const historicDay = history.find(entry => entry.date === dateStr);
            const activeMins = historicDay ? (historicDay.totalActiveMins || 0) : 0;

            last30Graph.unshift(+(activeMins / 60).toFixed(1));
            monthTotalMins += activeMins;
            if (activeMins > 0) monthValidDays++;

            if (i <= 7) {
                last7Graph.unshift(+(activeMins / 60).toFixed(1));
                weekTotalMins += activeMins;
                if (activeMins > 0) weekValidDays++;
            }
        }

        last30Graph.push(+(todayTotal / 60).toFixed(1));
        last7Graph.push(+(todayTotal / 60).toFixed(1));

        dev.analyticsData = {
            today: { 
                totalActive: formatTime(todayTotal), 
                loadShedding: formatTime(lightOutageMins), 
                totalBlackout: formatTime(totalOutageMins),
                hourlyGraph: h,
                awakeData: awake 
            },
            week: { 
                totalActive: formatTime(weekTotalMins), 
                avgLight: formatTime(Math.round(weekTotalMins / weekValidDays)), 
                loadShedding: formatTime(lightOutageMins), 
                dailyGraph: last7Graph 
            },
            month: { 
                totalActive: formatTime(monthTotalMins), 
                avgLight: formatTime(Math.round(monthTotalMins / monthValidDays)), 
                loadShedding: formatTime(lightOutageMins), 
                totalBlackout: formatTime(totalOutageMins),
                dailyGraph: last30Graph
            }
        };
    },

    updateDeviceState(hwid, newMetrics, newCapabilities) {
        if (!this.devices[hwid]) return;

        if (newMetrics) {
            this.devices[hwid].metrics = { ...this.devices[hwid].metrics, ...newMetrics };
            this.recalculateAnalytics(hwid);
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
            console.error("Failed to save device store to localStorage", error);
        }
    }
};