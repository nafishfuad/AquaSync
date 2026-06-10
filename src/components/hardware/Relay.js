// src/components/hardware/Relay.js

export function renderRelay(container, title, icon, isChecked, onUpdate) {
    // 1. Grab the template
    const template = document.getElementById("tpl-relay");
    if (!template) return;
    
    // 2. Clone it
    const clone = template.content.cloneNode(true);
    
    // 3. Find the elements
    const titleEl = clone.querySelector(".tpl-title");
    const iconEl = clone.querySelector(".tpl-icon");
    const checkboxEl = clone.querySelector(".tpl-checkbox");
    
    // 4. Populate data
    titleEl.innerText = title;
    iconEl.innerText = icon;
    checkboxEl.checked = isChecked;
    
    // 5. Attach listener
    checkboxEl.addEventListener("change", (e) => {
        // Send the new boolean (true/false) back to main.js
        onUpdate(e.target.checked);
    });
    
    // 6. Inject
    container.appendChild(clone);
}