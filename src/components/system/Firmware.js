// src/components/system/Firmware.js

import { DeviceStore } from '../../state.js';

export function renderFirmware(container, fwState, commandHook) {
    const div = document.createElement('div');
    div.className = "bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800";

    // Grab the active device to check the ESP32's staging status
    const activeDevice = DeviceStore.getActiveDevice();
    const isStaged = activeDevice?.metrics?.ota_staged === true;

    // Determine update logic
    const isUpdateAvailable = (fwState.current !== fwState.latest) && (fwState.latest !== "Checking..." && fwState.latest !== "Unknown");

    let statusText = isUpdateAvailable ? "New firmware found! Ready to download." : "Your device is up to date.";
    let statusColor = isUpdateAvailable ? "text-amber-400" : "text-gray-500";

    if (isStaged) {
        statusText = "Download verified and staged in memory. Ready to install.";
        statusColor = "text-green-400";
    }

    // Button Styling
    const btnDlStyle = (!isStaged && isUpdateAvailable)
        ? "bg-aqua/10 text-aqua border-aqua/50 hover:bg-aqua hover:text-black shadow-[0_0_15px_rgba(0,242,254,0.15)] cursor-pointer"
        : "bg-[#121212] text-gray-600 border-gray-800 opacity-50 cursor-not-allowed";

    div.innerHTML = `
        <h2 class="text-sm uppercase text-gray-400 font-semibold tracking-wide mb-4">Firmware Update</h2>
        
        <div class="flex justify-between text-[10px] text-gray-400 mb-4 bg-[#121212] p-3 rounded-xl border border-gray-800 shadow-inner">
            <span>Device: <span class="text-white font-bold tracking-wider">${fwState.current}</span></span>
            <span>Latest: <span class="${fwState.latest === fwState.current ? 'text-gray-500' : 'text-aqua'} font-bold tracking-wider">${fwState.latest}</span></span>
        </div>

        <p id="txt-fw-status" class="text-[10px] ${statusColor} mb-4 leading-relaxed text-center font-medium">
            ${statusText}
        </p>

        <div class="space-y-3">
            ${isStaged ? `
                <div class="flex gap-3">
                    <button id="btn-fw-cancel" class="flex-1 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95">
                        Cancel
                    </button>
                    <button id="btn-fw-install" class="flex-1 bg-green-500/10 text-green-400 border border-green-500/50 hover:bg-green-500 hover:text-black shadow-[0_0_15px_rgba(74,222,128,0.15)] font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 cursor-pointer">
                        Install & Reboot
                    </button>
                </div>
            ` : `
                <button id="btn-fw-dl" ${!isUpdateAvailable ? 'disabled' : ''} class="w-full ${btnDlStyle} font-bold py-3.5 rounded-xl border text-[10px] uppercase tracking-widest transition-all active:scale-95">
                    1. Download Update
                </button>
                <button disabled class="w-full bg-[#121212] text-gray-600 border border-gray-800 opacity-50 cursor-not-allowed font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                    2. Install & Reboot
                </button>
            `}
        </div>
    `;

    const btnDl = div.querySelector('#btn-fw-dl');
    const btnInstall = div.querySelector('#btn-fw-install');
    const btnCancel = div.querySelector('#btn-fw-cancel');
    const statusTxt = div.querySelector('#txt-fw-status');

    // STEP 1: Download
    if (btnDl && !isStaged && isUpdateAvailable) {
        btnDl.onclick = () => {
            if (confirm("Begin OTA firmware download? The device will pull the update from the cloud.")) {

                // Lock the Download button
                btnDl.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Downloading...`;
                btnDl.classList.add("opacity-50", "pointer-events-none");

                statusTxt.innerText = "Downloading and flashing to secondary partition... (~30 seconds)";
                statusTxt.classList.replace("text-amber-400", "text-aqua");

                // Send the payload to the ESP32
                commandHook({
                    command: "download_ota",
                    device_model: activeDevice.model || "AS-Standard",
                    version: fwState.latest
                });
            }
        };
    }

    // STEP 2: Install & Reboot
    if (btnInstall && isStaged) {
        btnInstall.onclick = () => {
            if (confirm("Install firmware? The device will reboot to apply the new system.")) {

                // Lock the Install button
                btnInstall.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Installing...`;
                btnInstall.classList.add("opacity-50", "pointer-events-none");
                if (btnCancel) btnCancel.classList.add("opacity-50", "pointer-events-none");

                statusTxt.innerText = "Rebooting into new firmware... Please wait.";

                // Send the reboot command to swap the partitions
                commandHook({ command: "reboot" });

                // Force a page reload after 15 seconds so the UI fetches the new version number
                setTimeout(() => window.location.reload(), 15000);
            }
        };
    }

    // STEP 3: Cancel (Un-stage)
    if (btnCancel && isStaged) {
        btnCancel.onclick = () => {
            // Push the un-stage command to Firebase and Redraw UI instantly
            commandHook({ ota_staged: false });
        };
    }

    container.appendChild(div);
}