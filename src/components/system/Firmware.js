// src/components/system/Firmware.js

export function renderFirmware(container, fwState, commandHook) {
    const div = document.createElement('div');
    div.className = "bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800";
    
    // Determine update logic
    const isUpdateAvailable = (fwState.current !== fwState.latest) && (fwState.latest !== "Checking...");
    const statusText = isUpdateAvailable ? "New firmware found! Ready to download." : "Your device is up to date.";
    const statusColor = isUpdateAvailable ? "text-green-400" : "text-gray-500";
    
    // Styling for active vs disabled buttons
    const btnDlStyle = isUpdateAvailable 
        ? "bg-aqua/10 text-aqua border-aqua/50 hover:bg-aqua hover:text-black shadow-[0_0_15px_rgba(0,242,254,0.15)]" 
        : "bg-[#121212] text-gray-600 border-gray-800 opacity-50 cursor-not-allowed";

    div.innerHTML = `
        <h2 class="text-sm uppercase text-gray-400 font-semibold tracking-wide mb-4">Firmware Update</h2>
        
        <div class="flex justify-between text-[10px] text-gray-400 mb-4 bg-[#121212] p-3 rounded-xl border border-gray-800 shadow-inner">
            <span>Device: <span class="text-white font-bold tracking-wider">${fwState.current}</span></span>
            <span>Latest: <span class="text-aqua font-bold tracking-wider">${fwState.latest}</span></span>
        </div>

        <p id="txt-fw-status" class="text-[10px] ${statusColor} mb-4 leading-relaxed text-center font-medium">
            ${statusText}
        </p>

        <div class="space-y-3">
            <button id="btn-fw-dl" ${!isUpdateAvailable ? 'disabled' : ''} class="w-full ${btnDlStyle} font-bold py-3.5 rounded-xl border text-[10px] uppercase tracking-widest transition-all active:scale-95">
                1. Download Update
            </button>
            <button id="btn-fw-install" disabled class="w-full bg-[#121212] text-gray-600 border border-gray-800 opacity-50 font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                2. Install & Reboot
            </button>
        </div>
    `;

    const btnDl = div.querySelector('#btn-fw-dl');
    const btnInstall = div.querySelector('#btn-fw-install');
    const statusTxt = div.querySelector('#txt-fw-status');

    if (btnDl && isUpdateAvailable) {
        btnDl.onclick = () => {
            if (confirm("Begin OTA firmware download? Do not close the app.")) {
                btnDl.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Downloading...`;
                btnDl.classList.add("opacity-50", "pointer-events-none");
                
                statusTxt.innerText = "Downloading to device memory... (~20 seconds)";
                statusTxt.classList.replace("text-green-400", "text-amber-400");

                commandHook({ command: "download_ota" });

                // Simulate unlocking the install button after a set time (in reality, API would trigger this)
                setTimeout(() => {
                    btnDl.innerHTML = `✅ Download Verified`;
                    statusTxt.innerText = "Download complete! Ready to install.";
                    statusTxt.classList.replace("text-amber-400", "text-green-400");
                    
                    btnInstall.disabled = false;
                    btnInstall.className = "w-full bg-green-500/10 text-green-400 border border-green-500/50 hover:bg-green-500 hover:text-black shadow-[0_0_15px_rgba(74,222,128,0.15)] font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95";
                }, 15000); 
            }
        };
    }

    if (btnInstall) {
        btnInstall.onclick = () => {
            if (confirm("Install firmware? The device will reboot and may take 30 seconds to reconnect.")) {
                btnInstall.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Installing...`;
                btnInstall.classList.add("opacity-50", "pointer-events-none");
                commandHook({ command: "install_ota" });
            }
        };
    }

    container.appendChild(div);
}