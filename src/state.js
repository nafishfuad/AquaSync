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

            // Parse deep Analytics if supplied
            if (newMetrics.hourlyData || newMetrics.dailyData) {
                const h = toArray(newMetrics.hourlyData, 24, 0);
                const d = toArray(newMetrics.dailyData, 30, 0);
                const awake = toArray(newMetrics.awakeData, 24, 1);

                // 1. Calculate what is currently saved in the Firebase Array
                let sumOfFirebaseHours = 0;
                for (let i = 0; i < 24; i++) {
                    if (h[i] > 60) h[i] = 60;
                    sumOfFirebaseHours += h[i];
                }

                let todayTotal = sumOfFirebaseHours;
                const currentHour = new Date().getHours();

                // 🔥 THE FIX: Calculate the delta between the Live Total and the Firebase Array
                if (newMetrics.liveActiveMins !== undefined && newMetrics.liveActiveMins > sumOfFirebaseHours) {
                    const unpushedMinutes = newMetrics.liveActiveMins - sumOfFirebaseHours;
                    
                    // Add only the unpushed minutes to the current hour on the graph
                    h[currentHour] += unpushedMinutes;
                    if (h[currentHour] > 60) h[currentHour] = 60; 
                    
                    // Set the text total to the true live master total
                    todayTotal = newMetrics.liveActiveMins;
                }

                // Inject the true live total into the 7-Day and 30-Day graphs
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
            localStorage.setItem("aquasync_ecosystem", JSON.stringify(this.devices));
            if (this.activeDeviceId) {
                localStorage.setItem("aquasync_active_hwid", this.activeDeviceId);
            } else {
                localStorage.removeItem("aquasync_active_hwid");
            }
            console.log("💾 DeviceStore safely secured in browser storage.");
        } catch (error) {
            console.error("Failed to save device store to localStorage", error);
        }
    }
};