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

        // Escape - Close modals / cancels
        if (key === 'Escape') {
            e.preventDefault();
            this.triggerAction('close');
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
            var saveBtn = document.querySelector('.modal.open .btn-primary, .modal-overlay[style*="display: block"] .btn-primary, .modal-overlay.active .btn-primary, #btn-save-sale, #btn-save-account, #btn-save-payment');
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
        } else if (action === 'close') {
            // Close active modal
            var closeBtn = document.querySelector('.modal-overlay.active .modal-close, .modal-overlay[style*="display: block"] .modal-close, .modal-overlay.active .btn-outline[onclick*="close"]');
            if (closeBtn) {
                closeBtn.click();
            }
        }
    }
};

// Auto-init
shortcuts.init();
