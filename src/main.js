// src/main.js

import { DeviceStore } from './state.js';
import { API } from './api.js';
import { buildInsightsPanel, buildControlPanel, buildSystemPanel, buildColorPanel } from './ui-factory.js';
import { renderEmptyState, renderPairingWizard } from './components/system/PairingWizard.js';
import { initTopNav } from './components/system/TopNav.js';
import { debounce } from './utils.js'; // 🔥 Importing the Debounce Tool

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

        // 1. Fetch data ONCE on initial load
        this.runSyncLoop();

        // 2. Fetch data ONLY when returning to the app, destroying the spam loop!
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
            
            // 🔥 Auto-Heal Local IP from Firebase
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

        // 🔥 THE DEBOUNCER: Waits 300ms after you stop moving the slider before sending to the network
        const debouncedNetworkSend = debounce(async (targetDevice, payload) => {
            const res = await API.sendCommand(targetDevice, payload);
            // If the ESP32 replied instantly with its updated state, sync it quietly to memory
            if (res && res.returnedState) {
                DeviceStore.updateDeviceState(targetDevice.hwid, res.returnedState);
            }
        }, 300);

        const commandHook = async (payload, fastUI = false) => {
            // 1. Instantly update the Local Cache (UI stays buttery smooth without waiting for WiFi)
            DeviceStore.updateDeviceState(device.hwid, payload);

            if (!fastUI) {
                // For standard buttons/toggles -> Send Immediately and Redraw UI
                this.renderActiveUI();
                const res = await API.sendCommand(device, payload);
                if (res && res.returnedState) {
                    DeviceStore.updateDeviceState(device.hwid, res.returnedState);
                    this.renderActiveUI(); // Force a final redraw to match the absolute hardware truth
                }
            } else {
                // For Sliders & Color Wheels -> Send through the Debounce Dam
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