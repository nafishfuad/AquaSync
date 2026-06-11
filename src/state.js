// src/state.js

// Helper to turn raw minutes into "00h 00m" format
function formatTime(minutes) {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}h ${m}m`;
}

export const DeviceStore = {
    activeDeviceId: null,
    devices: {},

    init() {
        try {
            // 🔥 AUTO-WIPE: If the browser has corrupted data from an old version, nuke it.
            if (!localStorage.getItem("aquasync_v2_1")) {
                console.warn("[STATE] Performing hard migration wipe to clear corrupted memory...");
                localStorage.clear();
                localStorage.setItem("aquasync_v2_1", "true"); 
            }

            const storedData = localStorage.getItem("aquasync_ecosystem");
            if (storedData) {
                this.devices = JSON.parse(storedData);
            }
            this.activeDeviceId = localStorage.getItem("aquasync_active_hwid");

        } catch (error) {
            console.error("[STATE] Memory validation failed. Resetting ecosystem.", error);
            localStorage.clear();
            this.devices = {};
            this.activeDeviceId = null;
        }
    },

    addDevice(hwid, model = "AS-Standard", name = "New Aquarium Tank") {
        this.devices[hwid] = {
            hwid: hwid,
            name: name,
            model: model,
            localIP: null,
            network: {
                isWiFiConnected: false,
                ssid: "Disconnected"
            },
            firmware: {
                current: "v2.0.0",
                latest: "Checking..."
            },
            capabilities: {
                hasLight: true,
                hasCO2: true,
                hasFan: true,
                hasColorSpectrum: true 
            },
            metrics: {
                isAutoMode: true,
                isLightOn: false,
                isCO2On: false,
                isFanOn: false,
                isFanEnabled: false,
                currentBrightness: 0,
                startTime: "17:00",
                photoperiod: 6,
                maxBrightness: 80,
                isDimmerEnabled: true,
                sunriseMins: 20,
                sunsetMins: 20,
                isCO2ScheduleSeparate: false,
                co2OnTime: "16:50",
                co2OffTime: "22:40",
                recoveryMins: 5,
                fanOnTime: "10:00",
                fanOffTime: "18:00",
                fanSpeed: 80,
                colorSpectrum: { w: 87, r: 100, g: 100, b: 100 }
            },
            analyticsData: {
                today: { totalActive: "00h 00m", loadShedding: "00h 00m", hourlyGraph: Array(24).fill(0) },
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
            if (keys.length > 0) {
                this.activeDeviceId = keys[0];
            } else {
                return null;
            }
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
        if (!this.devices[hwid]) return;
        
        if (newMetrics) {
            // Delta Update: Merge only changed data into metrics
            this.devices[hwid].metrics = { ...this.devices[hwid].metrics, ...newMetrics };
            
            // Check if the payload contains a custom device name
            if (newMetrics.deviceName) {
                this.devices[hwid].name = newMetrics.deviceName;
            }

            // 🔥 THE ANALYTICS CRUNCHER
            if (newMetrics.hourlyData && newMetrics.dailyData) {
                const todayTotal = newMetrics.hourlyData.reduce((a, b) => a + b, 0);
                // Combine today's running total with historical totals for accurate 7/30 day readouts
                const weekTotal = newMetrics.dailyData.slice(0, 6).reduce((a, b) => a + b, 0) + todayTotal;
                const monthTotal = newMetrics.dailyData.slice(0, 29).reduce((a, b) => a + b, 0) + todayTotal;

                this.devices[hwid].analyticsData = {
                    today: { 
                        totalActive: formatTime(todayTotal), 
                        loadShedding: "00h 00m", 
                        hourlyGraph: newMetrics.hourlyData 
                    },
                    week: { 
                        totalActive: formatTime(weekTotal), 
                        avgLight: formatTime(Math.round(weekTotal / 7)), 
                        loadShedding: "00h 00m", 
                        // Reverse the array so the oldest day is on the left side of the chart
                        dailyGraph: newMetrics.dailyData.slice(0, 7).reverse() 
                    },
                    month: { 
                        totalActive: formatTime(monthTotal), 
                        avgLight: formatTime(Math.round(monthTotal / 30)), 
                        loadShedding: "00h 00m", 
                        // Reverse the array so the oldest day is on the left side of the chart
                        dailyGraph: newMetrics.dailyData.reverse()
                    }
                };
            }
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
            if (this.activeDeviceId) {
                localStorage.setItem("aquasync_active_hwid", this.activeDeviceId);
            }
        } catch (error) {
            console.error("[STATE] Error writing to browser storage.", error);
        }
    }
};