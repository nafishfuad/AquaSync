// src/components/system/TopNav.js

import { DeviceStore } from '../../state.js';
import { renderPairingWizard } from './PairingWizard.js';
import { renderAboutModal } from './AboutModal.js'; 

// 🔥 HELPER: Fast background network scanner
async function pingUrl(url) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res.ok;
    } catch (e) {
        clearTimeout(id);
        return false;
    }
}

export function initTopNav() {
    const slot = document.getElementById("slot-top-nav");
    if (!slot) return;

    const savedTheme = localStorage.getItem("aquasync_theme") || "dark";
    if (savedTheme === "light") document.body.classList.add("light-theme");
    else document.body.classList.remove("light-theme");

    const activeDevice = DeviceStore.getActiveDevice();
    const allDevices = DeviceStore.devices;

    const formatHwidDisplay = (id) => {
        if (!id) return "";
        let cleanId = id.toUpperCase();
        if (cleanId.startsWith("AQUA-")) return cleanId.substring(0, 10);
        if (cleanId.startsWith("AQUA")) return "AQUA-" + cleanId.substring(4, 9);
        return cleanId.substring(0, 10); 
    };

    const hideStatusIcons = activeDevice ? "" : "hidden";
    const deviceName = activeDevice ? activeDevice.name : "Setup Required";

    slot.innerHTML = `
        <div class="pointer-events-auto w-full max-w-[1200px] bg-cardbg border border-gray-700/50 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-2xl backdrop-blur-md relative z-50">
            
            <div class="flex items-center gap-3 overflow-hidden pr-2">
                <div class="w-11 h-11 bg-[#121212] rounded-xl flex shrink-0 items-center justify-center border border-gray-800 shadow-inner">
                    <span class="text-2xl">🌊</span>
                </div>
                <div class="flex flex-col justify-center min-w-0">
                    
                    <h1 class="text-white font-black text-lg tracking-wide leading-none truncate mb-1">
                        AquaSync
                    </h1>
                    
                    <div class="flex items-center gap-2">
                        <p class="text-[10px] text-aqua uppercase font-bold tracking-widest truncate max-w-[90px] sm:max-w-[160px]">
                            ${deviceName}
                        </p>
                        <div id="nav-status-indicator" class="${hideStatusIcons} flex items-center gap-1.5 transition-all bg-[#121212] px-1.5 py-0.5 rounded border border-gray-800">
                            <span class="relative flex h-2 w-2 shrink-0" id="nav-status-ping-container">
                                <span id="nav-status-ping" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-500 opacity-75 hidden"></span>
                                <span id="nav-status-dot" class="relative inline-flex rounded-full h-2 w-2 bg-gray-500"></span>
                            </span>
                            <span id="nav-status-text" class="text-[9px] uppercase font-bold text-gray-500 tracking-widest truncate">Scanning...</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
                
                <button id="btn-theme-toggle" class="p-2 bg-[#121212] border border-gray-800 rounded-lg hover:border-gray-600 transition-colors text-gray-400" aria-label="Toggle Theme">
                    <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                </button>

                <button id="btn-about" class="p-2 bg-[#121212] border border-gray-800 rounded-lg hover:border-gray-600 transition-colors text-gray-400" aria-label="About">
                    <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </button>

                <div class="relative">
                    <button id="btn-nav-dropdown" class="p-2 bg-[#121212] border border-gray-800 rounded-lg hover:border-gray-600 transition-colors text-gray-400">
                        <svg id="dropdown-arrow" class="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    
                    <div id="nav-menu" class="hidden absolute right-0 mt-3 w-72 bg-cardbg border border-gray-700 rounded-xl shadow-2xl flex-col overflow-hidden z-[999]">
                        <div class="p-4 border-b border-gray-800 bg-[#121212]/50">
                            <p class="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Your Ecosystem</p>
                            <div class="space-y-2">
                                ${Object.values(allDevices).map(d => `
                                    <button data-hwid="${d.hwid}" class="btn-switch-device w-full text-left p-3 rounded-xl border ${d.hwid === activeDevice?.hwid ? 'bg-aqua/10 border-aqua/30' : 'bg-[#121212] border-gray-800 hover:border-gray-600'} transition-all group">
                                        <div class="flex items-center justify-between">
                                            <span class="text-sm font-bold ${d.hwid === activeDevice?.hwid ? 'text-aqua' : 'text-white group-hover:text-aqua'} transition-colors">${d.name}</span>
                                            ${d.hwid === activeDevice?.hwid ? '<span class="text-aqua text-lg leading-none">✓</span>' : ''}
                                        </div>
                                        <div class="text-[9px] text-gray-500 font-semibold tracking-widest uppercase mt-1">
                                            Model: ${d.model || 'AS-BASE'} <span class="opacity-50 mx-1">•</span> ID: ${formatHwidDisplay(d.hwid)}
                                        </div>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                        <button id="btn-add-new-device" class="w-full text-left px-5 py-4 text-xs font-bold text-aqua hover:bg-gray-800 transition-colors flex items-center gap-2">
                            <span class="text-lg leading-none">+</span> Add New Tank
                        </button>
                        ${activeDevice ? `
                        <button data-hwid="${activeDevice.hwid}" class="btn-remove-device w-full text-left px-5 py-4 text-xs font-bold text-red-400 border-t border-gray-800 hover:bg-red-500/10 transition-colors flex items-center gap-2">
                            <span class="text-lg leading-none">×</span> Remove Tank
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Dropdown Logic
    const trigger = document.getElementById("btn-nav-dropdown");
    const menu = document.getElementById("nav-menu");
    const arrow = document.getElementById("dropdown-arrow");

    trigger.onclick = () => {
        menu.classList.toggle("hidden");
        menu.classList.toggle("flex");
        arrow.style.transform = menu.classList.contains("hidden") ? "rotate(0deg)" : "rotate(180deg)";
    };

    // Attach Listeners for the Utility Buttons
    document.getElementById("btn-theme-toggle").onclick = () => {
        const isLight = document.body.classList.toggle("light-theme");
        localStorage.setItem("aquasync_theme", isLight ? "light" : "dark");
    };

    document.getElementById("btn-about").onclick = () => {
        renderAboutModal();
    };

    // Add New Device Logic
    document.getElementById("btn-add-new-device").onclick = () => {
        menu.classList.add("hidden");
        menu.classList.remove("flex");
        renderPairingWizard(() => window.location.reload());
    };

    // Switch Device Logic
    document.querySelectorAll(".btn-switch-device").forEach(btn => {
        btn.onclick = (e) => {
            const targetHwid = e.currentTarget.getAttribute("data-hwid");
            DeviceStore.setActiveDevice(targetHwid);
            window.location.reload(); 
        };
    });

    // Remove Device Logic
    document.querySelectorAll(".btn-remove-device").forEach(btn => {
        btn.onclick = (e) => {
            if (confirm("Are you sure you want to remove this device from the app?")) {
                const targetHwid = e.currentTarget.getAttribute("data-hwid");
                DeviceStore.removeDevice(targetHwid);
                window.location.reload();
            }
        };
    });

    // ========================================================
    // 🔥 THE AUTONOMOUS CONNECTION ENGINE
    // ========================================================
    if (!window.navWatchdogActive) {
        window.navWatchdogActive = true;
        
        const updateStatus = (mode) => {
            const ping = document.getElementById("nav-status-ping");
            const dot = document.getElementById("nav-status-dot");
            const text = document.getElementById("nav-status-text");
            if (!ping || !dot || !text) return;

            // Strip previous colors
            ping.className = "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75";
            dot.className = "relative inline-flex rounded-full h-2 w-2";
            text.className = "text-[9px] uppercase font-bold tracking-widest truncate";

            if (mode === "cloud") {
                ping.classList.add("bg-purple-500");
                dot.classList.add("bg-purple-500");
                text.classList.add("text-purple-400");
                text.innerText = "Cloud Sync";
            } else if (mode === "local") {
                ping.classList.add("bg-aqua");
                dot.classList.add("bg-aqua");
                text.classList.add("text-aqua");
                text.innerText = "Local Wi-Fi";
            } else if (mode === "hotspot") {
                ping.classList.add("bg-green-500");
                dot.classList.add("bg-green-500");
                text.classList.add("text-green-400");
                text.innerText = "ESP Hotspot";
            } else {
                ping.classList.add("hidden"); // Kill animation
                dot.classList.add("bg-gray-600");
                text.classList.add("text-gray-500");
                text.innerText = "Offline";
            }
        };

        // Poll the networks every 4 seconds to adjust colors
        setInterval(async () => {
            const dev = DeviceStore.getActiveDevice();
            if (!dev) {
                updateStatus("offline");
                return;
            }

            const now = Math.floor(Date.now() / 1000);
            const hb = dev.metrics?.lastHeartbeatTs || 0;
            
            // If heartbeat is within 45 seconds (30s pulse + 15s delay buffer), cloud is alive!
            const isCloudDead = (now - hb >= 45);

            if (isCloudDead) {
                // 1. Check if we are directly connected to the ESP's Hotspot (Green)
                if (await pingUrl("http://192.168.4.1/info")) {
                    updateStatus("hotspot");
                } 
                // 2. Check if we can talk to the ESP via Local Home Wi-Fi (Aqua)
                else if (dev.localIP && await pingUrl(`http://${dev.localIP}/info`)) {
                    updateStatus("local");
                } 
                // 3. Completely disconnected (Grey)
                else {
                    updateStatus("offline");
                }
            } else {
                // Connected to Firebase (Purple)
                updateStatus("cloud");
            }
        }, 4000);
    }
}