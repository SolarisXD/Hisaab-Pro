/**
 * pdf.js — Hisaab Pro PDF Generation
 * 
 * Uses jsPDF and html2canvas to generate PDFs of invoices and reports.
 * Assumes libraries are loaded via <script> tags in the HTML.
 */

'use strict';

var pdf = {
    /**
     * Helper to generate a clean, professional filename
     */
    getSafeFilename: function(baseName, type) {
        var date = getToday();
        var name = (baseName || 'Hisaab').replace(/[^a-z0-9]/gi, '_');
        var suffix = (type || 'Report').replace(/[^a-z0-9]/gi, '_');
        return `${name}_${suffix}_${date}.pdf`;
    },

    /**
     * Generate PDF from an HTML element
     * @param {HTMLElement} element - The element to capture
     * @param {string} filename - The name of the PDF file
     */
    fromElement: function(element, filename) {
        if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
            showToast('PDF libraries not loaded. Please check assets.', 'error');
            return Promise.reject(new Error('Libraries missing'));
        }

        showToast('Generating PDF...', 'info');

        // Capture with html2canvas
        return html2canvas(element, {
            scale: 2, // Higher quality
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        }).then(function(canvas) {
            var imgData = canvas.toDataURL('image/jpeg', 0.95);
            var { jsPDF } = window.jspdf;
            var doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            var imgWidth = 210; // A4 width in mm
            var pageHeight = 297; // A4 height in mm
            var imgHeight = (canvas.height * imgWidth) / canvas.width;
            var heightLeft = imgHeight;
            var position = 0;

            // Add first page
            doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add extra pages if needed
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                doc.addPage();
                doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            doc.save(filename || 'hisaab-pro-export.pdf');
            showToast('PDF downloaded successfully!', 'success');
        }).catch(function(err) {
            showToast('Failed to generate PDF: ' + err.message, 'error');
            console.error(err);
        });
    },

    /**
     * Generate Invoice PDF
     * @param {Object} sale - The sale data object
     * @param {Object} options - { anonymous: boolean }
     */
    generateInvoice: function(data, options) {
        options = options || {};
        var type = options.type || (data.supplier_account_id || data.supplier_name ? 'purchase' : 'sale');
        var isSale = type === 'sale';
        
        // Branding based on context
        var themeColor = isSale ? '#2563EB' : '#475569'; // Blue vs Slate
        var secondaryColor = isSale ? '#f8fafc' : '#f1f5f9';
        var label = isSale ? 'SALES INVOICE' : 'PURCHASE RECORD';
        
        // Default descriptions
        var partyName = isSale ? (data.customer_name || 'Walk-in Customer') : (data.supplier_name || 'Regular Supplier');
        var defaultDesc = isSale ? `Sale Transaction — ${partyName}` : `Procurement Entry — ${partyName}`;

        // Create a hidden print-ready element
        var printEl = document.createElement('div');
        printEl.className = 'print-only-container';
        printEl.style.width = '800px'; 
        printEl.style.padding = '40px';
        printEl.style.background = 'white';
        printEl.style.color = '#1e293b';
        printEl.style.fontFamily = "'Inter', Arial, sans-serif";

        // Get shop info
        api.getConfig().then(function(config) {
            var headerHtml = '';
            if (options.anonymous) {
                var anonLabel = isSale ? 'ANONYMOUS SALES RECORD' : 'CONFIDENTIAL PURCHASE RECORD';
                headerHtml = `
                    <div style="text-align: center; border-bottom: 4px solid #64748b; padding-bottom: 20px; margin-bottom: 30px; background-color: #f1f5f9; padding-top: 20px; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; font-weight: 900; color: #334155; letter-spacing: 3px;">${anonLabel}</h1>
                        <p style="margin: 8px 0 2px 0; font-size: 13px; font-weight: 600; color: #64748b;">(Confidential Internal Document — No Firm Identity)</p>
                    </div>
                `;
            } else {
                headerHtml = `
                    <div style="text-align: center; border-bottom: 4px solid ${themeColor}; padding-bottom: 20px; margin-bottom: 30px; background-color: ${secondaryColor}; padding-top: 20px; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 28px; text-transform: uppercase; font-weight: 900; color: ${isSale ? '#1e3a8a' : '#1e293b'}; letter-spacing: 2px;">${escapeHtml(config.shop.name)}</h1>
                        <p style="margin: 8px 0 2px 0; font-size: 15px; font-weight: 600; color: #333;">${escapeHtml(config.shop.address || '')}</p>
                        <p style="margin: 4px 0; font-size: 14px; color: #475569;"><strong>Contact:</strong> ${escapeHtml(config.shop.phone || '—')} &nbsp;|&nbsp; <strong>GSTIN:</strong> ${escapeHtml(config.shop.gstin || '—')}</p>
                    </div>
                `;
            }

            var html = `
                ${headerHtml}
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                    <div>
                        <h3 style="margin: 0 0 10px 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">${isSale ? 'Billed To:' : 'Supplier:'}</h3>
                        <p style="margin: 0; font-weight: 800; font-size: 18px; color: #1e293b;">${escapeHtml(partyName)}</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; font-size: 20px; color: ${themeColor}; font-weight: 900; letter-spacing: 1px;">${label}</h2>
                        <p style="margin: 6px 0; font-size: 14px; font-weight: 600;"><strong>No:</strong> ${escapeHtml(data.invoice_no)}</p>
                        <p style="margin: 4px 0; font-size: 14px; font-weight: 600;"><strong>Date:</strong> ${formatDate(data.date)}</p>
                    </div>
                </div>

                <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 30px; background: #fdfdfd; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Transaction Context / Description:</p>
                    <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 500; color: #1e293b; line-height: 1.5;">${escapeHtml(data.notes || defaultDesc)}</p>
                </div>

                <div style="display: flex; justify-content: flex-end;">
                    <div style="width: 300px; background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #f1f5f9;">
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; font-weight: 600; color: #475569;">
                            <span>Subtotal Volume:</span>
                            <span>${formatINR(data.subtotal)}</span>
                        </div>
                        ${data.tax_amount > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; font-weight: 600; color: #475569;">
                            <span>Taxation (${data.tax_percent}%):</span>
                            <span>${formatINR(data.tax_amount)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; padding: 12px 0 0 0; border-top: 2px dashed #cbd5e1; margin-top: 12px; font-weight: 900; font-size: 22px;">
                            <span style="color: #64748b;">Total:</span>
                            <span style="color: ${themeColor};">${formatINR(data.total)}</span>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 40px; border-top: 2px solid #f1f5f9; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; font-weight: 600;">
                    <p style="margin: 4px 0;">${options.anonymous ? 'Privileged Financial Documentation.' : 'This is a digitally verified commercial record.'}</p>
                    <p style="margin: 4px 0; color: #64748b; font-size: 11px;">Computer generated ${isSale ? 'sales record' : 'entry'} — authorized by Hisaab Pro Protocol.</p>
                </div>
            `;

            printEl.innerHTML = html;
            document.body.appendChild(printEl);

            // Capture and remove
            var filename = pdf.getSafeFilename(isSale ? 'Sale' : 'Purchase', data.invoice_no);
            pdf.fromElement(printEl, filename)
                .finally(function() {
                    document.body.removeChild(printEl);
                });
        });
    },

    /**
     * Generate Report PDF with professional header
     * @param {HTMLElement} contentEl - The report content element
     * @param {string} title - Report title
     * @param {string} filename - Filename
     * @param {Object} options - { anonymous: boolean }
     */
    generateReportPDF: function(contentEl, title, filename, options) {
        options = options || {};
        // Create a wrapper for the report to add a header
        var printEl = document.createElement('div');
        printEl.className = 'print-report-container';
        printEl.style.width = '800px';
        printEl.style.padding = '30px';
        printEl.style.background = 'white';
        printEl.style.color = 'black';
        printEl.style.fontFamily = 'Arial, sans-serif';

        api.getConfig().then(function(config) {
            var headerHtml = '';
            if (options.anonymous) {
                headerHtml = `
                    <div style="text-align: center; border-bottom: 3px solid #64748b; padding-bottom: 12px; margin-bottom: 15px; background-color: #f1f5f9; padding-top: 12px; border-radius: 4px 4px 0 0;">
                        <h1 style="margin: 0; font-size: 20px; text-transform: uppercase; font-weight: 900; color: #334155; letter-spacing: 1.5px;">FINANCIAL RECORD</h1>
                        <p style="margin: 5px 0 2px 0; font-size: 12px; color: #64748b;"><strong>Subject:</strong> ${escapeHtml(title)} &nbsp;|&nbsp; <strong>Generated on:</strong> ${formatDate(getToday())}</p>
                    </div>
                `;
            } else {
                headerHtml = `
                    <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 15px; background-color: #f8fafc; padding-top: 12px; border-radius: 4px 4px 0 0;">
                        <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900; color: #1e3a8a; letter-spacing: 1px;">${escapeHtml(config.shop.name)}</h1>
                        <p style="margin: 5px 0 2px 0; font-size: 13px; font-weight: 600; color: #333;">${escapeHtml(config.shop.address)}</p>
                        <p style="margin: 2px 0; font-size: 12px; color: #555;"><strong>Report:</strong> ${escapeHtml(title)} &nbsp;|&nbsp; <strong>Generated on:</strong> ${formatDate(getToday())}</p>
                    </div>
                `;
            }
            
            var styleHtml = `
                <style>
                    .print-report-container * { box-sizing: border-box; }
                    .print-report-container .btn,
                    .print-report-container button,
                    .print-report-container .header-actions,
                    .print-report-container .loading-overlay,
                    .print-report-container .spinner,
                    .print-report-container .material-symbols-outlined,
                    .print-report-container input,
                    .print-report-container select,
                    .print-report-container .no-print { display: none !important; }

                    /* Hide the entire action bar in Ledger */
                    .print-report-container #ledger-panel > div.flex.justify-between {
                        border-bottom: 2px solid #f1f5f9 !important;
                        padding-bottom: 15px !important;
                        margin-bottom: 25px !important;
                    }
                    .print-report-container #ledger-panel > div.flex.justify-between > div.flex.items-center {
                        display: none !important; /* Hide action buttons container */
                    }
                    
                    /* Decluttering Ledger Account Name */
                    .print-report-container #ledger-account-name {
                        font-size: 22px !important;
                        font-weight: 900 !important;
                        color: #0f172a !important;
                        margin: 0 !important;
                        font-style: normal !important;
                        text-transform: uppercase !important;
                        letter-spacing: -0.5px !important;
                    }
                    
                    /* Decluttering Cards */
                    .print-report-container #ledger-stats { 
                        display: flex !important; 
                        gap: 20px !important; 
                        margin-bottom: 25px !important;
                    }
                    .print-report-container #ledger-stats > div { 
                        flex: 1 !important;
                        background: #f8fafc !important; 
                        border: 1px solid #e2e8f0 !important;
                        padding: 15px 20px !important;
                        border-radius: 8px !important;
                        justify-content: flex-start !important;
                        box-shadow: none !important;
                    }
                    .print-report-container #ledger-stats > div:last-child {
                        background: #f1f5f9 !important;
                        border-color: #cbd5e1 !important;
                        color: #1e293b !important;
                    }
                    .print-report-container #ledger-stats p { margin: 0 !important; }
                    .print-report-container #ledger-stats .text-xs { font-size: 11px !important; color: #64748b !important; font-weight: 800 !important; }
                    .print-report-container #ledger-stats .text-2xl { font-size: 20px !important; margin-top: 4px !important; font-weight: 900 !important; }

                    .print-report-container .panel,
                    .print-report-container .stat-card {
                        box-shadow: none !important;
                        border: 1px solid #e5e7eb !important;
                        margin-bottom: 20px !important;
                        border-radius: 6px !important;
                    }
                    .print-report-container .panel-body,
                    .print-report-container .stat-card { padding: 15px !important; }
                    
                    /* Table Decluttering */
                    .print-report-container table { 
                        font-size: 11.5px !important; 
                        width: 100% !important; 
                        border-collapse: separate !important;
                        border-spacing: 0 !important;
                        border: 1px solid #e2e8f0 !important;
                        border-radius: 8px !important;
                        overflow: hidden !important;
                    }
                    .print-report-container th { 
                        background: #f8fafc !important; 
                        border-bottom: 1px solid #e2e8f0 !important; 
                        border-right: 1px solid #f1f5f9 !important;
                        padding: 12px 15px !important; 
                        font-weight: 900 !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.5px !important;
                        color: #475569 !important;
                    }
                    .print-report-container td { 
                        border-bottom: 1px solid #f1f5f9 !important; 
                        border-right: 1px solid #fdfdfd !important;
                        padding: 10px 15px !important; 
                        vertical-align: middle !important;
                        line-height: 1.4 !important;
                    }
                    .print-report-container td div p.text-sm { font-weight: 800 !important; color: #1e293b !important; margin-bottom: 2px !important; }
                    .print-report-container td div p.text-[10px] { color: #64748b !important; font-weight: 700 !important; }
                    .print-report-container .amount { font-weight: 800 !important; }
                    .print-report-container h3 { font-size: 15px !important; margin: 0 0 10px 0 !important; color: #111 !important; }
                    .print-report-container .stat-label { font-size: 11px !important; margin-bottom: 4px !important; }
                    .print-report-container .stat-value { font-size: 18px !important; }
                </style>
            `;
            
            printEl.innerHTML = styleHtml + headerHtml + contentEl.innerHTML;
            document.body.appendChild(printEl);
            
            pdf.fromElement(printEl, filename)
                .finally(function() {
                    document.body.removeChild(printEl);
                });
        });
    },

    /**
     * Generate PDF from a data array and columns definition
     * @param {Array} data - Array of objects
     * @param {Array} columns - Array of column definitions {label, key, render}
     * @param {string} title - Report title
     * @param {string} filename - Filename
     * @param {Object} options - { anonymous: boolean }
     */
    generateTablePDF: function(data, columns, title, filename, options) {
        options = options || {};
        var printEl = document.createElement('div');
        printEl.className = 'print-report-container';
        printEl.style.width = '800px';
        printEl.style.padding = '30px';
        printEl.style.background = 'white';
        printEl.style.color = 'black';
        printEl.style.fontFamily = 'Arial, sans-serif';

        api.getConfig().then(function(config) {
            var headerHtml = '';
            if (options.anonymous) {
                headerHtml = `
                    <div style="text-align: center; border-bottom: 3px solid #64748b; padding-bottom: 12px; margin-bottom: 15px; background-color: #f1f5f9; padding-top: 12px; border-radius: 4px 4px 0 0;">
                        <h1 style="margin: 0; font-size: 20px; text-transform: uppercase; font-weight: 900; color: #334155; letter-spacing: 1px;">FINANCIAL LISTING</h1>
                        <p style="margin: 2px 0; font-size: 12px; color: #555;"><strong>Table:</strong> ${escapeHtml(title)} &nbsp;|&nbsp; <strong>Generated on:</strong> ${formatDate(getToday())}</p>
                    </div>
                `;
            } else {
                headerHtml = `
                    <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 15px; background-color: #f8fafc; padding-top: 12px; border-radius: 4px 4px 0 0;">
                        <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900; color: #1e3a8a; letter-spacing: 1px;">${escapeHtml(config.shop.name)}</h1>
                        <p style="margin: 5px 0 2px 0; font-size: 13px; font-weight: 600; color: #333;">${escapeHtml(config.shop.address)}</p>
                        <p style="margin: 2px 0; font-size: 12px; color: #555;"><strong>Report:</strong> ${escapeHtml(title)} &nbsp;|&nbsp; <strong>Generated on:</strong> ${formatDate(getToday())}</p>
                    </div>
                `;
            }
            
            var tableHtml = '<table style="width:100%; border-collapse: collapse; font-size: 11px;">';
            // Header
            tableHtml += '<thead><tr style="background: #f3f4f6;">';
            columns.forEach(col => {
                tableHtml += `<th style="border: 1px solid #e5e7eb; padding: 6px 8px; text-align: ${col.align || 'left'}; font-weight: 600;">${escapeHtml(col.label)}</th>`;
            });
            tableHtml += '</tr></thead><tbody>';
            
            // Body
            data.forEach(row => {
                tableHtml += '<tr>';
                columns.forEach(col => {
                    var val = col.render ? col.render(row) : (row[col.key] || '');
                    // Strip HTML tags safely if render returns HTML (e.g. badges or colored spans)
                    if (typeof val === 'string' && val.includes('<')) {
                        val = val.replace(/<[^>]*>?/gm, '');
                    }
                    tableHtml += `<td style="border: 1px solid #e5e7eb; padding: 4px 8px; text-align: ${col.align || 'left'};">${escapeHtml(String(val))}</td>`;
                });
                tableHtml += '</tr>';
            });
            
            tableHtml += '</tbody></table>';

            printEl.innerHTML = headerHtml + tableHtml;
            document.body.appendChild(printEl);
            
            pdf.fromElement(printEl, filename)
                .finally(function() {
                    document.body.removeChild(printEl);
                });
        });
    }
};
