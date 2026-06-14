// src/state.js

function formatTime(minutes) {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}h ${m}m`;
}

// 🔥 THE FIX: Helper function to safely convert Firebase sparse objects back to true arrays
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
                    
                    if (!dev.companion) {
                        dev.companion = { current: "v2.0.0", latest: "Checking...", downloadUrl: "" };
                    }
                    if (dev.analyticsData && dev.analyticsData.today) {
                        if (!dev.analyticsData.today.awakeData) {
                            dev.analyticsData.today.awakeData = Array(24).fill(1);
                        }
                    }
                }
            }
            this.activeDeviceId = localStorage.getItem("aquasync_active_hwid");
        } catch (error) {
            console.error("[STATE] Memory validation failed. Corrupted JSON.", error);
            localStorage.removeItem("aquasync_ecosystem");
            localStorage.removeItem("aquasync_active_hwid");
            this.devices = {};
            this.activeDeviceId = null;
        }
    },

    addDevice(hwid, model = "AS-Standard", name = "New Aquarium Tank") {
        this.devices[hwid] = {
            hwid: hwid, name: name, model: model, localIP: null,
            network: { isWiFiConnected: false, ssid: "Disconnected" },
            firmware: { current: "v2.0.0", latest: "Checking...", downloadUrl: "" },
            companion: { current: "v2.0.0", latest: "Checking...", downloadUrl: "" },
            capabilities: { hasLight: true, hasCO2: true, hasFan: true, hasColorSpectrum: true },
            metrics: {
                isAutoMode: true, isLightOn: false, isCO2On: false, isFanOn: false, isFanEnabled: false,
                currentBrightness: 0, startTime: "17:00", photoperiod: 6, maxBrightness: 80,
                isDimmerEnabled: true, sunriseMins: 20, sunsetMins: 20, isCO2ScheduleSeparate: false,
                co2OnTime: "16:50", co2OffTime: "22:40", recoveryMins: 5, fanOnTime: "10:00", fanOffTime: "18:00",
                fanSpeed: 80, colorSpectrum: { w: 87, r: 100, g: 100, b: 100 }
            },
            analyticsData: {
                today: { totalActive: "00h 00m", loadShedding: "00h 00m", totalBlackout: "00h 00m", hourlyGraph: Array(24).fill(0), awakeData: Array(24).fill(1) },
                week: { totalActive: "00h 00m", avgLight: "00h 00m", loadShedding: "00h 00m", dailyGraph: Array(7).fill(0) },
                month: { totalActive: "00h 00m", avgLight: "00h 00m", loadShedding: "00h 00m", dailyGraph: Array(30).fill(0) }
            }
        };
        this.activeDeviceId = hwid;
        this.save();
    },

    getActiveDevice() {
        if (!this.activeDeviceId || !this.devices[this.activeDeviceId]) {
            const keys = Object.keys(this.devices);
            if (keys.length > 0) this.activeDeviceId = keys[0];
            else return null;
        }
        return this.devices[this.activeDeviceId];
    },

    setActiveDevice(hwid) {
        if (this.devices[hwid]) {
            this.activeDeviceId = hwid;
            this.save();
            return true;
        }
        return false;
    },

    removeDevice(hwid) {
        if (this.devices[hwid]) {
            delete this.devices[hwid];
            if (this.activeDeviceId === hwid) {
                const remainingKeys = Object.keys(this.devices);
                this.activeDeviceId = remainingKeys.length > 0 ? remainingKeys[0] : null;
            }
            this.save();
            return true;
        }
        return false;
    },

    updateDeviceState(hwid, newMetrics, newCapabilities = null) {
        if (!this.devices[hwid] || !newMetrics) return;

        if (newMetrics.fw_version) {
            this.devices[hwid].firmware.current = newMetrics.fw_version;
        }
        
        this.devices[hwid].metrics = { ...this.devices[hwid].metrics, ...newMetrics };
        if (newMetrics.deviceName) this.devices[hwid].name = newMetrics.deviceName;

        const mergedMetrics = this.devices[hwid].metrics;

        if (mergedMetrics.hourlyData || mergedMetrics.dailyData) {
            
            // 🔥 THE FIX: Force Firebase Objects safely back into true Arrays
            const hourly = toArray(mergedMetrics.hourlyData, 24, 0);
            const awake = toArray(mergedMetrics.awakeData, 24, 1);
            const daily = toArray(mergedMetrics.dailyData, 30, 0);

            let todayTotal = mergedMetrics.liveActiveMins !== undefined 
                ? mergedMetrics.liveActiveMins 
                : hourly.reduce((a, b) => a + b, 0);
            
            if (mergedMetrics.isLightOn && todayTotal === 0) {
                todayTotal = new Date().getMinutes(); 
            }
            
            const activeHistoryWeek = daily.slice(0, 6).filter(mins => mins > 0).length;
            const activeHistoryMonth = daily.slice(0, 29).filter(mins => mins > 0).length;

            const weekDivisor = Math.max(1, activeHistoryWeek + (todayTotal > 0 ? 1 : 0));
            const monthDivisor = Math.max(1, activeHistoryMonth + (todayTotal > 0 ? 1 : 0));

            const weekTotal = daily.slice(0, 6).reduce((a, b) => a + b, 0) + todayTotal;
            const monthTotal = daily.slice(0, 29).reduce((a, b) => a + b, 0) + todayTotal;

            const lightOutageMins = mergedMetrics.lightLoadSheddingToday || 0;
            const totalOutageMins = mergedMetrics.totalLoadSheddingToday || 0;

            const weekGraphData = [...daily.slice(0, 6).reverse(), todayTotal].map(m => Number((m / 60).toFixed(2)));
            const monthGraphData = [...daily.slice(0, 29).reverse(), todayTotal].map(m => Number((m / 60).toFixed(2)));

            this.devices[hwid].analyticsData = {
                today: { 
                    totalActive: formatTime(todayTotal), 
                    loadShedding: formatTime(lightOutageMins), 
                    totalBlackout: formatTime(totalOutageMins), 
                    hourlyGraph: hourly,
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
                    dailyGraph: monthGraphData
                }
            };
        }
        
        if (newCapabilities) {
            this.devices[hwid].capabilities = { ...this.devices[hwid].capabilities, ...newCapabilities };
        }
        
        this.save();
    },

    updateNetwork(hwid, ip, isConnected) {
        if (!this.devices[hwid]) return;
        if (ip !== null) this.devices[hwid].localIP = ip;
        this.devices[hwid].network.isWiFiConnected = isConnected;
        this.save();
    },

    save() {
        try {
            localStorage.setItem("aquasync_ecosystem", JSON.stringify(this.devices));
            if (this.activeDeviceId) localStorage.setItem("aquasync_active_hwid", this.activeDeviceId);
        } catch (error) {
            console.error("[STATE] Error writing to browser storage.", error);
        }
    }
};