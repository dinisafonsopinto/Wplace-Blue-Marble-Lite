// ==UserScript==
// @name         Blue Marble (Lite)
// @namespace    https://github.com/SwingTheVine/
// @version      1.1.3
// @description  A stripped-down userscript for Wplace.live showing pixel timer, next level, and adding an archive button.
// @author       Dinis12481
// @match        https://wplace.live/*
// @icon         https://i.etsystatic.com/7421639/r/il/4070fb/2078198039/il_570xN.2078198039_14y6.jpg
// @updateURL    https://raw.githubusercontent.com/dinisafonsopinto/Wplace-Blue-Marble-Lite/main/content.user.js
// @downloadURL  https://raw.githubusercontent.com/dinisafonsopinto/Wplace-Blue-Marble-Lite/main/content.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';

    Date.prototype.addSeconds = function(s, m=0, h=0) {
        this.setTime(this.getTime() + (h*60*60*1000) + (m*60*1000) + (s*1000));
        return this;
    }

    let nextLevelEl = null;
    let timerEl = null;
    let countdownInterval = null;
    
    // State trackers to handle the document-start timing
    let uiReady = false;
    let cachedData = null; 

    // 1. Intercept Fetch IMMEDIATELY (Before page loads)
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        const clone = response.clone();
        const url = (args[0] instanceof Request ? args[0].url : args[0]) || "";

        if (url.includes("/me")) {
            clone.json().then(data => {
                if (data && data.charges) {
                    cachedData = data; // Save data in case UI isn't drawn yet
                    if (uiReady) updateStats(data);
                }
            }).catch(() => {});
        }
        return response;
    };

    // 2. Data extraction and updating logic
    function updateStats(data) {
        if (!uiReady) return; 

        if (data.level !== undefined && data.pixelsPainted !== undefined) {
            const nextLevelPixels = Math.ceil(Math.pow(Math.floor(data.level) * Math.pow(30, 0.65), 1 / 0.65) - data.pixelsPainted);
            if (nextLevelEl) nextLevelEl.textContent = `${nextLevelPixels.toLocaleString()} pixels`;
        }

        if (data.charges) {
            const endDate = Date.now() + (data.charges.max - data.charges.count) * data.charges.cooldownMs;

            if (countdownInterval) clearInterval(countdownInterval);

            countdownInterval = setInterval(() => {
                const remainingMs = Math.max(0, endDate - Date.now());

                if (remainingMs === 0) {
                    if (timerEl) {
                        timerEl.textContent = "FULL";
                        timerEl.style.color = "#0f0";
                    }
                    clearInterval(countdownInterval);
                    return;
                }

                if (timerEl) timerEl.style.color = "white";

                const secondsTotal = Math.floor(remainingMs / 1000);
                const hours = Math.floor(secondsTotal / 3600);
                const minutes = Math.floor((secondsTotal % 3600) / 60);
                const seconds = Math.floor(secondsTotal % 60);

                const d = new Date();
                const newDate = d.addSeconds(seconds, minutes, hours);
                const formattedDate = String(newDate.getHours()).padStart(2, '0') + ':' + String(newDate.getMinutes()).padStart(2, '0');

                if (timerEl) {
                    timerEl.textContent =
                        String(hours).padStart(2, '0') + ':' +
                        String(minutes).padStart(2, '0') + ':' +
                        String(seconds).padStart(2, '0') + ' (' +
                        formattedDate + ')';
                }
            }, 500);
        }
    }

    // 3. Archive Button Logic
    function createArchiveButton(id, originalShareBtn) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = originalShareBtn.className; // copy the style so it automatically follows new CSS
        btn.setAttribute('aria-label', 'Open in Archive');

        btn.onfocus = (e) => displayInGameTooltip(e.currentTarget, 'Open in Archive');
        btn.onmouseenter = (e) => displayInGameTooltip(e.currentTarget, 'Open in Archive');
        btn.onmouseleave = () => hideInGameTooltip();
        
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
        
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideInGameTooltip();
            
            const styleId = 'eralyon-hide-dialog';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.innerHTML = 'dialog[open] { opacity: 0 !important; pointer-events: none !important; transition: none !important; } .modal-backdrop { opacity: 0 !important; transition: none !important; }';
                document.head.appendChild(style);
            }

            originalShareBtn.click();

            let attempts = 0;
            const checkDialog = setInterval(() => {
                attempts++;
                const dialogs = Array.from(document.querySelectorAll('dialog[open]'));
                const targetDialog = dialogs.find(d => d.querySelector('input[readonly]'));
                
                if (targetDialog) {
                    const inputEl = targetDialog.querySelector('input[readonly]');
                    
                    if (inputEl && inputEl.value && inputEl.value.includes('http')) {
                        clearInterval(checkDialog);
                        
                        let lat, lng, zoom;
                        try {
                            const shareUrl = new URL(inputEl.value);
                            lat = shareUrl.searchParams.get('lat');
                            lng = shareUrl.searchParams.get('lng');
                            zoom = shareUrl.searchParams.get('zoom') || '12.52';
                        } catch (err) {
                            console.error("Failed to parse share URL", err);
                        }
                        
                        const closeBtn = targetDialog.querySelector('form[method="dialog"] button');
                        if (closeBtn) closeBtn.click();
                        
                        setTimeout(() => {
                            const styleEl = document.getElementById(styleId);
                            if (styleEl) styleEl.remove(); 
                            
                            if (lat && lng) {
                                window.open(`https://wplace.eralyon.net/en/?lat=${lat}&lng=${lng}&zoom=${zoom}`, '_blank');
                            } else {
                                alert("Could not extract parameters from the share URL.");
                            }
                        }, 25);
                    }
                } else if (attempts > 50) { 
                    clearInterval(checkDialog);
                    const styleEl = document.getElementById(styleId);
                    if (styleEl) styleEl.remove();
                    alert("Share modal or URL input didn't load in time.");
                }
            }, 10);
        };
        return btn;
    }

    function injectArchiveButton() {
        // Search directly for the share button anywhere on the UI, case-insensitive
        const shareButtons = document.querySelectorAll('button[aria-label="share" i], button[title="share" i]');
        if (shareButtons.length === 0) return;
    
        shareButtons.forEach((shareBtn, index) => {
            const btnId = 'eralyon-archive-btn-' + index;
            
            if (!document.getElementById(btnId)) {
                const archiveBtn = createArchiveButton(btnId, shareBtn);
                const parent = shareBtn.parentElement;
                
                if (parent) {
                    // Force room for the 4th button regardless of the specific Tailwind class used
                    parent.classList.remove('grid-cols-[1fr_auto_auto]');
                    parent.style.gridTemplateColumns = '1fr auto auto auto';
                }
                shareBtn.insertAdjacentElement('afterend', archiveBtn);
            }
        });
    }

    function displayInGameTooltip(targetElement, message) {
        const tooltip = document.getElementById('game-tooltip');
        if (!tooltip) return;

        // 1. Inject text and reveal the tooltip FIRST so the browser gives it dimensions
        tooltip.firstElementChild.textContent = message;
        tooltip.removeAttribute('hidden');
        tooltip.setAttribute('data-open', '');

        // 2. Measure both the button and the newly populated tooltip
        const btnRect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        // 3. Calculate position (Centered X, hovering 6px above the button on Y)
        let targetX = btnRect.left + (btnRect.width / 2) - (tooltipRect.width / 2);
        let targetY = btnRect.top - tooltipRect.height - 6; 

        // 4. Edge collision: Prevent the tooltip from bleeding off the screen
        targetX = Math.max(10, Math.min(targetX, window.innerWidth - tooltipRect.width - 10));

        // 5. Apply the translation
        tooltip.style.translate = `${Math.round(targetX)}px ${Math.round(targetY)}px`;
    }

    function hideInGameTooltip() {
        const tooltip = document.getElementById('game-tooltip');
        if (!tooltip) return;
        
        tooltip.setAttribute('hidden', '');
        tooltip.removeAttribute('data-open');
        tooltip.firstElementChild.textContent = '';
    }

    // 4. Initialize UI safely after DOM loads
    function init() {
        const ui = document.createElement('div');
        ui.style.position = 'fixed';
        ui.style.top = '10px';
        ui.style.left = '75px';
        ui.style.backgroundColor = 'rgba(20, 20, 20, 0.9)';
        ui.style.color = 'white';
        ui.style.padding = '12px';
        ui.style.borderRadius = '5px';
        ui.style.zIndex = '9999';
        ui.style.fontFamily = 'monospace';
        ui.style.border = '1px solid #444';
        ui.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
        ui.style.pointerEvents = 'none';

        ui.innerHTML = `
            <div style="font-weight:bold; border-bottom: 1px solid #555; margin-bottom: 8px; padding-bottom: 4px;">Blue Marble Lite</div>
            <div style="margin-bottom: 6px;">Next level in: <b id="bm-lite-next-level">Waiting...</b></div>
            <div>Full Charges in: <b id="bm-lite-timer">Waiting...</b></div>
        `;
        
        document.body.appendChild(ui);

        nextLevelEl = document.getElementById('bm-lite-next-level');
        timerEl = document.getElementById('bm-lite-timer');
        uiReady = true;

        // If the fetch request already resolved in the background, populate the UI immediately
        if (cachedData) {
            updateStats(cachedData);
        }

        // 1. Try to find the specific UI wrapper. 
        // If you inspect the page and find a specific div that houses the UI (like '<div id="app">'), put it here.
        // Otherwise, it safely falls back to observing the body.
        const targetContainer = document.querySelector('#app') || document.body;

        const observer = new MutationObserver((mutations) => {
            // 2. Filter the noise. Check if the mutation actually added a new HTML element.
            // This ignores text node updates (like your timer ticking down).
            const hasNewElements = mutations.some(mutation => 
                Array.from(mutation.addedNodes).some(node => node.nodeType === Node.ELEMENT_NODE)
            );

            if (hasNewElements) {
                injectArchiveButton();
            }
        });

        // 3. Configure the observer to ONLY watch for added/removed children, not attributes or text data.
        observer.observe(targetContainer, { 
            childList: true, 
            subtree: true 
        });
    }

    // Only inject UI once the body actually exists
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();