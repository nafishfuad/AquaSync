// src/main.js

import { DeviceStore } from './state.js';
import { API } from './api.js';
import { buildInsightsPanel, buildControlPanel, buildSystemPanel, buildColorPanel } from './ui-factory.js';
import { renderEmptyState, renderPairingWizard } from './components/system/PairingWizard.js';
import { initTopNav } from './components/system/TopNav.js';
import { debounce } from './utils.js'; 

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
        const dot = document.getElementById("ui-connection-status");
        if (!dot) return;
        dot.className = "w-3 h-3 rounded-full transition-colors duration-300 ";
        if (status === "local") dot.className += "bg-aqua shadow-[0_0_10px_rgba(0,242,254,0.8)]";
        else if (status === "cloud") dot.className += "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]";
        else dot.className += "bg-red-500";
    },

    async runSyncLoop() {
        const device = DeviceStore.getActiveDevice();
        if (!device) return;

        const response = await API.syncDevice(device);
        
        if (response && response.data) {
            this.setConnectionStatus(response.source);
            
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

        const debouncedNetworkSend = debounce(async (targetDevice, payload) => {
            const res = await API.sendCommand(targetDevice, payload);
            if (res && res.returnedState) {
                DeviceStore.updateDeviceState(targetDevice.hwid, res.returnedState);
                AquaSync.renderActiveUI(); // 🔥 FIX: Tell the UI to redraw after slider release!
            }
        }, 300);

        const commandHook = async (payload, fastUI = false) => {
            
            // 1. Light overrides CO2 (Visual Sync for the UI)
            if (payload.hasOwnProperty("isLightOn") && !device.metrics.isCO2ScheduleSeparate) {
                payload.isCO2On = payload.isLightOn;
            }

            // 🔥 BUG 2 FIX: The Auto-Decoupler
            // If the user clicks the CO2 button manually, but they are currently slaved together...
            if (payload.hasOwnProperty("isCO2On") && !payload.hasOwnProperty("isLightOn") && !payload.hasOwnProperty("isCO2ScheduleSeparate")) {
                if (!device.metrics.isCO2ScheduleSeparate) {
                    payload.isCO2ScheduleSeparate = true; // Auto-detach them!
                    DeviceStore.updateDeviceState(device.hwid, { isCO2ScheduleSeparate: true });
                }
            }

            // Instantly update the Local Cache
            DeviceStore.updateDeviceState(device.hwid, payload);

            if (!fastUI) {
                AquaSync.renderActiveUI(); 
                const res = await API.sendCommand(device, payload);
                if (res && res.returnedState) {
                    DeviceStore.updateDeviceState(device.hwid, res.returnedState);
                    AquaSync.renderActiveUI(); 
                }
            } else {
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
document.addEventListener("DOMContentLoaded", () => AquaSync.init());