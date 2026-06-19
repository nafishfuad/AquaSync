// src/components/system/CustomDialogs.js

function createDialogWrapper() {
    const existing = document.getElementById("custom-dialog-wrapper");
    if (existing) existing.remove();

    const wrapper = document.createElement("div");
    wrapper.id = "custom-dialog-wrapper";
    wrapper.className = "fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 animate-fade-in pointer-events-auto transition-opacity duration-300";
    document.body.appendChild(wrapper);
    return wrapper;
}

export function showPrompt(title, placeholder = "", defaultValue = "") {
    return new Promise((resolve) => {
        const wrapper = createDialogWrapper();
        wrapper.innerHTML = `
            <div class="bg-cardbg rounded-3xl p-6 shadow-2xl border border-gray-800 w-full max-w-sm flex flex-col transform scale-95 transition-transform duration-300" id="custom-dialog-inner">
                <h3 class="text-white font-bold text-lg mb-4 tracking-wide">${title}</h3>
                <input type="text" id="dialog-prompt-input" class="w-full bg-[#121212] border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-aqua transition-colors mb-6 text-sm" placeholder="${placeholder}" value="${defaultValue}" autocomplete="off" />
                <div class="flex space-x-3">
                    <button id="dialog-btn-cancel" class="flex-1 bg-[#121212] hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors active:scale-95">Cancel</button>
                    <button id="dialog-btn-submit" class="flex-1 bg-aqua/10 hover:bg-aqua border border-aqua/30 hover:border-aqua text-aqua hover:text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors active:scale-95">Save</button>
                </div>
            </div>
        `;

        requestAnimationFrame(() => {
            wrapper.querySelector("#custom-dialog-inner").classList.remove("scale-95");
            wrapper.querySelector("#custom-dialog-inner").classList.add("scale-100");
        });

        const input = wrapper.querySelector("#dialog-prompt-input");
        setTimeout(() => input.focus(), 100);

        const close = (val) => {
            wrapper.classList.remove("opacity-100");
            wrapper.classList.add("opacity-0");
            wrapper.querySelector("#custom-dialog-inner").classList.remove("scale-100");
            wrapper.querySelector("#custom-dialog-inner").classList.add("scale-95");
            setTimeout(() => { wrapper.remove(); resolve(val); }, 300);
        };

        wrapper.querySelector("#dialog-btn-cancel").onclick = () => close(null);
        wrapper.querySelector("#dialog-btn-submit").onclick = () => close(input.value);
        input.onkeydown = (e) => { if (e.key === "Enter") close(input.value); };
    });
}

export function showConfirm(title, message) {
    return new Promise((resolve) => {
        const wrapper = createDialogWrapper();
        wrapper.innerHTML = `
            <div class="bg-cardbg rounded-3xl p-6 shadow-2xl border border-gray-800 w-full max-w-sm flex flex-col text-center items-center transform scale-95 transition-transform duration-300" id="custom-dialog-inner">
                <div class="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center text-2xl mb-4">
                    ⚠️
                </div>
                <h3 class="text-white font-bold text-lg mb-2 tracking-wide">${title}</h3>
                <p class="text-gray-400 text-sm mb-6">${message}</p>
                <div class="flex space-x-3 w-full">
                    <button id="dialog-btn-cancel" class="flex-1 bg-[#121212] hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors active:scale-95">Cancel</button>
                    <button id="dialog-btn-submit" class="flex-1 bg-red-500/10 hover:bg-red-500 border border-red-500/30 hover:border-red-500 text-red-500 hover:text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors active:scale-95">Confirm</button>
                </div>
            </div>
        `;

        requestAnimationFrame(() => {
            wrapper.querySelector("#custom-dialog-inner").classList.remove("scale-95");
            wrapper.querySelector("#custom-dialog-inner").classList.add("scale-100");
        });

        const close = (val) => {
            wrapper.classList.remove("opacity-100");
            wrapper.classList.add("opacity-0");
            wrapper.querySelector("#custom-dialog-inner").classList.remove("scale-100");
            wrapper.querySelector("#custom-dialog-inner").classList.add("scale-95");
            setTimeout(() => { wrapper.remove(); resolve(val); }, 300);
        };

        wrapper.querySelector("#dialog-btn-cancel").onclick = () => close(false);
        wrapper.querySelector("#dialog-btn-submit").onclick = () => close(true);
    });
}

export function showAlert(title, message) {
    return new Promise((resolve) => {
        const wrapper = createDialogWrapper();
        wrapper.innerHTML = `
            <div class="bg-cardbg rounded-3xl p-6 shadow-2xl border border-gray-800 w-full max-w-sm flex flex-col text-center items-center transform scale-95 transition-transform duration-300" id="custom-dialog-inner">
                <div class="w-12 h-12 bg-aqua/10 text-aqua rounded-full flex items-center justify-center text-xl mb-4">
                    ℹ️
                </div>
                <h3 class="text-white font-bold text-lg mb-2 tracking-wide">${title}</h3>
                <p class="text-gray-400 text-sm mb-6">${message}</p>
                <button id="dialog-btn-ok" class="w-full bg-aqua/10 hover:bg-aqua border border-aqua/30 hover:border-aqua text-aqua hover:text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors active:scale-95">OK</button>
            </div>
        `;

        requestAnimationFrame(() => {
            wrapper.querySelector("#custom-dialog-inner").classList.remove("scale-95");
            wrapper.querySelector("#custom-dialog-inner").classList.add("scale-100");
        });

        const close = () => {
            wrapper.classList.remove("opacity-100");
            wrapper.classList.add("opacity-0");
            wrapper.querySelector("#custom-dialog-inner").classList.remove("scale-100");
            wrapper.querySelector("#custom-dialog-inner").classList.add("scale-95");
            setTimeout(() => { wrapper.remove(); resolve(); }, 300);
        };

        wrapper.querySelector("#dialog-btn-ok").onclick = close;
    });
}
