// src/components/system/PairingWizard.js
import { DeviceStore, IdentityStore } from '../../state.js';
import { showAlert } from './CustomDialogs.js';
import { API } from '../../api.js';

let heartbeatInterval = null;

export function setupDemoDevice() {
    const demoId = 'DEMO-DEVICE';
    DeviceStore.addDevice(demoId, "AS-Standard", "Virtual Demo Tank");
    
    const dev = DeviceStore.devices[demoId];
    dev.isDummy = true;
    dev.network.isWiFiConnected = true;
    
    dev.metrics.isAutoMode = true;
    dev.metrics.isLightOn = true;
    dev.metrics.currentBrightness = 85;
    dev.metrics.isDimmerEnabled = true;
    dev.metrics.sunriseMins = 30;
    dev.metrics.sunsetMins = 30;
    dev.metrics.isFanEnabled = true;
    dev.metrics.fanSpeed = 60;
    dev.metrics.isCO2ScheduleSeparate = true;
    
    // 🌊 Dynamic fluctuating realistic dummy data generator
    const mockDailyData = [];
    const mockDailyLostLight = [];
    const mockDailyAwake = [];
    
    for (let i = 0; i < 30; i++) {
        // Natural up-and-down variation between 4 to 9 hours (240 to 540 mins)
        const baseMins = 420 + Math.round(120 * Math.sin(i * 0.5)) + Math.round((Math.random() - 0.5) * 60);
        const clampedActive = Math.max(240, Math.min(540, baseMins));
        mockDailyData.push(clampedActive);
        
        // Sporadic load shedding scattered across historical days (e.g. 15m, 30m, 45m, or 60m outages)
        const hasOutage = (i % 3 === 0) || (Math.random() < 0.3);
        const outageMins = hasOutage ? [15, 30, 45, 60][Math.floor(Math.random() * 4)] : 0;
        mockDailyLostLight.push(outageMins);
        mockDailyAwake.push(1440 - outageMins);
    }
    
    dev.metrics.hourlyData = [0, 0, 0, 0, 0, 0, 0, 0, 30, 60, 60, 60, 60, 60, 60, 60, 60, 30, 0, 0, 0, 0, 0, 0];
    dev.metrics.awakeData = Array(24).fill(60);
    dev.metrics.awakeData[14] = 30; // 30 mins outage during 2:00 PM hour
    dev.metrics.outagesToday = "14:00-14:30,";
    dev.metrics.dailyData = mockDailyData;
    dev.metrics.dailyAwakeData = mockDailyAwake;
    dev.metrics.dailyLostLightData = mockDailyLostLight;
    dev.metrics.liveActiveMins = 510;
    dev.metrics.lightLoadSheddingToday = 30;
    dev.metrics.totalLoadSheddingToday = 30;
    
    DeviceStore.updateDeviceState(demoId, dev.metrics);
    DeviceStore.setActiveDevice(demoId);
    
    // 🔥 THE FIX: Explicitly force the browser to save to LocalStorage before reloading!
    DeviceStore.save(); 
    window.location.reload();
}

