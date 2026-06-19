// src/state.js
import { db, auth } from './firebase-config.js';
import { ref, get, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

const FIREBASE_URL = "https://aqua-fish-controller-default-rtdb.asia-southeast1.firebasedatabase.app";

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
                    if (!dev.companion) dev.companion = { current: "v1.5.0", latest: "Checking...", downloadUrl: "" };
                    if (!dev.firmware) dev.firmware = { current: "v1.5.0", latest: "Checking...", downloadUrl: "" };
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
        
        try {
            // Use a proper Firebase query to only fetch devices owned by this user
            // instead of downloading ALL devices and filtering client-side
            const devicesRef = ref(db, 'devices');
            const ownerQuery = query(devicesRef, orderByChild('ownerUid'), equalTo(uid));
            const snapshot = await get(ownerQuery);
            
            if (snapshot.exists()) {
                let addedNew = false;
                
                snapshot.forEach((childSnapshot) => {
                    const hwid = childSnapshot.key;
                    const deviceData = childSnapshot.val();
                    
                    if (!this.devices[hwid]) {
                        // Check state node (where ESP32 writes) for device metadata
                        const state = deviceData.state || {};
                        const name = state.deviceName || "AquaSync Tank";
                        const model = state.model || "AS-Standard";
                        
                        this.addDevice(hwid, model, name);
                        addedNew = true;
                    }
                });
                
                if (addedNew) {
                    console.log("✅ Cloud devices synced to local store.");
                    this.save();
                    return true;
                } else {
                    console.log("☁️ No new cloud devices found for this account.");
                    return false;
                }
            } else {
                console.log("☁️ No cloud devices found for this account.");
                return false;
            }
        } catch (e) {
            console.error("Failed to sync devices from cloud", e);
            return false;
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
                customColors: [],
                companion: { current: "v1.5.0", latest: "Checking...", downloadUrl: "" },
                firmware: { current: "v1.5.0", latest: "Checking...", downloadUrl: "" }
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

    // Write ownerUid into Firebase so this device can be discovered from any browser
    async claimDevice(hwid, uid) {
        if (!hwid || !uid) return;
        try {
            await fetch(`${FIREBASE_URL}/devices/${hwid}/ownerUid.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(uid)
            });
            console.log("✅ Claimed device in cloud:", hwid);
        } catch (e) {
            console.error("❌ Failed to claim device:", hwid, e);
        }
    },

    // Remove ownerUid from Firebase when a device is removed or factory-reset
    async unclaimDevice(hwid) {
        if (!hwid) return;
        try {
            await fetch(`${FIREBASE_URL}/devices/${hwid}/ownerUid.json`, {
                method: 'DELETE'
            });
            console.log("🗑️ Unclaimed device from cloud:", hwid);
        } catch (e) {
            console.error("❌ Failed to unclaim device:", hwid, e);
        }
    },

    // Claim ALL locally-known (non-demo) devices for the given uid
    async claimAllLocalDevices(uid) {
        if (!uid) return;
        for (const hwid of Object.keys(this.devices)) {
            if (this.devices[hwid].isDummy) continue;
            try {
                const res = await fetch(`${FIREBASE_URL}/devices/${hwid}/ownerUid.json`);
                const existingOwner = await res.json();
                if (!existingOwner) {
                    await this.claimDevice(hwid, uid);
                }
            } catch (e) {
                console.error("Migration check failed for", hwid, e);
            }
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

            // Explicitly sync the firmware version from the device API to the UI Firmware State
            if (newMetrics.fw_version) {
                if (!this.devices[hwid].firmware) this.devices[hwid].firmware = { current: "v1.0.0", latest: "Checking...", downloadUrl: "" };
                this.devices[hwid].firmware.current = newMetrics.fw_version;
            }

            // Sync the device name across all clients if it was changed elsewhere
                    if (newMetrics.deviceName && this.devices[hwid].name !== newMetrics.deviceName) {
                this.devices[hwid].name = newMetrics.deviceName;
            }

            if (newMetrics.hourlyData || newMetrics.dailyData) {
                const h = toArray(newMetrics.hourlyData, 24, 0);
                const d = toArray(newMetrics.dailyData, 30, 0);
                const awake = toArray(newMetrics.awakeData, 24, 1);

                let todayTotal = 0;
                for(let i=0; i<24; i++) {
                    todayTotal += newMetrics.activeData[i] || 0;
                }

                // Inject live active minutes into today's graph
                const currentHour = new Date().getHours();
                if (newMetrics.liveActiveMins > todayTotal) {
                    let sumOfFirebaseHours = 0;
                    for(let i=0; i<24; i++) if (i !== currentHour) sumOfFirebaseHours += newMetrics.activeData[i] || 0;
                    const unpushedMinutes = newMetrics.liveActiveMins - sumOfFirebaseHours;
                    h[currentHour] += unpushedMinutes;
                    if (h[currentHour] > 60) h[currentHour] = 60; 
                    todayTotal = newMetrics.liveActiveMins;
                }

                d[0] = Math.max(d[0] || 0, todayTotal);

                let weekTotal = 0;
                let weekBlackout = 0;
                let weekLostLight = 0;
                const weekGraphData = [];
                let weekDivisor = 0;
                const dailyAwake = toArray(newMetrics.dailyAwakeData, 30, 1440);
                const dailyLostLight = toArray(newMetrics.dailyLostLightData, 30, 0);
                
                for (let i = 0; i < 7; i++) {
                    const val = d[i] || 0;
                    weekTotal += val;
                    if (val > 0) weekDivisor++;
                    weekGraphData.unshift(+(val / 60).toFixed(1));
                    if (dailyAwake[i] > 0) weekBlackout += Math.max(0, 1440 - dailyAwake[i]);
                    weekLostLight += dailyLostLight[i] || 0;
                }
                if (weekDivisor === 0) weekDivisor = 1;

                let monthTotal = 0;
                let monthBlackout = 0;
                let monthLostLight = 0;
                const monthGraphData = [];
                let monthDivisor = 0;
                for (let i = 0; i < 30; i++) {
                    const val = d[i] || 0;
                    monthTotal += val;
                    if (val > 0) monthDivisor++;
                    monthGraphData.unshift(+(val / 60).toFixed(1));
                    if (dailyAwake[i] > 0) monthBlackout += Math.max(0, 1440 - dailyAwake[i]);
                    monthLostLight += dailyLostLight[i] || 0;
                }
                if (monthDivisor === 0) monthDivisor = 1;

                const lightOutageMins = newMetrics.lightLoadSheddingToday || 0;
                const totalOutageMins = newMetrics.totalLoadSheddingToday || 0;
                
                // Add today's total outage to the week and month if it's not already in dailyAwake[0]
                weekBlackout += totalOutageMins;
                monthBlackout += totalOutageMins;
                
                // Add today's lost light to the week and month if it's not already in dailyLostLight[0]
                weekLostLight += lightOutageMins;
                monthLostLight += lightOutageMins;

                this.devices[hwid].analyticsData = {
                    today: { 
                        totalActive: formatTime(todayTotal), 
                        loadShedding: formatTime(lightOutageMins), 
                        totalBlackout: formatTime(totalOutageMins),
                        hourlyGraph: h,
                        awakeData: awake 
                    },
                    week: { 
                        totalActive: formatTime(weekTotal), 
                        avgLight: formatTime(Math.round(weekTotal / weekDivisor)), 
                        loadShedding: formatTime(weekLostLight),
                        totalBlackout: formatTime(weekBlackout),
                        dailyGraph: weekGraphData 
                    },
                    month: { 
                        totalActive: formatTime(monthTotal), 
                        avgLight: formatTime(Math.round(monthTotal / monthDivisor)), 
                        loadShedding: formatTime(monthLostLight),
                        totalBlackout: formatTime(monthBlackout),
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
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = {
                    email: user.email,
                    uid: user.uid,
                    token: user.accessToken
                };
                this.isGuest = false;
                console.log("🔒 Session active for:", this.currentUser.email);
            } else {
                this.currentUser = null;
                this.isGuest = true;
                console.log("🔒 No active session.");
            }
            // Broadcast that Auth has loaded so main.js knows to redraw the Account Panel!
            window.dispatchEvent(new CustomEvent("aquasync_auth_resolved"));
        });
    },

    async login(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async signup(email, password) {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async resetPassword(email) {
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true, message: "Password reset link sent to " + email };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async logout() {
        try {
            await signOut(auth);
            this.currentUser = null;
            this.isGuest = true;
            localStorage.removeItem("aquasync_ecosystem");
            localStorage.removeItem("aquasync_active_hwid");
            window.location.reload();
        } catch (error) {
            console.error("Logout failed", error);
        }
    }
};