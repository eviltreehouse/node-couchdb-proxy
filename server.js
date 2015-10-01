#!/usr/bin/env node

var VERSION = "1.0.0";

var KEY = null; var KEY_PASS = null;

var cdbHost = process.argv[2];
var cdbPort = process.argv[3];
var cdbProxyPort = process.argv[4];

if (! cdbHost) cdbHost = '127.0.0.1';
if (! cdbPort) cdbPort = 5984;
if (! cdbProxyPort) cdbProxyPort = 5994;;

var http = require('http'),
 request = require('request'),
 url = require('url');

console.log("[*] Redirecting http://0.0.0.0:" + cdbProxyPort + " => http://" + cdbHost + ":" + cdbPort + "...");

http.createServer(function (req, res) {
	var req_url = url.parse(req.url,true);

	var href = req_url.href;
	//console.log( href, req.url, req.headers['referer'], req_url.query);

	var re = "^http\:\/\/" + cdbHost + ":" + cdbProxyPort + "\/";
	re = new RegExp(re);

	href = href.replace(/\?.*/, '');
	if (href.match(/^\/_all_dbs\/?$/)) {
		console.log("* _all_dbs request made from " + (req.headers['referer'] || "-") );

		var referOkay = ( typeof req.headers['referer'] != 'undefined' ) && req.headers['referer'].match(re) ? true : false;
		var overrideOkay = KEY && (req_url.query[KEY] == KEY_PASS) ? true : false;
		
		if ((! referOkay) && (! overrideOkay)) {
			console.log("* [DENY] Returning empty list");
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.write("[]");
			res.end();
			return;
		} else {
			console.log("* [GOOD] Permitting request for _all_dbs");
		}
	}

	var x = request('http://' + [ cdbHost, cdbPort ].join(":") + href);
	req.pipe(x);
	x.pipe(res);	
}).listen(cdbProxyPort);

