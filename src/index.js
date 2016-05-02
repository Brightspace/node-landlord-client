'use strict';

var parseCacheControl = require('parse-cache-control'),
	Promise = require('bluebird'),
	request = require('superagent');

var AbstractLandlordCache = require('./abstract-cache'),
	errors = require('./errors'),
	LRULandlordCache = require('./lru-cache');

var DEFAULT_LANDLORD_URI = 'https://landlord.brightspace.com';

function LandlordClient(opts) {
	if (!(this instanceof LandlordClient)) {
		return new LandlordClient(opts);
	}

	opts = opts || {};

	this._cache = opts.cache || new LRULandlordCache();

	if (!(this._cache instanceof AbstractLandlordCache)) {
		throw new Error('"opts.cache" must be an instance of AbstractLandlordCache if provided');
	}

	this._landlord = opts.endpoint || DEFAULT_LANDLORD_URI;
}

LandlordClient.prototype.lookupTenantId = Promise.method(/* @this */ function lookupTenantId(host) {
	var self = this;

	if ('string' !== typeof host || 0 === host.length) {
		throw new Error('host must be a valid string');
	}

	return self
		._cache
		.getTenantIdLookup(host)
		.catch(function() {
			return new Promise(function(resolve, reject) {
				request
					.get(self._landlord + '/v1/tenants')
					.query({
						domain: host
					})
					.end(function(err, res) {
						if (err) {
							reject(new errors.TenantLookupFailed(err));
							return;
						}

						var tenants = res.body;

						if (!Array.isArray(tenants)) {
							reject(new errors.TenantLookupFailed());
							return;
						}

						if (0 === tenants.length) {
							reject(new errors.TenantNotFound(host));
							return;
						}

						var tenantInfo = tenants[0];

						if ('object' !== typeof tenantInfo || !tenantInfo.hasOwnProperty('tenantId')) {
							reject(new errors.TenantLookupFailed());
							return;
						}

						var tenantId = tenantInfo.tenantId;

						var result = self
							._cache
							.cacheTenantIdLookup(host, tenantId)
							.catch(function() {})
							.return(tenantId);

						resolve(result);
					});
			});
		});
});

LandlordClient.prototype._lookupTenantInfo = function lookupTenantInfo(tenantId) {
	var self = this;

	return new Promise(function(resolve, reject) {
		if ('string' !== typeof tenantId) {
			reject(new Error('tenantId must be a valid string'));
		}

		request
			.get(self._landlord + '/v1/tenants/' + tenantId)
			.end(function(err, res) {
				if (err) {
					if (res && res.status === 404) {
						reject(new errors.TenantIdNotFound(tenantId));
					} else {
						reject(new errors.TenantLookupFailed(err));
					}

					return;
				}

				var tenantInfo = res.body;

				if ('object' !== typeof tenantInfo || !tenantInfo.hasOwnProperty('domain') || !tenantInfo.hasOwnProperty('isHttpSite')) {
					reject(new errors.TenantLookupFailed());
					return;
				}

				tenantInfo.domain = tenantInfo.domain.replace(/\/+$/g, '');

				var cacheControl = parseCacheControl(res.headers['cache-control']);
				tenantInfo._maxAge = null !== cacheControl
					? cacheControl['max-age']
					: null;

				resolve(tenantInfo);
			});
	});
};

LandlordClient.prototype.lookupTenantHost = function lookupTenantHost(tenantId) {
	return this._lookupTenantInfo(tenantId)
		.then(function(tenantInfo) {
			return tenantInfo.domain;
		});
};

LandlordClient.prototype.lookupTenantUrl = function lookupTenantUri(tenantId) {
	var self = this;

	return self
		._cache
		.getTenantUrlLookup(tenantId)
		.catch(function() {
			return self
				._lookupTenantInfo(tenantId)
				.then(function(tenantInfo) {
					var protocol = tenantInfo.isHttpSite ? 'http' : 'https';
					var url = protocol + '://' + tenantInfo.domain + '/';

					if (null !== tenantInfo._maxAge) {
						return self
							._cache
							.cacheTenantUrlLookup(tenantId, url, tenantInfo._maxAge)
							.catch(function() {})
							.return(url);
					}

					return url;
				});
		});
};

LandlordClient.prototype.health = function health() {
	return request.get(this._landlord + '/health');
};

module.exports = LandlordClient;
module.exports.AbstractLandlordCache = AbstractLandlordCache;
module.exports.errors = errors;
module.exports.LRULandlordCache = LRULandlordCache;
