/**
 * Shortcuts Utility — Hisaab Pro
 * 
 * Professional accounting shortcuts (F2: Save, Esc: Close, Enter: Tab-like).
 */

'use strict';

var shortcuts = {
    init: function() {
        document.addEventListener('keydown', this.handleGlobalKeys.bind(this));
    },

    handleGlobalKeys: function(e) {
        // e.key is the key string
        var key = e.key;
        var ctrl = e.ctrlKey || e.metaKey;

        // F2 - Save/Update
        if (key === 'F2') {
            e.preventDefault();
            this.triggerAction('save');
        }

        // F8 or Delete - Delete
        if (key === 'F8' || key === 'Delete') {
            e.preventDefault();
            this.triggerAction('delete');
        }

        // Alt + P - Print/Download PDF
        if (e.altKey && (key === 'p' || key === 'P')) {
            e.preventDefault();
            this.triggerAction('print');
        }

        // Alt + E - Edit
        if (e.altKey && (key === 'e' || key === 'E')) {
            e.preventDefault();
            this.triggerAction('edit');
        }

        // Escape - Close modals / cancels
        if (key === 'Escape') {
            e.preventDefault();
            this.triggerAction('close');
            
            // Also close our injected dropdowns if open
            var qa = document.getElementById('quick-add-dropdown');
            if (qa && qa.style.display === 'block') qa.style.display = 'none';
        }

        // Alt + F3 - Quick Add Dropdown
        if (e.altKey && key === 'F3') {
            e.preventDefault();
            this.toggleQuickAdd(e);
        }

        // Alt + F1 - Go to Accounts
        if (e.altKey && key === 'F1') {
            e.preventDefault();
            window.location.href = 'accounts.html';
        }

        // Alt + L - Open Ledger Search
        if (e.altKey && (key === 'l' || key === 'L')) {
            e.preventDefault();
            this.openLedgerPrompt();
        }

        // F10 - Toggle Calculator
        if (key === 'F10') {
            e.preventDefault();
            if (window.calculator) {
                window.calculator.toggle();
            }
        }

        // Enter - Move to next field if inside a form (like Tally)
        if (key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'submit' && e.target.type !== 'button') {
            // If it's a textarea, let it be unless it's Ctrl+Enter
            if (e.target.tagName === 'TEXTAREA' && !ctrl) return;
            
            e.preventDefault();
            this.focusNextInput(e.target);
        }

        // Ctrl + S - Quick Save
        if (ctrl && (key === 's' || key === 'S')) {
            e.preventDefault();
            this.triggerAction('save');
        }
    },

    focusNextInput: function(currentElement) {
        var form = currentElement.form;
        if (!form) return;

        var index = Array.prototype.indexOf.call(form, currentElement);
        var next = form[index + 1];

        // Find next visible/enabled input
        while (next && (next.disabled || next.type === 'hidden' || next.tabIndex < 0)) {
            index++;
            next = form[index + 1];
        }

        if (next) {
            next.focus();
            if (next.select) next.select();
        } else {
            // If it's the last one, maybe trigger save?
            // this.triggerAction('save');
        }
    },

    /**
     * Trigger actions by checking for specific button clicks or global handlers
     */
    triggerAction: function(action) {
        if (action === 'save') {
            // Find primary button in active modal or page
            var saveBtn = document.querySelector('.modal-overlay.active .btn-confirm, .modal.open .btn-primary, .modal-overlay[style*="display: block"] .btn-primary, .modal-overlay.active .btn-primary, #btn-save-sale, #btn-save-account, #btn-save-payment');
            if (saveBtn && !saveBtn.disabled) {
                saveBtn.click();
            } else {
                // Look for page-level primary buttons if no modal
                var pageSaveBtn = document.querySelector('.main-content .btn-primary:not(.sidebar-toggle)');
                if (pageSaveBtn && !pageSaveBtn.disabled && pageSaveBtn.offsetParent !== null) {
                    pageSaveBtn.click();
                }
            }
        } else if (action === 'delete') {
            // Find delete button in active modal or page
            var deleteBtn = document.querySelector('.modal-overlay.active #btn-delete-sale, .modal-overlay.active #btn-delete-account, .modal-overlay.active #btn-delete-payment, .modal-overlay.active .btn-danger');
            if (deleteBtn && !deleteBtn.disabled) {
                deleteBtn.click();
            }
        } else if (action === 'print') {
            // Find print/download button in active modal or page
            var printBtn = document.querySelector('.modal-overlay.active #btn-download-sale, .modal-overlay.active #btn-print-invoice, #btn-print');
            if (printBtn && !printBtn.disabled) {
                printBtn.click();
            }
        } else if (action === 'edit') {
            // Find edit button (likely in ledger view or similar)
            var editBtn = document.querySelector('#btn-edit-ledger-account, .btn-primary[onclick*="edit"], .btn-edit');
            if (editBtn && !editBtn.disabled && editBtn.offsetParent !== null) {
                editBtn.click();
            }
        } else if (action === 'close') {
            // Close active modal
            var closeBtn = document.querySelector('.modal-overlay.active .modal-close, .modal-overlay[style*="display: block"] .modal-close, .modal-overlay.active .btn-outline[onclick*="close"]');
            if (closeBtn) {
                closeBtn.click();
            }
        }
    },
    
    toggleQuickAdd: function(e) {
        var dropdown = document.getElementById('quick-add-dropdown');
        if (!dropdown) {
            // Inject dropdown HTML globally
            dropdown = document.createElement('div');
            dropdown.id = 'quick-add-dropdown';
            dropdown.style.cssText = 'position: fixed; top: 60px; right: 20px; background: white; border: 1px solid #ccc; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px; z-index: 9999; display: none; width: 220px; overflow: hidden;';
            dropdown.innerHTML = `
                <div style="padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #eee; background: #f9f9f9;">Quick Add <span style="float:right; font-size:12px; font-weight:normal; color:#888;">Alt+F3</span></div>
                <a href="sales.html?view=add" style="display: block; padding: 12px 16px; color: #333; text-decoration: none; border-bottom: 1px solid #eee;">+ Add Sale</a>
                <a href="purchases.html?view=add" style="display: block; padding: 12px 16px; color: #333; text-decoration: none; border-bottom: 1px solid #eee;">+ Add Purchase</a>
                <a href="payments.html?view=add&type=out" style="display: block; padding: 12px 16px; color: #333; text-decoration: none; border-bottom: 1px solid #eee;">+ Add Payment (Out)</a>
                <a href="payments.html?view=add&type=in" style="display: block; padding: 12px 16px; color: #333; text-decoration: none;">+ Add Receipt (In)</a>
            `;
            document.body.appendChild(dropdown);
            
            // Add click outside to close
            document.addEventListener('click', function(e) {
                if (dropdown.style.display === 'block' && !dropdown.contains(e.target)) {
                    dropdown.style.display = 'none';
                }
            });
        }
        
        if (dropdown.style.display === 'none') {
            dropdown.style.display = 'block';
            // Stop propagation so the click listener doesn't immediately close it
            if (e) e.stopPropagation();
        } else {
            dropdown.style.display = 'none';
        }
    },
    
    openLedgerPrompt: function() {
        // We can just redirect to reports.html?type=account-ledger and focus the dropdown
        window.location.href = 'reports.html?type=account-ledger&focus=true';
    }
};

