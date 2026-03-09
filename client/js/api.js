/**
 * api.js — Hisaab Pro Fetch Wrapper
 * 
 * Centralized API client. Change BASE_URL to point to cloud server later.
 * Handles 401 redirects, JSON parsing, and error formatting.
 */

'use strict';

var API_BASE = '/api/v1';

var api = {
    /**
     * Make a GET request
     */
    get: function(endpoint, params) {
        var url = API_BASE + endpoint;
        if (params) {
            var query = [];
            for (var key in params) {
                if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                    query.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                }
            }
            if (query.length > 0) {
                url += '?' + query.join('&');
            }
        }
        return api._fetch(url, { method: 'GET' });
    },

    /**
     * Make a POST request
     */
    post: function(endpoint, body) {
        return api._fetch(API_BASE + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    },

    /**
     * Make a PUT request
     */
    put: function(endpoint, body) {
        return api._fetch(API_BASE + endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    },

    /**
     * Make a DELETE request
     */
    delete: function(endpoint) {
        return api._fetch(API_BASE + endpoint, { method: 'DELETE' });
    },

    /**
     * Internal fetch wrapper with error handling
     */
    _fetch: function(url, options) {
        options = options || {};
        options.credentials = 'same-origin';

        return fetch(url, options)
            .then(function(response) {
                if (response.status === 401) {
                    // Redirect to login if not already there to avoid infinite loops
                    var path = window.location.pathname;
                    if (path !== '/' && !path.endsWith('/index.html')) {
                        window.location.href = '/index.html';
                    }
                    return Promise.reject(new Error('Session expired'));
                }
                return response.json().then(function(data) {
                    if (!response.ok) {
                        throw new Error(data.error || 'Request failed');
                    }
                    return data;
                });
            });
    },

    /**
     * Get public config (shop info)
     */
    getConfig: function() {
        return api.get('/config');
    },

    // --- Settings & Security ---
    getSettingsStatus: function() {
        return this.get('/settings/status');
    },

    runManualBackup: function() {
        return this.post('/settings/backup');
    },

    getSystemSetting: function(key) {
        return this.get('/settings/system-settings/' + key);
    },

    setSystemSetting: function(key, value) {
        return this.post('/settings/system-settings', { key: key, value: value });
    },

    getFinancialYears: function() {
        return this.get('/settings/financial-years');
    },

    createFinancialYear: function(data) {
        return this.post('/settings/financial-years', data);
    },

    activateFinancialYear: function(id) {
        return this.post('/settings/financial-years/' + id + '/activate');
    },

    updateShopConfig: function(data) {
        return this.put('/settings/shop-config', data);
    },

    // --- Purchases ---
    getPurchases: function(params) {
        return this.get('/purchases', params);
    },

    getPurchase: function(id) {
        return this.get('/purchases/' + id);
    },

    createPurchase: function(data) {
        return this.post('/purchases', data);
    },

    deletePurchase: function(id) {
        return this.delete('/purchases/' + id);
    }
};
