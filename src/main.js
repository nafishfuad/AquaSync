// src/main.js

import { DeviceStore } from './state.js';
import { API } from './api.js';
import { buildInsightsPanel, buildControlPanel, buildSystemPanel, buildColorPanel } from './ui-factory.js';
import { renderEmptyState, renderPairingWizard } from './components/system/PairingWizard.js';
import { initTopNav } from './components/system/TopNav.js';
import { debounce } from './utils.js'; 
import { showOutageModal } from './components/system/OutageModal.js'; // 🔥 NEW: Import the global modal

const AquaSync = {
    async init() {
        console.log("🌊 AquaSync Ecosystem Initializing...");
        DeviceStore.init();
        
        if (Object.keys(DeviceStore.devices).length === 0) {
            document.querySelector("main").classList.add("hidden");
            document.querySelector("nav").classList.add("hidden");
            document.getElementById("slot-top-nav").classList.add("hidden");
            renderEmptyState();
            return; 
        }

        initTopNav();
        
        // 🔥 THE REFRESH FIX: Read the last open tab from memory (default to page-control)
        const lastOpenTab = localStorage.getItem('aquasync_active_tab') || 'page-control';
        this.switchTab(lastOpenTab); 
        
        this.renderActiveUI();
        this.runSyncLoop();

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === 'visible') {
                this.runSyncLoop();
            }
        });
    },

    switchTab(targetId) {
        // 🔥 THE REFRESH FIX: Save the new tab to memory whenever you click a nav button
        localStorage.setItem('aquasync_active_tab', targetId);

        const pages = ['page-insights', 'page-control', 'page-color', 'page-network'];
        pages.forEach(id => {
            const pageEl = document.getElementById(id);
            const navEl = document.getElementById(`nav-${id}`);
            if (pageEl) pageEl.classList.add('hidden');
            if (navEl) {
                navEl.classList.remove('text-aqua');
                navEl.classList.add('text-gray-500');
            }
        });

        const targetPage = document.getElementById(targetId);
        const targetNav = document.getElementById(`nav-${targetId}`);
        if (targetPage) targetPage.classList.remove('hidden');
        if (targetNav) {
            targetNav.classList.add('text-aqua');
            targetNav.classList.remove('text-gray-500');
        }
        
        // Only scroll to top if we are actually clicking a tab, not on page load
        if (event && event.type === 'click') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    setConnectionStatus(status) {
        this.currentStatus = status;
        
        // --- 1. TOP NAV LOGIC (Grey, Blue Pulse, Purple Pulse) ---
        const topPing = document.getElementById("ui-top-ping");
        const topDot = document.getElementById("ui-top-dot");
        
        if (topPing && topDot) {
            topPing.className = "absolute inline-flex h-full w-full rounded-full opacity-75";
            topDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 transition-colors duration-300";
            
            if (status === "local") {
                topPing.classList.add("bg-blue-400", "animate-ping");
                topDot.classList.add("bg-blue-500");
            } else if (status === "cloud") {
                topPing.classList.add("bg-purple-400", "animate-ping");
                topDot.classList.add("bg-purple-500");
            } else { 
                // Offline -> Static Grey
                topPing.classList.add("hidden"); 
                topDot.classList.add("bg-gray-500"); 
            }
        }
        
        // --- 2. TODAY'S OVERVIEW LOGIC (Red Static, Blue Pulse) ---
        const overviewPing = document.getElementById("ui-overview-ping");
        const overviewDot = document.getElementById("ui-overview-dot");
        
        if (overviewPing && overviewDot) {
            overviewPing.className = "absolute inline-flex h-full w-full rounded-full opacity-75";
            overviewDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 transition-colors duration-300";
            
            if (status === "offline") {
                // Offline -> Static Red
                overviewPing.classList.add("hidden"); 
                overviewDot.classList.add("bg-red-500"); 
            } else { 
                // Online (Local OR Cloud) -> Blue Pulse
                overviewPing.classList.add("bg-blue-400", "animate-ping");
                overviewDot.classList.add("bg-blue-500");
            }
        }
    },

    // 🔥 NEW: Top Nav Sync Animation Controller
    updateSyncStatus(state) {
        const dot = document.getElementById("ui-status-dot");
        const spin = document.getElementById("ui-status-spinner");
        const check = document.getElementById("ui-status-check");
        if (!dot || !spin || !check) return; 

        // Hide all icons first
        [dot, spin, check].forEach(el => el.classList.add('hidden'));

        if (state === 'syncing') {
            spin.classList.remove('hidden');
        } else if (state === 'success') {
            check.classList.remove('hidden');
            // Revert back to the dot after 5 seconds of showing the checkmark
            setTimeout(() => {
                if (!spin.classList.contains('hidden') === false) { // Only revert if not currently syncing something else
                    this.updateSyncStatus('idle');
                }
            }, 5000);
        } else {
            dot.classList.remove('hidden');
        }
    },

    async runSyncLoop() {
        const device = DeviceStore.getActiveDevice();
        if (!device) return;

        // 🔥 THE FIX: Allow it to retry if the previous fetch failed and returned "Unknown"
        if (device.firmware.latest === "Checking..." || device.firmware.latest === "Unknown") {
            try {
                const fullManifestReq = await fetch("https://raw.githubusercontent.com/nafishfuad/AquaSync/main/firmware.json?t=" + Date.now());
                if (fullManifestReq.ok) {
                    const fullManifest = await fullManifestReq.json();
                    
                    device.firmware.latest = fullManifest[device.model]?.version || "Unknown";
                    device.firmware.downloadUrl = fullManifest[device.model]?.firmware_url || "";
                    
                    device.companion.latest = fullManifest["CompanionApp"]?.version || "Unknown";
                    device.companion.downloadUrl = fullManifest["CompanionApp"]?.download_url || "";
                    
                    DeviceStore.save();
                    this.renderActiveUI();
                } else {
                    throw new Error("Manifest not OK");
                }
            } catch (e) {
                device.firmware.latest = "Unknown";
                device.companion.latest = "Unknown";
                DeviceStore.save();
                this.renderActiveUI();
            }
        }

        const response = await API.syncDevice(device);
        
        if (response && response.data) {
            
            // 🔥 OFFLINE GHOST FIX: Check the Heartbeat Timestamp
            const nowSecs = Math.floor(Date.now() / 1000);
            const lastBeat = response.data.lastHeartbeatTs || nowSecs;
            const timeSinceLastBeat = nowSecs - lastBeat;

            // If pulling from cloud and heartbeat is older than 1 mins (60s), it's dead
            if (response.source === "cloud" && timeSinceLastBeat > 60) {
                this.setConnectionStatus("offline");
            } else {
                this.setConnectionStatus(response.source);
            }
            
            if (response.data.localIP && response.data.localIP !== device.localIP) {
                DeviceStore.updateNetwork(device.hwid, response.data.localIP, true);
            }
            if (response.data.capabilities) {
                DeviceStore.updateDeviceState(device.hwid, response.data, response.data.capabilities);
            } else {
                DeviceStore.updateDeviceState(device.hwid, response.data);
            }

            this.renderActiveUI();
        } else {
            this.setConnectionStatus("offline");
        }
    },

    renderActiveUI() {
        const device = DeviceStore.getActiveDevice();
        if (!device) return;

        // 🔥 TIER 2: BATCH DATA (5-Second Quiet Window for Schedules/Sliders)
        const debouncedNetworkSend = debounce(async (targetDevice, payload) => {
            const res = await API.sendCommand(targetDevice, payload);
            if (res && res.success) {
                AquaSync.updateSyncStatus('success'); // Show Blue Checkmark
                if (res.returnedState) {
                    DeviceStore.updateDeviceState(targetDevice.hwid, res.returnedState);
                    AquaSync.renderActiveUI(); 
                }
            } else {
                AquaSync.updateSyncStatus('idle');
            }
        }, 5000); // 5000ms = 5 Seconds

        // 🔥 THE MASTER COMMAND HOOK (Handles Optimistic UI)
        // fastUI = true -> Batch Data (Sliders/Inputs)
        // fastUI = false -> Quick Data (Buttons)
        const commandHook = async (payload, fastUI = false) => {
            
            // Link Light and CO2 visually if they are not separated
            if ((payload.hasOwnProperty("isLightOn") || payload.hasOwnProperty("currentBrightness")) && !device.metrics.isCO2ScheduleSeparate) {
                payload.isCO2On = payload.hasOwnProperty("isLightOn") ? payload.isLightOn : (payload.currentBrightness > 0);
            }

            // OPTIMISTIC UI: Update the Local Cache instantly and redraw!
            DeviceStore.updateDeviceState(device.hwid, payload);
            AquaSync.renderActiveUI(); 

            // Trigger the loading spinner in the Nav Bar
            AquaSync.updateSyncStatus('syncing');

            if (!fastUI) {
                // TIER 1: QUICK DATA (Execute Immediately)
                const res = await API.sendCommand(device, payload);
                if (res && res.success) {
                    AquaSync.updateSyncStatus('success'); // Show Blue Checkmark
                    if (res.returnedState) {
                        DeviceStore.updateDeviceState(device.hwid, res.returnedState);
                        AquaSync.renderActiveUI(); 
                    }
                } else {
                    AquaSync.updateSyncStatus('idle');
                }
            } else {
                // TIER 2: BATCH DATA (Send to 5-Second Timer)
                debouncedNetworkSend(device, payload);
            }
        };

        buildControlPanel(device, commandHook);
        buildInsightsPanel(device);
        buildColorPanel(device, commandHook);
        buildSystemPanel(device, API, commandHook);
    }
};

window.AquaSync = AquaSync;
// 🔥 NEW: Attach modal function globally for inline HTML onclick handlers
window.showOutageModal = showOutageModal; 

document.addEventListener("DOMContentLoaded", () => AquaSync.init());