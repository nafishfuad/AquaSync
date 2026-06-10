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

        // 1. Evaluate Circuit Breaker
        if (now < forceCloudUntil || !device.localIP) {
            useCloud = true;
        }

        // 2. Attempt Local Network Sync
        if (!useCloud) {
            try {
                const response = await fetchWithTimeout(`http://${device.localIP}/info`);
                if (!response.ok) throw new Error("Local HTTP Error");
                
                const data = await response.json();
                localFailCount = 0; // Reset breaker on success
                return { source: "local", data };
            } catch (err) {
                localFailCount++;
                if (localFailCount >= 3) {
                    console.warn("[API] Local network unstable. Tripping Circuit Breaker to Cloud-Only for 60s.");
                    forceCloudUntil = now + 60000; 
                }
            }
        }

        // 3. Fallback to Cloud (Firebase)
        try {
            const response = await fetch(`${FIREBASE_URL}/devices/${device.hwid}/state.json`);
            if (!response.ok) throw new Error("Cloud HTTP Error");
            const data = await response.json();
            return { source: "cloud", data };
        } catch (err) {
            console.error("[API] Both Local and Cloud sync failed.");
            return null;
        }
    },

    async checkHotspotHandshake() {
        try {
            // ESP32 default AP IP address
            const response = await fetchWithTimeout('http://192.168.4.1/api/handshake', {}, 3000);
            if (response.ok) {
                return await response.json(); // Returns { hw_id, session_token }
            }
        } catch (err) {
            return null; // Silent fail, we expect this to fail until they connect to the AP
        }
        return null;
    },

    async sendCommand(device, payload) {
        // Tag payload with our new Schema Version
        const commandWrapper = {
            v: 2,
            timestamp: Math.floor(Date.now() / 1000),
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
                if (res.ok) return true;
            } catch (err) {
                console.warn("[API] Local command failed, routing to cloud.");
            }
        }

        // Fallback to Cloud Patch
        try {
            await fetch(`${FIREBASE_URL}/devices/${device.hwid}/commands.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(commandWrapper)
            });
            return true;
        } catch (err) {
            console.error("[API] Command delivery failed globally.");
            return false;
        }
    },

    async sendWifiProvisioning(ssid, pass, token) {
        try {
            const response = await fetchWithTimeout('http://192.168.4.1/wifi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssid, pass, token })
            }, 10000); // 10 second timeout because ESP32 needs time to process and save to flash
            
            return response.ok;
        } catch (err) {
            // If the ESP32 reboots immediately upon success, it might drop the connection, 
            // causing a fetch error. We can often treat a network drop here as a soft success.
            console.warn("[API] Provisioning connection dropped (Likely rebooting).");
            return true; 
        }
    }
};