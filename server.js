#!/usr/bin/env node
var VERSION = "1.0.5";

var A = parseArguments();

if (A['v']) {
	console.log('node-couchdb-proxy version ' + VERSION);
	console.log('by: corey @ eviltreehouse.com <https://github.com/eviltreehouse>');
	process.exit(0);
}

if (! A['a']) A['a'] = [ '127.0.0.1' ];
else A['a'].push('127.0.0.1');

var KEY = A['k']       || null; 
var KEY_PASS = A['kv'] || null;

var cdbHost = A['h']       || '127.0.0.1';		// CouchDB host
var cdbPort = A['p']       || '5984';			// CouchDB service port
var cdbProxyHost = A['ph'] || undefined;		// Your proxy [listen] host
var cdbProxyPort = A['pp'] || '5994';			// Your proxy [listen] port

var lbProxyIP = A['fh']		|| null;			// Your load balancers forwarding IP (or ^10.0.3.) range regex.
var lbProxyRegExIPv6 = false;

if (lbProxyIP && lbProxyIP.match(/^\^/)) {
	if (lbProxyIP.match(/\:/)) lbProxyRegExIPv6 = true;
	lbProxyIP = new RegExp(lbProxyIP);
}

var http = require('http'),
 request = require('request'),
 url = require('url');

console.log("[*] Redirecting http://" + (cdbProxyHost || "0.0.0.0") + ":" + cdbProxyPort + " => http://" + cdbHost + ":" + cdbPort + "...");

http.createServer(function (req, res) {
	var req_url = url.parse(req.url,true);

	var href = req_url.href;
	//console.log( href, req.url, req.headers['referer'], req_url.query);

	var re = "^http\:\/\/" + cdbHost + ":" + cdbProxyPort + "\/";
	re = new RegExp(re);

	//href = href.replace(/\?.*/, '');
	if (req_url.pathname.match(/^\/_all_dbs\/?/)) {
		console.log("[*] _all_dbs request made from " + clientIp(req) + " < " + (req.headers['referer'] || "-no referer-") + " >" );

		var referOkay = ( typeof req.headers['referer'] != 'undefined' ) && req.headers['referer'].match(re) ? true : false;
		var originOkay = permitIp( clientIp(req) );
		var overrideOkay = KEY && (req_url.query[KEY] == KEY_PASS) ? true : false;
		
		console.log(referOkay, originOkay, overrideOkay);
		
		if ((! referOkay) && (! overrideOkay) && (! originOkay)) {
			console.log("[!] _all_dbs DENIED: Returning empty list");
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.write("[]");
			res.end();
			return;
		} else {
			console.log("[*] _all_dbs PERMITTED");
		}
	}

	var x = request('http://' + [ cdbHost, cdbPort ].join(":") + href);		//  + (req_url.search ? req_url.search : '')
	req.pipe(x);
	x.pipe(res);	
}).listen(cdbProxyPort, cdbProxyHost);

/*
// FUNCS //////////////////////////////////////////////
*/

function clientIp(req) {
	var cip = validForward(req.headers['x-forwarded-for']) || 
			req.connection.remoteAddress || 
			req.socket.remoteAddress ||
			req.connection.socket.remoteAddress;

	// @TODO -- support ipv6
	return _ipv4(cip);
}

var _permitCache = {};
function permitIp(ip) {
	var permit = false;
	
	if (_permitCache[ip]) return true;
	
	if (A['a']) {
		for (var ai in A['a']) {
			var allowed = A['a'][ai];
			
			if (allowed.match(/^\^/)) {
				permit = ip.match(allowed) ? true : false;
			} else {
				permit = allowed == ip;	
			}
			
			if (permit) break;
		}
	}
	
	if (permit) _permitCache[ ip ] = true;
	
	console.log("[?] PERMIT: " + ip + "? " + permit);
		
	return permit;
}

function validForward(hv) {
	if (! hv) return null;
	if (! lbProxyIP) return null;
	if (typeof lbProxyIP == 'object') {
		if (! lbProxyRegExIPv6) hv = _ipv4(hv);
		if (hv.match(lbProxyIP)) return hv;
	} else {
		if (hv == lbProxyIP) return hv;
	}
}

function _ipv4(ipv6) {
	return ipv6.match(/([0-9\.]+)$/)[1];
}

function parseArguments() {
	var def = {};
	
	for (var i = 0; i < process.argv.length; i++) {
		var arg = process.argv[i]; if (! arg) arg = "";
		if (arg.match(/^\-./)) {
			var arg_name = arg.match(/^\-(.+)$/)[1];
			if (def[ arg_name ]) {
				def[ arg_name ] = [ def[arg_name] ];
				def[ arg_name ].push( process.argv[i+1] || true );
			} else {
				def[ arg_name ] = process.argv[i+1] || true;
			}
			i++;
		}
	}
	
	return def;
}