// src/main.js

import { DeviceStore } from './state.js';
import { API } from './api.js';
import { buildInsightsPanel, buildControlPanel, buildSystemPanel, buildColorPanel } from './ui-factory.js';
import { renderEmptyState, renderPairingWizard } from './components/system/PairingWizard.js';

const AquaSync = {
    pollingTimer: null,

    async init() {
        console.log("🌊 AquaSync Ecosystem Initializing...");
        
        // 1. Hydrate memory
        DeviceStore.init();
        
        // 2. Security Check: Are there any devices?
        if (Object.keys(DeviceStore.devices).length === 0) {
            // Hide the standard UI elements
            document.querySelector("main").classList.add("hidden");
            document.querySelector("nav").classList.add("hidden");
            document.querySelector("header").classList.add("hidden");
            
            // Show the pairing flow
            renderEmptyState();
            return; // Stop initialization here.
        }

        // 3. Initial UI Setup
        this.updateHeader();
        this.switchTab('page-control'); 
        
        // 🔥 CRITICAL FIX: Draw the UI instantly from offline memory!
        this.renderActiveUI();

        // 4. Start the Hybrid Polling Engine
        this.runSyncLoop();
        this.pollingTimer = setInterval(() => this.runSyncLoop(), 5000);
    },

    switchTab(targetId) {
        // Hide all pages
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

        // Show target page
        const targetPage = document.getElementById(targetId);
        const targetNav = document.getElementById(`nav-${targetId}`);
        if (targetPage) targetPage.classList.remove('hidden');
        if (targetNav) {
            targetNav.classList.add('text-aqua');
            targetNav.classList.remove('text-gray-500');
        }

        // Scroll to top cleanly
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    updateHeader() {
        const device = DeviceStore.getActiveDevice();
        if (device) {
            const modelEl = document.getElementById("ui-active-model");
            if (modelEl) modelEl.innerText = device.model;
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

        // Fetch from API
        const response = await API.syncDevice(device);
        
        if (response && response.data) {
            this.setConnectionStatus(response.source);
            
            // If the device sent capabilities (Local /info route), save them
            if (response.data.capabilities) {
                DeviceStore.updateDeviceState(device.hwid, response.data, response.data.capabilities);
            } else {
                // Otherwise just update the metrics (Cloud state route)
                DeviceStore.updateDeviceState(device.hwid, response.data);
            }

            // Redraw the active UI with fresh data
            this.renderActiveUI();
        } else {
            this.setConnectionStatus("offline");
        }
    },

    renderActiveUI() {
        const device = DeviceStore.getActiveDevice();
        if (!device) return;

        // Create the callback hook that the UI components use
        const commandHook = async (payload, fastUI = false) => {
            
            // 🔥 OFFLINE SIMULATION FIX:
            // If the user clicks "Resume Auto", mock the ESP32 hardware syncing the schedule
            if (payload.isAutoMode === true) {
                payload.isLightOn = true;
                payload.isCO2On = true;
                payload.isFanOn = false;
                payload.currentBrightness = device.metrics.maxBrightness;
            }
            
            // Optimistic fast-update to UI
            DeviceStore.updateDeviceState(device.hwid, payload);
            this.renderActiveUI();
            
            // Background push to hardware (Throttle if using slider fastUI)
            if (!fastUI) {
                await API.sendCommand(device, payload);
            }
        };

        // Command the UI Factory to build/update the DOM
        buildControlPanel(device, commandHook);
        buildInsightsPanel(device);
        buildColorPanel(device, commandHook);
        buildSystemPanel(device, API, commandHook);
    }
};

// Bind to window so HTML inline onclick handlers (nav buttons) can access it
window.AquaSync = AquaSync;

// Boot the app when the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    AquaSync.init();
});