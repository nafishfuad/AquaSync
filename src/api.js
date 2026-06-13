// src/api.js

const FIREBASE_URL = "https://aqua-fish-controller-default-rtdb.asia-southeast1.firebasedatabase.app";

// Circuit Breaker State
let localFailCount = 0;
let forceCloudUntil = 0;

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    options.signal = controller.signal;

    try {
        const response = await fetch(url, options);
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

export const API = {
    async syncDevice(device) {
        const now = Date.now();
        let useCloud = false;
        let localData = null;
        let finalSource = "cloud";

        // 1. Evaluate Circuit Breaker
        if (now < forceCloudUntil || !device.localIP) {
            useCloud = true;
        }

        // 2. Attempt Local Network Sync (Fast UI State)
        if (!useCloud) {
            try {
                // Keep timeout very short (2s) so we don't lag the UI if the local network is congested
                const response = await fetchWithTimeout(`http://${device.localIP}/info`, {}, 2000);
                if (!response.ok) throw new Error("Local HTTP Error");
                
                localData = await response.json();
                localFailCount = 0; // Reset breaker on success
                finalSource = "local";
            } catch (err) {
                localFailCount++;
                if (localFailCount >= 3) {
                    console.warn("[API] Local network unstable. Tripping Circuit Breaker to Cloud-Only for 60s.");
                    forceCloudUntil = now + 60000; 
                }
            }
        }

        // 3. ALWAYS Pull from Cloud (For Heavy Analytics Arrays)
        try {
            const response = await fetch(`${FIREBASE_URL}/devices/${device.hwid}/state.json?t=${Date.now()}`);
            if (!response.ok) throw new Error("Cloud HTTP Error");
            
            const cloudData = await response.json();
            
            // 🔥 THE PHANTOM SHIELD
            if (cloudData === null) {
                console.warn("[API] Firebase returned a phantom null state. Ignoring to protect UI.");
                // If cloud is phantom, but we have local data, return local to keep UI alive
                if (localData) return { source: finalSource, data: localData }; 
                throw new Error("Phantom State Detected");
            }
            
            // 🔥 THE HYBRID MERGE
            // We layer the instant Local Data ON TOP OF the heavy Cloud Data.
            // This ensures buttons are 100% live, but graphs are populated!
            const mergedData = localData ? { ...cloudData, ...localData } : cloudData;
            
            return { source: finalSource, data: mergedData };
            
        } catch (err) {
            console.error("[API] Cloud sync failed or returned invalid data.");
            // Offline fallback: If Firebase fails (no internet) but we are on Local WiFi, keep the UI alive!
            if (localData) return { source: finalSource, data: localData };
            return null; 
        }
    },

    async checkHotspotHandshake() {
        try {
            const response = await fetchWithTimeout('http://192.168.4.1/api/handshake', {}, 3000);
            if (response.ok) {
                return await response.json(); 
            }
        } catch (err) {
            return null; 
        }
        return null;
    },

    async sendCommand(device, payload) {
        const commandWrapper = {
            v: 2,
            ts: Math.floor(Date.now() / 1000),
            ...payload
        };

        const now = Date.now();
        
        // Attempt Local First
        if (device.localIP && now >= forceCloudUntil) {
            try {
                const res = await fetchWithTimeout(`http://${device.localIP}/api/control`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(commandWrapper)
                });
                
                if (res.ok) {
                    const returnedData = await res.json();
                    return { success: true, source: "local", returnedState: returnedData };
                }
            } catch (err) {
                console.warn("[API] Local command failed, routing to cloud.");
            }
        }

        // Fallback to Cloud Patch
        try {
            const res = await fetch(`${FIREBASE_URL}/devices/${device.hwid}/commands.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(commandWrapper)
            });
            if (res.ok) {
                return { success: true, source: "cloud", returnedState: null };
            }
        } catch (err) {
            console.error("[API] Command delivery failed globally.");
        }
        
        return { success: false, source: "none", returnedState: null };
    },

    async sendWifiProvisioning(ssid, pass, token, deviceName) {
        try {
            const response = await fetchWithTimeout('http://192.168.4.1/wifi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssid, pass, token, deviceName }) 
            }, 10000); 
            
            return response.ok;
        } catch (err) {
            console.warn("[API] Provisioning connection dropped (Likely rebooting).");
            return true; 
        }
    },

    // 🔥 NEW: OTA Manifest Fetcher
    async checkLatestFirmware(model) {
        try {
            // Append timestamp to bust the browser cache
            const response = await fetch("https://raw.githubusercontent.com/nafishfuad/Aqua-Fish/main/firmware.json?t=" + Date.now());
            if (!response.ok) return null;
            
            const data = await response.json();
            return data[model] || null; 
        } catch (err) {
            console.error("[API] Failed to fetch OTA manifest from GitHub.", err);
            return null;
        }
    }
};