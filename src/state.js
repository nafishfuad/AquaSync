// src/state.js

// 1. Import ONLY the specific Firebase methods we need to use
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, onValue, set, get } from "firebase/database";

// 2. 🔥 THE CONNECTION: Import the live Auth and DB instances from your central config file
import { auth, db } from "./firebase-config.js";

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

// ==========================================
// NEW: IDENTITY STORE (Authentication & Sync)
// ==========================================
export const IdentityStore = {
    currentUser: null,
    isGuest: true,

    init() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("🔓 User logged in:", user.email);
                this.currentUser = user;
                this.isGuest = false;
                
                // 1. Push any local guest tanks to the new cloud account
                await DeviceStore.syncLocalToCloud();

                // 2. Download their full cloud ecosystem
                DeviceStore.loadFromCloud(user.uid);

                // 3. Tell the UI to update the Network Page
                window.dispatchEvent(new CustomEvent("aquasync_auth_changed", { detail: { isGuest: false, email: user.email } }));
            } else {
                console.log("👤 Running in Local Guest Mode");
                this.currentUser = null;
                this.isGuest = true;
                DeviceStore.initLocal(); // Fall back to localStorage

                // Tell UI to show Guest Mode
                window.dispatchEvent(new CustomEvent("aquasync_auth_changed", { detail: { isGuest: true, email: null } }));
            }
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
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // Create their empty Vault A ecosystem
            await set(ref(db, `users/${userCredential.user.uid}/ecosystem`), {});
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    logout() {
        signOut(auth);
    }
};

// ==========================================
// UPDATED: DEVICE STORE
// ==========================================
export const DeviceStore = {
    activeDeviceId: null,
    devices: {},

    // 1. LOCAL LOAD (For Guests)
    initLocal() {
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
        
        // Trigger a custom event so your UI knows data is ready to draw
        window.dispatchEvent(new Event("aquasync_data_ready"));
    },

    // 🔥 NEW: The Local-to-Cloud Migration Engine
    async syncLocalToCloud() {
        if (IdentityStore.isGuest) return; // Safety check
        
        // Loop through everything currently in memory (which was loaded from localStorage)
        for (let hwid in this.devices) {
            const dev = this.devices[hwid];
            console.log(`🚀 Migrating local tank [${dev.name}] to Cloud...`);
            
            // We reuse our existing claim function to securely push it to Vault A and Vault B
            await this.claimDevice(hwid, dev.model, dev.name);
        }
    },

    // 2. CLOUD LOAD (For Logged-In Users)
    loadFromCloud(uid) {
        const ecoRef = ref(db, `users/${uid}/ecosystem`);
        onValue(ecoRef, (snapshot) => {
            if (snapshot.exists()) {
                const ecosystem = snapshot.val();
                
                // Merge cloud ecosystem into local state
                for (let hwid in ecosystem) {
                    if (!this.devices[hwid]) {
                         // Build the empty shell so the UI doesn't crash while waiting for ESP32 telemetry
                         this.addDeviceLocal(hwid, ecosystem[hwid].model, ecosystem[hwid].name);
                    } else {
                         // Update name if changed on another device
                         this.devices[hwid].name = ecosystem[hwid].name;
                    }
                }
                
                if (!this.activeDeviceId && Object.keys(this.devices).length > 0) {
                    this.activeDeviceId = Object.keys(this.devices)[0];
                }
                console.log("☁️ Ecosystem loaded from Cloud");
            } else {
                console.log("☁️ Ecosystem is empty.");
                this.devices = {};
            }
            window.dispatchEvent(new Event("aquasync_data_ready"));
        });
    },

    // 3. THE CLAIMING PROTOCOL (Replaces old addDevice)
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
                // Device is an orphan, or we already own it. Claim it!
                await set(ref(db, `devices/${hwid}/ownerUid`), uid);
                
                // Add it to the User's Ecosystem (Vault A)
                await set(ref(db, `users/${uid}/ecosystem/${hwid}`), {
                    hwid: hwid,
                    model: model,
                    name: name
                });
                console.log("🎉 Device successfully claimed to your cloud account!");
                return { success: true };
            } else {
                return { success: false, message: "⚠️ This device is already registered to another account. Please factory reset the physical device first." };
            }
        } catch (error) {
            console.error("Claiming error:", error);
            return { success: false, message: "Permission denied or network error." };
        }
    },

    // 4. LOCAL ADDITION (Helper for Building the Object)
    addDeviceLocal(hwid, model, name) {
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

    // 5. REMOVE DEVICE (With Cloud Wipe)
    async removeDevice(hwid) {
        if (this.devices[hwid]) {
            delete this.devices[hwid];
            
            if (this.activeDeviceId === hwid) {
                const keys = Object.keys(this.devices);
                this.activeDeviceId = keys.length > 0 ? keys[0] : null;
            }
            this.save();

            // Cloud removal protocol
            if (!IdentityStore.isGuest && IdentityStore.currentUser) {
                const uid = IdentityStore.currentUser.uid;
                try {
                    // 1. Remove from User Ecosystem (Vault A)
                    await set(ref(db, `users/${uid}/ecosystem/${hwid}`), null);
                    // 2. Remove claim from Device (Vault B) - Make it an orphan again
                    await set(ref(db, `devices/${hwid}/ownerUid`), null);
                    console.log(`☁️ Device ${hwid} removed from cloud account.`);
                } catch(e) {
                    console.error("Failed to remove device from cloud", e);
                }
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

            // Parse deep Analytics if supplied
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
            // We always save to localStorage as a fallback/cache
            localStorage.setItem("aquasync_ecosystem", JSON.stringify(this.devices));
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