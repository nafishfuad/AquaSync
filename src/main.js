// src/main.js

import { DeviceStore } from './state.js';
import { API } from './api.js';
import { buildInsightsPanel, buildControlPanel, buildSystemPanel, buildColorPanel } from './ui-factory.js';
import { renderEmptyState, renderPairingWizard } from './components/system/PairingWizard.js';
import { initTopNav } from './components/system/TopNav.js';

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

        // 2. 🔥 THE FIX: Fetch data ONLY when returning to the app, destroying the spam loop!
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

        const commandHook = async (payload, fastUI = false) => {
            // 🔥 REMOVED THE BAD AUTO-MODE OVERRIDE LOGIC HERE
            
            DeviceStore.updateDeviceState(device.hwid, payload);
            
            // 🔥 THE FIX: Only redraw the screen if it's NOT a fastUI slider change
            if (!fastUI) {
                this.renderActiveUI();
                await API.sendCommand(device, payload);
            } else {
                API.sendCommand(device, payload);
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