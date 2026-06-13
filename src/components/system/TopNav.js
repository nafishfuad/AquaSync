// src/components/system/TopNav.js
// ... (keep your imports the same)

export function initTopNav() {
    const slot = document.getElementById("slot-top-nav");
    if (!slot) return;

    const savedTheme = localStorage.getItem("aquasync_theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
    } else {
        document.body.classList.remove("light-theme");
    }

    const activeDevice = DeviceStore.getActiveDevice();
    const allDevices = DeviceStore.devices;

    if (!activeDevice) {
        slot.innerHTML = "";
        return;
    }

    // 🔥 NEW: Helper to perfectly format the HWID for the UI
    const formatHwidDisplay = (id) => {
        if (!id) return "";
        let cleanId = id.toUpperCase();
        // If it already has the dash, just grab the first 10 characters max
        if (cleanId.startsWith("AQUA-")) return cleanId.substring(0, 10);
        // If it's missing the dash (like AQUA70AF0...), format it properly
        if (cleanId.startsWith("AQUA")) return "AQUA-" + cleanId.substring(4, 9);
        return cleanId.substring(0, 10); 
    };

    slot.innerHTML = `
        <div class="pointer-events-auto w-full max-w-[1200px] bg-cardbg border border-gray-700/50 shadow-md rounded-2xl px-4 py-3 flex justify-between items-center transition-colors duration-300">
            </div>

        <div class="pointer-events-auto w-full max-w-[1200px] bg-cardbg/90 backdrop-blur-xl border border-gray-700/50 shadow-md rounded-2xl relative mt-3 transition-colors duration-300">
            
            <div id="device-dropdown-menu" class="hidden absolute top-[110%] left-0 w-full bg-cardbg border border-gray-700/50 shadow-2xl rounded-2xl p-3 z-[250] flex-col space-y-2 transition-colors duration-300">
                ${Object.values(allDevices).map(dev => `
                    <div class="bg-cardbg border border-gray-700/50 rounded-xl p-3 flex justify-between items-center ${dev.hwid === activeDevice.hwid ? 'border-aqua/50 bg-aqua/5' : ''} transition-colors duration-300">
                        <div class="flex items-center space-x-3">
                            <span class="text-xl">🐠</span>
                            <div class="flex flex-col">
                                <span class="text-sm font-bold text-white">${dev.name}</span>
                                <span class="text-[8px] text-gray-500 uppercase tracking-widest">${formatHwidDisplay(dev.hwid)}</span>
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
                
                <button id="btn-add-new-device" class="w-full bg-cardbg border border-gray-700/50 hover:border-gray-500 text-aqua font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 mt-2 flex items-center justify-center">
                    <span class="text-lg mr-2">+</span> Add A New Device
                </button>
            </div>
        </div>
    `;

    document.getElementById("btn-theme-toggle").onclick = () => {
        const isLight = document.body.classList.toggle("light-theme");
        localStorage.setItem("aquasync_theme", isLight ? "light" : "dark");
        
        document.getElementById("icon-sun").classList.toggle("hidden", isLight);
        document.getElementById("icon-sun").classList.toggle("block", !isLight);
        
        document.getElementById("icon-moon").classList.toggle("hidden", !isLight);
        document.getElementById("icon-moon").classList.toggle("block", isLight);

        if (window.AquaSync && window.AquaSync.renderActiveUI) {
            window.AquaSync.renderActiveUI();
        }
    };

    document.getElementById("btn-nav-info").onclick = renderAboutModal;

    const trigger = document.getElementById("device-dropdown-trigger");
    const menu = document.getElementById("device-dropdown-menu");
    const arrow = document.getElementById("dropdown-arrow");

    trigger.onclick = () => {
        menu.classList.toggle("hidden");
        menu.classList.toggle("flex");
        arrow.style.transform = menu.classList.contains("hidden") ? "rotate(0deg)" : "rotate(180deg)";
    };

    document.getElementById("btn-add-new-device").onclick = () => {
        menu.classList.add("hidden");
        menu.classList.remove("flex");
        renderPairingWizard(() => window.location.reload());
    };

    document.querySelectorAll(".btn-switch-device").forEach(btn => {
        btn.onclick = (e) => {
            const targetHwid = e.target.getAttribute("data-hwid");
            DeviceStore.setActiveDevice(targetHwid);
            window.location.reload(); 
        };
    });

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