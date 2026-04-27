/**
 * pdf.js — Hisaab Pro Plain PDF Generation v3
 * Clean, audit-ready ledger statements
 */

'use strict';

console.log('PDF.js v8 FIXED Indian format');

var pdf = {
    PAGE_WIDTH: 210,
    PAGE_HEIGHT: 297,
    MARGIN: 15,
    
    /**
     * Format amount in Indian numbering (1,23,456.78)
     */
    formatAmount: function(amount, type) {
        if (amount == null || isNaN(amount)) return '0.00';
        
        var isNegative = amount < 0;
        var num = Math.abs(amount);
        var str = num.toFixed(2);
        var parts = str.split('.');
        var intPart = parts[0];
        var decPart = parts[1] || '00';
        
        var result = '';
        if (intPart.length > 3) {
            var lastThree = intPart.substring(intPart.length - 3);
            var otherNumbers = intPart.substring(0, intPart.length - 3);
            result = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + ',' + lastThree;
        } else {
            result = intPart;
        }
        
        var formatted = result + '.' + decPart;
        
        if (type === 'balance') {
            return formatted + (isNegative ? ' Cr' : ' Dr');
        }
        return (isNegative ? '-' : '') + formatted;
    },
    
    // Use helvetica - built-in with jsPDF
    setFont: function(doc, style, size) {
        style = style || 'normal';
        size = size || 11;
        doc.setFont('helvetica', style, size);
    },
    
    /**
     * Helper: generate filename
     */
    getSafeFilename: function(baseName, type) {
        var date = getToday();
        var name = (baseName || 'Hisaab').replace(/[^a-z0-9]/gi, '_');
        var suffix = (type || 'Report').replace(/[^a-z0-9]/gi, '_');
        return name + '_' + suffix + '_' + date + '.pdf';
    },
    
    /**
     * DRAW: Horizontal line
     */
    drawLine: function(doc, y, x1, x2) {
        doc.setLineWidth(0.5);
        doc.line(x1 || this.MARGIN, y, x2 || (this.PAGE_WIDTH - this.MARGIN), y);
    },
    
    /**
     * DRAW: Centered text
     */
    drawCentered: function(doc, text, y, fontSize, fontStyle) {
        fontSize = fontSize || 12;
        fontStyle = fontStyle || 'normal';
        doc.setFont('Times New Roman', fontStyle);
        doc.setFontSize(fontSize);
        doc.text(text, this.PAGE_WIDTH / 2, y, { align: 'center' });
    },
    
    /**
     * Generate Ledger Statement PDF
     */
    generateLedgerPDF: function(options) {
        options = options || {};
        
        if (typeof jspdf === 'undefined') {
            showToast('jsPDF not loaded', 'error');
            return;
        }
        
        var self = this;
        var jsPDF = jspdf.jsPDF;
        var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        var page = 1;
        var yPos = this.MARGIN;
        var rowHeight = 7;
        
        // Table columns - fixed widths in mm
        var cols = [
            { label: 'Date', w: 22, a: 'left' },
            { label: 'Particulars', w: 65, a: 'left' },
            { label: 'Ref.No.', w: 18, a: 'center' },
            { label: 'Debit', w: 28, a: 'right' },
            { label: 'Credit', w: 28, a: 'right' },
            { label: 'Balance', w: 32, a: 'right' }
        ];
        
        // Scale to fit
        var totW = cols.reduce(function(s, c) { return s + c.w; }, 0);
        var scale = (this.PAGE_WIDTH - 2 * this.MARGIN) / totW;
        cols = cols.map(function(c) { c.w = c.w * scale; return c; });
        
        function getX(i) {
            var x = self.MARGIN;
            for (var j = 0; j < i; j++) x += cols[j].w;
            return x;
        }
        
        // ============ HEADER ============
        yPos += 6;
        
        if (options.anonymous) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('LEDGER ACCOUNT', this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.text('(Confidential Financial Record)', this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 12;
            doc.setLineWidth(0.75);
            doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
        } else {
            // Company info - handle undefined/null properly
            var shopName = options.shopName || '';
            var shopAddr = options.shopAddress || '';
            var shopPhone = options.shopPhone || '';
            var shopGSTIN = options.shopGSTIN || '';
            
            // Clean up address if undefined
            if (shopAddr === 'undefined' || shopAddr === 'null') shopAddr = '';
            if (shopPhone === 'undefined' || shopPhone === 'null') shopPhone = '';
            if (shopGSTIN === 'undefined' || shopGSTIN === 'null') shopGSTIN = '';
            
            var fyLabel = options.fy ? '- ' + options.fy : '';
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            var headerLine = shopName ? shopName + ' ' + fyLabel : 'LEDGER ACCOUNT';
            doc.text(headerLine, this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 8;
            
            if (shopAddr) {
                doc.setFontSize(10);
                doc.text(shopAddr, this.PAGE_WIDTH / 2, yPos, { align: 'center' });
                yPos += 5;
            }
            
            if (shopPhone || shopGSTIN) {
                doc.setFontSize(9);
                var contactParts = [];
                if (shopPhone) contactParts.push('Ph: ' + shopPhone);
                if (shopGSTIN) contactParts.push('GSTIN: ' + shopGSTIN);
                doc.text(contactParts.join('  |  '), this.PAGE_WIDTH / 2, yPos, { align: 'center' });
                yPos += 5;
            }
            
            yPos += 4;
            doc.setLineWidth(0.75);
            doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
        }
        
        yPos += 10;
        
        // Account name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(options.accountName || 'Account', this.PAGE_WIDTH / 2, yPos, { align: 'center' });
        yPos += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Ledger Account', this.PAGE_WIDTH / 2, yPos, { align: 'center' });
        yPos += 5;
        
        // Period
        if (options.period) {
            doc.setFontSize(9);
            doc.text(options.period, this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 5;
        }
        
        yPos += 6;
        
        // ============ TABLE HEADER ============
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        
        cols.forEach(function(col, i) {
            var x = getX(i);
            if (col.a === 'right') {
                doc.text(col.label, x + col.w, yPos, { align: 'right' });
            } else if (col.a === 'center') {
                doc.text(col.label, x + col.w / 2, yPos, { align: 'center' });
            } else {
                doc.text(col.label, x + 1, yPos);
            }
        });
        
        yPos += 2;
        doc.setLineWidth(0.5);
        doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
        yPos += 6;
        
        // ============ TABLE BODY ============
        var entries = options.entries || [];
        var balance = options.openingBalance || 0;
        var totDebit = 0;
        var totCredit = 0;
        
        // Opening Balance
        if (options.openingBalance != null && options.openingBalance !== undefined) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            
            doc.text('-', getX(0) + 1, yPos);
            doc.text('Opening Balance', getX(1) + 1, yPos);
            doc.text('-', getX(2) + cols[2].w / 2, yPos, { align: 'center' });
            
            var obStr = self.formatAmount(balance, 'balance');
            var rightStart = getX(3);
            
            doc.text('', rightStart + cols[3].w, yPos, { align: 'right' });
            doc.text('', rightStart + cols[3].w + cols[4].w, yPos, { align: 'right' });
            doc.text(obStr, rightStart + cols[3].w + cols[4].w + cols[5].w, yPos, { align: 'right' });
            
            if (balance >= 0) totDebit += balance;
            else totCredit += Math.abs(balance);
            
            yPos += 3;
            doc.setLineWidth(0.25);
            doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
            yPos += rowHeight;
        }
        
        // Transactions
        entries.forEach(function(entry) {
            if (yPos > this.PAGE_HEIGHT - 50) {
                doc.addPage();
                page++;
                yPos = this.MARGIN;
                
                // Repeat header
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                cols.forEach(function(col, i) {
                    var x = getX(i);
                    if (col.a === 'right') {
                        doc.text(col.label, x + col.w, yPos, { align: 'right' });
                    } else if (col.a === 'center') {
                        doc.text(col.label, x + col.w / 2, yPos, { align: 'center' });
                    } else {
                        doc.text(col.label, x + 1, yPos);
                    }
                });
                yPos += 2;
                doc.setLineWidth(0.5);
                doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
                yPos += 6;
                
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8);
                doc.text('continued...', this.MARGIN + 2, yPos);
                yPos += 6;
            }
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            
            // Date
            doc.text(entry.date || '-', getX(0) + 1, yPos);
            
            // Particulars - clean text
            var part = entry.particulars || '-';
            if (part.length > 30) part = part.substring(0, 27) + '...';
            doc.text(part, getX(1) + 1, yPos);
            
            // Ref.No
            var ref = entry.ref_no || '-';
            doc.text(ref.substring(0, 5), getX(2) + cols[2].w / 2, yPos, { align: 'center' });
            
            // Debit/Credit
            var debit = parseFloat(entry.debit) || 0;
            var credit = parseFloat(entry.credit) || 0;
            
            var debitStr = debit > 0 ? self.formatAmount(debit, 'amount') : '';
            var creditStr = credit > 0 ? self.formatAmount(credit, 'amount') : '';
            
            var r3 = getX(3) + cols[3].w;
            var r4 = r3 + cols[4].w;
            var r5 = r4 + cols[5].w;
            
            // Update running balance
            if (debit > 0) balance += debit;
            if (credit > 0) balance -= credit;
            
            doc.text(debitStr, r3, yPos, { align: 'right' });
            doc.text(creditStr, r4, yPos, { align: 'right' });
            doc.text(self.formatAmount(balance, 'balance'), r5, yPos, { align: 'right' });
            
            // Totals
            if (debit > 0) totDebit += debit;
            if (credit > 0) totCredit += credit;
            
            // Row line
            yPos += 3;
            doc.setLineWidth(0.25);
            doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
            yPos += rowHeight;
        }.bind(this));
        
        // ============ TOTALS ============
        yPos += 4;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Total', getX(1) + 1, yPos);
        
        var td = getX(3) + cols[3].w;
        var tc = td + cols[4].w;
        var tb = tc + cols[5].w;
        
        doc.text(self.formatAmount(totDebit, 'amount'), td, yPos, { align: 'right' });
        doc.text(self.formatAmount(totCredit, 'amount'), tc, yPos, { align: 'right' });
        doc.text(self.formatAmount(balance, 'balance'), tb, yPos, { align: 'right' });
        
        yPos += 4;
        doc.setLineWidth(0.75);
        doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
        yPos += 12;
        
        // Final balance
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        var finalLabel = 'Closing Balance: ' + self.formatAmount(balance, 'balance');
        doc.text(finalLabel, this.PAGE_WIDTH - this.MARGIN, yPos, { align: 'right' });
        
        // Page number
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('Page ' + page, this.PAGE_WIDTH - this.MARGIN, this.PAGE_HEIGHT - 8, { align: 'right' });
        
        // Save
        var filename = options.filename || this.getSafeFilename(options.accountName || 'Ledger', 'Statement');
        doc.save(filename);
        showToast('PDF downloaded', 'success');
    },
    
    /**
     * Generate Invoice PDF
     */
    generateInvoice: function(data, options) {
        options = options || {};
        
        if (typeof jspdf === 'undefined') {
            showToast('jsPDF not loaded', 'error');
            return;
        }
        
        var jsPDF = jspdf.jsPDF;
        var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        var type = options.type || 'sale';
        var isSale = type === 'sale';
        var yPos = this.MARGIN;
        
        // Header
        yPos += 6;
        
        if (options.anonymous) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(isSale ? 'SALES INVOICE' : 'PURCHASE RECORD', this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 8;
            doc.setFontSize(11);
            doc.text('(Confidential Document)', this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 12;
            doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
        } else {
            var cfg = options.shopConfig || {};
            var name = cfg.name || '';
            var addr = cfg.address || '';
            var phone = cfg.phone || '';
            var gstin = cfg.gstin || '';
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(name, this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 8;
            
            if (addr) {
                doc.setFontSize(10);
                doc.text(addr, this.PAGE_WIDTH / 2, yPos, { align: 'center' });
                yPos += 5;
            }
            
            if (phone || gstin) {
                var parts = [];
                if (phone) parts.push('Ph: ' + phone);
                if (gstin) parts.push('GSTIN: ' + gstin);
                doc.setFontSize(9);
                doc.text(parts.join('  |  '), this.PAGE_WIDTH / 2, yPos, { align: 'center' });
                yPos += 5;
            }
            
            yPos += 4;
            doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
        }
        
        yPos += 10;
        
        // Party & Invoice
        var party = isSale ? (data.customer_name || 'Customer') : (data.supplier_name || 'Supplier');
        var invLabel = isSale ? 'INVOICE' : 'PURCHASE';
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(isSale ? 'Customer:' : 'Supplier:', this.MARGIN + 5, yPos);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(invLabel, this.PAGE_WIDTH - this.MARGIN - 5, yPos, { align: 'right' });
        
        yPos += 6;
        doc.setFont('helvetica', 'normal');
        doc.text(party, this.MARGIN + 5, yPos);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('No: ' + (data.invoice_no || '-'), this.PAGE_WIDTH - this.MARGIN - 5, yPos, { align: 'right' });
        
        yPos += 5;
        doc.text('Date: ' + formatDate(data.date), this.PAGE_WIDTH - this.MARGIN - 5, yPos, { align: 'right' });
        
        yPos += 12;
        doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
        yPos += 8;
        
        // Particulars
        doc.text('Particulars:', this.MARGIN + 5, yPos);
        yPos += 6;
        doc.text(data.notes || (isSale ? 'Sale' : 'Purchase'), this.MARGIN + 5, yPos);
        
        yPos += 12;
        
        // Amounts
        var amtX = this.PAGE_WIDTH - 50;
        
        doc.text('Subtotal:', amtX, yPos);
        doc.text(this.formatAmount(data.subtotal), this.PAGE_WIDTH - this.MARGIN - 5, yPos, { align: 'right' });
        
        if (data.tax_amount > 0) {
            yPos += 6;
            doc.text('Tax (' + (data.tax_percent || 0) + '%):', amtX, yPos);
            doc.text(this.formatAmount(data.tax_amount), this.PAGE_WIDTH - this.MARGIN - 5, yPos, { align: 'right' });
        }
        
        yPos += 8;
        doc.line(amtX, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
        
        yPos += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Total:', amtX, yPos);
        doc.text(this.formatAmount(data.total), this.PAGE_WIDTH - this.MARGIN - 5, yPos, { align: 'right' });
        
        // Footer
        yPos += 15;
        doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
        
        yPos += 8;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.text(options.anonymous ? 'Confidential.' : 'Computer generated record.', this.PAGE_WIDTH / 2, yPos, { align: 'center' });
        
        doc.setFontSize(8);
        doc.text('Page 1', this.PAGE_WIDTH - this.MARGIN - 5, this.PAGE_HEIGHT - 8, { align: 'right' });
        
        var filename = this.getSafeFilename(isSale ? 'Sale' : 'Purchase', data.invoice_no);
        doc.save(filename);
        showToast('PDF downloaded', 'success');
    },
    
    /**
     * Generate Report PDF
     */
    generateReportPDF: function(data, columns, title, options) {
        options = options || {};
        
        if (typeof jspdf === 'undefined') {
            showToast('jsPDF not loaded', 'error');
            return;
        }
        
        var jsPDF = jspdf.jsPDF;
        var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        var yPos = this.MARGIN;
        
        // Header
        yPos += 6;
        
        if (options.anonymous) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('FINANCIAL RECORD', this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 8;
            doc.setFontSize(12);
            doc.text(title, this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 10;
            doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
        } else {
            var cfg = options.shopConfig || {};
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(cfg.name || 'Business', this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 8;
            
            if (cfg.address) {
                doc.setFontSize(10);
                doc.text(cfg.address, this.PAGE_WIDTH / 2, yPos, { align: 'center' });
                yPos += 5;
            }
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text(title, this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 6;
            
            if (options.period) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.text(options.period, this.PAGE_WIDTH / 2, yPos, { align: 'center' });
                yPos += 5;
            }
            
            doc.setFontSize(9);
            doc.text('Generated: ' + formatDate(getToday()), this.PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 5;
            doc.line(this.MARGIN, yPos, this.PAGE_WIDTH - this.MARGIN, yPos);
        }
        
        yPos += 10;
        
        // Table
        if (columns && data && data.length > 0) {
            var self = this;
            var tableW = self.PAGE_WIDTH - 2 * self.MARGIN;
            var colW = tableW / columns.length;
            
            // Header
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            for (var ci = 0; ci < columns.length; ci++) {
                var x = self.MARGIN + ci * colW;
                var a = columns[ci].align || 'left';
                if (a === 'right' || a === 'text-right') {
                    doc.text(columns[ci].label || '', x + colW - 2, yPos, { align: 'right' });
                } else if (a === 'center') {
                    doc.text(columns[ci].label || '', x + colW / 2, yPos, { align: 'center' });
                } else {
                    doc.text(columns[ci].label || '', x + 2, yPos);
                }
            }
            
            yPos += 2;
            doc.setLineWidth(0.5);
            doc.line(self.MARGIN, yPos, self.PAGE_WIDTH - self.MARGIN, yPos);
            yPos += 6;
            
            // Data
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            
            for (var ri = 0; ri < data.length; ri++) {
                var row = data[ri];
                if (yPos > self.PAGE_HEIGHT - 25) {
                    doc.addPage();
                    yPos = self.MARGIN;
                    
                    doc.setFont('helvetica', 'bold');
                    for (var qi = 0; qi < columns.length; qi++) {
                        var qx = self.MARGIN + qi * colW;
                        var qa = columns[qi].align || 'left';
                        if (qa === 'right' || qa === 'text-right') {
                            doc.text(columns[qi].label || '', qx + colW - 2, yPos, { align: 'right' });
                        } else if (qa === 'center') {
                            doc.text(columns[qi].label || '', qx + colW / 2, yPos, { align: 'center' });
                        } else {
                            doc.text(columns[qi].label || '', qx + 2, yPos);
                        }
                    }
                    yPos += 2;
                    doc.setLineWidth(0.5);
                    doc.line(self.MARGIN, yPos, self.PAGE_WIDTH - self.MARGIN, yPos);
                    yPos += 6;
                    doc.setFont('helvetica', 'normal');
                }
                
                for (var cj = 0; cj < columns.length; cj++) {
                    var col = columns[cj];
                    var cx = self.MARGIN + cj * colW;
                    var val = col.render ? col.render(row) : (row[col.key] || '');
                    if (typeof val === 'string') {
                        val = val.replace(/<[^>]*>/g, '');
                        val = val.replace(/₹/g, '').trim();
                    }
                    var align = col.align || 'left';
                    
                    if (align === 'right' || align === 'text-right') {
                        doc.text(String(val), cx + colW - 2, yPos, { align: 'right' });
                    } else if (align === 'center') {
                        doc.text(String(val), cx + colW / 2, yPos, { align: 'center' });
                    } else {
                        doc.text(String(val), cx + 2, yPos);
                    }
                }
                
                yPos += 3;
                doc.setLineWidth(0.25);
                doc.line(self.MARGIN, yPos, self.PAGE_WIDTH - self.MARGIN, yPos);
                yPos += 6;
            }
        }
        
        // Footer
        yPos += 10;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.text(options.anonymous ? 'Confidential.' : 'Generated by Hisaab Pro.', self.PAGE_WIDTH / 2, yPos, { align: 'center' });
        
        doc.setFontSize(8);
        doc.text('Page 1', self.PAGE_WIDTH - self.MARGIN - 5, self.PAGE_HEIGHT - 8, { align: 'right' });
        
        var filename = options.filename || self.getSafeFilename(title || 'Report', 'Data');
        doc.save(filename);
        showToast('PDF downloaded', 'success');
    },
    
    /**
     * Legacy
     */
    fromElement: function() {
        showToast('Use direct PDF generation', 'info');
    }
};