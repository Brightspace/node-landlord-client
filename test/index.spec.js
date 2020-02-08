'use strict';

const __sinon__ = require('sinon');
const expect = require('chai').expect;
const nock = require('nock');

const errors = require('../src/errors');
const LandlordClient = require('../src/index');
const data = {
	endpoint: 'http://landlord.localhost',
	tenantId: '88ce2351-2eda-40ba-8774-d4d46f0d2d1a',
	domain: 'brightspace.localhost',
	scheme: 'http',
	isHttpSite: true,
	tenantUrl: 'http://brightspace.localhost/',
	maxAge: 3600,
	expiry: 3600
};

const EXPECTED_USER_AGENT = `node-landlord-client/${require('../package.json').version}`;

describe('LandlordClient', function() {
	let sandbox = __sinon__.sandbox.create();

	beforeEach(function() {
		sandbox = __sinon__.sandbox.create();
		sandbox.useFakeTimers();
	});

	afterEach(function() {
		sandbox.verifyAndRestore();
	});

	it('looks up tenant id when not cached', function() {
		const getRequest = nock(data.endpoint)
			.get('/v1/tenants')
			.query({ domain: data.domain })
			.reply(200, [{
				tenantId: data.tenantId,
				domain: data.domain
			}]);

		const cache = new LandlordClient.LRULandlordCache();
		const getTenantIdLookupStub =
			sandbox.stub(cache, 'getTenantIdLookup');
		getTenantIdLookupStub
			.withArgs(data.domain)
			.returns(Promise.reject(new Error('Not Found')));
		const cacheTenantIdLookupStub =
			sandbox.stub(cache, 'cacheTenantIdLookup');
		cacheTenantIdLookupStub
			.withArgs(data.domain, data.tenantId)
			.returns(Promise.resolve());

		const instance = new LandlordClient({ endpoint: data.endpoint, cache });
		return expect(instance.lookupTenantId(data.domain))
			.to.eventually
			.equal(data.tenantId)
			.then(function() {
				getRequest.done();
			});
	});

	it('does not look up tenant id when cached', function() {
		const getRequest = nock(data.endpoint);

		const cache = new LandlordClient.LRULandlordCache();
		const getTenantIdLookupStub =
			sandbox.stub(cache, 'getTenantIdLookup');
		getTenantIdLookupStub
			.withArgs(data.domain)
			.returns(Promise.resolve(data.tenantId));
		const cacheTenantUrlLookupSpy =
			sandbox.stub(cache, 'cacheTenantUrlLookup');

		const instance = new LandlordClient({ endpoint: data.endpoint, cache });
		return expect(instance.lookupTenantId(data.domain))
			.to.eventually
			.equal(data.tenantId)
			.then(function() {
				getRequest.done();
			})
			.then(function() {
				expect(cacheTenantUrlLookupSpy.notCalled).to.be.true;
			});
	});

	it('dedupes concurrent tenant id lookups', function() {
		// this will fail if not deduped due to the nock only working once

		const getRequest = nock(data.endpoint)
			.get('/v1/tenants')
			.query({ domain: data.domain })
			.reply(200, [{
				tenantId: data.tenantId,
				domain: data.domain
			}]);

		const cache = new LandlordClient.LRULandlordCache();
		sandbox
			.stub(cache, 'getTenantIdLookup')
			.returns(Promise.reject(new Error('Not Found')));
		sandbox
			.stub(cache, 'cacheTenantIdLookup')
			.returns(Promise.resolve());

		const instance = new LandlordClient({ endpoint: data.endpoint, cache });
		const lookup1 = instance.lookupTenantId(data.domain);
		const lookup2 = instance.lookupTenantId(data.domain);

		Promise
			.all([
				expect(lookup1).to.eventually.equal(data.tenantId),
				expect(lookup2).to.eventually.equal(data.tenantId)
			])
			.then(function() {
				getRequest.done();
			});
	});

	it('does not dedupe concurrent tenant id lookups for different domains', function() {
		// this will fail if erroneously deduped due to a nock not being satisfied

		const getRequest = nock(data.endpoint)
			.get('/v1/tenants')
			.query({ domain: data.domain })
			.reply(200, [{
				tenantId: data.tenantId,
				domain: data.domain
			}])
			.get('/v1/tenants')
			.query({ domain: 'cats' })
			.reply(200, [{
				tenantId: data.tenantId,
				domain: data.domain
			}]);

		const cache = new LandlordClient.LRULandlordCache();
		sandbox
			.stub(cache, 'getTenantIdLookup')
			.returns(Promise.reject(new Error('Not Found')));
		sandbox
			.stub(cache, 'cacheTenantIdLookup')
			.returns(Promise.resolve());

		const instance = new LandlordClient({ endpoint: data.endpoint, cache });
		const lookup1 = instance.lookupTenantId(data.domain);
		const lookup2 = instance.lookupTenantId('cats');

		return Promise
			.all([
				expect(lookup1).to.eventually.equal(data.tenantId),
				expect(lookup2).to.eventually.equal(data.tenantId)
			])
			.then(function() {
				getRequest.done();
			});
	});

	for (const blockOnRefresh of [false, true]) {
		describe(`blockOnRefresh: ${blockOnRefresh}`, function() {
			it('looks up tenant info when not cached', function() {
				const getRequest = nock(data.endpoint)
					.get('/v1/tenants/' + data.tenantId)
					.reply(200, {
						tenantId: data.tenantId,
						domain: data.domain + '/',
						isHttpSite: data.isHttpSite
					}, {
						'Cache-Control': 'max-age=' + data.maxAge
					});

				const cache = new LandlordClient.LRULandlordCache();
				const getTenantUrlLookupStub =
					sandbox.stub(cache, 'getTenantUrlLookup');
				getTenantUrlLookupStub
					.withArgs(data.tenantId)
					.returns(Promise.reject(new Error('Not Found')));
				const cacheTenantUrlLookupStub =
					sandbox.stub(cache, 'cacheTenantUrlLookup');
				cacheTenantUrlLookupStub
					.withArgs(data.tenantId, data.tenantUrl, data.expiry)
					.returns(Promise.resolve());

				const instance = new LandlordClient({ endpoint: data.endpoint, cache, blockOnRefresh });
				return expect(instance.lookupTenantUrl(data.tenantId))
					.to.eventually
					.equal(data.tenantUrl)
					.then(function() {
						getRequest.done();
					})
					.then(function() {
						expect(cacheTenantUrlLookupStub.calledOnce).to.be.true;
					});
			});

			it('dedupes concurrent tenant info lookups', function() {
				// this will fail if not deduped due to the nock only working once

				const getRequest = nock(data.endpoint)
					.get('/v1/tenants/' + data.tenantId)
					.reply(200, {
						tenantId: data.tenantId,
						domain: data.domain + '/',
						isHttpSite: data.isHttpSite
					}, {
						'Cache-Control': 'max-age=' + data.maxAge
					});

				const cache = new LandlordClient.LRULandlordCache();
				sandbox
					.stub(cache, 'getTenantIdLookup')
					.returns(Promise.reject(new Error('Not Found')));
				sandbox
					.stub(cache, 'cacheTenantIdLookup')
					.returns(Promise.resolve());

				const instance = new LandlordClient({ endpoint: data.endpoint, cache, blockOnRefresh });
				const lookup1 = instance.lookupTenantUrl(data.tenantId);
				const lookup2 = instance.lookupTenantUrl(data.tenantId);

				return Promise
					.all([
						expect(lookup1).to.eventually.equal(data.tenantUrl),
						expect(lookup2).to.eventually.equal(data.tenantUrl)
					])
					.then(function() {
						getRequest.done();
					});
			});

			it('does not dedupe concurrent tenant info lookups for different tenant ids', function() {
				// this will fail if wrongly deduped due to a nock not being satisfied

				const getRequest = nock(data.endpoint)
					.get('/v1/tenants/' + data.tenantId)
					.reply(200, {
						tenantId: data.tenantId,
						domain: data.domain + '/',
						isHttpSite: data.isHttpSite
					}, {
						'Cache-Control': 'max-age=' + data.maxAge
					})
					.get('/v1/tenants/cats')
					.reply(200, {
						tenantId: 'cats',
						domain: data.domain + '/',
						isHttpSite: data.isHttpSite
					}, {
						'Cache-Control': 'max-age=' + data.maxAge
					});

				const cache = new LandlordClient.LRULandlordCache();
				sandbox
					.stub(cache, 'getTenantIdLookup')
					.returns(Promise.reject(new Error('Not Found')));
				sandbox
					.stub(cache, 'cacheTenantIdLookup')
					.returns(Promise.resolve());

				const instance = new LandlordClient({ endpoint: data.endpoint, cache, blockOnRefresh });
				const lookup1 = instance.lookupTenantUrl(data.tenantId);
				const lookup2 = instance.lookupTenantUrl('cats');

				return Promise
					.all([
						expect(lookup1).to.eventually.equal(data.tenantUrl),
						expect(lookup2).to.eventually.equal(data.tenantUrl)
					])
					.then(function() {
						getRequest.done();
					});
			});

			it('does not look up tenant info when cached', function() {
				const getRequest = nock(data.endpoint);

				const cache = new LandlordClient.LRULandlordCache();
				const getTenantUrlLookupStub =
					sandbox.stub(cache, 'getTenantUrlLookup');
				getTenantUrlLookupStub
					.withArgs(data.tenantId)
					.returns(Promise.resolve({ url: data.tenantUrl, expiry: 1 }));
				const cacheTenantUrlLookupSpy =
					sandbox.stub(cache, 'cacheTenantUrlLookup');

				const instance = new LandlordClient({ endpoint: data.endpoint, cache, blockOnRefresh });
				return expect(instance.lookupTenantUrl(data.tenantId))
					.to.eventually
					.equal(data.tenantUrl)
					.then(function() {
						getRequest.done();
					})
					.then(function() {
						expect(cacheTenantUrlLookupSpy.notCalled).to.be.true;
					});
			});

			it('gets error when tenantId not found', function() {
				const nonExistantTenantId = '88ce2351-2xxx-40ba-8774-d4d46f0d2d1a';
				const getRequest = nock(data.endpoint)
					.get('/v1/tenants/' + nonExistantTenantId)
					.replyWithError();

				const cache = new LandlordClient.LRULandlordCache();
				const getTenantUrlLookupStub =
					sandbox.stub(cache, 'getTenantUrlLookup');
				getTenantUrlLookupStub
					.withArgs(nonExistantTenantId)
					.returns(Promise.reject(new Error('Not Found')));
				const cacheTenantUrlLookupStub =
					sandbox.stub(cache, 'cacheTenantUrlLookup');
				cacheTenantUrlLookupStub
					.withArgs(nonExistantTenantId, data.tenantUrl, data.expiry)
					.returns(Promise.reject(new Error('Not Found')));

				const instance = new LandlordClient({ endpoint: data.endpoint, cache, blockOnRefresh });
				return expect(instance.lookupTenantUrl(nonExistantTenantId))
					.to.be.rejectedWith(errors.TenantLookupFailed)
					.then(function() {
						getRequest.done();
					});
			});
		});
	}

	describe('blockOnRefresh: false', function() {
		it('uses stale cached value and updates in background', function() {
			sandbox.clock.restore();

			const getRequest = nock(data.endpoint)
				.get(`/v1/tenants/${data.tenantId}`)
				.delay(50)
				.reply(200, {
					tenantId: data.tenantId,
					domain: data.domain + '.example.com',
					isHttpSite: data.isHttpSite
				}, {
					'Cache-Control': 'max-age=' + data.maxAge
				});

			const cache = new LandlordClient.LRULandlordCache();
			cache.cacheTenantUrlLookup(data.tenantId, data.tenantUrl, 1);

			const before = Date.now();
			const instance = new LandlordClient({ endpoint: data.endpoint, cache });
			return expect(instance.lookupTenantUrl(data.tenantId))
				.to.eventually
				.equal(`http://${data.domain}/`)
				.then(function() {
					const now = Date.now();
					expect(now - before).to.be.below(50);

					return new Promise(resolve => setTimeout(resolve, 55)).then(() => {
						getRequest.done();

						return expect(instance.lookupTenantUrl(data.tenantId))
							.to.eventually
							.equal(`http://${data.domain}.example.com/`);
					});
				});
		});

		it('emits an error when background refresh fails', function() {
			sandbox.clock.restore();

			const getRequest = nock(data.endpoint)
				.get(`/v1/tenants/${data.tenantId}`)
				.reply(502);

			const cache = new LandlordClient.AbstractLandlordCache();
			sandbox
				.stub(cache, 'getTenantUrlLookup')
				.withArgs(data.tenantId)
				.returns(Promise.resolve({ url: data.tenantUrl, expiry: 1 }));

			let resolveEmittedError;
			const errorEmitted = new Promise(resolve => {
				resolveEmittedError = resolve;
			});
			const instance = new LandlordClient({ endpoint: data.endpoint, cache })
				.on('error', resolveEmittedError);
			instance.lookupTenantUrl(data.tenantId);

			return errorEmitted
				.then(emittedError => {
					getRequest.done();

					expect(emittedError)
						.to.be.an.instanceof(errors.TenantLookupFailed);
				});
		});
	});

	describe('blockOnRefresh: true', function() {
		it('waits for updated value when cache is stale', function() {
			sandbox.clock.restore();

			const getRequest = nock(data.endpoint)
				.get(`/v1/tenants/${data.tenantId}`)
				.reply(200, {
					tenantId: data.tenantId,
					domain: data.domain + '.example.com',
					isHttpSite: data.isHttpSite
				}, {
					'Cache-Control': 'max-age=' + data.maxAge
				});

			const cache = new LandlordClient.LRULandlordCache();
			cache.cacheTenantUrlLookup(data.tenantId, data.tenantUrl, 1);

			const instance = new LandlordClient({ endpoint: data.endpoint, cache, blockOnRefresh: true });
			return expect(instance.lookupTenantUrl(data.tenantId))
				.to.eventually
				.equal(`http://${data.domain}.example.com/`)
				.then(() => getRequest.done());
		});

		it('uses stale cached value and emits an error when refresh fails', function() {
			sandbox.clock.restore();

			const getRequest = nock(data.endpoint)
				.get(`/v1/tenants/${data.tenantId}`)
				.reply(502);

			const cache = new LandlordClient.AbstractLandlordCache();
			sandbox
				.stub(cache, 'getTenantUrlLookup')
				.withArgs(data.tenantId)
				.returns(Promise.resolve({ url: data.tenantUrl, expiry: 1 }));

			let resolveEmittedError;
			const errorEmitted = new Promise(resolve => {
				resolveEmittedError = resolve;
			});
			const instance = new LandlordClient({ endpoint: data.endpoint, cache })
				.on('error', resolveEmittedError);
			const lookup = instance.lookupTenantUrl(data.tenantId);

			return Promise.all([
				expect(lookup).to.eventually.equal(data.tenantUrl),
				expect(errorEmitted).to.eventually.be.an.instanceof(errors.TenantLookupFailed),
				() => getRequest.done(),
			]);
		});
	});

	it('sends a custom user-agent header when looking up tenant id', function() {
		// this will fail due to nock if the user-agent header doesnt match

		const getRequest = nock(data.endpoint)
			.get('/v1/tenants')
			.query({ domain: data.domain })
			.matchHeader('User-Agent', EXPECTED_USER_AGENT)
			.reply(200, [{
				tenantId: data.tenantId,
				domain: data.domain
			}]);

		const instance = new LandlordClient({ endpoint: data.endpoint });
		return instance
			.lookupTenantId(data.domain)
			.then(function() {
				getRequest.done();
			});
	});

	it('includes the client name in custom user-agent header when looking up tenant id', function() {
		// this will fail due to nock if the user-agent header doesnt match
		const name = 'landlord-client-tests';

		const getRequest = nock(data.endpoint)
			.get('/v1/tenants')
			.query({ domain: data.domain })
			.matchHeader('User-Agent', `${name} (${EXPECTED_USER_AGENT})`)
			.reply(200, [{
				tenantId: data.tenantId,
				domain: data.domain
			}]);

		const instance = new LandlordClient({ endpoint: data.endpoint, name });
		return instance
			.lookupTenantId(data.domain)
			.then(function() {
				getRequest.done();
			});
	});

	it('sends a custom user-agent header when looking up tenant url', function() {
		// this will fail due to nock if the user-agent header doesnt match

		const getRequest = nock(data.endpoint)
			.get(`/v1/tenants/${data.tenantId}`)
			.matchHeader('User-Agent', EXPECTED_USER_AGENT)
			.reply(200, {
				tenantId: data.tenantId,
				domain: data.domain,
				isHttpSite: data.isHttpSite
			});

		const instance = new LandlordClient({ endpoint: data.endpoint });
		return instance
			.lookupTenantUrl(data.tenantId)
			.then(function() {
				getRequest.done();
			});
	});

	it('includes the client name in custom user-agent header when looking up tenant url', function() {
		// this will fail due to nock if the user-agent header doesnt match
		const name = 'landlord-client-tests';

		const getRequest = nock(data.endpoint)
			.get(`/v1/tenants/${data.tenantId}`)
			.matchHeader('User-Agent', `${name} (${EXPECTED_USER_AGENT})`)
			.reply(200, {
				tenantId: data.tenantId,
				domain: data.domain,
				isHttpSite: data.isHttpSite
			});

		const instance = new LandlordClient({ endpoint: data.endpoint, name });
		return instance
			.lookupTenantUrl(data.tenantId)
			.then(function() {
				getRequest.done();
			});
	});
});
