/**
 * auth.js — Hisaab Pro Login Page Logic
 * 
 * Handles login form submission and session management.
 */

'use strict';

(function() {
    // Initial check
    api.get('/auth/me')
        .then(function() {
            // Logged in
            window.location.href = '/dashboard.html';
        })
        .catch(function() {
            // Not logged in -> check if system is initialized
            checkSystemStatus();
        });

    function checkSystemStatus() {
        api.get('/auth/status')
            .then(function(status) {
                if (!status.initialized) {
                    // Start new journey!
                    if (!window.location.pathname.endsWith('signup.html')) {
                        window.location.href = '/signup.html';
                    }
                } else {
                    // System exists, show login
                    if (window.location.pathname.endsWith('signup.html')) {
                        window.location.href = '/index.html';
                    }
                    var link = document.getElementById('signup-link-container');
                    if (link) link.style.display = 'none'; // Only one-time setup
                    loadShopConfig();
                    loadFinancialYears();
                }
            })
            .catch(function() {
                // Backend error or offline
                showError('System data not accessible. Please ensure Hisaab Pro Server is running.');
            });
    }

    function loadShopConfig() {
        api.getConfig()
            .then(function(config) {
                if (config && config.shop && config.shop.name) {
                    var nameEl = document.getElementById('shop-name');
                    if (nameEl) nameEl.textContent = config.shop.name;
                }
            })
            .catch(function() {});
    }

    function loadFinancialYears() {
        api.get('/settings/public-financial-years')
            .then(function(years) {
                var select = document.getElementById('fy-select');
                var group = document.getElementById('fy-group');
                if (!select || !group) return;

                select.innerHTML = '';
                
                // Add Legacy Option
                var legacyOpt = document.createElement('option');
                legacyOpt.value = 'hisaab.db';
                legacyOpt.textContent = 'Current/Legacy Data';
                select.appendChild(legacyOpt);

                var hasActive = false;
                if (years && years.length > 0) {
                    years.forEach(function(fy) {
                        var opt = document.createElement('option');
                        opt.value = fy.db_filename;
                        if (fy.is_active === 1) {
                            opt.selected = true;
                            hasActive = true;
                        }
                        opt.textContent = fy.name + ' (' + formatDate(fy.start_date) + ' to ' + formatDate(fy.end_date) + ')';
                        select.appendChild(opt);
                    });
                }
                
                if (!hasActive) {
                    legacyOpt.selected = true;
                }
                
                group.style.display = 'block';
            })
            .catch(function(err) {
                console.error('Failed to load financial years on login:', err);
            });
    }

    // Basic date formatter for the dropdown
    function formatDate(dateString) {
        if (!dateString) return '';
        var d = new Date(dateString);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    // Handle login form
    var form = document.getElementById('login-form');
    var errorEl = document.getElementById('login-error');
    var loginBtn = document.getElementById('login-btn');

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        var username = document.getElementById('username').value.trim();
        var password = document.getElementById('password').value;
        var fyFilename = document.getElementById('fy-select') ? document.getElementById('fy-select').value : 'hisaab.db';

        if (!username || !password) {
            showError('Please enter username and password');
            return;
        }

        // Disable button while loading
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';

        api.post('/auth/login', { username: username, password: password })
            .then(function(data) {
                if (data.success) {
                    localStorage.setItem('hisaab_active_fy', fyFilename);
                    window.location.href = '/dashboard.html';
                } else {
                    showError(data.error || 'Login failed');
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Sign In';
                }
            })
            .catch(function(err) {
                showError(err.message || 'Invalid username or password');
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
            });
    });

    function showError(message) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
        setTimeout(function() {
            errorEl.classList.remove('show');
        }, 5000);
    }
})();
