// src/components/hardware/ModeBanner.js

export function renderModeBanner(container, isAutoMode, onToggle) {
    const template = document.getElementById("tpl-mode-banner");
    if (!template) return;

    const clone = template.content.cloneNode(true);
    const icon = clone.querySelector(".tpl-mode-icon");
    const title = clone.querySelector(".tpl-mode-title");
    const desc = clone.querySelector(".tpl-mode-desc");
    const btn = clone.querySelector(".tpl-mode-btn");

    if (isAutoMode) {
        icon.innerText = "🤖";
        title.innerText = "Auto Mode";
        title.className = "text-sm font-bold text-aqua tracking-wide tpl-mode-title";
        desc.innerText = "Following Schedule";
        btn.innerText = "Set Manual";
        btn.className = "bg-[#121212] text-gray-400 border border-gray-700 hover:text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 tpl-mode-btn";
    } else {
        icon.innerText = "🖐️";
        title.innerText = "Manual Mode";
        title.className = "text-sm font-bold text-amber-400 tracking-wide tpl-mode-title";
        desc.innerText = "Schedule Suspended";
        btn.innerText = "Resume Auto";
        btn.className = "bg-aqua/10 text-aqua border border-aqua/50 hover:bg-aqua hover:text-black px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 tpl-mode-btn";
    }

    btn.addEventListener("click", () => {
        onToggle(!isAutoMode);
    });

    container.appendChild(clone);
}