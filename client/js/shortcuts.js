/**
 * Shortcuts Utility — Hisaab Pro
 */

'use strict';

window.Shortcuts = {
    init: function() {
        var self = this;
        document.addEventListener('keydown', function(e) {
            self.handleKey(e);
        });
    },
    
    handleKey: function(e) {
        var key = e.key;
        var ctrl = e.ctrlKey || e.metaKey;
        var alt = e.altKey;
        
        // Quick Add menu is open
        var dropdown = document.getElementById('quick-add-dropdown');
        if (dropdown && dropdown.style.display === 'block') {
            if (key === 'ArrowDown') { e.preventDefault(); this.navigateQuickAdd(1); return; }
            if (key === 'ArrowUp') { e.preventDefault(); this.navigateQuickAdd(-1); return; }
            if (key === 'Enter') { e.preventDefault(); this.selectQuickAddItem(); return; }
            if (key === 'Escape') { e.preventDefault(); dropdown.style.display = 'none'; return; }
        }
        
        // F2 - Save
        if (key === 'F2') { e.preventDefault(); this.triggerSave(); return; }
        
        // F8 or Delete
        if (key === 'F8' || key === 'Delete') { e.preventDefault(); this.triggerDelete(); return; }
        
        // Escape - close calculator/dropdown/modals
        if (key === 'Escape') { e.preventDefault(); this.triggerClose(); return; }
        
        // F10 - Calculator
        if (key === 'F10') { e.preventDefault(); this.toggleCalculator(); return; }
        
        // Ctrl + S
        if (ctrl && (key === 's' || key === 'S')) { e.preventDefault(); this.triggerSave(); return; }
        
        // Ctrl + P
        if (ctrl && (key === 'p' || key === 'P')) { e.preventDefault(); this.triggerPrint(); return; }
        
        // Alt + P - Purchase
        if (alt && (key === 'p' || key === 'P')) { e.preventDefault(); window.location.href = 'purchases.html?view=add'; return; }
        
        // Alt + S - Sales
        if (alt && (key === 's' || key === 'S')) { e.preventDefault(); window.location.href = 'sales.html'; return; }
        
        // Alt + A - Accounts
        if (alt && (key === 'a' || key === 'A')) { e.preventDefault(); window.location.href = 'accounts.html'; return; }
        
        // Alt + H - Dashboard
        if (alt && (key === 'h' || key === 'H')) { e.preventDefault(); window.location.href = 'dashboard.html'; return; }
        
        // Alt + L - Ledger
        if (alt && (key === 'l' || key === 'L')) { e.preventDefault(); window.location.href = 'reports.html?type=account-ledger&focus=true'; return; }
        
        // Alt + Q - Quick Add
        if (alt && (key === 'q' || key === 'Q')) { e.preventDefault(); this.showQuickAdd(); return; }
    },
    
    triggerSave: function() {
        var btn = document.querySelector('#btn-save-sale, #btn-save-payment, #btn-save-purchase, #btn-save-account, #btn-save-staff, .btn-confirm');
        if (btn) btn.click();
    },
    
    triggerDelete: function() {
        var btn = document.querySelector('#btn-delete-sale, #btn-delete-payment, #btn-delete-purchase, .btn-danger');
        if (btn) btn.click();
    },
    
    triggerClose: function() {
        // Close calculator
        var calc = document.getElementById('inapp-calculator');
        if (calc && calc.style.display === 'block') {
            calc.style.display = 'none';
            return;
        }
        
        // Close Quick Add
        var dropdown = document.getElementById('quick-add-dropdown');
        if (dropdown && dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
            return;
        }
        
        // Try to call page-specific close functions
        if (typeof closeSaleModal === 'function') closeSaleModal();
        else if (typeof closePaymentModal === 'function') closePaymentModal();
        else if (typeof closePurchaseModal === 'function') closePurchaseModal();
        else if (typeof closeAccountModal === 'function') closeAccountModal();
        else if (typeof closeStaffModal === 'function') closeStaffModal();
        else if (typeof closeFYModal === 'function') closeFYModal();
        
        // Also try generic modal close
        var modal = document.querySelector('.modal-overlay:not(.hidden), .modal-overlay[style*="display: block"]');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    },
    
    triggerPrint: function() {
        var btn = document.querySelector('#btn-download-sale, #btn-print, .btn-print');
        if (btn) btn.click();
    },
    
    showQuickAdd: function() {
        var self = this;
        var dropdown = document.getElementById('quick-add-dropdown');
        
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'quick-add-dropdown';
            dropdown.style.cssText = 
                'position: fixed; top: 80px; left: 20px; width: 220px; ' +
                'background: #ffffff; border: 1px solid #e5e7eb; ' +
                'box-shadow: 0 10px 40px rgba(0,0,0,0.15); border-radius: 16px; ' +
                'z-index: 9999; overflow: hidden; font-family: -apple-system, sans-serif;';
            
            dropdown.innerHTML = 
                '<div style="padding: 14px 20px; font-weight: 600; border-bottom: 1px solid #e5e7eb; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; font-size: 14px; display: flex; justify-content: space-between;">' +
                    '<span>Quick Add</span><span style="font-size:11px; opacity:0.8;">↑↓ Enter</span>' +
                '</div>' +
                '<a href="sales.html?view=add" class="qa-item" style="display: block; padding: 12px 20px; color: #374151; text-decoration: none; border-bottom: 1px solid #f3f4f6; font-size: 14px; font-weight: 500;">+ New Sale</a>' +
                '<a href="purchases.html?view=add" class="qa-item" style="display: block; padding: 12px 20px; color: #374151; text-decoration: none; border-bottom: 1px solid #f3f4f6; font-size: 14px; font-weight: 500;">+ New Purchase</a>' +
                '<a href="payments.html?view=add" class="qa-item" style="display: block; padding: 12px 20px; color: #374151; text-decoration: none; border-bottom: 1px solid #f3f4f6; font-size: 14px; font-weight: 500;">+ New Payment</a>' +
                '<a href="payments.html?view=add&type=in" class="qa-item" style="display: block; padding: 12px 20px; color: #374151; text-decoration: none; font-size: 14px; font-weight: 500;">+ New Receipt</a>';
            
            document.body.appendChild(dropdown);
            
            document.addEventListener('click', function(evt) {
                if (dropdown.style.display !== 'none' && !dropdown.contains(evt.target)) {
                    dropdown.style.display = 'none';
                }
            });
        }
        
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        this.qaIndex = -1;
        this.highlightQuickAddItem(-1);
    },
    
    qaIndex: -1,
    
    highlightQuickAddItem: function(index) {
        var items = document.querySelectorAll('.qa-item');
        if (!items.length) return;
        
        items.forEach(function(item) {
            item.style.background = 'transparent';
            item.style.color = '#374151';
        });
        
        if (index < 0) index = items.length - 1;
        if (index >= items.length) index = 0;
        
        this.qaIndex = index;
        items[index].style.background = '#3b82f6';
        items[index].style.color = 'white';
    },
    
    navigateQuickAdd: function(dir) {
        this.highlightQuickAddItem(this.qaIndex + dir);
    },
    
    selectQuickAddItem: function() {
        var items = document.querySelectorAll('.qa-item');
        if (this.qaIndex >= 0 && this.qaIndex < items.length) {
            items[this.qaIndex].click();
        }
    },
    
    toggleCalculator: function() {
        var calc = document.getElementById('inapp-calculator');
        if (!calc) {
            this.buildCalculator();
        } else {
            calc.style.display = calc.style.display === 'none' ? 'block' : 'none';
            if (calc.style.display === 'block') {
                document.getElementById('calc-display').focus();
            }
        }
    },
    
    buildCalculator: function() {
        var self = this;
        var calc = document.createElement('div');
        calc.id = 'inapp-calculator';
        calc.style.cssText = 
            'position: fixed; bottom: 30px; left: 30px; width: 320px; ' +
            'background: #ffffff; border: 1px solid #e5e7eb; ' +
            'box-shadow: 0 10px 40px rgba(0,0,0,0.15); border-radius: 20px; ' +
            'z-index: 99999; font-family: -apple-system, sans-serif; display: block;';
        
        var header = document.createElement('div');
        header.style.cssText = 'background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 16px 20px; font-size: 15px; font-weight: 600; display: flex; justify-content: space-between;';
        header.innerHTML = '<span>Calculator</span><span style="font-size:11px; opacity:0.8;">ESC / F10</span>';
        
        var body = document.createElement('div');
        body.style.cssText = 'padding: 20px;';
        
        var display = document.createElement('input');
        display.id = 'calc-display';
        display.type = 'text';
        display.style.cssText = 
            'width: 100%; box-sizing: border-box; padding: 16px 18px; ' +
            'font-size: 28px; font-weight: 600; text-align: right; ' +
            'background: #f8fafc; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; ' +
            'margin-bottom: 16px; letter-spacing: 2px; outline: none;';
        display.placeholder = '0';
        
        display.onkeydown = function(e) {
            if (e.key === 'Enter') { e.preventDefault(); self.calcResult(); }
            else if (e.key === 'Escape') { e.preventDefault(); calc.style.display = 'none'; }
        };
        
        var grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;';
        
        var buttons = [
            { l: 'C', s: 'background:#ef4444;color:white;' },
            { l: '(', s: 'background:#3b82f6;color:white;' },
            { l: ')', s: 'background:#3b82f6;color:white;' },
            { l: '÷', s: 'background:#3b82f6;color:white;' },
            { l: '7', s: 'background:#f1f5f9;color:#334155;' },
            { l: '8', s: 'background:#f1f5f9;color:#334155;' },
            { l: '9', s: 'background:#f1f5f9;color:#334155;' },
            { l: '×', s: 'background:#3b82f6;color:white;' },
            { l: '4', s: 'background:#f1f5f9;color:#334155;' },
            { l: '5', s: 'background:#f1f5f9;color:#334155;' },
            { l: '6', s: 'background:#f1f5f9;color:#334155;' },
            { l: '-', s: 'background:#3b82f6;color:white;' },
            { l: '1', s: 'background:#f1f5f9;color:#334155;' },
            { l: '2', s: 'background:#f1f5f9;color:#334155;' },
            { l: '3', s: 'background:#f1f5f9;color:#334155;' },
            { l: '+', s: 'background:#3b82f6;color:white;' },
            { l: '0', s: 'background:#f1f5f9;color:#334155;', w: 'span 2' },
            { l: '.', s: 'background:#f1f5f9;color:#334155;' },
            { l: '=', s: 'background:#10b981;color:white;', w: 'span 2' },
            { l: '⌫', s: 'background:#f59e0b;color:white;' }
        ];
        
        var base = 'padding: 16px; border: none; border-radius: 12px; cursor: pointer; font-size: 18px; font-weight: 600; outline: none;';
        
        buttons.forEach(function(b) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = b.l;
            btn.style.cssText = base + b.s + (b.w ? 'grid-column:' + b.w + ';' : '');
            
            if (b.l === 'C') btn.onclick = function() { display.value = ''; display.focus(); };
            else if (b.l === '=') btn.onclick = function() { self.calcResult(display); };
            else if (b.l === '⌫') btn.onclick = function() { display.value = display.value.slice(0, -1); display.focus(); };
            else btn.onclick = function() { display.value += b.l; display.focus(); };
            
            grid.appendChild(btn);
        });
        
        body.appendChild(display);
        body.appendChild(grid);
        calc.appendChild(header);
        calc.appendChild(body);
        document.body.appendChild(calc);
    },
    
    calcResult: function(display) {
        if (!display) display = document.getElementById('calc-display');
        try {
            var expr = display.value.replace(/×/g, '*').replace(/÷/g, '/').replace(/[^0-9()./*+\-]/g, '');
            if (expr && /^[0-9()./*+\-]+$/.test(expr)) {
                var result = eval('(' + expr + ')');
                display.value = isFinite(result) ? result : 'Error';
            } else {
                display.value = 'Error';
            }
        } catch(e) {
            display.value = 'Error';
        }
    }
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.Shortcuts.init(); });
} else {
    window.Shortcuts.init();
}