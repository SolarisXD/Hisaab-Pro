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

    // Handle login form
    var form = document.getElementById('login-form');
    var errorEl = document.getElementById('login-error');
    var loginBtn = document.getElementById('login-btn');

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        var username = document.getElementById('username').value.trim();
        var password = document.getElementById('password').value;

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
