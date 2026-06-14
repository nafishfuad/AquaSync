// src/components/system/PairingWizard.js
import { DeviceStore } from '../../state.js';
import { API } from '../../api.js';

let heartbeatInterval = null;

export function setupDemoDevice() {
    const demoId = "DEMO-" + Math.floor(Math.random() * 10000);
    DeviceStore.addDevice(demoId, "AS-Standard", "Virtual Demo Tank");
    
    const dev = DeviceStore.devices[demoId];
    
    // Tag as fake
    dev.isDummy = true;
    dev.network.isWiFiConnected = true;
    
    // Seed realistic metrics
    dev.metrics.isAutoMode = true;
    dev.metrics.isLightOn = true;
    dev.metrics.currentBrightness = 85;
    dev.metrics.isDimmerEnabled = true;
    dev.metrics.sunriseMins = 30;
    dev.metrics.sunsetMins = 30;
    dev.metrics.isFanEnabled = true;
    dev.metrics.fanSpeed = 60;
    dev.metrics.isCO2ScheduleSeparate = true;
    
    // Inject a beautiful preset Analytics Graph so the Insights page isn't empty!
    dev.analyticsData = {
        today: {
            totalActive: "08h 30m",
            loadShedding: "00h 00m",
            hourlyGraph: [0,0,0,0,0,0,0,0,30,60,60,60,60,60,60,60,60,30,0,0,0,0,0,0],
            awakeData: Array(24).fill(60)
        },
        week: {
            totalActive: "59h 30m",
            avgLight: "08h 30m",
            loadShedding: "00h 00m",
            dailyGraph: [8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5]
        },
        month: {
            totalActive: "255h 00m",
            avgLight: "08h 30m",
            loadShedding: "00h 00m",
            dailyGraph: Array(30).fill(8.5)
        }
    };
    
    DeviceStore.setActiveDevice(demoId);
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
            alert("Please enter both Wi-Fi Name and Password.");
            return;
        }

        btnSend.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Sending...`;
        btnSend.classList.add("opacity-50", "pointer-events-none");

        const success = await API.sendWifiProvisioning(ssid, pass, secureToken, deviceName);

        if (success) {
            btnSend.innerHTML = `✅ Paired!`;
            DeviceStore.addDevice(discoveredHwid, "AS-Standard", deviceName);
            DeviceStore.updateNetwork(discoveredHwid, null, true); 
            
            setTimeout(() => {
                closeModal();
                if (onComplete) onComplete(); 
            }, 1500);
        } else {
            btnSend.innerHTML = `❌ Failed. Try Again`;
            btnSend.classList.remove("opacity-50", "pointer-events-none");
            setTimeout(() => btnSend.innerHTML = `PAIR DEVICE`, 2000);
        }
    });
}

// Renders the initial "No Devices Linked" screen
export function renderEmptyState() {
    const slot = document.getElementById("slot-global-overlays");
    const template = document.getElementById("tpl-empty-splash");
    if (!template || !slot) return;

    slot.innerHTML = "";
    const clone = template.content.cloneNode(true);
    
    // 🔥 THE FIX: Search the template BEFORE we put it on screen, fallback to ANY button to guarantee it works
    let targetBtn = clone.querySelector("#btn-start-discovery") || clone.querySelector("button");
    
    if (targetBtn) {
        targetBtn.addEventListener("click", () => {
            renderPairingWizard(() => {
                slot.classList.add("hidden");
                slot.classList.remove("flex");
                window.location.reload(); 
            });
        });

        // Inject the Demo Button right below the Pair button dynamically!
        const demoBtn = document.createElement("button");
        demoBtn.className = "w-full bg-[#121212] border border-gray-700 hover:bg-gray-800 text-gray-300 font-bold py-3.5 rounded-xl text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-sm mt-3 flex items-center justify-center";
        demoBtn.innerHTML = `<span class="mr-2 text-purple-400 text-base">🎮</span> Simulate Demo Tank`;
        demoBtn.onclick = () => setupDemoDevice();
        
        targetBtn.parentNode.insertBefore(demoBtn, targetBtn.nextSibling);
    }

    // Append to live DOM
    slot.classList.remove("hidden");
    slot.classList.add("flex");
    slot.appendChild(clone);
}