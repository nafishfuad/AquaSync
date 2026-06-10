// src/state.js

/**
 * AquaSync Core State Store
 * Acts as the absolute single source of truth for all device profiles,
 * operational live metrics, capabilities, and analytics caches.
 */
export const DeviceStore = {
    activeDeviceId: null,
    devices: {},

    /**
     * Hydrates the local state store directly from browser memory.
     */
    init() {
        try {
            const storedData = localStorage.getItem("aquasync_ecosystem");
            if (storedData) {
                this.devices = JSON.parse(storedData);
            }
            this.activeDeviceId = localStorage.getItem("aquasync_active_hwid");

        } catch (error) {
            console.error("[STATE] Flash memory hydration failed. Initializing empty registries.", error);
            this.devices = {};
        }
    },

    /**
     * Registers a completely new physical controller to the profile layer
     */
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
                hasColorSpectrum: true // AS-Standard includes native WRGB mixing
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

    /**
     * Safely retrieves the active device database footprint
     */
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

    /**
     * Atomic transaction handler for raw state metric payloads received from hardware
     */
    updateDeviceMetrics(hwid, newMetrics) {
        if (!this.devices[hwid]) return;
        
        // Merge runtime metrics dynamically without obliterating configuration schemas
        this.devices[hwid].metrics = { ...this.devices[hwid].metrics, ...newMetrics };
        this.save();
    },

    /**
     * Updates peripheral capabilities when the hardware delivers its layout configuration
     */
    updateDeviceCapabilities(hwid, newCaps) {
        if (!this.devices[hwid] || !newCaps) return;
        this.devices[hwid].capabilities = { ...this.devices[hwid].capabilities, ...newCaps };
        this.save();
    },

    /**
     * Commits analytics arrays safely into browser local memory caches
     */
    updateDeviceAnalytics(hwid, analytics) {
        if (!this.devices[hwid] || !analytics) return;
        this.devices[hwid].analyticsData = { ...this.devices[hwid].analyticsData, ...analytics };
        this.save();
    },

    /**
     * Commits the structural state values down into the physical localStorage pipeline
     */
    save() {
        try {
            localStorage.setItem("aquasync_ecosystem", JSON.stringify(this.devices));
            if (this.activeDeviceId) {
                localStorage.setItem("aquasync_active_hwid", this.activeDeviceId);
            }
        } catch (error) {
            console.error("[STATE] Critical exception writing values to browser flash NVS.", error);
        }
    }
};