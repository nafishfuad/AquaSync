// src/utils.js

/**
 * Delays the execution of a function until after 'wait' milliseconds 
 * have elapsed since the last time it was invoked.
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}