// Auto-init
shortcuts.init();

// Simple In-App Calculator
window.calculator = {
    ui: null,
    toggle: function() {
        if (!this.ui) {
            this.buildUI();
        }
        if (this.ui.style.display === 'none') {
            this.ui.style.display = 'block';
            document.getElementById('calc-display').focus();
        } else {
            this.ui.style.display = 'none';
        }
    },
    buildUI: function() {
        this.ui = document.createElement('div');
        this.ui.id = 'inapp-calculator';
        this.ui.style.cssText = 'position: fixed; bottom: 20px; right: 20px; width: 240px; background: #fff; border: 1px solid #ddd; box-shadow: 0 4px 16px rgba(0,0,0,0.15); border-radius: 8px; z-index: 10000; display: none; overflow: hidden; font-family: monospace;';
        
        var header = document.createElement('div');
        header.style.cssText = 'background: var(--color-primary, #3b82f6); color: white; padding: 8px 12px; font-family: sans-serif; font-size: 14px; font-weight: bold; display: flex; justify-content: space-between; cursor: move;';
        header.innerHTML = '<span>Calculator</span><span style="font-weight:normal; font-size:12px; opacity:0.8;">F10 to close</span>';
        
        var body = document.createElement('div');
        body.style.cssText = 'padding: 12px;';
        
        var display = document.createElement('input');
        display.id = 'calc-display';
        display.type = 'text';
        display.style.cssText = 'width: 100%; box-sizing: border-box; padding: 8px; font-size: 18px; text-align: right; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px;';
        display.onkeydown = function(e) {
            if (e.key === 'Enter') {
                try {
                    // Safe eval replacement (Allowing digits, parentheses, and operators)
                    display.value = new Function('return ' + display.value.replace(/[^-()0-9/*+.]/g, ''))();
                } catch(err) {
                    display.value = 'Error';
                }
            } else if (e.key === 'Escape' || e.key === 'F10') {
                window.calculator.toggle();
            }
        };
        
        // Quick numpad
        var grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;';
        var btns = ['7','8','9','/','4','5','6','*','1','2','3','-','C','0','.','+','='];
        
        btns.forEach(function(b) {
            var btn = document.createElement('button');
            btn.innerText = b;
            btn.style.cssText = 'padding: 8px 0; border: 1px solid #eee; background: #f9f9f9; cursor: pointer; border-radius: 4px; font-size: 16px;';
            if (b === '=') btn.style.gridColumn = 'span 4';
            if (b === 'C') {
               btn.onclick = () => display.value = '';
            } else if (b === '=') {
               btn.onclick = () => {
                   try { display.value = new Function('return ' + display.value.replace(/[^-()0-9/*+.]/g, ''))(); } 
                   catch(err) { display.value = 'Error'; }
               };
            } else {
               btn.onclick = () => { display.value += b; display.focus(); };
            }
            grid.appendChild(btn);
        });
        
        body.appendChild(display);
        body.appendChild(grid);
        this.ui.appendChild(header);
        this.ui.appendChild(body);
        document.body.appendChild(this.ui);
        
        // Simple drag logic
        var isDown = false, offset = [0,0];
        header.addEventListener('mousedown', function(e) {
            isDown = true;
            offset = [
                this.parentElement.offsetLeft - e.clientX,
                this.parentElement.offsetTop - e.clientY
            ];
        });
        document.addEventListener('mouseup', function() { isDown = false; });
        document.addEventListener('mousemove', function(e) {
            if (isDown) {
                window.calculator.ui.style.left = (e.clientX + offset[0]) + 'px';
                window.calculator.ui.style.top  = (e.clientY + offset[1]) + 'px';
                window.calculator.ui.style.bottom = 'auto';
                window.calculator.ui.style.right = 'auto';
            }
        });
    }
};
