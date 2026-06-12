// src/components/system/AboutModal.js

export function renderAboutModal() {
    const modal = document.getElementById("about-modal");
    if (!modal) return;

    // Detect current theme
    const isLight = document.body.classList.contains("light-theme");
    
    // Apply styling to the modal content container
    const content = modal.querySelector(".bg-cardbg");
    if (content) {
        content.className = `rounded-3xl p-6 shadow-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-cardbg border-gray-800'} w-full max-w-sm relative overflow-hidden`;
    }

    // Toggle visibility
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

// Function to hide the modal (called by the 'x' button)
window.hideAboutModal = () => {
    const modal = document.getElementById("about-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
};

// Close if clicking the background overlay
document.getElementById("about-modal")?.addEventListener('click', (e) => {
    if (e.target.id === 'about-modal') {
        window.hideAboutModal();
    }
});