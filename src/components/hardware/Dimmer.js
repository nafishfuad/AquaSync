// src/components/hardware/Dimmer.js

export function renderLiveDimmer(container, device, onUpdate) {
    const template = document.getElementById("tpl-dimmer");
    if (!template) return;

    const clone = template.content.cloneNode(true);
    const wrapper = clone.querySelector("div"); 
    const title = clone.querySelector(".tpl-title");
    const icon = clone.querySelector(".tpl-icon");
    const value = clone.querySelector(".tpl-value");
    const slider = clone.querySelector(".tpl-slider");

    title.innerText = "Live Brightness";
    icon.innerText = "🎚️";
    value.innerText = `${device.metrics.currentBrightness}%`;
    slider.value = device.metrics.currentBrightness;

    // Visual feedback: Lock slider if system is running automatically
    if (device.metrics.isAutoMode) {
        wrapper.classList.add("opacity-50", "grayscale", "pointer-events-none");
        title.innerHTML = `Live Brightness <span class="text-aqua ml-2 text-[10px] uppercase tracking-widest">(Auto)</span>`;
        value.classList.replace("text-aqua", "text-gray-500");
    }

    slider.addEventListener("input", (e) => {
        value.innerText = `${e.target.value}%`;
    });

    slider.addEventListener("change", (e) => {
        onUpdate(parseInt(e.target.value));
    });

    container.appendChild(clone);
}