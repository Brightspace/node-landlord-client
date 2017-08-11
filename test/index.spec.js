'use strict';

const __sinon__ = require('sinon');
const expect = require('chai').expect;
const nock = require('nock');

const LandlordClient = require('../src/index');
const data = {
	endpoint: 'http://landlord.localhost',
	tenantId: '88ce2351-2eda-40ba-8774-d4d46f0d2d1a',
	domain: 'brightspace.localhost',
	scheme: 'http',
	isHttpSite: true,
	tenantUrl: 'http://brightspace.localhost/',
	maxAge: 3600
};

describe('LandlordClient', function() {
	let sandbox = __sinon__.sandbox.create();

	beforeEach(function() {
		sandbox = __sinon__.sandbox.create();
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
			.withArgs(data.tenantId, data.tenantUrl, data.maxAge)
			.returns(Promise.resolve());

		const instance = new LandlordClient({ endpoint: data.endpoint, cache });
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

	it('does not look up tenant info when cached', function() {
		const getRequest = nock(data.endpoint);

		const cache = new LandlordClient.LRULandlordCache();
		const getTenantUrlLookupStub =
			sandbox.stub(cache, 'getTenantUrlLookup');
		getTenantUrlLookupStub
			.withArgs(data.tenantId)
			.returns(Promise.resolve(data.tenantUrl));
		const cacheTenantUrlLookupSpy =
			sandbox.stub(cache, 'cacheTenantUrlLookup');

		const instance = new LandlordClient({ endpoint: data.endpoint, cache });
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
});
