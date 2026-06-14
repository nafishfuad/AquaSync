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
        // 🔥 THE DUMMY FIREWALL: Stop real network requests for the Demo Device
        if (device.isDummy) {
            return { 
                success: true, 
                source: "cloud", 
                data: { ...device.metrics, localIP: "127.0.0.1", lastHeartbeatTs: Math.floor(Date.now() / 1000) } 
            };
        }

        const now = Date.now();
        let useCloud = false;
        let localData = null;
        let finalSource = "cloud";

        if (now < forceCloudUntil || !device.localIP) {
            useCloud = true;
        }

        if (!useCloud) {
            try {
                const response = await fetchWithTimeout(`http://${device.localIP}/info`, {}, 2000);
                if (!response.ok) throw new Error("Local HTTP Error");
                
                localData = await response.json();
                localFailCount = 0; 
                finalSource = "local";
            } catch (err) {
                localFailCount++;
                if (localFailCount >= 3) {
                    console.warn("[API] Local network unstable. Tripping Circuit Breaker to Cloud-Only for 60s.");
                    forceCloudUntil = now + 60000; 
                }
            }
        }

        try {
            const response = await fetch(`${FIREBASE_URL}/devices/${device.hwid}/state.json?t=${Date.now()}`);
            if (!response.ok) throw new Error("Cloud HTTP Error");
            
            const cloudData = await response.json();
            
            if (cloudData === null) {
                console.warn("[API] Firebase returned a phantom null state. Ignoring to protect UI.");
                if (localData) return { source: finalSource, data: localData }; 
                throw new Error("Phantom State Detected");
            }
            
            const mergedData = localData ? { ...cloudData, ...localData } : cloudData;
            return { source: finalSource, data: mergedData };
            
        } catch (err) {
            console.error("[API] Cloud sync failed or returned invalid data.");
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
        // 🔥 THE DUMMY FIREWALL: Instant success for optimistic UI rendering
        if (device.isDummy) {
            return { success: true, source: "cloud", returnedState: null };
        }

        const commandWrapper = {
            v: 2,
            ts: Math.floor(Date.now() / 1000),
            ...payload
        };

        const now = Date.now();
        
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

    async checkLatestFirmware(model) {
        try {
            const response = await fetch("https://raw.githubusercontent.com/nafishfuad/AquaSync/main/firmware.json?t=" + Date.now());
            if (!response.ok) return null;
            
            const data = await response.json();
            return data[model] || null; 
        } catch (err) {
            console.error("[API] Failed to fetch OTA manifest from GitHub.", err);
            return null;
        }
    }
};