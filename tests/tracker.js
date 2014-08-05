/*
 * Node.js tracker for Snowplow: tests/tracker.js
 * 
 * Copyright (c) 2014 Snowplow Analytics Ltd. All rights reserved.
 *
 * This program is licensed to you under the Apache License Version 2.0,
 * and you may not use this file except in compliance with the Apache License Version 2.0.
 * You may obtain a copy of the Apache License Version 2.0 at http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the Apache License Version 2.0 is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the Apache License Version 2.0 for the specific language governing permissions and limitations there under.
 */

var assert = require('assert');
var nock = require('nock');
var querystring = require('querystring');
var tracker = require('../lib/tracker');
var version = require('../lib/version');

nock.disableNetConnect();
nock.recorder.rec({dont_print: true});

var mock = nock('http://d3rkrsqld9gmqf.cloudfront.net')
	.persist()
	.filteringPath(function(){return '/'})
	.get('/')
	.reply(200);

var context = [{
	schema: 'iglu:com.acme/user/jsonschema/1-0-0',
	data: {
		type: 'tester'
	}
}];

var completedContext = JSON.stringify({
	schema: 'iglu:com.snowplowanalytics.snowplow/contexts/jsonschema/1-0-0',
	data: context
});

function extractQueryString() {
	return querystring.parse(nock.recorder.play()[0].split('\n')[2].slice(11, -2));
}

function checkQuerystring(queryDict, expected) {
	for (var key in expected) {
		assert.strictEqual(expected[key], queryDict[key], key + ' should have value '  + expected[key]);
	}
	assert.deepEqual(queryDict['co'], completedContext, 'a custom context should be attached');
	assert.ok(queryDict['dtm'], 'a timestamp should be attached');
	assert.ok(queryDict['eid'], 'a UUID should be attached');
}

describe('tracker', function () {

	afterEach(function () {
		nock.recorder.clear();
	})

	describe('#trackPageView', function () {
		
		it('should send a page view event', function (done) {
			var expected = {
				tv: 'node-' + version,
				tna: 'cf',
				aid: 'cfe35',
				e: 'pv',
				url: 'http://www.example.com',
				page: 'example page',
				refr: 'google'
			};
			var t = tracker('d3rkrsqld9gmqf.cloudfront.net', 'cf', 'cfe35', false, function(){
				checkQuerystring(extractQueryString(), expected);
				done.apply(this, arguments);
			});
			t.trackPageView('http://www.example.com', 'example page', 'google', context);
		});
	});

	describe('#trackStructEvent', function () {

		it('should send a structured event', function (done) {
			var expected = {
				tv: 'node-' + version,
				tna: 'cf',
				aid: 'cfe35',
				e: 'se',
				se_ca: 'clothes',
				se_ac: 'add_to_basket',
				se_la: undefined,
				se_pr: 'red',			
				se_va: '15'
			};
			var t = tracker('d3rkrsqld9gmqf.cloudfront.net', 'cf', 'cfe35', false, function(){
				checkQuerystring(extractQueryString(), expected);
				done.apply(this, arguments);
			});
			t.trackStructEvent('clothes', 'add_to_basket', null, 'red', 15, context);
		});
	});

	describe('#trackEcommerceTransaction', function () {

		it('should track an ecommerce transaction', function (done) {
			var items = [{
				sku: 'item-729',
				name: 'red hat',
				category: 'headgear',
				price: 10,
				quantity: 1,
				context: context
			}];
			var requestCount = items.length + 1;
			var expectedTransaction = {
				e: 'tr',
				tr_id: 'order-7',
				tr_af: 'affiliate',
				tr_tt: '15',
				tr_tx: '5',
				tr_sh: '0',
				tr_ci: 'Dover',
				tr_st: 'Delaware',
				tr_co: 'US',
				tr_cu: 'GBP'
			};
			var expectedItem = {
				e: 'ti',
				ti_sk: 'item-729',
				ti_nm: 'red hat',
				ti_ca: 'headgear',
				ti_qu: '1',
				ti_id: 'order-7',
				ti_cu: 'GBP'
			};
			var t = tracker('d3rkrsqld9gmqf.cloudfront.net', 'cf', 'cfe35', false, function(){
				var qs = extractQueryString();
				var expected = qs['e'] === 'tr' ? expectedTransaction : expectedItem;
				checkQuerystring(qs, expected);

				// Don't end the test until every request has been dealt with
				nock.recorder.clear();
				requestCount--;
				if (!requestCount) {
					done.apply(this, arguments);
				}
			});
			t.trackEcommerceTransaction('order-7', 'affiliate', 15, 5, 0, 'Dover', 'Delaware', 'US', 'GBP', items, context);
		});
	});

	describe('#trackUnstructEvent', function () {

		it('should send a structured event', function (done) {
			var inputJson = {
				schema: 'iglu:com.acme/viewed_product/jsonschema/1-0-0',
				data: {
					price: 20
				}
			};
			var expected = {
				tv: 'node-' + version,
				tna: 'cf',
				aid: 'cfe35',
				e: 'ue',
				ue_pr: JSON.stringify({
					schema: 'iglu:com.snowplowanalytics.snowplow/unstruct_event/jsonschema/1-0-0',
					data: inputJson
				})
			};
			var t = tracker('d3rkrsqld9gmqf.cloudfront.net', 'cf', 'cfe35', false, function(){
				checkQuerystring(extractQueryString(), expected);
				done.apply(this, arguments);
			});
			t.trackUnstructEvent(inputJson, context);
		});
	});	

	describe('#trackScreenView', function () {

		it('should send a screen view event', function (done) {
			var expected = {
				tv: 'node-' + version,
				tna: 'cf',
				aid: 'cfe35',
				e: 'ue',
				ue_pr: JSON.stringify({
					schema: 'iglu:com.snowplowanalytics.snowplow/unstruct_event/jsonschema/1-0-0',
					data: {
						schema: 'iglu:com.snowplowanalytics.snowplow/screen_view/jsonschema/1-0-0',
						data: {
							name: 'title screen',
							id: '12345'
						}
					}
				})
			};
			var t = tracker('d3rkrsqld9gmqf.cloudfront.net', 'cf', 'cfe35', false, function(){
				checkQuerystring(extractQueryString(), expected);
				done.apply(this, arguments);
			});
			t.trackScreenView('title screen', '12345', context);
		});
	});	

	describe('setter methods', function () {
		it('should set user attributes', function (done) {
			var expected = {
				tv: 'node-' + version,
				tna: 'cf',
				aid: 'cfe35',
				e: 'pv',
				url: 'http://www.example.com',
				page: 'example page',
				refr: 'google',
				p: 'web',
				uid: 'jacob',
				res: '400x200',
				vp: '500x800',
				cd: '24',
				tz: 'Europe London'
			};
			var t = tracker('d3rkrsqld9gmqf.cloudfront.net', 'cf', 'cfe35', false, function(){
				checkQuerystring(extractQueryString(), expected);
				done.apply(this, arguments);
			});
			t.setPlatform('web');
			t.setUserId('jacob');
			t.setScreenResolution(400, 200);
			t.setViewport(500, 800);
			t.setColorDepth(24);
			t.setTimezone('Europe London');

			t.trackPageView('http://www.example.com', 'example page', 'google', context);
		});
	});	
});
