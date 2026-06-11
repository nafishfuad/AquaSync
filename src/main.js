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
        this.switchTab('page-control'); 
        this.renderActiveUI();

        this.runSyncLoop();

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === 'visible') {
                this.runSyncLoop();
            }
        });
    },

    switchTab(targetId) {
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            
            // 🔥 CO2 VISUAL SYNC: If you toggle Light, and CO2 isn't separate, visually toggle CO2 instantly!
            if (payload.hasOwnProperty("isLightOn") && !device.metrics.isCO2ScheduleSeparate) {
                payload.isCO2On = payload.isLightOn;
            }

            // 1. Instantly update the Local Cache
            DeviceStore.updateDeviceState(device.hwid, payload);

            if (!fastUI) {
                AquaSync.renderActiveUI(); // Redraw immediately for snappy button feels
                const res = await API.sendCommand(device, payload);
                if (res && res.returnedState) {
                    DeviceStore.updateDeviceState(device.hwid, res.returnedState);
                    AquaSync.renderActiveUI(); // 🔥 FIX: Final redraw to lock in hardware truth
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