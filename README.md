# landlord-client
[![Coverage
Status](https://coveralls.io/repos/github/Brightspace/node-landlord-client/badge.svg?branch=master)](https://coveralls.io/github/Brightspace/node-landlord-client?branch=master)

Simple helper for interacting with the Landlord APIs

## Install

```bash
npm install @d2l/landlord-client --save
```


## Usage

```js
var LandlordClient = require('@d2l/landlord-client');

var client = new LandlordClient();

client
	.lookupTenantId('valence.desire2learn.com:443')
	.then(function (tenantId) {
		// do something
	})
	.catch(function (err) {
		// handle error
	});
```

### API

---

#### `new LandlordClient([Object options])` -> `LandlordClient`


##### Option: endpoint

You may optionally specify the Landlord instance to connect to.

```js
...new LandlordClient({ endpoint: 'https://landlord.brightspace.com' });
```

##### Option: cache `AbstractLandlordCache` _(LRULandlordCache)_

You may optionally specifiy an instance of a cache inheriting from
`LandlordClient.AbstractLandlordCache`.

---

#### `.lookupTenantId(String host)` -> `Promise<String>`

Given the host, will fetch then TenantId from Landlord. Returns a Promise to a
String.

---

#### `.lookupTenantUrl(String TenantId)` -> `Promise<String>`

Given the TenantId, well fetch the base url from Landlord. Returns a Promise to
a String.

---

#### `.lookupTenantHost(String TenantId)` -> `Promise<String>`

Given the TenantId, will fetch the host (no protocol) from Landlord. Returns a
Promise to a String.

---

#### `.validateConfiguration()` -> `Promise<String>`

Checks availability by pinging Landlord. Returns a Promise to a String.

---

#### `LandlordClient.errors` -> `Object`

Provided as part of the export is an object containing the well-typed errors
which may be returned from function calls.


## Testing

```bash
npm test
```

## Contributing

1. **Fork** the repository. Committing directly against this repository is
   highly discouraged.

2. Make your modifications in a branch, updating and writing new unit tests
   as necessary in the `spec` directory.

3. Ensure that all tests pass with `npm test`

4. `rebase` your changes against master. *Do not merge*.

5. Submit a pull request to this repository. Wait for tests to run and someone
   to chime in.

### Code Style

This repository is configured with [EditorConfig][EditorConfig] and [ESLint]
[ESLint] rules. See the [docs.dev code style article][code style] for
information on installing editor extensions.

[EditorConfig]: http://editorconfig.org/
[ESLint]: http://eslint.org/
[code style]: http://docs.dev.d2l/index.php/JavaScript_Code_Style_(Personal_Learning)
