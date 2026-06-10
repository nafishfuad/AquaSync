// src/components/system/Maintenance.js

export function renderMaintenance(container, commandHook) {
    const div = document.createElement('div');
    div.className = "bg-cardbg rounded-2xl p-5 shadow-lg border border-gray-800";
    
    div.innerHTML = `
        <h2 class="text-sm uppercase text-gray-400 font-semibold tracking-wide mb-4">System Maintenance</h2>
        <div class="space-y-3">
            <button id="btn-reboot" class="w-full bg-[#121212] text-gray-300 border border-gray-700 hover:border-gray-500 hover:text-white font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm">
                Reboot Controller
            </button>
            <button id="btn-reset" class="w-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                Factory Reset
            </button>
        </div>
    `;

    div.querySelector('#btn-reboot').onclick = () => {
        if (confirm("Are you sure you want to reboot the controller? It will briefly go offline.")) {
            commandHook({ command: "reboot" });
        }
    };

    div.querySelector('#btn-reset').onclick = () => {
        if (confirm("WARNING: This will permanently erase all Wi-Fi settings, schedules, and analytics. You will need to set up the device again. Proceed?")) {
            commandHook({ command: "factory_reset" });
            // Alert user that they will need to refresh the app
            setTimeout(() => {
                alert("Device reset. The app will now reload.");
                localStorage.clear();
                window.location.reload();
            }, 2000);
        }
    };

    container.appendChild(div);
}