export function renderPairingWizard(onComplete) {
    const slot = document.getElementById("slot-global-overlays");
    const template = document.getElementById("tpl-pairing-wizard");
    if (!template || !slot) return;

    slot.innerHTML = "";
    const clone = template.content.cloneNode(true);
    
    slot.classList.remove("hidden");
    slot.classList.add("flex");
    slot.appendChild(clone);

    let secureToken = null;
    let discoveredHwid = null;

    const startHeartbeat = () => {
        heartbeatInterval = setInterval(async () => {
            const handshake = await API.checkHotspotHandshake();
            if (handshake && handshake.hw_id) {
                clearInterval(heartbeatInterval);
                secureToken = handshake.session_token;
                discoveredHwid = handshake.hw_id;
                
                document.getElementById("txt-found-hwid").innerText = `HW_ID: ${discoveredHwid}`;
                document.getElementById("view-listen").classList.add("hidden");
                document.getElementById("view-found").classList.remove("hidden");
            }
        }, 3000);
    };

    startHeartbeat();

    const closeModal = (e) => {
        if (e) e.stopPropagation(); 
        clearInterval(heartbeatInterval);
        
        slot.innerHTML = "";

        if (Object.keys(DeviceStore.devices).length === 0) {
            renderEmptyState();
        } else {
            slot.classList.add("hidden");
            slot.classList.remove("flex");
        }
    };

    document.getElementById("btn-close-wizard").addEventListener("click", closeModal);

    const btnSend = document.getElementById("btn-send-creds");
    btnSend.addEventListener("click", async () => {
        const ssid = document.getElementById("inp-ssid").value.trim();
        const pass = document.getElementById("inp-pass").value.trim();
        const deviceName = document.getElementById("inp-name").value.trim() || "AquaSync Controller";

        if (!ssid || !pass) {
            await showAlert("Missing Details", "Please enter both Wi-Fi Name and Password.");
            return;
        }

        btnSend.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Sending...`;
        btnSend.classList.add("opacity-50", "pointer-events-none");

        const success = await API.sendWifiProvisioning(ssid, pass, secureToken, deviceName);

        if (success) {
            btnSend.innerHTML = `✅ Paired!`;
            DeviceStore.addDevice(discoveredHwid, "AS-Standard", deviceName);
            DeviceStore.updateNetwork(discoveredHwid, null, true); 
            
            // Write ownerUid to Firebase so this device syncs across all browsers
            if (IdentityStore.currentUser) {
                await DeviceStore.claimDevice(discoveredHwid, IdentityStore.currentUser.uid);
            }

            // 🔥 THE FIX: Explicitly force the browser to save to LocalStorage before closing!
            DeviceStore.save(); 
            
            setTimeout(() => {
                closeModal();
                if (onComplete) onComplete(); 
            }, 3000); // Wait 3 seconds to ensure ESP32 safely restarts without connection interruption
        } else {
            btnSend.innerHTML = `❌ Failed. Try Again`;
            btnSend.classList.remove("opacity-50", "pointer-events-none");
            setTimeout(() => btnSend.innerHTML = `PAIR DEVICE`, 2000);
        }
    });
}

export function renderEmptyState() {
    const slot = document.getElementById("slot-global-overlays");
    const template = document.getElementById("tpl-empty-splash");
    if (!template || !slot) return;

    slot.innerHTML = "";
    const clone = template.content.cloneNode(true);
    
    slot.classList.remove("hidden");
    slot.classList.add("flex");
    slot.appendChild(clone);

    const startBtn = document.getElementById("btn-start-discovery");
    if (startBtn) {
        startBtn.addEventListener("click", () => {
            renderPairingWizard(() => {
                slot.classList.add("hidden");
                slot.classList.remove("flex");
                setTimeout(() => window.location.reload(), 1000); 
            });
        });

        const demoBtn = document.createElement("button");
        demoBtn.className = "w-full max-w-[280px] mx-auto bg-[#121212] border border-gray-700 hover:bg-gray-800 hover:text-white text-gray-300 font-bold py-3.5 rounded-xl text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-sm mt-3 block text-center";
        demoBtn.innerHTML = "🎮 SIMULATE DEMO TANK";
        demoBtn.onclick = () => setupDemoDevice();
        
        startBtn.parentNode.insertBefore(demoBtn, startBtn.nextSibling);

        // 🔥 NEW: Inject Cloud Login Button if NOT logged in
        if (!IdentityStore.currentUser) {
            const loginBtn = document.createElement("button");
            loginBtn.className = "w-full max-w-[280px] bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500 hover:text-white text-purple-400 font-bold py-3.5 rounded-xl text-[11px] uppercase tracking-widest transition-all active:scale-95 mt-3 block mx-auto shadow-[0_0_15px_rgba(168,85,247,0.15)]";
            loginBtn.innerText = "Log In to Cloud";
            loginBtn.onclick = () => {
                if (window.openAuthModal) window.openAuthModal();
            };
            demoBtn.parentNode.insertBefore(loginBtn, demoBtn.nextSibling);
        } else {
            // If they are logged in, show a beautiful Synced badge instead
            const userBox = document.createElement("div");
            userBox.className = "mt-5 text-center text-[10px] text-gray-500 font-bold tracking-widest uppercase border border-gray-800 bg-[#121212] rounded-xl py-2 px-4 max-w-[280px] mx-auto shadow-inner";
            userBox.innerHTML = `Synced to Cloud <br><span class="text-aqua lowercase tracking-normal text-xs">${IdentityStore.currentUser.email}</span>`;
            demoBtn.parentNode.insertBefore(userBox, demoBtn.nextSibling);
        }
    }
}
