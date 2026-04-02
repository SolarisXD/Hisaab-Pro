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
     */
    generateInvoice: function(sale) {
        // Create a hidden print-ready element
        var printEl = document.createElement('div');
        printEl.className = 'print-only-container';
        printEl.style.width = '800px'; // Fixed width for consistent capture
        printEl.style.padding = '30px';
        printEl.style.background = 'white';
        printEl.style.color = 'black';
        printEl.style.fontFamily = 'Arial, sans-serif';

        // Get shop info
        api.getConfig().then(function(config) {
            var html = `
                <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; background-color: #f8fafc; padding-top: 15px; border-radius: 4px 4px 0 0;">
                    <h1 style="margin: 0; font-size: 26px; text-transform: uppercase; font-weight: 900; color: #1e3a8a; letter-spacing: 1.5px;">${escapeHtml(config.shop.name)}</h1>
                    <p style="margin: 6px 0 2px 0; font-size: 14px; font-weight: 600; color: #333;">${escapeHtml(config.shop.address)}</p>
                    <p style="margin: 2px 0; font-size: 13px; color: #555;"><strong>Phone:</strong> ${escapeHtml(config.shop.phone)} &nbsp;|&nbsp; <strong>GSTIN:</strong> ${escapeHtml(config.shop.gstin)}</p>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                    <div>
                        <h3 style="margin: 0 0 8px 0; color: #666; font-size: 11px; text-transform: uppercase;">Invoice To:</h3>
                        <p style="margin: 0; font-weight: bold; font-size: 15px;">${escapeHtml(sale.customer_name || 'Walk-in Customer')}</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; font-size: 18px; color: #2563EB;">INVOICE</h2>
                        <p style="margin: 4px 0; font-size: 13px;"><strong>No:</strong> ${escapeHtml(sale.invoice_no)}</p>
                        <p style="margin: 4px 0; font-size: 13px;"><strong>Date:</strong> ${formatDate(sale.date)}</p>
                    </div>
                </div>

                <div style="padding: 15px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 20px; background: #fafafa;">
                    <p style="margin: 0; font-size: 13px; color: #666;">Description:</p>
                    <p style="margin: 4px 0 0 0; font-size: 14px;">${escapeHtml(sale.notes || 'Hisaab Sale Transaction')}</p>
                </div>

                <div style="display: flex; justify-content: flex-end;">
                    <div style="width: 250px;">
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
                            <span>Subtotal:</span>
                            <span>${formatINR(sale.subtotal)}</span>
                        </div>
                        ${sale.tax_amount > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
                            <span>GST (${sale.tax_percent}%):</span>
                            <span>${formatINR(sale.tax_amount)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #333; margin-top: 8px; font-weight: bold; font-size: 16px;">
                            <span>Total:</span>
                            <span style="color: #2563EB;">${formatINR(sale.total)}</span>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px; font-size: 11px; color: #666; text-align: center;">
                    <p style="margin: 2px 0;">Thank you for your business!</p>
                    <p style="margin: 2px 0;">Computer generated invoice — signature not required.</p>
                </div>
            `;

            printEl.innerHTML = html;
            document.body.appendChild(printEl);

            // Capture and remove
            var filename = pdf.getSafeFilename('Invoice', sale.invoice_no);
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
     */
    generateReportPDF: function(contentEl, title, filename) {
        // Create a wrapper for the report to add a header
        var printEl = document.createElement('div');
        printEl.className = 'print-report-container';
        printEl.style.width = '800px';
        printEl.style.padding = '30px';
        printEl.style.background = 'white';
        printEl.style.color = 'black';
        printEl.style.fontFamily = 'Arial, sans-serif';

        api.getConfig().then(function(config) {
            var headerHtml = `
                <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 15px; background-color: #f8fafc; padding-top: 12px; border-radius: 4px 4px 0 0;">
                    <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900; color: #1e3a8a; letter-spacing: 1px;">${escapeHtml(config.shop.name)}</h1>
                    <p style="margin: 5px 0 2px 0; font-size: 13px; font-weight: 600; color: #333;">${escapeHtml(config.shop.address)}</p>
                    <p style="margin: 2px 0; font-size: 12px; color: #555;"><strong>Report:</strong> ${escapeHtml(title)} &nbsp;|&nbsp; <strong>Generated on:</strong> ${formatDate(getToday())}</p>
                </div>
            `;
            
            var styleHtml = `
                <style>
                    .print-report-container * { box-sizing: border-box; }
                    .print-report-container .btn,
                    .print-report-container button,
                    .print-report-container .header-actions,
                    .print-report-container .no-print { display: none !important; }
                    .print-report-container .panel,
                    .print-report-container .stat-card {
                        box-shadow: none !important;
                        border: 1px solid #e5e7eb !important;
                        margin-bottom: 15px !important;
                        border-radius: 4px !important;
                    }
                    .print-report-container .panel-body,
                    .print-report-container .stat-card { padding: 12px 15px !important; }
                    .print-report-container .stats-row { gap: 15px !important; margin-bottom: 15px !important; }
                    .print-report-container table { font-size: 11px !important; margin-bottom: 0 !important; width: 100% !important; border-collapse: collapse !important; }
                    .print-report-container th { background: #f3f4f6 !important; border: 1px solid #e5e7eb !important; padding: 6px 8px !important; }
                    .print-report-container td { border: 1px solid #e5e7eb !important; padding: 6px 8px !important; }
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
     */
    generateTablePDF: function(data, columns, title, filename) {
        var printEl = document.createElement('div');
        printEl.className = 'print-report-container';
        printEl.style.width = '800px';
        printEl.style.padding = '30px';
        printEl.style.background = 'white';
        printEl.style.color = 'black';
        printEl.style.fontFamily = 'Arial, sans-serif';

        api.getConfig().then(function(config) {
            var headerHtml = `
                <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 15px; background-color: #f8fafc; padding-top: 12px; border-radius: 4px 4px 0 0;">
                    <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900; color: #1e3a8a; letter-spacing: 1px;">${escapeHtml(config.shop.name)}</h1>
                    <p style="margin: 5px 0 2px 0; font-size: 13px; font-weight: 600; color: #333;">${escapeHtml(config.shop.address)}</p>
                    <p style="margin: 2px 0; font-size: 12px; color: #555;"><strong>Report:</strong> ${escapeHtml(title)} &nbsp;|&nbsp; <strong>Generated on:</strong> ${formatDate(getToday())}</p>
                </div>
            `;
            
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
