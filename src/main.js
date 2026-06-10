// src/main.js

import { DeviceStore } from './state.js';
import { API } from './api.js';
// We will build ui-factory.js next, but we import its functions here:
import { buildInsightsPanel, buildControlPanel, buildSystemPanel } from './ui-factory.js';
import { renderEmptyState, renderPairingWizard } from './components/system/PairingWizard.js';

const AquaSync = {
    pollingTimer: null,

    async init() {
        console.log("🌊 AquaSync Ecosystem Initializing...");
        
        // 1. Hydrate memory
        DeviceStore.init();
        
        // 2. Security Check: Are there any devices?
        if (Object.keys(DeviceStore.devices).length === 0) {
            // Hide the main dashboard and nav
            document.querySelector("main").classList.add("hidden");
            document.querySelector("nav").classList.add("hidden");
            document.querySelector("header").classList.add("hidden");
            
            // Show the pairing flow
            renderEmptyState();
            return; // Stop initialization here. The app will reload once paired.
        }

        // ... continue with normal initialization if devices exist
        this.updateHeader();
        this.switchTab('page-control'); 
        this.runSyncLoop();
        this.pollingTimer = setInterval(() => this.runSyncLoop(), 5000);
    },

    switchTab(targetId) {
        // Hide all pages
        const pages = ['page-insights', 'page-control', 'page-network'];
        pages.forEach(id => {
            document.getElementById(id).classList.add('hidden');
            document.getElementById(`nav-${id}`).classList.remove('text-aqua');
            document.getElementById(`nav-${id}`).classList.add('text-gray-500');
        });

        // Show target page
        document.getElementById(targetId).classList.remove('hidden');
        document.getElementById(`nav-${targetId}`).classList.add('text-aqua');
        document.getElementById(`nav-${targetId}`).classList.remove('text-gray-500');

        // Scroll to top cleanly
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    updateHeader() {
        const device = DeviceStore.getActiveDevice();
        if (device) {
            document.getElementById("ui-active-model").innerText = device.model;
        }
    },

    setConnectionStatus(status) {
        const dot = document.getElementById("ui-connection-status");
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

            // Redraw the active UI
            this.renderActiveUI();
        } else {
            this.setConnectionStatus("offline");
        }
    },

    renderActiveUI() {
        const device = DeviceStore.getActiveDevice();
        if (!device) return;

        // Create the callback hook that the UI components will use when a user moves a slider
        const commandHook = async (payload) => {
            // Optimistic fast-update to UI (makes sliders feel instant)
            DeviceStore.updateDeviceState(device.hwid, payload);
            this.renderActiveUI();
            
            // Background push to hardware
            await API.sendCommand(device, payload);
        };

        // Command the UI Factory to build/update the DOM
        buildControlPanel(device, commandHook);
        buildInsightsPanel(device);
        buildSystemPanel(device, API);
    }
};

// Bind to window so HTML inline onclick handlers (nav buttons) can access it
window.AquaSync = AquaSync;

// Boot the app when the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    AquaSync.init();
});