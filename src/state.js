// src/state.js

export const DeviceStore = {
    activeDeviceId: null,
    devices: {},

    init() {
        try {
            // 🔥 AUTO-WIPE: If the browser has corrupted data from an old version, nuke it.
            if (!localStorage.getItem("aquasync_v2_1")) {
                console.warn("[STATE] Performing hard migration wipe to clear corrupted memory...");
                localStorage.clear();
                localStorage.setItem("aquasync_v2_1", "true"); // Tag it so it never wipes again
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
                current: "v1.0.0",
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
                isCO2ScheduleSeparate: true,
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

    // 🔥 This function was missing, which caused main.js to fail!
    updateDeviceState(hwid, newMetrics, newCapabilities = null) {
        if (!this.devices[hwid]) return;
        
        if (newMetrics) {
            this.devices[hwid].metrics = { ...this.devices[hwid].metrics, ...newMetrics };
        }
        if (newCapabilities) {
            this.devices[hwid].capabilities = { ...this.devices[hwid].capabilities, ...newCapabilities };
        }
        this.save();
    },

    // 🔥 This handles the Pairing Wizard network connection status
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