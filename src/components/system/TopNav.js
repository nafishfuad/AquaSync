// src/components/system/TopNav.js

import { DeviceStore } from '../../state.js';
import { renderAboutModal } from './AboutModal.js';
import { renderPairingWizard, renderEmptyState } from './PairingWizard.js';

export function initTopNav() {
    const slot = document.getElementById("slot-top-nav");
    if (!slot) return;

    // 🔥 THEME INITIALIZATION: Check memory and apply instantly
    const savedTheme = localStorage.getItem("aquasync_theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
    } else {
        document.body.classList.remove("light-theme");
    }

    const activeDevice = DeviceStore.getActiveDevice();
    const allDevices = DeviceStore.devices;

    // If no devices, don't render the nav
    if (!activeDevice) {
        slot.innerHTML = "";
        return;
    }

    slot.innerHTML = `
        <div class="pointer-events-auto w-full max-w-[1200px] bg-[#121212] border border-gray-800 shadow-md rounded-2xl px-4 py-3 flex justify-between items-center transition-colors duration-300">
            <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-gradient-to-br from-aqua to-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(0,242,254,0.3)]">
                    <span class="text-sm">🌊</span>
                </div>
                <div class="flex flex-col justify-center">
                    <h1 class="text-white font-bold tracking-wider uppercase text-sm leading-tight">AquaSync</h1>
                    <span class="text-[8px] text-aqua font-bold tracking-widest uppercase">Ecosystem</span>
                </div>
            </div>

            <div class="flex items-center space-x-3 text-gray-400">
                <button id="btn-theme-toggle" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-800 transition-colors active:scale-95 group">
                    <svg id="icon-sun" class="w-4 h-4 ${savedTheme === 'dark' ? 'block' : 'hidden'} group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    <svg id="icon-moon" class="w-4 h-4 ${savedTheme === 'light' ? 'block' : 'hidden'} group-hover:text-aqua transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                </button>
                
                <button id="btn-nav-info" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-800 transition-colors border border-gray-700 active:scale-95">
                    <span class="text-xs font-bold">i</span>
                </button>
                <button id="ui-connection-status" class="w-2.5 h-2.5 rounded-full bg-gray-500 ml-2 transition-colors duration-300"></button>
            </div>
        </div>

        <div class="pointer-events-auto w-full max-w-[1200px] bg-cardbg/90 backdrop-blur-xl border border-gray-700/50 shadow-[0_10px_30px_rgba(0,0,0,0.5)] rounded-2xl relative mt-3 transition-colors duration-300">
            
            <div id="device-dropdown-trigger" class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-800/50 rounded-2xl transition-colors">
                <div class="flex items-center space-x-3">
                    <span class="text-2xl drop-shadow-md">🐠</span>
                    <div class="flex flex-col">
                        <span class="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Active Device</span>
                        <span id="ui-active-name" class="text-white font-bold text-sm tracking-wide">${activeDevice.name}</span>
                    </div>
                </div>
                <div class="flex items-center space-x-3">
                    <span id="ui-active-model" class="text-[9px] text-aqua bg-aqua/10 border border-aqua/20 px-2 py-1 rounded-full font-bold tracking-widest uppercase">${activeDevice.model}</span>
                    <span id="dropdown-arrow" class="text-gray-500 transition-transform duration-300">▼</span>
                </div>
            </div>

            <div id="device-dropdown-menu" class="hidden absolute top-[110%] left-0 w-full bg-[#1a1a1a] border border-gray-700 shadow-2xl rounded-2xl p-3 z-[250] flex-col space-y-2 transition-colors duration-300">
                ${Object.values(allDevices).map(dev => `
                    <div class="bg-[#121212] border border-gray-800 rounded-xl p-3 flex justify-between items-center ${dev.hwid === activeDevice.hwid ? 'border-aqua/50 bg-aqua/5' : ''} transition-colors duration-300">
                        <div class="flex items-center space-x-3">
                            <span class="text-xl">🐠</span>
                            <div class="flex flex-col">
                                <span class="text-sm font-bold text-white">${dev.name}</span>
                                <span class="text-[8px] text-gray-500 uppercase tracking-widest">${dev.hwid}</span>
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            ${dev.hwid !== activeDevice.hwid ? `
                                <button class="btn-switch-device bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95" data-hwid="${dev.hwid}">Select</button>
                            ` : `<span class="px-3 py-1.5 text-[9px] font-bold text-aqua uppercase tracking-widest">Active</span>`}
                            <button class="btn-remove-device bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95" data-hwid="${dev.hwid}">Remove</button>
                        </div>
                    </div>
                `).join('')}
                
                <button id="btn-add-new-device" class="w-full bg-cardbg border border-gray-700 hover:border-gray-500 text-aqua font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 mt-2 flex items-center justify-center">
                    <span class="text-lg mr-2">+</span> Add A New Device
                </button>
            </div>
        </div>
    `;

    // --- EVENT LISTENERS ---

    // 🔥 THEME TOGGLE LOGIC
    document.getElementById("btn-theme-toggle").onclick = () => {
        const isLight = document.body.classList.toggle("light-theme");
        localStorage.setItem("aquasync_theme", isLight ? "light" : "dark");
        
        // Swap Icons smoothly
        document.getElementById("icon-sun").classList.toggle("hidden", isLight);
        document.getElementById("icon-sun").classList.toggle("block", !isLight);
        
        document.getElementById("icon-moon").classList.toggle("hidden", !isLight);
        document.getElementById("icon-moon").classList.toggle("block", isLight);

        // Force UI Redraw so Chart.js canvas colors update
        if (window.AquaSync && window.AquaSync.renderActiveUI) {
            window.AquaSync.renderActiveUI();
        }
    };

    // Info Modal
    document.getElementById("btn-nav-info").onclick = renderAboutModal;

    // Dropdown Toggle Logic
    const trigger = document.getElementById("device-dropdown-trigger");
    const menu = document.getElementById("device-dropdown-menu");
    const arrow = document.getElementById("dropdown-arrow");

    trigger.onclick = () => {
        menu.classList.toggle("hidden");
        menu.classList.toggle("flex");
        arrow.style.transform = menu.classList.contains("hidden") ? "rotate(0deg)" : "rotate(180deg)";
    };

    // Add New Device
    document.getElementById("btn-add-new-device").onclick = () => {
        menu.classList.add("hidden");
        menu.classList.remove("flex");
        renderPairingWizard(() => window.location.reload());
    };

    // Switch Device
    document.querySelectorAll(".btn-switch-device").forEach(btn => {
        btn.onclick = (e) => {
            const targetHwid = e.target.getAttribute("data-hwid");
            DeviceStore.setActiveDevice(targetHwid);
            window.location.reload(); // Cleanest way to refresh all components to new device state
        };
    });

    // Remove Device
    document.querySelectorAll(".btn-remove-device").forEach(btn => {
        btn.onclick = (e) => {
            if (confirm("Are you sure you want to remove this device from the app?")) {
                const targetHwid = e.target.getAttribute("data-hwid");
                DeviceStore.removeDevice(targetHwid);
                
                if (Object.keys(DeviceStore.devices).length === 0) {
                    renderEmptyState();
                } else {
                    window.location.reload();
                }
            }
        };
    });
}