// src/api.js

import { auth } from "./firebase-config.js";

const FIREBASE_URL = "https://aqua-fish-controller-default-rtdb.asia-southeast1.firebasedatabase.app";

let localFailCount = 0;
let forceCloudUntil = 0;

async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
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
    async checkHotspotHandshake() {
        try {
            const response = await fetchWithTimeout('http://192.168.4.1/api/handshake', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }, 3000);
            
            if (response.ok) return await response.json();
            return null;
        } catch (err) {
            return null; 
        }
    },

    async sendCommand(device, commandPayload) {
        if (device.isDummy) return { success: true, source: "cloud" };

        const now = Date.now();
        // Pack the entire payload exactly as it is, adding a timestamp
        const commandWrapper = { ...commandPayload, timestamp: Math.floor(now / 1000) };
        
        let useCloud = false;
        let localSucceeded = false;

        if (now < forceCloudUntil || !device.localIP || !device.network.isWiFiConnected) {
            useCloud = true;
        }

        // 1. Local Network Attempt
        if (!useCloud && device.localIP) {
            try {
                const res = await fetchWithTimeout(`http://${device.localIP}/api/control`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(commandWrapper)
                });
                if (res.ok) {
                    localFailCount = 0;
                    localSucceeded = true;
                }
            } catch (err) {
                localFailCount++;
                if (localFailCount >= 2) forceCloudUntil = now + 60000;
                useCloud = true; 
            }
        }

        // 2. Cloud WebSocket Attempt (🔥 FIX 3: Unified Push)
        try {
            const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
            const authQuery = token ? `?auth=${token}` : "";

            // Everything goes to config! The ESP32 parses "commands" out of it safely.
            if (commandWrapper.command || useCloud || !localSucceeded) {
                await fetch(`${FIREBASE_URL}/devices/${device.hwid}/config.json${authQuery}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(commandWrapper)
                });
            }
            return { success: true, source: localSucceeded ? "local" : "cloud" };

        } catch (err) {
            console.error("[API] Cloud push failed.", err);
        }
        
        return { success: localSucceeded, source: localSucceeded ? "local" : "none" };
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
            return null;
        }
    }
};