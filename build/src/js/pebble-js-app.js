var __loader = (function() {

var loader = {};

loader.packages = {};

loader.packagesLinenoOrder = [{ filename: 'loader.js', lineno: 0 }];

loader.extpaths = ['?', '?.js', '?.json', '?/index.js'];

loader.paths = ['/', 'lib', 'vendor'];

loader.basepath = function(path) {
  return path.replace(/[^\/]*$/, '');
};

var replace = function(a, regexp, b) {
  var z;
  do {
    z = a;
  } while (z !== (a = a.replace(regexp, b)));
  return z;
};

loader.normalize = function(path) {
  path = replace(path, /(?:(^|\/)\.?\/)+/g, '$1');
  path = replace(path, /[^\/]*\/\.\.\//, '');
  return path;
};

loader.require = function(path, requirer) {
  var module = loader.getPackage(path, requirer);
  if (!module) {
    throw new Error("Cannot find module '" + path + "'");
  }

  if (module.exports) {
    return module.exports;
  }

  var require = function(path) { return loader.require(path, module); };

  module.exports = {};
  module.loader(module.exports, module, require);
  module.loaded = true;

  return module.exports;
};

var compareLineno = function(a, b) { return a.lineno - b.lineno; };

loader.define = function(path, lineno, loadfun) {
  var module = {
    filename: path,
    lineno: lineno,
    loader: loadfun,
  };

  loader.packages[path] = module;
  loader.packagesLinenoOrder.push(module);
  loader.packagesLinenoOrder.sort(compareLineno);
};

loader.getPackage = function(path, requirer) {
  var module;
  if (requirer) {
    module = loader.getPackageAtPath(loader.basepath(requirer.filename) + '/' + path);
  }

  if (!module) {
    module = loader.getPackageAtPath(path);
  }

  var paths = loader.paths;
  for (var i = 0, ii = paths.length; !module && i < ii; ++i) {
    var dirpath = paths[i];
    module = loader.getPackageAtPath(dirpath + '/' + path);
  }
  return module;
};

loader.getPackageAtPath = function(path) {
  path = loader.normalize(path);

  var module;
  var extpaths = loader.extpaths;
  for (var i = 0, ii = extpaths.length; !module && i < ii; ++i) {
    var filepath = extpaths[i].replace('?', path);
    module = loader.packages[filepath];
  }
  return module;
};

loader.getPackageByLineno = function(lineno) {
  var packages = loader.packagesLinenoOrder;
  var module;
  for (var i = 0, ii = packages.length; i < ii; ++i) {
    var next = packages[i];
    if (next.lineno > lineno) {
      break;
    }
    module = next;
  }
  return module;
};

return loader;

})();

__loader.define("app.js", 111, function(exports, module, require) {
var UI = require('ui');
var Voice = require('ui/voice');
var Vector2 = require('vector2');
var Motor = require('ui/vibe');
var Settings = require('settings');
var Clay = require('clay');
var Feature = require('platform/feature');
var clayConfig = require('config');
var clay = new Clay(clayConfig, null, {autoHandleEvents: false});

var token = "";
var isABot = false;
var servers = [];
var channels = [];
var dmChannels = [];
var messages = [];
var selectedChannel;
var inChatList = false;

Pebble.addEventListener('showConfiguration', function(e) {
	Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function(e) {
	if (e && !e.response) {
		return;
	}
	var dict = clay.getSettings(e.response);
	console.log("Message to send:" + JSON.stringify(dict));
	Settings.option(dict);
});

token = Settings.option('token');
isABot = Settings.option('isABot');
console.log("Got Settings: " + token + ", " + isABot);

var loadingCard = new UI.Card({
	fullscreen:true, 
	title: 'Loading...',
	titleColor: Feature.color('orange', 'black')
});

if(!token){
	loadingCard.title("Oops!");
	loadingCard.subtitle("Enter your Discord token in the app settings!");
	console.log("No token!");
}

loadingCard.show();

var serverMenu = new UI.Menu({
	fullscreen:true,
	backgroundColor: Feature.color('liberty', "white"),
	textColor: Feature.color('white',"black"),
	highlightBackgroundColor: Feature.color('indigo',"#AA5500"),
	highlightTextColor: Feature.color('white',"black"),
	sections: [
		{title: 'Servers'},
	]
});

if(!isABot){
	serverMenu.section(0, {title: 'DMs'});
	serverMenu.section(1, {title: 'Servers'});
}

var channelMenu = new UI.Menu({
	fullscreen:true,
	backgroundColor: Feature.color('liberty',"white"),
	textColor: "black",
	highlightBackgroundColor: Feature.color('indigo',"black"),
	highlightTextColor: 'white',
	sections: [{
	  title: 'Channels',
	  items: [{}]
	}]
});

var chatList = new UI.Card({
	fullscreen:true, 
	scrollable:true,
	title: 'Loading...',
	titleColor: Feature.color('orange',"black"),
	subtitleColor: Feature.color('chrome yellow',"black"),
	bodyColor: 'black',
});

serverMenu.on("select", function(selection) {
	channels = [];
	channelMenu.items(0, {title:"Loading..."});
	var j = 0;
	if(selection.sectionIndex || isABot)
		for(var i = 0; i < servers[selection.itemIndex].channels.length; i++){
			if(!servers[selection.itemIndex].channels[i].type){
				channels.push(servers[selection.itemIndex].channels[i]);
				channelMenu.item(0, j, {
					title: servers[selection.itemIndex].channels[i].name, 
					subtitle: servers[selection.itemIndex].channels[i].topic
				});
				j++;
			}
		}
	else
		for(var i = 0; i < dmChannels.length; i++){
			channels.push(dmChannels[i]);
			if(dmChannels[i].recipients.length > 1){
				var members = "";
				for(var m = 0; m < dmChannels[i].recipients.length; m++)
					members += dmChannels[i].recipients[m].username + ", ";
				channelMenu.item(0, j, {
					title: "Group with " + dmChannels[i].recipients[0].username,
					subtitle: members
				});
			}else
				channelMenu.item(0, j, {title: dmChannels[i].recipients[0].username});
			j++;
		}
	channelMenu.show();
});

channelMenu.on("select", function(selection){
	messages = [];
	console.log("Selected Channel!");
	
	selectedChannel = channels[selection.itemIndex].id;
	
	var request = new XMLHttpRequest();
	
	request.onload = function() {
		console.log('Got response: ' + this.responseText);
		messages = JSON.parse(this.responseText);
		console.log(JSON.stringify(messages[0]));
		var cardBody = "";
		chatList.title(messages[0].author.username + ":");
		chatList.subtitle(messages[0].content);
		for(var i = 1; i < messages.length; i++)
			cardBody += messages[i].author.username + ":\n" + messages[i].content + "\n";
		if(cardBody.length > 433 - messages[0].author.username.length - messages[0].content.length);
		chatList.body(cardBody.substring(0, 410 - messages[0].author.username.length - messages[0].content.length) + "...");
		console.log("Chat list text length: " + (cardBody.substring(0, 410 - messages[0].author.username.length - messages[0].content.length).length +3));
	};

	request.open("GET", "https://discordapp.com/api/channels/" + selectedChannel + "/messages");
	if(isABot)
		request.setRequestHeader('Authorization', "Bot " + token);
	else
		request.setRequestHeader('Authorization', token);
	request.setRequestHeader('Content-Type', 'application/json');
	request.send();
	chatList.show();
	inChatList = true;
});

chatList.on('click', 'select', function(input){
	inChatList = false;
	Voice.dictate('start', true, function(input) {
		if (input.err) {
			inChatList = true;
			console.log('Error: ' + input.err);
			return;
		}
	
		var message = new XMLHttpRequest();
		
		message.onload = function() {
			console.log('Got response: ' + this.responseText);
		};

		message.open("POST", "https://discordapp.com/api/channels/" + selectedChannel + "/messages");
		if(isABot)
			message.setRequestHeader('Authorization', "Bot " + token);
		else
			message.setRequestHeader('Authorization', token);
		message.setRequestHeader('Content-Type', 'application/json');
		message.send(JSON.stringify({content:input.transcription}));
		inChatList = true;
	});
});

chatList.on('click', 'back', function(input){
	chatList.title('Loading...');
	chatList.subtitle('');
	chatList.body('');
	chatList.hide();
	inChatList = false;
});

var ws = new WebSocket("wss://gateway.discord.gg/?encoding=json&v=7");

ws.addEventListener('open', function (event) {
	console.log("Connected!");
});

ws.addEventListener('message', function (event) {
	var data = JSON.parse(event.data);
	
	if(data.t === "READY"){
		console.log("Ready!");
		serverMenu.show();
		loadingCard.hide();
		if(!isABot){
			console.log(JSON.stringify(data.d.guilds));
			servers = data.d.guilds;
			dmChannels = data.d.private_channels;
			serverMenu.item(0, 0, {title: "Messages", subtitle: "Direct messages"});
			for(var i = 0; i < servers.length; i++){
				serverMenu.item(1, i, {title: data.d.guilds[i].name});
			}
		}
	}
	
	if(data.t === "MESSAGE_CREATE"){
		setTimeout(function(){
			console.log("New Message! Currently in chat list: " + inChatList);
			if(data.d.channel_id == selectedChannel && inChatList){
				Motor.vibrate('short');
				messages.unshift(data.d);
				var cardBody = "";
				chatList.title(messages[0].author.username + ":");
				chatList.subtitle(messages[0].content);
				for(var i = 1; i < messages.length; i++)
					cardBody += messages[i].author.username + ":\n" + messages[i].content + "\n";
				if(cardBody.length > 433 - messages[0].author.username.length - messages[0].content.length);
				chatList.body(cardBody.substring(0, 410 - messages[0].author.username.length - messages[0].content.length) + "...");
				console.log("Length of chat card: " + (410 - messages[0].author.username.length - messages[0].content.length + 3));
			}
		}, 500);
	}
	
	if(data.t === "GUILD_CREATE" && isABot){
		console.log("Got Server: " + data.d.name);
		serverMenu.item(0, servers.length, {title: data.d.name});
		servers.push(data.d);
	}
	console.log(event.data);
	console.log(JSON.stringify(event));
	if(data.op === 10){
		console.log("Heartbeat: " + data.d.heartbeat_interval);
		console.log("Sent Auth!");
		ws.send(JSON.stringify({
			"op": 2,
			"d": {
				"token": token,
				"properties": {
					"$browser": "pebble",
				},
				"large_threshold": 50,
			}
		}));
		
		setInterval(function(){
			console.log("Sent heartbeat!");
			ws.send(JSON.stringify({"op": 1, "d":null}));
		}, data.d.heartbeat_interval - 500);
	}
});

});
__loader.define("clay.js", 370, function(exports, module, require) {
/* Clay - https://github.com/pebble/clay - Version: 0.1.5 - Build Date: 2016-03-21T18:31:38.274Z */
!function(t){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.clay=t()}}(function(){var t;return function e(t,n,r){function o(a,s){if(!n[a]){if(!t[a]){var c="function"==typeof require&&require;if(!s&&c)return c(a,!0);if(i)return i(a,!0);var u=new Error("Cannot find module '"+a+"'");throw u.code="MODULE_NOT_FOUND",u}var l=n[a]={exports:{}};t[a][0].call(l.exports,function(e){var n=t[a][1][e];return o(n?n:e)},l,l.exports,e,t,n,r)}return n[a].exports}for(var i="function"==typeof require&&require,a=0;a<r.length;a++)o(r[a]);return o}({1:[function(t,e,n){(function(e){/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
"use strict";function r(){try{var t=new Uint8Array(1);return t.foo=function(){return 42},42===t.foo()&&"function"==typeof t.subarray&&0===t.subarray(1,1).byteLength}catch(e){return!1}}function o(){return i.TYPED_ARRAY_SUPPORT?2147483647:1073741823}function i(t){return this instanceof i?(i.TYPED_ARRAY_SUPPORT||(this.length=0,this.parent=void 0),"number"==typeof t?a(this,t):"string"==typeof t?s(this,t,arguments.length>1?arguments[1]:"utf8"):c(this,t)):arguments.length>1?new i(t,arguments[1]):new i(t)}function a(t,e){if(t=m(t,0>e?0:0|g(e)),!i.TYPED_ARRAY_SUPPORT)for(var n=0;e>n;n++)t[n]=0;return t}function s(t,e,n){("string"!=typeof n||""===n)&&(n="utf8");var r=0|y(e,n);return t=m(t,r),t.write(e,n),t}function c(t,e){if(i.isBuffer(e))return u(t,e);if(U(e))return l(t,e);if(null==e)throw new TypeError("must start with number, buffer, array or string");if("undefined"!=typeof ArrayBuffer){if(e.buffer instanceof ArrayBuffer)return f(t,e);if(e instanceof ArrayBuffer)return p(t,e)}return e.length?d(t,e):h(t,e)}function u(t,e){var n=0|g(e.length);return t=m(t,n),e.copy(t,0,0,n),t}function l(t,e){var n=0|g(e.length);t=m(t,n);for(var r=0;n>r;r+=1)t[r]=255&e[r];return t}function f(t,e){var n=0|g(e.length);t=m(t,n);for(var r=0;n>r;r+=1)t[r]=255&e[r];return t}function p(t,e){return e.byteLength,i.TYPED_ARRAY_SUPPORT?(t=new Uint8Array(e),t.__proto__=i.prototype):t=f(t,new Uint8Array(e)),t}function d(t,e){var n=0|g(e.length);t=m(t,n);for(var r=0;n>r;r+=1)t[r]=255&e[r];return t}function h(t,e){var n,r=0;"Buffer"===e.type&&U(e.data)&&(n=e.data,r=0|g(n.length)),t=m(t,r);for(var o=0;r>o;o+=1)t[o]=255&n[o];return t}function m(t,e){i.TYPED_ARRAY_SUPPORT?(t=new Uint8Array(e),t.__proto__=i.prototype):t.length=e;var n=0!==e&&e<=i.poolSize>>>1;return n&&(t.parent=Q),t}function g(t){if(t>=o())throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x"+o().toString(16)+" bytes");return 0|t}function b(t,e){if(!(this instanceof b))return new b(t,e);var n=new i(t,e);return delete n.parent,n}function y(t,e){"string"!=typeof t&&(t=""+t);var n=t.length;if(0===n)return 0;for(var r=!1;;)switch(e){case"ascii":case"binary":case"raw":case"raws":return n;case"utf8":case"utf-8":return C(t).length;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return 2*n;case"hex":return n>>>1;case"base64":return Z(t).length;default:if(r)return C(t).length;e=(""+e).toLowerCase(),r=!0}}function v(t,e,n){var r=!1;if(e=0|e,n=void 0===n||n===1/0?this.length:0|n,t||(t="utf8"),0>e&&(e=0),n>this.length&&(n=this.length),e>=n)return"";for(;;)switch(t){case"hex":return j(this,e,n);case"utf8":case"utf-8":return P(this,e,n);case"ascii":return D(this,e,n);case"binary":return N(this,e,n);case"base64":return R(this,e,n);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return E(this,e,n);default:if(r)throw new TypeError("Unknown encoding: "+t);t=(t+"").toLowerCase(),r=!0}}function A(t,e,n,r){n=Number(n)||0;var o=t.length-n;r?(r=Number(r),r>o&&(r=o)):r=o;var i=e.length;if(i%2!==0)throw new Error("Invalid hex string");r>i/2&&(r=i/2);for(var a=0;r>a;a++){var s=parseInt(e.substr(2*a,2),16);if(isNaN(s))throw new Error("Invalid hex string");t[n+a]=s}return a}function w(t,e,n,r){return q(C(e,t.length-n),t,n,r)}function x(t,e,n,r){return q(V(e),t,n,r)}function k(t,e,n,r){return x(t,e,n,r)}function M(t,e,n,r){return q(Z(e),t,n,r)}function T(t,e,n,r){return q(W(e,t.length-n),t,n,r)}function R(t,e,n){return 0===e&&n===t.length?J.fromByteArray(t):J.fromByteArray(t.slice(e,n))}function P(t,e,n){n=Math.min(t.length,n);for(var r=[],o=e;n>o;){var i=t[o],a=null,s=i>239?4:i>223?3:i>191?2:1;if(n>=o+s){var c,u,l,f;switch(s){case 1:128>i&&(a=i);break;case 2:c=t[o+1],128===(192&c)&&(f=(31&i)<<6|63&c,f>127&&(a=f));break;case 3:c=t[o+1],u=t[o+2],128===(192&c)&&128===(192&u)&&(f=(15&i)<<12|(63&c)<<6|63&u,f>2047&&(55296>f||f>57343)&&(a=f));break;case 4:c=t[o+1],u=t[o+2],l=t[o+3],128===(192&c)&&128===(192&u)&&128===(192&l)&&(f=(15&i)<<18|(63&c)<<12|(63&u)<<6|63&l,f>65535&&1114112>f&&(a=f))}}null===a?(a=65533,s=1):a>65535&&(a-=65536,r.push(a>>>10&1023|55296),a=56320|1023&a),r.push(a),o+=s}return O(r)}function O(t){var e=t.length;if($>=e)return String.fromCharCode.apply(String,t);for(var n="",r=0;e>r;)n+=String.fromCharCode.apply(String,t.slice(r,r+=$));return n}function D(t,e,n){var r="";n=Math.min(t.length,n);for(var o=e;n>o;o++)r+=String.fromCharCode(127&t[o]);return r}function N(t,e,n){var r="";n=Math.min(t.length,n);for(var o=e;n>o;o++)r+=String.fromCharCode(t[o]);return r}function j(t,e,n){var r=t.length;(!e||0>e)&&(e=0),(!n||0>n||n>r)&&(n=r);for(var o="",i=e;n>i;i++)o+=X(t[i]);return o}function E(t,e,n){for(var r=t.slice(e,n),o="",i=0;i<r.length;i+=2)o+=String.fromCharCode(r[i]+256*r[i+1]);return o}function Y(t,e,n){if(t%1!==0||0>t)throw new RangeError("offset is not uint");if(t+e>n)throw new RangeError("Trying to access beyond buffer length")}function S(t,e,n,r,o,a){if(!i.isBuffer(t))throw new TypeError("buffer must be a Buffer instance");if(e>o||a>e)throw new RangeError("value is out of bounds");if(n+r>t.length)throw new RangeError("index out of range")}function B(t,e,n,r){0>e&&(e=65535+e+1);for(var o=0,i=Math.min(t.length-n,2);i>o;o++)t[n+o]=(e&255<<8*(r?o:1-o))>>>8*(r?o:1-o)}function z(t,e,n,r){0>e&&(e=4294967295+e+1);for(var o=0,i=Math.min(t.length-n,4);i>o;o++)t[n+o]=e>>>8*(r?o:3-o)&255}function F(t,e,n,r,o,i){if(e>o||i>e)throw new RangeError("value is out of bounds");if(n+r>t.length)throw new RangeError("index out of range");if(0>n)throw new RangeError("index out of range")}function K(t,e,n,r,o){return o||F(t,e,n,4,3.4028234663852886e38,-3.4028234663852886e38),H.write(t,e,n,r,23,4),n+4}function L(t,e,n,r,o){return o||F(t,e,n,8,1.7976931348623157e308,-1.7976931348623157e308),H.write(t,e,n,r,52,8),n+8}function I(t){if(t=G(t).replace(_,""),t.length<2)return"";for(;t.length%4!==0;)t+="=";return t}function G(t){return t.trim?t.trim():t.replace(/^\s+|\s+$/g,"")}function X(t){return 16>t?"0"+t.toString(16):t.toString(16)}function C(t,e){e=e||1/0;for(var n,r=t.length,o=null,i=[],a=0;r>a;a++){if(n=t.charCodeAt(a),n>55295&&57344>n){if(!o){if(n>56319){(e-=3)>-1&&i.push(239,191,189);continue}if(a+1===r){(e-=3)>-1&&i.push(239,191,189);continue}o=n;continue}if(56320>n){(e-=3)>-1&&i.push(239,191,189),o=n;continue}n=(o-55296<<10|n-56320)+65536}else o&&(e-=3)>-1&&i.push(239,191,189);if(o=null,128>n){if((e-=1)<0)break;i.push(n)}else if(2048>n){if((e-=2)<0)break;i.push(n>>6|192,63&n|128)}else if(65536>n){if((e-=3)<0)break;i.push(n>>12|224,n>>6&63|128,63&n|128)}else{if(!(1114112>n))throw new Error("Invalid code point");if((e-=4)<0)break;i.push(n>>18|240,n>>12&63|128,n>>6&63|128,63&n|128)}}return i}function V(t){for(var e=[],n=0;n<t.length;n++)e.push(255&t.charCodeAt(n));return e}function W(t,e){for(var n,r,o,i=[],a=0;a<t.length&&!((e-=2)<0);a++)n=t.charCodeAt(a),r=n>>8,o=n%256,i.push(o),i.push(r);return i}function Z(t){return J.toByteArray(I(t))}function q(t,e,n,r){for(var o=0;r>o&&!(o+n>=e.length||o>=t.length);o++)e[o+n]=t[o];return o}var J=t("base64-js"),H=t("ieee754"),U=t("isarray");n.Buffer=i,n.SlowBuffer=b,n.INSPECT_MAX_BYTES=50,i.poolSize=8192;var Q={};i.TYPED_ARRAY_SUPPORT=void 0!==e.TYPED_ARRAY_SUPPORT?e.TYPED_ARRAY_SUPPORT:r(),i.TYPED_ARRAY_SUPPORT?(i.prototype.__proto__=Uint8Array.prototype,i.__proto__=Uint8Array):(i.prototype.length=void 0,i.prototype.parent=void 0),i.isBuffer=function(t){return!(null==t||!t._isBuffer)},i.compare=function(t,e){if(!i.isBuffer(t)||!i.isBuffer(e))throw new TypeError("Arguments must be Buffers");if(t===e)return 0;for(var n=t.length,r=e.length,o=0,a=Math.min(n,r);a>o&&t[o]===e[o];)++o;return o!==a&&(n=t[o],r=e[o]),r>n?-1:n>r?1:0},i.isEncoding=function(t){switch(String(t).toLowerCase()){case"hex":case"utf8":case"utf-8":case"ascii":case"binary":case"base64":case"raw":case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return!0;default:return!1}},i.concat=function(t,e){if(!U(t))throw new TypeError("list argument must be an Array of Buffers.");if(0===t.length)return new i(0);var n;if(void 0===e)for(e=0,n=0;n<t.length;n++)e+=t[n].length;var r=new i(e),o=0;for(n=0;n<t.length;n++){var a=t[n];a.copy(r,o),o+=a.length}return r},i.byteLength=y,i.prototype._isBuffer=!0,i.prototype.toString=function(){var t=0|this.length;return 0===t?"":0===arguments.length?P(this,0,t):v.apply(this,arguments)},i.prototype.equals=function(t){if(!i.isBuffer(t))throw new TypeError("Argument must be a Buffer");return this===t?!0:0===i.compare(this,t)},i.prototype.inspect=function(){var t="",e=n.INSPECT_MAX_BYTES;return this.length>0&&(t=this.toString("hex",0,e).match(/.{2}/g).join(" "),this.length>e&&(t+=" ... ")),"<Buffer "+t+">"},i.prototype.compare=function(t){if(!i.isBuffer(t))throw new TypeError("Argument must be a Buffer");return this===t?0:i.compare(this,t)},i.prototype.indexOf=function(t,e){function n(t,e,n){for(var r=-1,o=0;n+o<t.length;o++)if(t[n+o]===e[-1===r?0:o-r]){if(-1===r&&(r=o),o-r+1===e.length)return n+r}else r=-1;return-1}if(e>2147483647?e=2147483647:-2147483648>e&&(e=-2147483648),e>>=0,0===this.length)return-1;if(e>=this.length)return-1;if(0>e&&(e=Math.max(this.length+e,0)),"string"==typeof t)return 0===t.length?-1:String.prototype.indexOf.call(this,t,e);if(i.isBuffer(t))return n(this,t,e);if("number"==typeof t)return i.TYPED_ARRAY_SUPPORT&&"function"===Uint8Array.prototype.indexOf?Uint8Array.prototype.indexOf.call(this,t,e):n(this,[t],e);throw new TypeError("val must be string, number or Buffer")},i.prototype.write=function(t,e,n,r){if(void 0===e)r="utf8",n=this.length,e=0;else if(void 0===n&&"string"==typeof e)r=e,n=this.length,e=0;else if(isFinite(e))e=0|e,isFinite(n)?(n=0|n,void 0===r&&(r="utf8")):(r=n,n=void 0);else{var o=r;r=e,e=0|n,n=o}var i=this.length-e;if((void 0===n||n>i)&&(n=i),t.length>0&&(0>n||0>e)||e>this.length)throw new RangeError("attempt to write outside buffer bounds");r||(r="utf8");for(var a=!1;;)switch(r){case"hex":return A(this,t,e,n);case"utf8":case"utf-8":return w(this,t,e,n);case"ascii":return x(this,t,e,n);case"binary":return k(this,t,e,n);case"base64":return M(this,t,e,n);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return T(this,t,e,n);default:if(a)throw new TypeError("Unknown encoding: "+r);r=(""+r).toLowerCase(),a=!0}},i.prototype.toJSON=function(){return{type:"Buffer",data:Array.prototype.slice.call(this._arr||this,0)}};var $=4096;i.prototype.slice=function(t,e){var n=this.length;t=~~t,e=void 0===e?n:~~e,0>t?(t+=n,0>t&&(t=0)):t>n&&(t=n),0>e?(e+=n,0>e&&(e=0)):e>n&&(e=n),t>e&&(e=t);var r;if(i.TYPED_ARRAY_SUPPORT)r=this.subarray(t,e),r.__proto__=i.prototype;else{var o=e-t;r=new i(o,void 0);for(var a=0;o>a;a++)r[a]=this[a+t]}return r.length&&(r.parent=this.parent||this),r},i.prototype.readUIntLE=function(t,e,n){t=0|t,e=0|e,n||Y(t,e,this.length);for(var r=this[t],o=1,i=0;++i<e&&(o*=256);)r+=this[t+i]*o;return r},i.prototype.readUIntBE=function(t,e,n){t=0|t,e=0|e,n||Y(t,e,this.length);for(var r=this[t+--e],o=1;e>0&&(o*=256);)r+=this[t+--e]*o;return r},i.prototype.readUInt8=function(t,e){return e||Y(t,1,this.length),this[t]},i.prototype.readUInt16LE=function(t,e){return e||Y(t,2,this.length),this[t]|this[t+1]<<8},i.prototype.readUInt16BE=function(t,e){return e||Y(t,2,this.length),this[t]<<8|this[t+1]},i.prototype.readUInt32LE=function(t,e){return e||Y(t,4,this.length),(this[t]|this[t+1]<<8|this[t+2]<<16)+16777216*this[t+3]},i.prototype.readUInt32BE=function(t,e){return e||Y(t,4,this.length),16777216*this[t]+(this[t+1]<<16|this[t+2]<<8|this[t+3])},i.prototype.readIntLE=function(t,e,n){t=0|t,e=0|e,n||Y(t,e,this.length);for(var r=this[t],o=1,i=0;++i<e&&(o*=256);)r+=this[t+i]*o;return o*=128,r>=o&&(r-=Math.pow(2,8*e)),r},i.prototype.readIntBE=function(t,e,n){t=0|t,e=0|e,n||Y(t,e,this.length);for(var r=e,o=1,i=this[t+--r];r>0&&(o*=256);)i+=this[t+--r]*o;return o*=128,i>=o&&(i-=Math.pow(2,8*e)),i},i.prototype.readInt8=function(t,e){return e||Y(t,1,this.length),128&this[t]?-1*(255-this[t]+1):this[t]},i.prototype.readInt16LE=function(t,e){e||Y(t,2,this.length);var n=this[t]|this[t+1]<<8;return 32768&n?4294901760|n:n},i.prototype.readInt16BE=function(t,e){e||Y(t,2,this.length);var n=this[t+1]|this[t]<<8;return 32768&n?4294901760|n:n},i.prototype.readInt32LE=function(t,e){return e||Y(t,4,this.length),this[t]|this[t+1]<<8|this[t+2]<<16|this[t+3]<<24},i.prototype.readInt32BE=function(t,e){return e||Y(t,4,this.length),this[t]<<24|this[t+1]<<16|this[t+2]<<8|this[t+3]},i.prototype.readFloatLE=function(t,e){return e||Y(t,4,this.length),H.read(this,t,!0,23,4)},i.prototype.readFloatBE=function(t,e){return e||Y(t,4,this.length),H.read(this,t,!1,23,4)},i.prototype.readDoubleLE=function(t,e){return e||Y(t,8,this.length),H.read(this,t,!0,52,8)},i.prototype.readDoubleBE=function(t,e){return e||Y(t,8,this.length),H.read(this,t,!1,52,8)},i.prototype.writeUIntLE=function(t,e,n,r){t=+t,e=0|e,n=0|n,r||S(this,t,e,n,Math.pow(2,8*n),0);var o=1,i=0;for(this[e]=255&t;++i<n&&(o*=256);)this[e+i]=t/o&255;return e+n},i.prototype.writeUIntBE=function(t,e,n,r){t=+t,e=0|e,n=0|n,r||S(this,t,e,n,Math.pow(2,8*n),0);var o=n-1,i=1;for(this[e+o]=255&t;--o>=0&&(i*=256);)this[e+o]=t/i&255;return e+n},i.prototype.writeUInt8=function(t,e,n){return t=+t,e=0|e,n||S(this,t,e,1,255,0),i.TYPED_ARRAY_SUPPORT||(t=Math.floor(t)),this[e]=255&t,e+1},i.prototype.writeUInt16LE=function(t,e,n){return t=+t,e=0|e,n||S(this,t,e,2,65535,0),i.TYPED_ARRAY_SUPPORT?(this[e]=255&t,this[e+1]=t>>>8):B(this,t,e,!0),e+2},i.prototype.writeUInt16BE=function(t,e,n){return t=+t,e=0|e,n||S(this,t,e,2,65535,0),i.TYPED_ARRAY_SUPPORT?(this[e]=t>>>8,this[e+1]=255&t):B(this,t,e,!1),e+2},i.prototype.writeUInt32LE=function(t,e,n){return t=+t,e=0|e,n||S(this,t,e,4,4294967295,0),i.TYPED_ARRAY_SUPPORT?(this[e+3]=t>>>24,this[e+2]=t>>>16,this[e+1]=t>>>8,this[e]=255&t):z(this,t,e,!0),e+4},i.prototype.writeUInt32BE=function(t,e,n){return t=+t,e=0|e,n||S(this,t,e,4,4294967295,0),i.TYPED_ARRAY_SUPPORT?(this[e]=t>>>24,this[e+1]=t>>>16,this[e+2]=t>>>8,this[e+3]=255&t):z(this,t,e,!1),e+4},i.prototype.writeIntLE=function(t,e,n,r){if(t=+t,e=0|e,!r){var o=Math.pow(2,8*n-1);S(this,t,e,n,o-1,-o)}var i=0,a=1,s=0>t?1:0;for(this[e]=255&t;++i<n&&(a*=256);)this[e+i]=(t/a>>0)-s&255;return e+n},i.prototype.writeIntBE=function(t,e,n,r){if(t=+t,e=0|e,!r){var o=Math.pow(2,8*n-1);S(this,t,e,n,o-1,-o)}var i=n-1,a=1,s=0>t?1:0;for(this[e+i]=255&t;--i>=0&&(a*=256);)this[e+i]=(t/a>>0)-s&255;return e+n},i.prototype.writeInt8=function(t,e,n){return t=+t,e=0|e,n||S(this,t,e,1,127,-128),i.TYPED_ARRAY_SUPPORT||(t=Math.floor(t)),0>t&&(t=255+t+1),this[e]=255&t,e+1},i.prototype.writeInt16LE=function(t,e,n){return t=+t,e=0|e,n||S(this,t,e,2,32767,-32768),i.TYPED_ARRAY_SUPPORT?(this[e]=255&t,this[e+1]=t>>>8):B(this,t,e,!0),e+2},i.prototype.writeInt16BE=function(t,e,n){return t=+t,e=0|e,n||S(this,t,e,2,32767,-32768),i.TYPED_ARRAY_SUPPORT?(this[e]=t>>>8,this[e+1]=255&t):B(this,t,e,!1),e+2},i.prototype.writeInt32LE=function(t,e,n){return t=+t,e=0|e,n||S(this,t,e,4,2147483647,-2147483648),i.TYPED_ARRAY_SUPPORT?(this[e]=255&t,this[e+1]=t>>>8,this[e+2]=t>>>16,this[e+3]=t>>>24):z(this,t,e,!0),e+4},i.prototype.writeInt32BE=function(t,e,n){return t=+t,e=0|e,n||S(this,t,e,4,2147483647,-2147483648),0>t&&(t=4294967295+t+1),i.TYPED_ARRAY_SUPPORT?(this[e]=t>>>24,this[e+1]=t>>>16,this[e+2]=t>>>8,this[e+3]=255&t):z(this,t,e,!1),e+4},i.prototype.writeFloatLE=function(t,e,n){return K(this,t,e,!0,n)},i.prototype.writeFloatBE=function(t,e,n){return K(this,t,e,!1,n)},i.prototype.writeDoubleLE=function(t,e,n){return L(this,t,e,!0,n)},i.prototype.writeDoubleBE=function(t,e,n){return L(this,t,e,!1,n)},i.prototype.copy=function(t,e,n,r){if(n||(n=0),r||0===r||(r=this.length),e>=t.length&&(e=t.length),e||(e=0),r>0&&n>r&&(r=n),r===n)return 0;if(0===t.length||0===this.length)return 0;if(0>e)throw new RangeError("targetStart out of bounds");if(0>n||n>=this.length)throw new RangeError("sourceStart out of bounds");if(0>r)throw new RangeError("sourceEnd out of bounds");r>this.length&&(r=this.length),t.length-e<r-n&&(r=t.length-e+n);var o,a=r-n;if(this===t&&e>n&&r>e)for(o=a-1;o>=0;o--)t[o+e]=this[o+n];else if(1e3>a||!i.TYPED_ARRAY_SUPPORT)for(o=0;a>o;o++)t[o+e]=this[o+n];else Uint8Array.prototype.set.call(t,this.subarray(n,n+a),e);return a},i.prototype.fill=function(t,e,n){if(t||(t=0),e||(e=0),n||(n=this.length),e>n)throw new RangeError("end < start");if(n!==e&&0!==this.length){if(0>e||e>=this.length)throw new RangeError("start out of bounds");if(0>n||n>this.length)throw new RangeError("end out of bounds");var r;if("number"==typeof t)for(r=e;n>r;r++)this[r]=t;else{var o=C(t.toString()),i=o.length;for(r=e;n>r;r++)this[r]=o[r%i]}return this}};var _=/[^+\/0-9A-Za-z-_]/g}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{"base64-js":2,ieee754:3,isarray:4}],2:[function(t,e,n){!function(t){"use strict";function e(t){var e=t.charCodeAt(0);return e===a||e===f?62:e===s||e===p?63:c>e?-1:c+10>e?e-c+26+26:l+26>e?e-l:u+26>e?e-u+26:void 0}function n(t){function n(t){u[f++]=t}var r,o,a,s,c,u;if(t.length%4>0)throw new Error("Invalid string. Length must be a multiple of 4");var l=t.length;c="="===t.charAt(l-2)?2:"="===t.charAt(l-1)?1:0,u=new i(3*t.length/4-c),a=c>0?t.length-4:t.length;var f=0;for(r=0,o=0;a>r;r+=4,o+=3)s=e(t.charAt(r))<<18|e(t.charAt(r+1))<<12|e(t.charAt(r+2))<<6|e(t.charAt(r+3)),n((16711680&s)>>16),n((65280&s)>>8),n(255&s);return 2===c?(s=e(t.charAt(r))<<2|e(t.charAt(r+1))>>4,n(255&s)):1===c&&(s=e(t.charAt(r))<<10|e(t.charAt(r+1))<<4|e(t.charAt(r+2))>>2,n(s>>8&255),n(255&s)),u}function r(t){function e(t){return o.charAt(t)}function n(t){return e(t>>18&63)+e(t>>12&63)+e(t>>6&63)+e(63&t)}var r,i,a,s=t.length%3,c="";for(r=0,a=t.length-s;a>r;r+=3)i=(t[r]<<16)+(t[r+1]<<8)+t[r+2],c+=n(i);switch(s){case 1:i=t[t.length-1],c+=e(i>>2),c+=e(i<<4&63),c+="==";break;case 2:i=(t[t.length-2]<<8)+t[t.length-1],c+=e(i>>10),c+=e(i>>4&63),c+=e(i<<2&63),c+="="}return c}var o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",i="undefined"!=typeof Uint8Array?Uint8Array:Array,a="+".charCodeAt(0),s="/".charCodeAt(0),c="0".charCodeAt(0),u="a".charCodeAt(0),l="A".charCodeAt(0),f="-".charCodeAt(0),p="_".charCodeAt(0);t.toByteArray=n,t.fromByteArray=r}("undefined"==typeof n?this.base64js={}:n)},{}],3:[function(t,e,n){n.read=function(t,e,n,r,o){var i,a,s=8*o-r-1,c=(1<<s)-1,u=c>>1,l=-7,f=n?o-1:0,p=n?-1:1,d=t[e+f];for(f+=p,i=d&(1<<-l)-1,d>>=-l,l+=s;l>0;i=256*i+t[e+f],f+=p,l-=8);for(a=i&(1<<-l)-1,i>>=-l,l+=r;l>0;a=256*a+t[e+f],f+=p,l-=8);if(0===i)i=1-u;else{if(i===c)return a?NaN:(d?-1:1)*(1/0);a+=Math.pow(2,r),i-=u}return(d?-1:1)*a*Math.pow(2,i-r)},n.write=function(t,e,n,r,o,i){var a,s,c,u=8*i-o-1,l=(1<<u)-1,f=l>>1,p=23===o?Math.pow(2,-24)-Math.pow(2,-77):0,d=r?0:i-1,h=r?1:-1,m=0>e||0===e&&0>1/e?1:0;for(e=Math.abs(e),isNaN(e)||e===1/0?(s=isNaN(e)?1:0,a=l):(a=Math.floor(Math.log(e)/Math.LN2),e*(c=Math.pow(2,-a))<1&&(a--,c*=2),e+=a+f>=1?p/c:p*Math.pow(2,1-f),e*c>=2&&(a++,c/=2),a+f>=l?(s=0,a=l):a+f>=1?(s=(e*c-1)*Math.pow(2,o),a+=f):(s=e*Math.pow(2,f-1)*Math.pow(2,o),a=0));o>=8;t[n+d]=255&s,d+=h,s/=256,o-=8);for(a=a<<o|s,u+=o;u>0;t[n+d]=255&a,d+=h,a/=256,u-=8);t[n+d-h]|=128*m}},{}],4:[function(t,e,n){var r={}.toString;e.exports=Array.isArray||function(t){return"[object Array]"==r.call(t)}},{}],5:[function(e,n,r){(function(e){/*!
 * @license deepcopy.js Copyright(c) 2013 sasa+1
 * https://github.com/sasaplus1/deepcopy.js
 * Released under the MIT license.
 */
 !function(e,o){"object"==typeof r&&"object"==typeof n?n.exports=o():"function"==typeof t&&t.amd?t([],o):"object"==typeof r?r.deepcopy=o():e.deepcopy=o()}(this,function(){return function(t){function e(r){if(n[r])return n[r].exports;var o=n[r]={exports:{},id:r,loaded:!1};return t[r].call(o.exports,o,o.exports,e),o.loaded=!0,o.exports}var n={};return e.m=t,e.c=n,e.p="",e(0)}([function(t,e,n){"use strict";t.exports=n(3)},function(t,n){"use strict";function r(t,e){if("[object Array]"!==o.call(t))throw new TypeError("array must be an Array");var n=void 0,r=void 0,i=void 0;for(n=0,r=t.length;r>n;++n)if(i=t[n],i===e||i!==i&&e!==e)return n;return-1}n.__esModule=!0;var o=Object.prototype.toString,i="undefined"!=typeof e?function(t){return e.isBuffer(t)}:function(){return!1},a=Object.keys?function(t){return Object.keys(t)}:function(t){var e=typeof t;if(null===t||"function"!==e||"object"!==e)throw new TypeError("obj must be an Object");var n=[],r=void 0;for(r in t)t.hasOwnProperty(r)&&n.push(r);return n},s="function"==typeof Symbol?function(t){return Object.getOwnPropertySymbols(t)}:function(){return[]};n["default"]={getKeys:a,getSymbols:s,indexOf:r,isBuffer:i},t.exports=n["default"]},function(t,n,r){"use strict";function o(t,e){var n=a(t);return null!==n?a(t):i(t,e)}function i(t,n){if("function"!=typeof n)throw new TypeError("customizer is must be a Function");if("function"==typeof t){var r=String(t);return/^\s*function\s*\S*\([^\)]*\)\s*{\s*\[native code\]\s*}/.test(r)?t:new Function("return "+r)()}var o=c.call(t);if("[object Array]"===o)return[];if("[object Object]"===o&&t.constructor===Object)return{};if("[object Date]"===o)return new Date(+t);if("[object RegExp]"===o){var i=String(t),a=i.lastIndexOf("/");return new RegExp(i.slice(1,a),i.slice(a+1))}if(s.isBuffer(t)){var u=new e(t.length);return t.copy(u),u}var l=n(t);return void 0!==l?l:null}function a(t){var e=typeof t;return null!==t&&"object"!==e&&"function"!==e?t:null}n.__esModule=!0;var s=r(1),c=Object.prototype.toString;n["default"]={copy:o,copyCollection:i,copyValue:a},t.exports=n["default"]},function(t,e,n){"use strict";function r(t){}function o(t){var e=arguments.length<=1||void 0===arguments[1]?r:arguments[1];if(null===t)return null;var n=a.copyValue(t);if(null!==n)return n;var o=a.copyCollection(t,e),s=null!==o?o:t,c=[t],u=[s];return i(t,e,s,c,u)}function i(t,e,n,r,o){if(null===t)return null;var c=a.copyValue(t);if(null!==c)return c;var u=s.getKeys(t).concat(s.getSymbols(t)),l=void 0,f=void 0,p=void 0,d=void 0,h=void 0,m=void 0,g=void 0,b=void 0;for(l=0,f=u.length;f>l;++l)p=u[l],d=t[p],h=s.indexOf(r,d),-1===h?(m=a.copy(d,e),g=null!==m?m:d,null!==d&&/^(?:function|object)$/.test(typeof d)&&(r.push(d),o.push(g))):b=o[h],n[p]=b||i(d,e,g,r,o);return n}e.__esModule=!0;var a=n(2),s=n(1);e["default"]=o,t.exports=e["default"]}])})}).call(this,e("buffer").Buffer)},{buffer:1}],6:[function(t,e,n){function r(t){return/^[a-z_$][0-9a-z_$]*$/gi.test(t)&&!i.test(t)}function o(t){if(a)return t.toString();var e=t.source.replace(/\//g,function(t,e,n){return 0===e||"\\"!==n[e-1]?"\\/":"/"}),n=(t.global&&"g"||"")+(t.ignoreCase&&"i"||"")+(t.multiline&&"m"||"");return"/"+e+"/"+n}/* toSource by Marcello Bastea-Forte - zlib license */
e.exports=function(t,e,n,i){function a(t,e,n,i,s){function c(t){return n.slice(1)+t.join(","+(n&&"\n")+u)+(n?" ":"")}var u=i+n;switch(t=e?e(t):t,typeof t){case"string":return JSON.stringify(t);case"boolean":case"number":case"undefined":return""+t;case"function":return t.toString()}if(null===t)return"null";if(t instanceof RegExp)return o(t);if(t instanceof Date)return"new Date("+t.getTime()+")";var l=s.indexOf(t)+1;if(l>0)return"{$circularReference:"+l+"}";if(s.push(t),Array.isArray(t))return"["+c(t.map(function(t){return a(t,e,n,u,s.slice())}))+"]";var f=Object.keys(t);return f.length?"{"+c(f.map(function(o){return(r(o)?o:JSON.stringify(o))+":"+a(t[o],e,n,u,s.slice())}))+"}":"{}"}var s=[];return a(t,e,void 0===n?"  ":n||"",i||"",s)};var i=/^(abstract|boolean|break|byte|case|catch|char|class|const|continue|debugger|default|delete|do|double|else|enum|export|extends|false|final|finally|float|for|function|goto|if|implements|import|in|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|super|switch|synchronized|this|throw|throws|transient|true|try|typeof|undefined|var|void|volatile|while|with)$/,a="\\/"===new RegExp("/").source},{}],7:[function(t,e,n){"use strict";e.exports={name:"button",template:t("../../templates/components/button.tpl"),style:t("../../styles/clay/components/button.scss"),manipulator:"button",defaults:{primary:!1,attributes:{},description:""}}},{"../../styles/clay/components/button.scss":20,"../../templates/components/button.tpl":29}],8:[function(t,e,n){"use strict";e.exports={name:"checkboxgroup",template:t("../../templates/components/checkboxgroup.tpl"),style:t("../../styles/clay/components/checkboxgroup.scss"),manipulator:"checkboxgroup",defaults:{label:"",options:[],description:"",attributes:{}}}},{"../../styles/clay/components/checkboxgroup.scss":21,"../../templates/components/checkboxgroup.tpl":30}],9:[function(t,e,n){"use strict";e.exports={name:"color",template:t("../../templates/components/color.tpl"),style:t("../../styles/clay/components/color.scss"),manipulator:"color",defaults:{label:"",description:""},initialize:function(t,e){function n(t){if("number"==typeof t)t=t.toString(16);else if(!t)return"transparent";return t=r(t),"#"+(f?p[t]:t)}function r(t){for(t=t.toLowerCase();t.length<6;)t="0"+t;return t}function o(t){switch(typeof t){case"number":return r(t.toString(16));case"string":return t.replace(/^#|^0x/,"");default:return t}}function i(t){return t.reduce(function(t,e){return t.concat(e)},[])}function a(t){t=t.replace(/^#|^0x/,"");var e=parseInt(t.slice(0,2),16)/255,n=parseInt(t.slice(2,4),16)/255,r=parseInt(t.slice(4),16)/255;e=e>.04045?Math.pow((e+.055)/1.055,2.4):e/12.92,n=n>.04045?Math.pow((n+.055)/1.055,2.4):n/12.92,r=r>.04045?Math.pow((r+.055)/1.055,2.4):r/12.92;var o=(.4124*e+.3576*n+.1805*r)/.95047,i=(.2126*e+.7152*n+.0722*r)/1,a=(.0193*e+.1192*n+.9505*r)/1.08883;return o=o>.008856?Math.pow(o,1/3):7.787*o+16/116,i=i>.008856?Math.pow(i,1/3):7.787*i+16/116,a=a>.008856?Math.pow(a,1/3):7.787*a+16/116,[116*i-16,500*(o-i),200*(i-a)]}function s(t,e){var n=t[0]-e[0],r=t[1]-e[1],o=t[2]-e[2];return Math.sqrt(Math.pow(n,2)+Math.pow(r,2)+Math.pow(o,2))}function c(){return!e.meta.activeWatchInfo||2===e.meta.activeWatchInfo.firmware.major||"aplite"===e.meta.activeWatchInfo.platform&&!l.config.allowGray?d.BLACK_WHITE:"aplite"===e.meta.activeWatchInfo.platform&&l.config.allowGray?d.GRAY:d.COLOR}var u=t.HTML,l=this;l.roundColorToLayout=function(t){var e=o(t);if(-1===m.indexOf(e)){var n=a(e),r=m.map(function(t){var e=a(o(t));return s(n,e)}),i=Math.min.apply(Math,r),c=r.indexOf(i);e=m[c]}return parseInt(e,16)};var f=l.config.sunlight!==!1,p={"000000":"000000","000055":"001e41","0000aa":"004387","0000ff":"0068ca","005500":"2b4a2c","005555":"27514f","0055aa":"16638d","0055ff":"007dce","00aa00":"5e9860","00aa55":"5c9b72","00aaaa":"57a5a2","00aaff":"4cb4db","00ff00":"8ee391","00ff55":"8ee69e","00ffaa":"8aebc0","00ffff":"84f5f1",550000:"4a161b",550055:"482748","5500aa":"40488a","5500ff":"2f6bcc",555500:"564e36",555555:"545454","5555aa":"4f6790","5555ff":"4180d0","55aa00":"759a64","55aa55":"759d76","55aaaa":"71a6a4","55aaff":"69b5dd","55ff00":"9ee594","55ff55":"9de7a0","55ffaa":"9becc2","55ffff":"95f6f2",aa0000:"99353f",aa0055:"983e5a",aa00aa:"955694",aa00ff:"8f74d2",aa5500:"9d5b4d",aa5555:"9d6064",aa55aa:"9a7099",aa55ff:"9587d5",aaaa00:"afa072",aaaa55:"aea382",aaaaaa:"ababab",ffffff:"ffffff",aaaaff:"a7bae2",aaff00:"c9e89d",aaff55:"c9eaa7",aaffaa:"c7f0c8",aaffff:"c3f9f7",ff0000:"e35462",ff0055:"e25874",ff00aa:"e16aa3",ff00ff:"de83dc",ff5500:"e66e6b",ff5555:"e6727c",ff55aa:"e37fa7",ff55ff:"e194df",ffaa00:"f1aa86",ffaa55:"f1ad93",ffaaaa:"efb5b8",ffaaff:"ecc3eb",ffff00:"ffeeab",ffff55:"fff1b5",ffffaa:"fff6d3"},d={COLOR:[[!1,!1,"55ff00","aaff55",!1,"ffff55","ffffaa",!1,!1],[!1,"aaffaa","55ff55","00ff00","aaff00","ffff00","ffaa55","ffaaaa",!1],["55ffaa","00ff55","00aa00","55aa00","aaaa55","aaaa00","ffaa00","ff5500","ff5555"],["aaffff","00ffaa","00aa55","55aa55","005500","555500","aa5500","ff0000","ff0055"],[!1,"55aaaa","00aaaa","005555","ffffff","000000","aa5555","aa0000",!1],["55ffff","00ffff","00aaff","0055aa","aaaaaa","555555","550000","aa0055","ff55aa"],["55aaff","0055ff","0000ff","0000aa","000055","550055","aa00aa","ff00aa","ffaaff"],[!1,"5555aa","5555ff","5500ff","5500aa","aa00ff","ff00ff","ff55ff",!1],[!1,!1,!1,"aaaaff","aa55ff","aa55aa",!1,!1,!1]],GRAY:[["000000","aaaaaa","ffffff"]],BLACK_WHITE:[["000000","ffffff"]]},h=l.config.layout||c();"string"==typeof h&&(h=d[h]),Array.isArray(h[0])||(h=[h]);var m=i(h).map(function(t){return o(t)}).filter(function(t){return t}),g="",b=h.length,y=0;h.forEach(function(t){y=t.length>y?t.length:y});for(var v=100/y,A=100/b,w=l.$element,x=0;b>x;x++)for(var k=0;y>k;k++){var M=o(h[x][k]),T=M?" selectable":"",R=0===x&&0===k||0===x&&!h[x][k-1]||!h[x][k-1]&&!h[x-1][k]?" rounded-tl":"",P=0===x&&!h[x][k+1]||!h[x][k+1]&&!h[x-1][k]?" rounded-tr ":"",O=x===h.length-1&&0===k||x===h.length-1&&!h[x][k-1]||!h[x][k-1]&&!h[x+1][k]?" rounded-bl":"",D=x===h.length-1&&!h[x][k+1]||!h[x][k+1]&&!h[x+1][k]?" rounded-br":"";g+='<i class="color-box '+T+R+P+O+D+'" '+(M?'data-value="'+parseInt(M,16)+'" ':"")+'style="width:'+v+"%; height:"+A+"%; background:"+n(M)+';"></i>'}var N=0;3===y&&(N=5),2===y&&(N=8);var j=N*v/A+"%",E=N+"%";w.select(".color-box-container").add(u(g)).set("$paddingTop",j).set("$paddingRight",E).set("$paddingBottom",j).set("$paddingLeft",E),w.select(".color-box-wrap").set("$paddingBottom",v/A*100+"%");var Y=w.select(".value"),S=w.select(".picker-wrap"),B=l.$manipulatorTarget.get("disabled");w.select("label").on("click",function(){B||S.set("show")}),l.on("change",function(){var t=l.get();Y.set("$background-color",n(t)),w.select(".color-box").set("-selected"),w.select('.color-box[data-value="'+t+'"]').set("+selected")}),w.select(".color-box.selectable").on("click",function(t){l.set(parseInt(t.target.dataset.value,10)),S.set("-show")}),S.on("click",function(){S.set("-show")}),l.on("disabled",function(){B=!0}),l.on("enabled",function(){B=!1}),l._layout=h}}},{"../../styles/clay/components/color.scss":22,"../../templates/components/color.tpl":31}],10:[function(t,e,n){"use strict";e.exports={name:"footer",template:t("../../templates/components/footer.tpl"),manipulator:"html"}},{"../../templates/components/footer.tpl":32}],11:[function(t,e,n){"use strict";e.exports={name:"heading",template:t("../../templates/components/heading.tpl"),manipulator:"html",defaults:{size:4}}},{"../../templates/components/heading.tpl":33}],12:[function(t,e,n){"use strict";e.exports={color:t("./color"),footer:t("./footer"),heading:t("./heading"),input:t("./input"),select:t("./select"),submit:t("./submit"),text:t("./text"),toggle:t("./toggle"),radiogroup:t("./radiogroup"),checkboxgroup:t("./checkboxgroup"),button:t("./button"),slider:t("./slider")}},{"./button":7,"./checkboxgroup":8,"./color":9,"./footer":10,"./heading":11,"./input":13,"./radiogroup":14,"./select":15,"./slider":16,"./submit":17,"./text":18,"./toggle":19}],13:[function(t,e,n){"use strict";e.exports={name:"input",template:t("../../templates/components/input.tpl"),style:t("../../styles/clay/components/input.scss"),manipulator:"val",defaults:{label:"",description:"",attributes:{}}}},{"../../styles/clay/components/input.scss":23,"../../templates/components/input.tpl":34}],14:[function(t,e,n){"use strict";e.exports={name:"radiogroup",template:t("../../templates/components/radiogroup.tpl"),style:t("../../styles/clay/components/radiogroup.scss"),manipulator:"radiogroup",defaults:{label:"",options:[],description:"",attributes:{}}}},{"../../styles/clay/components/radiogroup.scss":24,"../../templates/components/radiogroup.tpl":35}],15:[function(t,e,n){"use strict";e.exports={name:"select",template:t("../../templates/components/select.tpl"),style:t("../../styles/clay/components/select.scss"),manipulator:"val",defaults:{label:"",options:[],description:"",attributes:{}},initialize:function(){function t(){var t=e.$manipulatorTarget.get("selectedIndex"),r=e.$manipulatorTarget.select("option"),o=r[t]&&r[t].innerHTML;n.set("innerHTML",o)}var e=this,n=e.$element.select(".value");t(),e.on("change",t)}}},{"../../styles/clay/components/select.scss":25,"../../templates/components/select.tpl":36}],16:[function(t,e,n){"use strict";e.exports={name:"slider",template:t("../../templates/components/slider.tpl"),style:t("../../styles/clay/components/slider.scss"),manipulator:"slider",defaults:{label:"",description:"",min:0,max:100,step:1,attributes:{}},initialize:function(){function t(){var t=e.get();n.set("value",t),r.set("innerHTML",t)}var e=this,n=e.$element.select(".value"),r=e.$element.select(".value-pad"),o=e.$manipulatorTarget,i=o.get("step");i=i.toString(10).split(".")[1],e.precision=i?i.length:0,e.on("change",t),o.on("|input",t),t(),n.on("|input",function(){r.set("innerHTML",this.get("value"))}),n.on("|change",function(){e.set(this.get("value")),t()})}}},{"../../styles/clay/components/slider.scss":26,"../../templates/components/slider.tpl":37}],17:[function(t,e,n){"use strict";e.exports={name:"submit",template:t("../../templates/components/submit.tpl"),style:t("../../styles/clay/components/submit.scss"),manipulator:"button",defaults:{attributes:{}}}},{"../../styles/clay/components/submit.scss":27,"../../templates/components/submit.tpl":38}],18:[function(t,e,n){"use strict";e.exports={name:"text",template:t("../../templates/components/text.tpl"),manipulator:"html"}},{"../../templates/components/text.tpl":39}],19:[function(t,e,n){"use strict";e.exports={name:"toggle",template:t("../../templates/components/toggle.tpl"),style:t("../../styles/clay/components/toggle.scss"),manipulator:"checked",defaults:{label:"",description:"",attributes:{}}}},{"../../styles/clay/components/toggle.scss":28,"../../templates/components/toggle.tpl":40}],20:[function(t,e,n){e.exports=".component-button { text-align: center; }\n\n.section .component-button { padding-bottom: 0; }\n\n.component-button .description { padding-left: 0; padding-right: 0; }\n"},{}],21:[function(t,e,n){e.exports=".component-checkbox { display: block; }\n\n.section .component-checkbox { padding-right: 0.375rem; }\n\n.component-checkbox > .label { display: block; padding-bottom: 0.35rem; }\n\n.component-checkbox .checkbox-group { padding-bottom: 0.35rem; }\n\n.component-checkbox .checkbox-group label { padding: 0.35rem 0.375rem; }\n\n.component-checkbox .checkbox-group .label { font-size: 0.9em; }\n\n.component-checkbox .checkbox-group input { opacity: 0; position: absolute; }\n\n.component-checkbox .checkbox-group i { display: block; position: relative; border-radius: 0.25rem; width: 1.4rem; height: 1.4rem; border: 0.11765rem solid #767676; -webkit-flex-shrink: 0; flex-shrink: 0; }\n\n.component-checkbox .checkbox-group input:checked + i { border-color: #ff4700; background: #ff4700; }\n\n.component-checkbox .checkbox-group input:checked + i:after { content: ''; box-sizing: border-box; -webkit-transform: rotate(45deg); transform: rotate(45deg); position: absolute; left: 0.35rem; top: -0.05rem; display: block; width: 0.5rem; height: 1rem; border: 0 solid #ffffff; border-right-width: 0.11765rem; border-bottom-width: 0.11765rem; }\n\n.component-checkbox .description { padding-left: 0; padding-right: 0; }\n"},{}],22:[function(t,e,n){e.exports=".section .component-color { padding: 0; }\n\n.component-color .value { width: 2.2652rem; height: 1.4rem; border-radius: 0.7rem; box-shadow: 0 0.1rem 0.1rem #2f2f2f; display: block; background: #000; }\n\n.component-color .picker-wrap { left: 0; top: 0; right: 0; bottom: 0; position: fixed; padding: 0.7rem 0.375rem; background: rgba(0, 0, 0, 0.65); opacity: 0; -webkit-transition: opacity 100ms ease-in 175ms; transition: opacity 100ms ease-in 175ms; pointer-events: none; z-index: 100; display: -webkit-box; display: -webkit-flex; display: flex; -webkit-box-orient: vertical; -webkit-box-direction: normal; -webkit-flex-direction: column; flex-direction: column; -webkit-box-pack: center; -webkit-justify-content: center; justify-content: center; -webkit-box-align: center; -webkit-align-items: center; align-items: center; }\n\n.component-color .picker-wrap .picker { padding: 0.7rem 0.75rem; background: #484848; box-shadow: 0 0.17647rem 0.88235rem rgba(0, 0, 0, 0.4); border-radius: 0.25rem; width: 100%; max-width: 26rem; overflow: auto; }\n\n.component-color .picker-wrap.show { -webkit-transition-delay: 0ms; transition-delay: 0ms; pointer-events: auto; opacity: 1; }\n\n.component-color .color-box-wrap { box-sizing: border-box; position: relative; height: 0; width: 100%; padding: 0 0 100% 0; }\n\n.component-color .color-box-wrap .color-box-container { position: absolute; height: 99.97%; width: 100%; left: 0; top: 0; }\n\n.component-color .color-box-wrap .color-box-container .color-box { float: left; cursor: pointer; -webkit-tap-highlight-color: transparent; }\n\n.component-color .color-box-wrap .color-box-container .color-box.rounded-tl { border-top-left-radius: 0.25rem; }\n\n.component-color .color-box-wrap .color-box-container .color-box.rounded-tr { border-top-right-radius: 0.25rem; }\n\n.component-color .color-box-wrap .color-box-container .color-box.rounded-bl { border-bottom-left-radius: 0.25rem; }\n\n.component-color .color-box-wrap .color-box-container .color-box.rounded-br { border-bottom-right-radius: 0.25rem; }\n\n.component-color .color-box-wrap .color-box-container .color-box.selected { -webkit-transform: scale(1.1); transform: scale(1.1); border-radius: 0.25rem; box-shadow: #111 0 0 0.24rem; position: relative; z-index: 100; }\n"},{}],23:[function(t,e,n){e.exports=".section .component-input { padding: 0; }\n\n.component-input label { display: block; }\n\n.component-input .label { padding-bottom: 0.7rem; }\n\n.component-input .input { position: relative; min-width: 100%; margin-top: 0.7rem; margin-left: 0; }\n\n.component-input input { display: block; width: 100%; background: #333333; border-radius: 0.25rem; padding: 0.35rem 0.375rem; border: none; vertical-align: baseline; color: #ffffff; font-size: inherit; }\n\n.component-input input::-webkit-input-placeholder { color: #858585; }\n\n.component-input input::-moz-placeholder { color: #858585; }\n\n.component-input input:-moz-placeholder { color: #858585; }\n\n.component-input input:-ms-input-placeholder { color: #858585; }\n\n.component-input input:focus { border: none; box-shadow: none; }\n\n.component-input input:focus::-webkit-input-placeholder { color: #666666; }\n\n.component-input input:focus::-moz-placeholder { color: #666666; }\n\n.component-input input:focus:-moz-placeholder { color: #666666; }\n\n.component-input input:focus:-ms-input-placeholder { color: #666666; }\n"},{}],24:[function(t,e,n){e.exports=".component-radio { display: block; }\n\n.section .component-radio { padding-right: 0.375rem; }\n\n.component-radio > .label { display: block; padding-bottom: 0.35rem; }\n\n.component-radio .radio-group { padding-bottom: 0.35rem; }\n\n.component-radio .radio-group label { padding: 0.35rem 0.375rem; }\n\n.component-radio .radio-group .label { font-size: 0.9em; }\n\n.component-radio .radio-group input { opacity: 0; position: absolute; }\n\n.component-radio .radio-group i { display: block; position: relative; border-radius: 1.4rem; width: 1.4rem; height: 1.4rem; border: 2px solid #767676; -webkit-flex-shrink: 0; flex-shrink: 0; }\n\n.component-radio .radio-group input:checked + i { border-color: #ff4700; }\n\n.component-radio .radio-group input:checked + i:after { content: ''; display: block; position: absolute; left: 15%; right: 15%; top: 15%; bottom: 15%; border-radius: 1.4rem; background: #ff4700; }\n\n.component-radio .description { padding-left: 0; padding-right: 0; }\n"},{}],25:[function(t,e,n){e.exports='.section .component-select { padding: 0; }\n\n.component-select label { position: relative; }\n\n.component-select .value { position: relative; padding-right: 1.1rem; display: block; }\n\n.component-select .value:after { content: ""; position: absolute; right: 0; top: 50%; margin-top: -0.1rem; height: 0; width: 0; border-left: 0.425rem solid transparent; border-right: 0.425rem solid transparent; border-top: 0.425rem solid #ff4700; }\n\n.component-select select { opacity: 0; position: absolute; display: block; left: 0; right: 0; top: 0; bottom: 0; background: #000; width: 100%; border: none; margin: 0; padding: 0; }\n'},{}],26:[function(t,e,n){e.exports=".section .component-slider { padding: 0; }\n\n.component-slider label { display: block; }\n\n.component-slider .label-container { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-box-align: center; -webkit-align-items: center; align-items: center; width: 100%; padding-bottom: 0.7rem; }\n\n.component-slider .label { -webkit-box-flex: 1; -webkit-flex: 1; flex: 1; min-width: 1rem; display: block; padding-right: 0.75rem; }\n\n.component-slider .value-wrap { display: block; position: relative; }\n\n.component-slider .value, .component-slider .value-pad { display: block; background: #333333; border-radius: 0.25rem; padding: 0.35rem 0.375rem; border: none; vertical-align: baseline; color: #ffffff; text-align: right; margin: 0; min-width: 1rem; }\n\n.component-slider .value-pad { visibility: hidden; }\n\n.component-slider .value-pad:before { content: ' '; display: inline-block; }\n\n.component-slider .value { max-width: 100%; position: absolute; left: 0; top: 0; }\n\n.component-slider .input-wrap { padding: 0 0.75rem 0.7rem; }\n\n.component-slider .input { display: block; position: relative; min-width: 100%; height: 1.4rem; overflow: hidden; margin-left: 0; }\n\n.component-slider .input:before { content: ''; display: block; position: absolute; height: 0.17647rem; background: #666666; width: 100%; top: 0.61176rem; }\n\n.component-slider .input .slider { display: block; width: 100%; -webkit-appearance: none; appearance: none; position: relative; height: 1.4rem; margin: 0; background-color: transparent; }\n\n.component-slider .input .slider:focus { outline: none; }\n\n.component-slider .input .slider::-webkit-slider-runnable-track { border: none; height: 1.4rem; width: 100%; background-color: transparent; }\n\n.component-slider .input .slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; position: relative; height: 1.4rem; width: 1.4rem; background-color: #ff4700; border-radius: 50%; }\n\n.component-slider .input .slider::-webkit-slider-thumb:before { content: \"\"; position: absolute; left: -1000px; top: 0.61176rem; height: 0.17647rem; width: 1001px; background: #ff4700; }\n"},{}],27:[function(t,e,n){e.exports=".component-submit { text-align: center; }\n"},{}],28:[function(t,e,n){e.exports=".section .component-toggle { padding: 0; }\n\n.component-toggle input { display: none; }\n\n.component-toggle .graphic { display: inline-block; position: relative; }\n\n.component-toggle .graphic .slide { display: block; border-radius: 1.05rem; height: 1.05rem; width: 2.2652rem; background: #2f2f2f; -webkit-transition: background-color 150ms linear; transition: background-color 150ms linear; }\n\n.component-toggle .graphic .marker { background: #ececec; width: 1.4rem; height: 1.4rem; border-radius: 1.4rem; position: absolute; left: 0; display: block; top: -0.175rem; -webkit-transition: -webkit-transform 150ms linear; transition: -webkit-transform 150ms linear; transition: transform 150ms linear; transition: transform 150ms linear, -webkit-transform 150ms linear; box-shadow: 0 0.1rem 0.1rem #2f2f2f; }\n\n.component-toggle input:checked + .graphic .slide { background: #993d19; }\n\n.component-toggle input:checked + .graphic .marker { background: #ff4700; -webkit-transform: translateX(0.8652rem); transform: translateX(0.8652rem); }\n"},{}],29:[function(t,e,n){e.exports='<div class="component component-button">\n  <button\n    type="button"\n    data-manipulator-target\n    class="{{primary ? \'primary\' : \'\'}}"\n    {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n  ></button>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],30:[function(t,e,n){e.exports='<div class="component component-checkbox">\n  <span class="label">{{{label}}}</span>\n  <div class="checkbox-group">\n    {{each options}}\n      <label class="tap-highlight">\n        <span class="label">{{{this.label}}}</span>\n        <input\n          type="checkbox"\n          value="{{this.value}}"\n          name="clay-{{clayId}}"\n          {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n        />\n        <i></i>\n      </label>\n    {{/each}}\n  </div>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],31:[function(t,e,n){e.exports='<div class="component component-color">\n  <label class="tap-highlight">\n    <input\n      data-manipulator-target\n      type="hidden"\n    />\n    <span class="label">{{{label}}}</span>\n    <span class="value"></span>\n  </label>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n  <div class="picker-wrap">\n    <div class="picker">\n      <div class="color-box-wrap">\n        <div class="color-box-container"></div>\n      </div>\n    </div>\n  </div>\n</div>\n'},{}],32:[function(t,e,n){e.exports='<footer data-manipulator-target class="component component-footer"></footer>\n'},{}],33:[function(t,e,n){e.exports='<div class="component component-heading">\n  <h{{size}} data-manipulator-target></h{{size}}>\n</div>\n'},{}],34:[function(t,e,n){e.exports='<div class="component component-input">\n  <label class="tap-highlight">\n    <span class="label">{{{label}}}</span>\n    <span class="input">\n      <input\n      data-manipulator-target\n        {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n    />\n    </span>\n  </label>\n\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],35:[function(t,e,n){e.exports='<div class="component component-radio">\n  <span class="label">{{{label}}}</span>\n  <div class="radio-group">\n    {{each options}}\n      <label class="tap-highlight">\n        <span class="label">{{{this.label}}}</span>\n        <input\n          type="radio"\n          value="{{this.value}}"\n          name="clay-{{clayId}}"\n          {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n        />\n        <i></i>\n      </label>\n    {{/each}}\n  </div>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],36:[function(t,e,n){e.exports='<div class="component component-select">\n  <label class="tap-highlight">\n    <span class="label">{{{label}}}</span>\n    <span class="value"></span>\n    <select data-manipulator-target {{each key: attributes}}{{key}}="{{this}}"{{/each}}>\n      {{each options}}\n        <option value="{{this.value}}" class="item-select-option">{{this.label}}</option>\n      {{/each}}\n    </select>\n  </label>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],37:[function(t,e,n){e.exports='<div class="component component-slider">\n  <label class="tap-highlight">\n    <span class="label-container">\n      <span class="label">{{{label}}}</span>\n      <span class="value-wrap">\n        <span class="value-pad"></span>\n        <input type="text" class="value" />\n      </span>\n    </span>\n    <span class="input">\n      <input\n        data-manipulator-target\n        class="slider"\n        type="range"\n        min="{{min}}"\n        max="{{max}}"\n        step="{{step}}"\n        {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n      />\n    </span>\n</label>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],38:[function(t,e,n){e.exports='<div class="component component-submit">\n  <button\n    data-manipulator-target\n    type="submit"\n    {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n  ></button>\n</div>\n'},{}],39:[function(t,e,n){e.exports='<div class="component component-text">\n  <p data-manipulator-target></p>\n</div>\n'},{}],40:[function(t,e,n){e.exports='<div class="component component-toggle">\n  <label class="tap-highlight">\n    <span class="label">{{{label}}}</span>\n    <span class="input">\n      <input\n        data-manipulator-target\n        type="checkbox"\n        {{each key: attributes}}{{key}}="{{this}}"{{/each}}\n      />\n      <span class="graphic">\n        <span class="slide"></span>\n        <span class="marker"></span>\n      </span>\n    </span>\n  </label>\n  {{if description}}\n    <div class="description">{{{description}}}</div>\n  {{/if}}\n</div>\n'},{}],41:[function(t,e,n){e.exports='<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>@font-face{font-family:PFDinDisplayProRegularWebfont;src:url(data:application/font-woff;charset=utf-8;base64,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) format("woff");font-weight:400;font-style:normal}a,abbr,acronym,address,applet,article,aside,audio,b,big,blockquote,body,canvas,caption,center,cite,code,dd,del,details,dfn,div,dl,dt,em,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hgroup,html,i,iframe,img,ins,kbd,label,legend,li,mark,menu,nav,object,ol,p,pre,q,s,samp,section,small,span,strike,strong,sub,summary,sup,table,tbody,td,tfoot,th,thead,time,tr,tt,u,ul,var,video{margin:0;padding:0;border:0;outline:0;font-size:100%;font:inherit;vertical-align:baseline}button,input,textarea{outline:0}article,aside,details,figcaption,figure,footer,header,hgroup,menu,nav,section{display:block}body{line-height:1}ol,ul{list-style:none}blockquote:after,blockquote:before,q:after,q:before{content:\'\';content:none}html{box-sizing:border-box}*,:after,:before{box-sizing:inherit}body,html{font-weight:400;font-family:PFDinDisplayPro-Regular,PFDinDisplayProRegularWebfont,sans-serif;-webkit-font-smoothing:antialiased;font-size:17px;line-height:1.4;height:100%;color:#fff}body.platform-ios,html.platform-ios{font-size:16px}body{background-color:#333;padding:0 .75rem .7rem}em{font-style:italic}strong{font-weight:400;font-family:PFDinDisplayPro-Medium,PFDinDisplayProRegularWebfont,sans-serif;color:#ff4700}.platform-android strong{font-family:PFDinDisplayProRegularWebfont,sans-serif;font-weight:700;letter-spacing:.025em}a{color:#858585}a:hover{color:inherit}h1,h2,h3,h4{text-transform:uppercase;font-weight:400;font-family:PFDinDisplayPro-Medium,PFDinDisplayProRegularWebfont,sans-serif;text-transform:uppercase;position:relative;top:.05rem;line-height:.9}.platform-android h1,.platform-android h2,.platform-android h3,.platform-android h4{font-family:PFDinDisplayProRegularWebfont,sans-serif;font-weight:700;letter-spacing:.025em}h1{font-size:2rem;line-height:2.8rem}h2{font-size:1.8rem;line-height:2.8rem}h3{font-size:1.5rem;line-height:2.8rem}h4{font-size:1.2rem;line-height:1.4rem}h5{font-size:1rem;line-height:1.4rem}h6{font-size:.8rem;line-height:1.4rem}input{font-family:inherit;font-size:inherit;line-height:inherit}label{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;align-items:center;padding:.7rem .75rem}label .input{white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;max-width:50%;margin-left:.75rem}label.invalid .input:after{content:"!";display:inline-block;color:#fff;background:#ff4700;border-radius:.55rem;width:1.1rem;text-align:center;height:1.1rem;font-size:.825rem;vertical-align:middle;line-height:1.1rem;box-shadow:0 .1rem .1rem #2f2f2f;font-weight:400;font-family:PFDinDisplayPro-Medium,PFDinDisplayProRegularWebfont,sans-serif;-webkit-box-flex:0;-webkit-flex:0 0 1.1rem;flex:0 0 1.1rem;margin-left:.3rem}.platform-android label.invalid .input:after{font-family:PFDinDisplayProRegularWebfont,sans-serif;font-weight:700;letter-spacing:.025em}.hide{display:none!important}.tap-highlight{-webkit-tap-highlight-color:rgba(255,255,255,.1);border-radius:.25rem}.tap-highlight:active{background-color:rgba(255,255,255,.1)}.component{padding-top:.7rem}.component.disabled{pointer-events:none}.component.disabled>*{opacity:.25}.section{background:#484848;border-radius:.25rem;box-shadow:#2f2f2f 0 .15rem .25rem}.section>.component{padding-bottom:.7rem;padding-right:.75rem;padding-left:.75rem;position:relative;margin-top:1rem}.section>.component:not(.hide)~.component{margin-top:0}.section>.component:first-child:after{display:none}.section>.component:after{content:"";background:#666;display:block;position:absolute;top:0;left:.375rem;right:.375rem;height:1px;pointer-events:none}.section>.component:not(.hide):after{display:none}.section>.component:not(.hide)~.component:not(.hide):after{display:block}.section>.component-heading:first-child{background:#414141;border-radius:.25rem .25rem 0 0}.section>.component-heading:first-child:after,.section>.component-heading:first-child~.component:not(.hide):after{display:none}.section>.component-heading:first-child~.component:not(.hide)~.component:not(.hide):after{display:block}.description{padding:0 .75rem .7rem;font-size:.9rem;line-height:1.4rem;color:#a4a4a4;text-align:left}.inputs{display:block;width:100%;border-collapse:collapse}.button,button{font-weight:400;font-family:PFDinDisplayPro-Medium,PFDinDisplayProRegularWebfont,sans-serif;font-size:1rem;line-height:1.4rem;text-transform:uppercase;background-color:#767676;border-radius:.25rem;border:none;display:inline-block;color:#fff;min-width:12rem;text-align:center;margin:0 auto .7rem;padding:.6rem;-webkit-tap-highlight-color:#858585}.platform-android .button,.platform-android button{font-family:PFDinDisplayProRegularWebfont,sans-serif;font-weight:700;letter-spacing:.025em}.button:active,button:active{background-color:#858585}.platform-ios .button,.platform-ios button{padding:.5rem}.button.primary,.button[type=submit],button.primary,button[type=submit]{background-color:#ff4700;-webkit-tap-highlight-color:red}.button.primary:active,.button[type=submit]:active,button.primary:active,button[type=submit]:active{background-color:red}a.button{text-decoration:none;color:#fff}</style><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><script>window.returnTo="$$RETURN_TO$$",window.clayConfig=$$CONFIG$$,window.claySettings=$$SETTINGS$$,window.customFn=$$CUSTOM_FN$$,window.clayComponents=$$COMPONENTS$$,window.clayMeta=$$META$$;</script></head><body><form id="main-form" class="inputs"></form><script>!function t(e,n,r){function i(u,a){if(!n[u]){if(!e[u]){var s="function"==typeof require&&require;if(!a&&s)return s(u,!0);if(o)return o(u,!0);var c=new Error("Cannot find module \'"+u+"\'");throw c.code="MODULE_NOT_FOUND",c}var f=n[u]={exports:{}};e[u][0].call(f.exports,function(t){var n=e[u][1][t];return i(n?n:t)},f,f.exports,t,e,n,r)}return n[u].exports}for(var o="function"==typeof require&&require,u=0;u<r.length;u++)i(r[u]);return i}({1:[function(t,e,n){"use strict";var r=t("./vendor/minified"),i=t("./lib/clay-config"),o=r.$,u=r._,a=u.extend([],window.clayConfig||[]),s=u.extend({},window.claySettings||{}),c=window.returnTo||"pebblejs://close#",f=window.customFn||function(){},l=window.clayComponents||{},d=window.clayMeta||{},h=window.navigator.userAgent.match(/android/i)?"android":"ios";document.documentElement.classList.add("platform-"+h),u.eachObj(l,function(t,e){i.registerComponent(e)});var p=o("#main-form"),g=new i(s,a,p,d);p.on("submit",function(){location.href=c+encodeURIComponent(JSON.stringify(g.serialize()))}),f.call(g,r),g.build()},{"./lib/clay-config":2,"./vendor/minified":8}],2:[function(t,e,n){"use strict";function r(t,e,n,c){function f(t,e){if(Array.isArray(t))t.forEach(function(t){f(t,e)});else if("section"===t.type){var n=i(\'<div class="section">\');e.add(n),f(t.items,n)}else{var r=o.copyObj(t);r.clayId=p.length;var a=new u(r).initialize(d);r.id&&(g[r.id]=a),r.appKey&&(m[r.appKey]=a),p.push(a);var s="undefined"!=typeof h[r.appKey]?h[r.appKey]:r.defaultValue||"";a.set(s),e.add(a.$element)}}function l(t){if(!v)throw new Error("ClayConfig not built. build() must be run before you can run "+t+"()");return!0}var d=this,h=o.copyObj(t),p=[],g={},m={},v=!1;d.meta=c,d.EVENTS={BEFORE_BUILD:"BEFORE_BUILD",AFTER_BUILD:"AFTER_BUILD"},a.updateProperties(d.EVENTS,{writable:!1}),d.getAllItems=function(){return l("getAllItems"),p},d.getItemByAppKey=function(t){return l("getItemByAppKey"),m[t]},d.getItemById=function(t){return l("getItemById"),g[t]},d.getItemsByType=function(t){return l("getItemsByType"),p.filter(function(e){return e.config.type===t})},d.serialize=function(){return l("serialize"),o.eachObj(m,function(t,e){h[t]={value:e.get()},e.precision&&(h[t].precision=e.precision)}),h},d.registerComponent=r.registerComponent,d.build=function(){return d.trigger(d.EVENTS.BEFORE_BUILD),f(e,n),v=!0,d.trigger(d.EVENTS.AFTER_BUILD),d},s.call(d,n),a.updateProperties(d,{writable:!1,configurable:!1}),d.config=e}var i=t("../vendor/minified").HTML,o=t("../vendor/minified")._,u=t("./clay-item"),a=t("../lib/utils"),s=t("./clay-events"),c=t("./component-registry"),f=t("./manipulators");r.registerComponent=function(t){var e=o.copyObj(t);if(c[e.name])return console.warn("Component: "+e.name+" is already registered. If you wish to override the existing functionality, you must provide a new name"),!1;if("string"==typeof e.manipulator&&(e.manipulator=f[t.manipulator],!e.manipulator))throw new Error("The manipulator: "+t.manipulator+" does not exist in the built-in manipulators.");if(!e.manipulator)throw new Error("The manipulator must be defined");if("function"!=typeof e.manipulator.set||"function"!=typeof e.manipulator.get)throw new Error("The manipulator must have both a `get` and `set` method");if(e.style){var n=document.createElement("style");n.type="text/css",n.appendChild(document.createTextNode(e.style)),document.head.appendChild(n)}return c[e.name]=e,!0},e.exports=r},{"../lib/utils":7,"../vendor/minified":8,"./clay-events":3,"./clay-item":4,"./component-registry":5,"./manipulators":6}],3:[function(t,e,n){"use strict";function r(t){function e(t){return t.split(" ").map(function(t){return"|"+t.replace(/^\\|/,"")}).join(" ")}function n(t,e){var n=o.find(a,function(e){return e.handler===t?e:null});return n||(n={handler:t,proxy:e},a.push(n)),n.proxy}function r(t){return o.find(a,function(e){return e.handler===t?e.proxy:null})}var u=this,a=[];u.on=function(r,i){var o=e(r),u=this,a=n(i,function(){i.apply(u,arguments)});return t.on(o,a),u},u.off=function(t){var e=r(t);return e&&i.off(e),u},u.trigger=function(e,n){return t.trigger(e,n),u}}var i=t("../vendor/minified").$,o=t("../vendor/minified")._;e.exports=r},{"../vendor/minified":8}],4:[function(t,e,n){"use strict";function r(t){var e=this,n=i[t.type];if(!n)throw new Error("The component: "+t.type+" is not registered. Make sure to register it with ClayConfig.registerComponent()");var r=s.extend({},n.defaults||{},t);e.id=t.id||null,e.appKey=t.appKey||null,e.config=t,e.$element=c(n.template.trim(),r),e.$manipulatorTarget=e.$element.select("[data-manipulator-target]"),e.$manipulatorTarget.length||(e.$manipulatorTarget=e.$element),e.initialize=function(t){return"function"==typeof n.initialize&&n.initialize.call(e,o,t),e},a.call(e,e.$manipulatorTarget),s.eachObj(n.manipulator,function(t,n){e[t]=n.bind(e)}),u.updateProperties(e,{writable:!1,configurable:!1})}var i=t("./component-registry"),o=t("../vendor/minified"),u=t("../lib/utils"),a=t("./clay-events"),s=o._,c=o.HTML;e.exports=r},{"../lib/utils":7,"../vendor/minified":8,"./clay-events":3,"./component-registry":5}],5:[function(t,e,n){"use strict";e.exports={}},{}],6:[function(t,e,n){"use strict";function r(){return this.$manipulatorTarget.get("disabled")?this:(this.$element.set("+disabled"),this.$manipulatorTarget.set("disabled",!0),this.trigger("disabled"))}function i(){return this.$manipulatorTarget.get("disabled")?(this.$element.set("-disabled"),this.$manipulatorTarget.set("disabled",!1),this.trigger("enabled")):this}function o(){return this.$element[0].classList.contains("hide")?this:(this.$element.set("+hide"),this.trigger("hide"))}function u(){return this.$element[0].classList.contains("hide")?(this.$element.set("-hide"),this.trigger("show")):this}var a=t("../vendor/minified")._;e.exports={html:{get:function(){return this.$manipulatorTarget.get("innerHTML")},set:function(t){return this.get()===t.toString(10)?this:(this.$manipulatorTarget.set("innerHTML",t),this.trigger("change"))},hide:o,show:u},button:{get:function(){return this.$manipulatorTarget.get("innerHTML")},set:function(t){return this.get()===t.toString(10)?this:(this.$manipulatorTarget.set("innerHTML",t),this.trigger("change"))},disable:r,enable:i,hide:o,show:u},val:{get:function(){return this.$manipulatorTarget.get("value")},set:function(t){return this.get()===t.toString(10)?this:(this.$manipulatorTarget.set("value",t),this.trigger("change"))},disable:r,enable:i,hide:o,show:u},slider:{get:function(){return parseFloat(this.$manipulatorTarget.get("value"))},set:function(t){var e=this.get();return this.$manipulatorTarget.set("value",t),this.get()===e?this:this.trigger("change")},disable:r,enable:i,hide:o,show:u},checked:{get:function(){return this.$manipulatorTarget.get("checked")},set:function(t){return!this.get()==!t?this:(this.$manipulatorTarget.set("checked",!!t),this.trigger("change"))},disable:r,enable:i,hide:o,show:u},radiogroup:{get:function(){return this.$element.select("input:checked").get("value")},set:function(t){return this.get()===t.toString(10)?this:(this.$element.select(\'input[value="\'+t.replace(\'"\',\'\\\\"\')+\'"]\').set("checked",!0),this.trigger("change"))},disable:r,enable:i,hide:o,show:u},checkboxgroup:{get:function(){var t=[];return this.$element.select("input:checked").each(function(e){t.push(e.value)}),t},set:function(t){var e=this;return t=t||[],a.equals(this.get(),t)?this:(e.$element.select("input").set("checked",!1),t.map(function(t){e.$element.select(\'input[value="\'+t.toString(10).replace(\'"\',\'\\\\"\')+\'"]\').set("checked",!0)}),e.trigger("change"))},disable:r,enable:i,hide:o,show:u},color:{get:function(){return parseInt(this.$manipulatorTarget.get("value"),10)||0},set:function(t){return t=this.roundColorToLayout(t||0),this.get()===t?this:(this.$manipulatorTarget.set("value",t),this.trigger("change"))},disable:r,enable:i,hide:o,show:u}}},{"../vendor/minified":8}],7:[function(t,e,n){"use strict";e.exports.updateProperties=function(t,e){Object.getOwnPropertyNames(t).forEach(function(n){Object.defineProperty(t,n,e)})}},{}],8:[function(t,e,n){e.exports=function(){function t(t){return t.substr(0,3)}function e(t){return t!=lt?""+t:""}function n(t,e){return typeof t==e}function r(t){return n(t,"string")}function i(t){return!!t&&n(t,"object")}function o(t){return t&&t.nodeType}function u(t){return n(t,"number")}function a(t){return i(t)&&!!t.getDay}function s(t){return t===!0||t===!1}function c(t){var e=typeof t;return"object"==e?!(!t||!t.getDay):"string"==e||"number"==e||s(t)}function f(t){return t}function l(t,n,r){return e(t).replace(n,r!=lt?r:"")}function d(t){return l(t,/^\\s+|\\s+$/g)}function h(t,e,n){for(var r in t)t.hasOwnProperty(r)&&e.call(n||t,r,t[r]);return t}function p(t,e,n){if(t)for(var r=0;r<t.length;r++)e.call(n||t,t[r],r);return t}function g(t,e,n){var r=[],i=F(e)?e:function(t){return e!=t};return p(t,function(e,o){i.call(n||t,e,o)&&r.push(e)}),r}function m(t,e,n,r){var i=[];return t(e,function(t,o){D(t=n.call(r||e,t,o))?p(t,function(t){i.push(t)}):t!=lt&&i.push(t)}),i}function v(t){var e=0;return h(t,function(t){e++}),e}function y(t){var e=[];return h(t,function(t){e.push(t)}),e}function b(t,e,n){var r=[];return p(t,function(i,o){r.push(e.call(n||t,i,o))}),r}function $(t,e){var n={};return p(t,function(t,r){n[t]=e}),n}function w(t,e){var n=e||{};for(var r in t)n[r]=t[r];return n}function T(t,e){for(var n=e,r=0;r<t.length;r++)n=w(t[r],n);return n}function x(t){return F(t)?t:function(e,n){return t===e?n:void 0}}function E(t,e,n){return e==lt?n:0>e?Math.max(t.length+e,0):Math.min(t.length,e)}function L(t,e,n,r){for(var i,o=x(e),u=E(t,r,t.length),a=E(t,n,0);u>a;a++)if((i=o.call(t,t[a],a))!=lt)return i}function M(t,e,n){var r=[];if(t)for(var i=E(t,n,t.length),o=E(t,e,0);i>o;o++)r.push(t[o]);return r}function C(t){return b(t,f)}function N(t,e){var n,r=F(t)?t():t,i=F(e)?e():e;return r==i?!0:r==lt||i==lt?!1:c(r)||c(i)?a(r)&&a(i)&&+r==+i:D(r)?r.length==i.length&&!L(r,function(t,e){return N(t,i[e])?void 0:!0}):!D(i)&&(n=y(r)).length==v(i)&&!L(n,function(t){return N(r[t],i[t])?void 0:!0})}function O(t,e,n){return F(t)?t.apply(n&&e,b(n||e,f)):void 0}function S(t,e,n){return b(t,function(t){return O(t,e,n)})}function j(t){return"\\\\u"+("0000"+t.charCodeAt(0).toString(16)).slice(-4)}function A(t){return l(t,/[\\x00-\\x1f\'"\\u2028\\u2029]/g,j)}function I(t,e){return t.split(e)}function _(t,e){if(gt[t])return gt[t];var n="with(_.isObject(obj)?obj:{}){"+b(I(t,/{{|}}}?/g),function(t,e){var n,r=d(t),i=l(r,/^{/),o=r==i?"esc(":"";return e%2?(n=/^each\\b(\\s+([\\w_]+(\\s*,\\s*[\\w_]+)?)\\s*:)?(.*)/.exec(i))?"each("+(d(n[4])?n[4]:"this")+", function("+n[2]+"){":(n=/^if\\b(.*)/.exec(i))?"if("+n[1]+"){":(n=/^else\\b\\s*(if\\b(.*))?/.exec(i))?"}else "+(n[1]?"if("+n[2]+")":"")+"{":(n=/^\\/(if)?/.exec(i))?n[1]?"}\\n":"});\\n":(n=/^(var\\s.*)/.exec(i))?n[1]+";":(n=/^#(.*)/.exec(i))?n[1]:(n=/(.*)::\\s*(.*)/.exec(i))?"print("+o+\'_.formatValue("\'+A(n[2])+\'",\'+(d(n[1])?n[1]:"this")+(o&&")")+"));\\n":"print("+o+(d(i)?i:"this")+(o&&")")+");\\n":t?\'print("\'+A(t)+\'");\\n\':void 0}).join("")+"}",r=new Function("obj","each","esc","print","_",n),i=function(t,n){var i=[];return r.call(n||t,t,function(t,e){D(t)?p(t,function(t,n){e.call(t,t,n)}):h(t,function(t,n){e.call(n,t,n)})},e||f,function(){O(i.push,i,arguments)},rt),i.join("")};return mt.push(i)>pt&&delete gt[mt.shift()],gt[t]=i}function B(t){return l(t,/[<>\'"&]/g,function(t){return"&#"+t.charCodeAt(0)+";"})}function H(t,e){return _(t,B)(e)}function q(t){return function(e,n,r){return t(this,e,n,r)}}function F(t){return"function"==typeof t&&!t.item}function D(t){return t&&t.length!=lt&&!r(t)&&!o(t)&&!F(t)&&t!==ot}function R(t){return parseFloat(l(t,/^[^\\d-]+/))}function k(t){return t[ut]=t[ut]||++ct}function U(t,e){var n,r=[],i={};return Q(t,function(t){Q(e(t),function(t){i[n=k(t)]||(r.push(t),i[n]=!0)})}),r}function P(t,e){var n={$position:"absolute",$visibility:"hidden",$display:"block",$height:lt},r=t.get(n),i=t.set(n).get("clientHeight");return t.set(r),i*e+"px"}function K(t,n,i,o,u){return F(n)?this.on(lt,t,n,i,o):r(o)?this.on(t,n,i,lt,o):this.each(function(r,a){Q(t?Z(t,r):r,function(t){Q(e(n).split(/\\s/),function(e){function n(e,n,r){var f=!u,l=u?r:t;if(u)for(var d=G(u,t);l&&l!=t&&!(f=d(l));)l=l.parentNode;return!f||s!=e||i.apply(Y(l),o||[n,a])&&"?"==c||"|"==c}function r(t){n(s,t,t.target)||(t.preventDefault(),t.stopPropagation())}var s=l(e,/[?|]/g),c=l(e,/[^?|]/g),d=("blur"==s||"focus"==s)&&!!u,h=ct++;t.addEventListener(s,r,d),t.M||(t.M={}),t.M[h]=n,i.M=m(Q,[i.M,function(){t.removeEventListener(s,r,d),delete t.M[h]}],f)})})})}function z(t){S(t.M),t.M=lt}function V(t){ft?ft.push(t):setTimeout(t,0)}function J(t,e,n){return Z(t,e,n)[0]}function W(t,e,n){var r=Y(document.createElement(t));return D(e)||e!=lt&&!i(e)?r.add(e):r.set(e).add(n)}function X(t){return m(Q,t,function(t){var e;return D(t)?X(t):o(t)?(e=t.cloneNode(!0),e.removeAttribute&&e.removeAttribute("id"),e):t})}function Y(t,e,n){return F(t)?V(t):new nt(Z(t,e,n))}function Z(t,e,n){function i(t){return D(t)?m(Q,t,i):t}function u(t){return g(m(Q,t,i),function(t){for(var r=t;r=r.parentNode;)if(r==e[0]||n)return r==e[0]})}return e?1!=(e=Z(e)).length?U(e,function(e){return Z(t,e,n)}):r(t)?1!=o(e[0])?[]:n?u(e[0].querySelectorAll(t)):e[0].querySelectorAll(t):u(t):r(t)?document.querySelectorAll(t):m(Q,t,i)}function G(t,e){function n(t,e){var n=RegExp("(^|\\\\s+)"+t+"(?=$|\\\\s)","i");return function(r){return t?n.test(r[e]):!0}}var i={},a=i;if(F(t))return t;if(u(t))return function(e,n){return n==t};if(!t||"*"==t||r(t)&&(a=/^([\\w-]*)\\.?([\\w-]*)$/.exec(t))){var s=n(a[1],"tagName"),c=n(a[2],"className");return function(t){return 1==o(t)&&s(t)&&c(t)}}return e?function(n){return Y(t,e).find(n)!=lt}:(Y(t).each(function(t){i[k(t)]=!0}),function(t){return i[k(t)]})}function Q(t,e){return D(t)?p(t,e):t!=lt&&e(t,0),t}function tt(){this.state=null,this.values=[],this.parent=null}function et(){var t=[],e=arguments,n=e.length,r=0,o=0,u=new tt;u.errHandled=function(){o++,u.parent&&u.parent.errHandled()};var a=u.fire=function(e,n){return null==u.state&&null!=e&&(u.state=!!e,u.values=D(n)?n:[n],setTimeout(function(){p(t,function(t){t()})},0)),u};p(e,function c(t,e){try{t.then?t.then(function(t){var o;(i(t)||F(t))&&F(o=t.then)?c(t,e):(u.values[e]=C(arguments),++r==n&&a(!0,2>n?u.values[e]:u.values))},function(t){u.values[e]=C(arguments),a(!1,2>n?u.values[e]:[u.values[e][0],u.values,e])}):t(function(){a(!0,C(arguments))},function(){a(!1,C(arguments))})}catch(o){a(!1,[o,u.values,e])}}),u.stop=function(){return p(e,function(t){t.stop&&t.stop()}),u.stop0&&O(u.stop0)};var s=u.then=function(e,n){var r=et(),a=function(){try{var t=u.state?e:n;F(t)?!function s(t){try{var e,n=0;if((i(t)||F(t))&&F(e=t.then)){if(t===r)throw new TypeError;e.call(t,function(t){n++||s(t)},function(t){n++||r.fire(!1,[t])}),r.stop0=t.stop}else r.fire(!0,[t])}catch(u){if(!n++&&(r.fire(!1,[u]),!o))throw u}}(O(t,it,u.values)):r.fire(u.state,u.values)}catch(a){if(r.fire(!1,[a]),!o)throw a}};return F(n)&&u.errHandled(),r.stop0=u.stop,r.parent=u,null!=u.state?setTimeout(a,0):t.push(a),r};return u.always=function(t){return s(t,t)},u.error=function(t){return s(0,t)},u}function nt(t,e){var n=this,r=0;if(t)for(var i=0,o=t.length;o>i;i++){var u=t[i];if(e&&D(u))for(var a=0,s=u.length;s>a;a++)n[r++]=u[a];else n[r++]=u}else n[r++]=e;n.length=r,n._=!0}function rt(){return new nt(arguments,!0)}var it,ot=window,ut="Nia",at={},st={},ct=1,ft=/^[ic]/.test(document.readyState)?lt:[],lt=null,dt=I("January,February,March,April,May,June,July,August,September,October,November,December",/,/g),ht=(b(dt,t),I("Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",/,/g)),pt=(b(ht,t),I("am,pm",/,/g),I("am,am,am,am,am,am,am,am,am,am,am,am,pm,pm,pm,pm,pm,pm,pm,pm,pm,pm,pm,pm",/,/g),99),gt={},mt=[];return w({each:q(p),equals:q(N),find:q(L),dummySort:0,select:function(t,e){return Y(t,this,e)},get:function(t,e){var n=this,i=n[0];if(i){if(r(t)){var o,u=/^(\\W*)(.*)/.exec(l(t,/^%/,"@data-")),a=u[1];return o=st[a]?st[a](this,u[2]):"$"==t?n.get("className"):"$$"==t?n.get("@style"):"$$slide"==t?n.get("$height"):"$$fade"==t||"$$show"==t?"hidden"==n.get("$visibility")||"none"==n.get("$display")?0:"$$fade"==t?isNaN(n.get("$opacity",!0))?1:n.get("$opacity",!0):1:"$"==a?ot.getComputedStyle(i,lt).getPropertyValue(l(u[2],/[A-Z]/g,function(t){return"-"+t.toLowerCase()})):"@"==a?i.getAttribute(u[2]):i[u[2]],e?R(o):o}var s={};return(D(t)?Q:h)(t,function(t){s[t]=n.get(t,e)}),s}},set:function(t,e){var n=this;if(e!==it){var i=/^(\\W*)(.*)/.exec(l(l(t,/^\\$float$/,"cssFloat"),/^%/,"@data-")),o=i[1];at[o]?at[o](this,i[2],e):"$$fade"==t?this.set({$visibility:e?"visible":"hidden",$opacity:e}):"$$slide"==t?n.set({$visibility:e?"visible":"hidden",$overflow:"hidden",$height:/px/.test(e)?e:function(t,n,r){return P(Y(r),e)}}):"$$show"==t?e?n.set({$visibility:e?"visible":"hidden",$display:""}).set({$display:function(t){return"none"==t?"block":t}}):n.set({$display:"none"}):"$$"==t?n.set("@style",e):Q(this,function(n,r){var u=F(e)?e(Y(n).get(t),r,n):e;"$"==o?i[2]?n.style[i[2]]=u:Q(u&&u.split(/\\s+/),function(t){var e=l(t,/^[+-]/);/^\\+/.test(t)?n.classList.add(e):/^-/.test(t)?n.classList.remove(e):n.classList.toggle(e)}):"$$scrollX"==t?n.scroll(u,Y(n).get("$$scrollY")):"$$scrollY"==t?n.scroll(Y(n).get("$$scrollX"),u):"@"==o?u==lt?n.removeAttribute(i[2]):n.setAttribute(i[2],u):n[i[2]]=u})}else r(t)||F(t)?n.set("$",t):h(t,function(t,e){n.set(t,e)});return n},add:function(t,e){return this.each(function(n,r){function i(t){if(D(t))Q(t,i);else if(F(t))i(t(n,r));else if(t!=lt){var a=o(t)?t:document.createTextNode(t);u?u.parentNode.insertBefore(a,u.nextSibling):e?e(a,n,n.parentNode):n.appendChild(a),u=a}}var u;i(r&&!F(t)?X(t):t)})},on:K,trigger:function(t,e){return this.each(function(n,r){for(var i=!0,o=n;o&&i;)h(o.M,function(r,o){i=i&&o(t,e,n)}),o=o.parentNode})},ht:function(t,e){var n=arguments.length>2?T(M(arguments,1)):e;return this.set("innerHTML",F(t)?t(n):/{{/.test(t)?H(t,n):/^#\\S+$/.test(t)?H(J(t).text,n):t)}},nt.prototype),w({request:function(t,n,r,i){var o,u=i||{},a=0,s=et(),c=r&&r.constructor==u.constructor;try{s.xhr=o=new XMLHttpRequest,s.stop0=function(){o.abort()},c&&(r=m(h,r,function(t,e){return m(Q,e,function(e){return encodeURIComponent(t)+(e!=lt?"="+encodeURIComponent(e):"")})}).join("&")),r==lt||/post/i.test(t)||(n+="?"+r,r=lt),o.open(t,n,!0,u.user,u.pass),c&&/post/i.test(t)&&o.setRequestHeader("Content-Type","application/x-www-form-urlencoded"),h(u.headers,function(t,e){o.setRequestHeader(t,e)}),h(u.xhr,function(t,e){o[t]=e}),o.onreadystatechange=function(){4!=o.readyState||a++||(o.status>=200&&o.status<300?s.fire(!0,[o.responseText,o]):s.fire(!1,[o.status,o.responseText,o]))},o.send(r)}catch(f){a||s.fire(!1,[0,lt,e(f)])}return s},ready:V,off:z,wait:function(t,e){var n=et(),r=setTimeout(function(){n.fire(!0,e)},t);return n.stop0=function(){n.fire(!1),clearTimeout(r)},n}},Y),w({each:p,toObject:$,find:L,equals:N,copyObj:w,extend:function(t){return T(M(arguments,1),t)},eachObj:h,isObject:i,format:function(t,e,n){return _(t,n)(e)},template:_,formatHtml:H,promise:et},rt),document.addEventListener("DOMContentLoaded",function(){S(ft),ft=lt},!1),{HTML:function(){var t=W("div");return rt(O(t.ht,t,arguments)[0].childNodes)},_:rt,$:Y,$$:J,M:nt,getter:st,setter:at}}()},{}]},{},[1]);</script></body></html>';
},{}],"pebble-clay":[function(t,e,n){"use strict";function r(t,e,n){function r(){i.meta={activeWatchInfo:Pebble.getActiveWatchInfo&&Pebble.getActiveWatchInfo(),accountToken:Pebble.getAccountToken(),watchToken:Pebble.getWatchToken(),userData:s(n.userData||{})}}function o(t){Array.isArray(t)?t.forEach(function(t){o(t)}):"section"===t.type?o(t.items):a[t.type]&&i.registerComponent(a[t.type])}var i=this;if(!Array.isArray(t))throw new Error("config must be an Array");if(e&&"function"!=typeof e)throw new Error('customFn must be a function or "null"');n=n||{},i.config=s(t),i.customFn=e||function(){},i.components={},i.meta={activeWatchInfo:null,accountToken:"",watchToken:"",userData:{}},n.autoHandleEvents!==!1&&"undefined"!=typeof Pebble?(Pebble.addEventListener("showConfiguration",function(){r(),Pebble.openURL(i.generateUrl())}),Pebble.addEventListener("webviewclosed",function(t){t&&t.response&&Pebble.sendAppMessage(i.getSettings(t.response),function(){console.log("Sent config data to Pebble")},function(t){console.log("Failed to send config data!"),console.log(JSON.stringify(t))})})):"undefined"!=typeof Pebble&&Pebble.addEventListener("ready",function(){r()}),o(i.config)}var o=t("./tmp/config-page.html"),i=t("tosource"),a=t("./src/scripts/components"),s=t("deepcopy/build/deepcopy.min");r.prototype.registerComponent=function(t){this.components[t.name]=t},r.prototype.generateUrl=function(){var t={},e=!Pebble||"pypkjs"===Pebble.platform,n=e?"$$$RETURN_TO$$$":"pebblejs://close#";try{t=JSON.parse(localStorage.getItem("clay-settings"))||{}}catch(a){console.error(a.toString())}var s=o.replace("$$RETURN_TO$$",n).replace("$$CUSTOM_FN$$",i(this.customFn)).replace("$$CONFIG$$",i(this.config)).replace("$$SETTINGS$$",i(t)).replace("$$COMPONENTS$$",i(this.components)).replace("$$META$$",i(this.meta));return e?r.encodeDataUri(s,"http://clay.pebble.com.s3-website-us-west-2.amazonaws.com/#"):r.encodeDataUri(s)},r.prototype.getSettings=function(t,e){var n={};try{n=JSON.parse(decodeURIComponent(t))}catch(o){throw new Error("The provided response was not valid JSON")}var i={};return Object.keys(n).forEach(function(t){"object"==typeof n[t]&&n[t]?i[t]=n[t].value:i[t]=n[t]}),localStorage.setItem("clay-settings",JSON.stringify(i)),e===!1?n:r.prepareSettingsForAppMessage(n)},r.encodeDataUri=function(t,e){return e="undefined"!=typeof e?e:"data:text/html;charset=utf-8,",e+encodeURIComponent(t)},r.prepareForAppMessage=function(t){function e(t,e){return Math.floor(t*Math.pow(10,e||0))}var n;return Array.isArray(t)?(n=[],t.forEach(function(t){var e=r.prepareForAppMessage(t);n.push(e),"string"==typeof e&&n.push(0)})):n="object"==typeof t&&t?"number"==typeof t.value?e(t.value,t.precision):Array.isArray(t.value)?t.value.map(function(n){return"number"==typeof n?e(n,t.precision):n}):r.prepareForAppMessage(t.value):"boolean"==typeof t?t?1:0:t,n},r.prepareSettingsForAppMessage=function(t){var e={};return Object.keys(t).forEach(function(n){e[n]=r.prepareForAppMessage(t[n])}),e},e.exports=r},{"./src/scripts/components":12,"./tmp/config-page.html":41,"deepcopy/build/deepcopy.min":5,tosource:6}]},{},["pebble-clay"])("pebble-clay")});
});
__loader.define("clock/clock.js", 387, function(exports, module, require) {
var moment = require('vendor/moment');

var Clock = module.exports;

Clock.weekday = function(weekday, hour, minute, seconds) {
  var now = moment();
  var target = moment({ hour: hour, minute: minute, seconds: seconds }).day(weekday);
  if (moment.max(now, target) === now) {
    target.add(1, 'week');
  }
  return target.unix();
};

});
__loader.define("clock/index.js", 402, function(exports, module, require) {
var Clock = require('./clock');

module.exports = Clock;

});
__loader.define("config.js", 408, function(exports, module, require) {
module.exports = [
	{
		"type": "section",
		"items": [
			{
				"type": "heading",
				"defaultValue": "Enter your Discord Token"
			},
			{
				"type": "text",
				"defaultValue": "This watch app will be able to send messages from your account to servers that you are on. The app sends data directly to Discord, your token is never sent anywhere else."
			},
			{
				"type": "input",
				"appKey": "token",
				"defaultValue": "",
				"label": "Token",
				"attributes": {
					"placeholder": "Token",
					"limit": 2000,
				}
			},
			{
				"type": "toggle",
				"appKey": "isABot",
				"label": "This token belongs to a bot",
				"defaultValue": false
			},
			{
				"type": "text",
				"defaultValue": "If you're logging in with a user account, and don't know how to get your token, <a href = \"https://www.youtube.com/watch?v=PlXrkOj3OEs\"> this short video </a> will show you how."
			},
			{
				"type": "submit",
				"defaultValue": "Save"
			}
		]
	},
];
});
__loader.define("lib/ajax.js", 449, function(exports, module, require) {
/*
 * ajax.js by Meiguro - MIT License
 */

var ajax = (function(){

var formify = function(data) {
  var params = [], i = 0;
  for (var name in data) {
    params[i++] = encodeURIComponent(name) + '=' + encodeURIComponent(data[name]);
  }
  return params.join('&');
};

var deformify = function(form) {
  var params = {};
  form.replace(/(?:([^=&]*)=?([^&]*)?)(?:&|$)/g, function(_, name, value) {
    if (name) {
      params[name] = value || true;
    }
    return _;
  });
  return params;
};

/**
 * ajax options. There are various properties with url being the only required property.
 * @typedef ajaxOptions
 * @property {string} [method='get'] - The HTTP method to use: 'get', 'post', 'put', 'delete', 'options',
 *    or any other standard method supported by the running environment.
 * @property {string} url - The URL to make the ajax request to. e.g. 'http://www.example.com?name=value'
 * @property {string} [type] - The content and response format. By default, the content format
 *    is 'form' and response format is separately 'text'. Specifying 'json' will have ajax send `data`
 *    as json as well as parse the response as json. Specifying 'text' allows you to send custom
 *    formatted content and parse the raw response text. If you wish to send form encoded data and
 *    parse json, leave `type` undefined and use `JSON.decode` to parse the response data.
 * @property {object} [data] - The request body, mainly to be used in combination with 'post' or 'put'.
 *    e.g. { username: 'guest' }
 * @property {object} headers - Custom HTTP headers. Specify additional headers.
 *    e.g. { 'x-extra': 'Extra Header' }
 * @property {boolean} [async=true] - Whether the request will be asynchronous.
 *    Specify false for a blocking, synchronous request.
 * @property {boolean} [cache=true] - Whether the result may be cached.
 *    Specify false to use the internal cache buster which appends the URL with the query parameter _
 *    set to the current time in milliseconds.
 */

/**
 * ajax allows you to make various http or https requests.
 * See {@link ajaxOptions}
 * @global
 * @param {ajaxOptions} opt - Options specifying the type of ajax request to make.
 * @param {function} success - The success handler that is called when a HTTP 200 response is given.
 * @param {function} failure - The failure handler when the HTTP request fails or is not 200.
 */
var ajax = function(opt, success, failure) {
  if (typeof opt === 'string') {
    opt = { url: opt };
  }
  var method = opt.method || 'GET';
  var url = opt.url;
  //console.log(method + ' ' + url);

  var onHandler = ajax.onHandler;
  if (onHandler) {
    if (success) { success = onHandler('success', success); }
    if (failure) { failure = onHandler('failure', failure); }
  }

  if (opt.cache === false) {
    var appendSymbol = url.indexOf('?') === -1 ? '?' : '&';
    url += appendSymbol + '_=' + Date.now();
  }

  var req = new XMLHttpRequest();
  req.open(method.toUpperCase(), url, opt.async !== false);

  var headers = opt.headers;
  if (headers) {
    for (var name in headers) {
      req.setRequestHeader(name, headers[name]);
    }
  }

  var data = opt.data;
  if (data) {
    if (opt.type === 'json') {
      req.setRequestHeader('Content-Type', 'application/json');
      data = JSON.stringify(opt.data);
    } else if (opt.type === 'xml') {
      req.setRequestHeader('Content-Type', 'text/xml');
    } else if (opt.type !== 'text') {
      req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      data = formify(opt.data);
    }
  }

  var ready = false;
  req.onreadystatechange = function(e) {
    if (req.readyState === 4 && !ready) {
      ready = true;
      var body = req.responseText;
      var okay = req.status >= 200 && req.status < 300 || req.status === 304;

      try {
        if (opt.type === 'json') {
          body = JSON.parse(body);
        } else if (opt.type === 'form') {
          body = deformify(body);
        }
      } catch (err) {
        okay = false;
      }
      var callback = okay ? success : failure;
      if (callback) {
        callback(body, req.status, req);
      }
    }
  };

  req.send(data);
};

ajax.formify = formify;
ajax.deformify = deformify;

if (typeof module !== 'undefined') {
  module.exports = ajax;
} else {
  window.ajax = ajax;
}

return ajax;

})();

});
__loader.define("lib/color.js", 587, function(exports, module, require) {
var Color = {};

Color.normalizeString = function(color) {
  if (typeof color === 'string') {
    if (color.substr(0, 2) === '0x') {
      return color.substr(2);
    } else if (color[0] === '#') {
      return color.substr(1);
    }
  }
  return color;
};

Color.rgbUint12To24 = function(color) {
  return ((color & 0xf00) << 12) | ((color & 0xf0) << 8) | ((color & 0xf) << 4);
};

Color.toArgbUint32 = function(color) {
  var argb = color;
  if (typeof color !== 'number') {
    color = Color.normalizeString(color.toString());
    argb = parseInt(color, 16);
  }
  if (typeof color === 'string') {
    var alpha = 0xff000000;
    if (color.length === 3) {
      argb = alpha | Color.rgbUint12To14(argb);
    } else if (color.length === 6) {
      argb = alpha | argb;
    }
  }
  return argb;
};

Color.toRgbUint24 = function(color) {
  return Color.toArgbUint32(color) & 0xffffff;
};

Color.toArgbUint8 = function(color) {
  var argb = Color.toArgbUint32(color);
  return (((argb >> 24) & 0xc0) | ((argb >> 18) & 0x30) |
          ((argb >> 12) & 0xc) | ((argb >> 6) & 0x3));
};

Color.toRgbUint8 = function(color) {
  return Color.toArgbUint8(color) & 0x3f;
};

module.exports = Color;

});
__loader.define("lib/emitter.js", 639, function(exports, module, require) {

var Emitter = function() {
  this._events = {};
};

Emitter.prototype.wrapHandler = function(handler) {
  return handler;
};

Emitter.prototype._on = function(type, subtype, handler) {
  var typeMap = this._events || ( this._events = {} );
  var subtypeMap = typeMap[type] || ( typeMap[type] = {} );
  (subtypeMap[subtype] || ( subtypeMap[subtype] = [] )).push({
    id: handler,
    handler: this.wrapHandler(handler),
  });
};

Emitter.prototype._off = function(type, subtype, handler) {
  if (!type) {
    this._events = {};
    return;
  }
  var typeMap = this._events;
  if (!handler && subtype === 'all') {
    delete typeMap[type];
    return;
  }
  var subtypeMap = typeMap[type];
  if (!subtypeMap) { return; }
  if (!handler) {
    delete subtypeMap[subtype];
    return;
  }
  var handlers = subtypeMap[subtype];
  if (!handlers) { return; }
  var index = -1;
  for (var i = 0, ii = handlers.length; i < ii; ++i) {
    if (handlers[i].id === handler) {
      index = i;
      break;
    }
  }
  if (index === -1) { return; }
  handlers.splice(index, 1);
};

Emitter.prototype.on = function(type, subtype, handler) {
  if (!handler) {
    handler = subtype;
    subtype = 'all';
  }
  this._on(type, subtype, handler);
  if (Emitter.onAddHandler) {
    Emitter.onAddHandler(type, subtype, handler);
  }
  if (this.onAddHandler) {
    this.onAddHandler(type, subtype, handler);
  }
};

Emitter.prototype.off = function(type, subtype, handler) {
  if (!handler) {
    handler = subtype;
    subtype = 'all';
  }
  this._off(type, subtype, handler);
  if (Emitter.onRemoveHandler) {
    Emitter.onRemoveHandler(type, subtype, handler);
  }
  if (this.onRemoveHandler) {
    this.onRemoveHandler(type, subtype, handler);
  }
};

Emitter.prototype.listeners = function(type, subtype) {
  if (!subtype) {
    subtype = 'all';
  }
  var typeMap = this._events;
  if (!typeMap) { return; }
  var subtypeMap = typeMap[type];
  if (!subtypeMap) { return; }
  return subtypeMap[subtype];
};

Emitter.prototype.listenerCount = function(type, subtype) {
  var listeners = this.listeners(type, subtype);
  return listeners ? listeners.length : 0;
};

Emitter.prototype.forEachListener = function(type, subtype, callback) {
  var typeMap = this._events;
  if (!typeMap) { return; }
  var subtypeMap;
  if (typeof callback === 'function') {
    var handlers = this.listeners(type, subtype);
    if (!handlers) { return; }
    for (var i = 0, ii = handlers.length; i < ii; ++i) {
      callback.call(this, type, subtype, handlers[i]);
    }
  } else if (typeof subtype === 'function') {
    callback = subtype;
    subtypeMap = typeMap[type];
    if (!subtypeMap) { return; }
    for (subtype in subtypeMap) {
      this.forEachListener(type, subtype, callback);
    }
  } else if (typeof type === 'function') {
    callback = type;
    for (type in typeMap) {
      this.forEachListener(type, callback);
    }
  }
};

var emitToHandlers = function(type, handlers, e) {
  if (!handlers) { return; }
  for (var i = 0, ii = handlers.length; i < ii; ++i) {
    var handler = handlers[i].handler;
    if (handler.call(this, e, type, i) === false) {
      return false;
    }
  }
  return true;
};

Emitter.prototype.emit = function(type, subtype, e) {
  if (!e) {
    e = subtype;
    subtype = null;
  }
  e.type = type;
  if (subtype) {
    e.subtype = subtype;
  }
  var typeMap = this._events;
  if (!typeMap) { return; }
  var subtypeMap = typeMap[type];
  if (!subtypeMap) { return; }
  var hadSubtype = emitToHandlers.call(this, type, subtypeMap[subtype], e);
  if (hadSubtype === false) {
    return false;
  }
  var hadAll = emitToHandlers.call(this, type, subtypeMap.all, e);
  if (hadAll === false) {
    return false;
  }
  if (hadSubtype || hadAll) {
    return true;
  }
};

module.exports = Emitter;

});
__loader.define("lib/image.js", 796, function(exports, module, require) {
var PNG = require('vendor/png');

var PNGEncoder = require('lib/png-encoder');

var image = {};

var getPos = function(width, x, y) {
  return y * width * 4 + x * 4;
};

//! Convert an RGB pixel array into a single grey color
var getPixelGrey = function(pixels, pos) {
  return ((pixels[pos] + pixels[pos + 1] + pixels[pos + 2]) / 3) & 0xFF;
};

//! Convert an RGB pixel array into a single uint8 2 bitdepth per channel color
var getPixelColorUint8 = function(pixels, pos) {
  var r = Math.min(Math.max(parseInt(pixels[pos    ] / 64 + 0.5), 0), 3);
  var g = Math.min(Math.max(parseInt(pixels[pos + 1] / 64 + 0.5), 0), 3);
  var b = Math.min(Math.max(parseInt(pixels[pos + 2] / 64 + 0.5), 0), 3);
  return (0x3 << 6) | (r << 4) | (g << 2) | b;
};

//! Get an RGB vector from an RGB pixel array
var getPixelColorRGB8 = function(pixels, pos) {
  return [pixels[pos], pixels[pos + 1], pixels[pos + 2]];
};

//! Normalize the color channels to be identical
image.greyscale = function(pixels, width, height, converter) {
  converter = converter || getPixelGrey;
  for (var y = 0, yy = height; y < yy; ++y) {
    for (var x = 0, xx = width; x < xx; ++x) {
      var pos = getPos(width, x, y);
      var newColor = converter(pixels, pos);
      for (var i = 0; i < 3; ++i) {
        pixels[pos + i] = newColor;
      }
    }
  }
};

//! Convert to an RGBA pixel array into a row major matrix raster
image.toRaster = function(pixels, width, height, converter) {
  converter = converter || getPixelColorRGB8;
  var matrix = [];
  for (var y = 0, yy = height; y < yy; ++y) {
    var row = matrix[y] = [];
    for (var x = 0, xx = width; x < xx; ++x) {
      var pos = getPos(width, x, y);
      row[x] = converter(pixels, pos);
    }
  }
  return matrix;
};

image.dithers = {};

image.dithers['floyd-steinberg'] = [
  [ 1, 0, 7/16],
  [-1, 1, 3/16],
  [ 0, 1, 5/16],
  [ 1, 1, 1/16]];

image.dithers['jarvis-judice-ninke'] = [
  [ 1, 0, 7/48],
  [ 2, 0, 5/48],
  [-2, 1, 3/48],
  [-1, 1, 5/48],
  [ 0, 1, 7/48],
  [ 1, 1, 5/48],
  [ 2, 1, 3/48],
  [-2, 2, 1/48],
  [-1, 2, 3/48],
  [ 0, 2, 5/48],
  [ 1, 2, 3/48],
  [ 2, 2, 1/48]];

image.dithers.sierra = [
  [ 1, 0, 5/32],
  [ 2, 0, 3/32],
  [-2, 1, 2/32],
  [-1, 1, 4/32],
  [ 0, 1, 5/32],
  [ 1, 1, 4/32],
  [ 2, 1, 2/32],
  [-1, 2, 2/32],
  [ 0, 2, 3/32],
  [ 1, 2, 2/32]];

image.dithers['default'] = image.dithers.sierra;

//! Get the nearest normalized grey color
var getChannelGrey = function(color) {
  return color >= 128 ? 255 : 0;
};

//! Get the nearest normalized 2 bitdepth color
var getChannel2 = function(color) {
  return Math.min(Math.max(parseInt(color / 64 + 0.5), 0) * 64, 255);
};

image.dither = function(pixels, width, height, dithers, converter) {
  converter = converter || getChannel2;
  dithers = dithers || image.dithers['default'];
  var numDithers = dithers.length;
  for (var y = 0, yy = height; y < yy; ++y) {
    for (var x = 0, xx = width; x < xx; ++x) {
      var pos = getPos(width, x, y);
      for (var i = 0; i < 3; ++i) {
        var oldColor = pixels[pos + i];
        var newColor = converter(oldColor);
        var error = oldColor - newColor;
        pixels[pos + i] = newColor;
        for (var j = 0; j < numDithers; ++j) {
          var dither = dithers[j];
          var x2 = x + dither[0], y2 = y + dither[1];
          if (x2 >= 0 && x2 < width && y < height) {
            pixels[getPos(width, x2, y2) + i] += parseInt(error * dither[2]);
          }
        }
      }
    }
  }
};

//! Dither a pixel buffer by image properties
image.ditherByProps = function(pixels, img, converter) {
  if (img.dither) {
    var dithers = image.dithers[img.dither];
    image.dither(pixels, img.width, img.height, dithers, converter);
  }
};

image.resizeNearest = function(pixels, width, height, newWidth, newHeight) {
  var newPixels = new Array(newWidth * newHeight * 4);
  var widthRatio = width / newWidth;
  var heightRatio = height / newHeight;
  for (var y = 0, yy = newHeight; y < yy; ++y) {
    for (var x = 0, xx = newWidth; x < xx; ++x) {
      var x2 = parseInt(x * widthRatio);
      var y2 = parseInt(y * heightRatio);
      var pos2 = getPos(width, x2, y2);
      var pos = getPos(newWidth, x, y);
      for (var i = 0; i < 4; ++i) {
        newPixels[pos + i] = pixels[pos2 + i];
      }
    }
  }
  return newPixels;
};

image.resizeSample = function(pixels, width, height, newWidth, newHeight) {
  var newPixels = new Array(newWidth * newHeight * 4);
  var widthRatio = width / newWidth;
  var heightRatio = height / newHeight;
  for (var y = 0, yy = newHeight; y < yy; ++y) {
    for (var x = 0, xx = newWidth; x < xx; ++x) {
      var x2 = Math.min(parseInt(x * widthRatio), width - 1);
      var y2 = Math.min(parseInt(y * heightRatio), height - 1);
      var pos = getPos(newWidth, x, y);
      for (var i = 0; i < 4; ++i) {
        newPixels[pos + i] = ((pixels[getPos(width, x2  , y2  ) + i] +
                               pixels[getPos(width, x2+1, y2  ) + i] +
                               pixels[getPos(width, x2  , y2+1) + i] +
                               pixels[getPos(width, x2+1, y2+1) + i]) / 4) & 0xFF;
      }
    }
  }
  return newPixels;
};

image.resize = function(pixels, width, height, newWidth, newHeight) {
  if (newWidth < width || newHeight < height) {
    return image.resizeSample(pixels, width, height, newWidth, newHeight);
  } else {
    return image.resizeNearest(pixels, width, height, newWidth, newHeight);
  }
};

//! Resize a pixel buffer by image properties
image.resizeByProps = function(pixels, img) {
  if (img.width !== img.originalWidth || img.height !== img.originalHeight) {
    return image.resize(pixels, img.originalWidth, img.originalHeight, img.width, img.height);
  } else {
    return pixels;
  }
};

//! Convert to a GBitmap with bitdepth 1
image.toGbitmap1 = function(pixels, width, height) {
  var rowBytes = width * 4;

  var gpixels = [];
  var growBytes = Math.ceil(width / 32) * 4;
  for (var i = 0, ii = height * growBytes; i < ii; ++i) {
    gpixels[i] = 0;
  }

  for (var y = 0, yy = height; y < yy; ++y) {
    for (var x = 0, xx = width; x < xx; ++x) {
      var grey = 0;
      var pos = getPos(width, x, y);
      for (var j = 0; j < 3; ++j) {
        grey += pixels[pos + j];
      }
      grey /= 3 * 255;
      if (grey >= 0.5) {
        var gbytePos = y * growBytes + parseInt(x / 8);
        gpixels[gbytePos] += 1 << (x % 8);
      }
    }
  }

  var gbitmap = {
    width: width,
    height: height,
    pixelsLength: gpixels.length,
    pixels: gpixels,
  };

  return gbitmap;
};

//! Convert to a PNG with total color bitdepth 8
image.toPng8 = function(pixels, width, height) {
  var raster = image.toRaster(pixels, width, height, getPixelColorRGB8);

  var palette = [];
  var colorMap = {};
  var numColors = 0;
  for (var y = 0, yy = height; y < yy; ++y) {
    var row = raster[y];
    for (var x = 0, xx = width; x < xx; ++x) {
      var color = row[x];
      var hash = getPixelColorUint8(color, 0);
      if (!(hash in colorMap)) {
        colorMap[hash] = numColors;
        palette[numColors++] = color;
      }
     row[x] = colorMap[hash];
    }
  }

  var bitdepth = 8;
  var colorType = 3; // 8-bit palette
  var bytes = PNGEncoder.encode(raster, bitdepth, colorType, palette);

  var png = {
    width: width,
    height: height,
    pixelsLength: bytes.array.length,
    pixels: bytes.array,
  };

  return png;
};

//! Set the size maintaining the aspect ratio
image.setSizeAspect = function(img, width, height) {
  img.originalWidth = width;
  img.originalHeight = height;
  if (img.width) {
    if (!img.height) {
      img.height = parseInt(height * (img.width / width));
    }
  } else if (img.height) {
    if (!img.width) {
      img.width = parseInt(width * (img.height / height));
    }
  } else {
    img.width = width;
    img.height = height;
  }
};

image.load = function(img, bitdepth, callback) {
  PNG.load(img.url, function(png) {
    var pixels = png.decode();
    if (bitdepth === 1) {
      image.greyscale(pixels, png.width, png.height);
    }
    image.setSizeAspect(img, png.width, png.height);
    pixels = image.resizeByProps(pixels, img);
    image.ditherByProps(pixels, img,
                        bitdepth === 1 ? getChannelGrey : getChannel2);
    if (bitdepth === 8) {
      img.image = image.toPng8(pixels, img.width, img.height);
    } else if (bitdepth === 1) {
      img.image = image.toGbitmap1(pixels, img.width, img.height);
    }
    if (callback) {
      callback(img);
    }
  });
  return img;
};

module.exports = image;

});
__loader.define("lib/myutil.js", 1098, function(exports, module, require) {
var util2 = require('util2');

var myutil = {};

myutil.shadow = function(a, b) {
  for (var k in a) {
    if (typeof b[k] === 'undefined') {
      b[k] = a[k];
    }
  }
  return b;
};

myutil.defun = function(fn, fargs, fbody) {
  if (!fbody) {
    fbody = fargs;
    fargs = [];
  }
  return new Function('return function ' + fn + '(' + fargs.join(', ') + ') {' + fbody + '}')();
};

myutil.slog = function() {
  var args = [];
  for (var i = 0, ii = arguments.length; i < ii; ++i) {
    args[i] = util2.toString(arguments[i]);
  }
  return args.join(' ');
};

myutil.toObject = function(key, value) {
  if (typeof key === 'object') {
    return key;
  }
  var obj = {};
  obj[key] = value;
  return obj;
};

myutil.flag = function(flags) {
  if (typeof flags === 'boolean') {
    return flags;
  }
  for (var i = 1, ii = arguments.length; i < ii; ++i) {
    if (flags[arguments[i]]) {
      return true;
    }
  }
  return false;
};

myutil.toFlags = function(flags) {
  if (typeof flags === 'string') {
    flags = myutil.toObject(flags, true);
  } else {
    flags = !!flags;
  }
  return flags;
};

/**
 * Returns an absolute path based on a root path and a relative path.
 */
myutil.abspath = function(root, path) {
  if (!path) {
    path = root;
  }
  if (path.match(/^\/\//)) {
    var m = root && root.match(/^(\w+:)\/\//);
    path = (m ? m[1] : 'http:') + path;
  }
  if (root && !path.match(/^\w+:\/\//)) {
    path = root + path;
  }
  return path;
};

/**
 *  Converts a name to a C constant name format of UPPER_CASE_UNDERSCORE.
 */
myutil.toCConstantName = function(x) {
  x = x.toUpperCase();
  x = x.replace(/[- ]/g, '_');
  return x;
};

module.exports = myutil;

});
__loader.define("lib/png-encoder.js", 1187, function(exports, module, require) {
/**
 * PNG Encoder from data-demo
 * https://code.google.com/p/data-demo/
 *
 * @author mccalluc@yahoo.com
 * @license MIT
 */

var Zlib = require('vendor/zlib');

var png = {};

png.Bytes = function(data, optional) {
  var datum, i;
  this.array = [];

  if (!optional) {

    if (data instanceof Array || data instanceof Uint8Array) {
      for (i = 0; i < data.length; i++) {
        datum = data[i];
        if (datum !== null) { // nulls and undefineds are silently skipped.
          if (typeof datum !== "number") {
            throw new Error("Expected number, not "+(typeof datum));
          } else if (Math.floor(datum) != datum) {
            throw new Error("Expected integer, not "+datum);
          } else if (datum < 0 || datum > 255) {
            throw new Error("Expected integer in [0,255], not "+datum);
          }
          this.array.push(datum);
        }
      }
    }

    else if (typeof data == "string") {
      for (i = 0; i < data.length; i++) {
        datum = data.charCodeAt(i);
        if (datum < 0 || datum > 255) {
          throw new Error("Characters above 255 not allowed without explicit encoding: "+datum);
        }
        this.array.push(datum);
      }
    }

    else if (data instanceof png.Bytes) {
      this.array.push.apply(this.array, data.array);
    }

    else if (typeof data == "number") {
        return new png.Bytes([data]);
    }

    else {
      throw new Error("Unexpected data type: "+data);
    }

  }

  else { // optional is defined.

    // TODO: generalize when generalization is required.
    if (typeof data == "number" &&
        Math.floor(data) == data &&
        data >= 0 &&
        (optional.bytes in {4:1, 2:1}) &&
        // don't change this last one to bit shifts: in JS, 0x100 << 24 == 0.
        data < Math.pow(256, optional.bytes)) {
      this.array = [
        (data & 0xFF000000) >>> 24,
        (data & 0x00FF0000) >>> 16,
        (data & 0x0000FF00) >>> 8,
        (data & 0x000000FF)
      ].slice(-optional.bytes);
    }

    else throw new Error("Unexpected data/optional args combination: "+data);

  }
};

png.Bytes.prototype.add = function(data, optional) {
  // Takes the same arguments as the constructor,
  // but appends the new data instead, and returns the modified object.
  // (suitable for chaining.)
  this.array.push.apply(this.array, new png.Bytes(data, optional).array);
  return this;
};

png.Bytes.prototype.chunk = function(n) {
  // Split the array into chunks of length n.
  // Returns an array of arrays.
  var buffer = [];
  for (var i = 0; i < this.array.length; i += n) {
    var slice = this.array.slice(i, i+n);
    buffer.push(this.array.slice(i, i+n));
  }
  return buffer;
};

png.Bytes.prototype.toString = function(n) {
  // one optional argument specifies line length in bytes.
  // returns a hex dump of the Bytes object.
  var chunks = this.chunk(n || 8);
  var byte;
  var lines = [];
  var hex;
  var chr;
  for (var i = 0; i < chunks.length; i++) {
    hex = [];
    chr = [];
    for (var j = 0; j < chunks[i].length; j++) {
      byte = chunks[i][j];
      hex.push(
        ((byte < 16) ? "0" : "") +
        byte.toString(16)
      );
      chr.push(
        (byte >=32 && byte <= 126 ) ?
          String.fromCharCode(byte)
          : "_"
      );
    }
    lines.push(hex.join(" ")+"  "+chr.join(""));
  }
  return lines.join("\n");
};

png.Bytes.prototype.serialize = function() {
  // returns a string whose char codes correspond to the bytes of the array.
  // TODO: get rid of this once transition is complete?
  return String.fromCharCode.apply(null, this.array);
};

png.fromRaster = function(raster, optional_palette, optional_transparency) {
  // Given a Raster object,
  // and optionally a list of rgb triples,
  // and optionally a corresponding list of transparency values (0: clear - 255: opaque)
  // return the corresponding PNG as a Bytes object.

  var signature = new png.Bytes([
    137, 80 /* P */, 78 /* N */, 71 /* G */, 13, 10, 26, 10
  ]);
  var ihdr = new png.Chunk.IHDR(raster.width, raster.height, raster.bit_depth, raster.color_type);
  var plte = (optional_palette instanceof Array) ?
    new png.Chunk.PLTE(optional_palette) :
    new png.Bytes([]);
  var trns = (optional_transparency instanceof Array) ?
    new png.Chunk.tRNS(optional_transparency) :
    new png.Bytes([]);
  var idat = new png.Chunk.IDAT(raster);
  var iend = new png.Chunk.IEND(); // intentionally blank

  // order matters.
  return signature.add(ihdr).add(plte).add(trns).add(idat).add(iend);
};

png.encode = function(raster, bit_depth, color_type, optional_palette, optional_transparency) {
  if (color_type === 0 || color_type === 3) {
    raster = new png.Raster(bit_depth, color_type, raster);
  } else if (color_type === 2 || color_type === 6) {
    raster = new png.Raster_rgb(bit_depth, color_type, raster);
  }
  return png.fromRaster(raster, optional_palette, optional_transparency);
};

png.Chunk = function(type, data) {
  // given a four character type, and Bytes,
  // calculates the length and the checksum, and creates
  // a Bytes object for that png chunk.

  if (!type.match(/^[A-Za-z]{4}$/)) {
    throw new Error("Creating PNG chunk: provided type should be four letters, not "+type);
  }

  if (!(data instanceof png.Bytes)) {
    throw new Error("Creating PNG "+type+" chunk: provided data is not Bytes: "+data);
  }

    // CRC calculations are a literal translation of the C code at
  // http://www.libpng.org/pub/png/spec/1.0/PNG-CRCAppendix.html
  if (!png.crc_table) {
    png.crc_table = []; // Table of CRCs of all 8-bit messages.
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        if (c & 1) {
          c = 0xedb88320 ^ (c >>> 1); // C ">>" is JS ">>>"
        } else {
          c = c >>> 1; // C ">>" is JS ">>>"
        }
      }
      png.crc_table[n] = c;
    }
  }

  function update_crc(crc, buffer) {
    // Update a running CRC with the buffer--the CRC
    // should be initialized to all 1's, and the transmitted value
    // is the 1's complement of the final running CRC
    var c = crc;
    var n;
    for (n = 0; n < buffer.length; n++) {
      c = png.crc_table[(c ^ buffer[n]) & 0xff] ^ (c >>> 8); // C ">>" is JS ">>>"
    }
    return c;
  }

  var type_and_data = new png.Bytes(type).add(data);
  var crc = (update_crc(0xffffffff, type_and_data.array) ^ 0xffffffff)>>>0;
  // >>>0 converts to unsigned, without changing the bits.

  var length_type_data_checksum =
    new png.Bytes(data.array.length,{bytes:4})
    .add(type_and_data)
    .add(crc,{bytes:4});

  return length_type_data_checksum;
};

png.Chunk.IHDR = function(width, height, bit_depth, color_type) {
  if (!(
        // grayscale
        (color_type === 0) && (bit_depth in {1:1, 2:1, 4:1, 8:1, 16:1}) ||
        // rgb
        (color_type === 2) && (bit_depth in {8:1, 16:1}) ||
        // palette
        (color_type === 3) && (bit_depth in {1:1, 2:1, 4:1, 8:1}) ||
        // grayscale + alpha
        (color_type === 4) && (bit_depth in {8:1, 16:1}) ||
        // rgb + alpha
        (color_type ===  6) && (bit_depth in {8:1, 16:1})
        // http://www.libpng.org/pub/png/spec/1.0/PNG-Chunks.html#C.IHDR
        )) {
    throw new Error("Invalid color type ("+color_type+") / bit depth ("+bit_depth+") combo");
  }
  return new png.Chunk(
    "IHDR",
    new png.Bytes(width,{bytes:4})
      .add(height,{bytes:4})
      .add([
        bit_depth,
        color_type,
        0, // compression method
        0, // filter method
        0  // interlace method
      ])
  );
};

png.Chunk.PLTE = function(rgb_list) {
  // given a list of RGB triples,
  // returns the corresponding PNG PLTE (palette) chunk.
  for (var i = 0, ii = rgb_list.length; i < ii; i++) {
    var triple = rgb_list[i];
    if (triple.length !== 3) {
      throw new Error("This is not a valid RGB triple: "+triple);
    }
  }
  return new png.Chunk(
    "PLTE",
    new png.Bytes(Array.prototype.concat.apply([], rgb_list))
  );
};

png.Chunk.tRNS = function(alpha_list) {
  // given a list of alpha values corresponding to the palette entries,
  // returns the corresponding PNG tRNS (transparency) chunk.
  return new png.Chunk(
    "tRNS",
    new png.Bytes(alpha_list)
  );
};

png.Raster = function(bit_depth, color_type, raster) {
  // takes an array of arrays of greyscale or palette values.
  // provides encode(), which returns bytes ready for a PNG IDAT chunk.

  // validate depth and type
  if (color_type !== 0 && color_type !== 3) throw new Error("Color type "+color_type+" is unsupported.");
  if (bit_depth > 8) throw new Error("Bit depths greater than 8 are unsupported.");

  this.bit_depth = bit_depth;
  this.color_type = color_type;

  // validate raster data.
  var max_value = (1 << bit_depth) - 1;
  var cols = raster[0].length;
  for (var row = 0; row < raster.length; row++) {
    if (raster[row].length != cols)
      throw new Error("Row "+row+" does not have the expected "+cols+" columns.");
    for (var col = 0; col < cols; col++) {
      if (!(raster[row][col] >= 0 && raster[row][col] <= max_value))
        throw new Error("Image data ("+raster[row][col]+") out of bounds at ("+row+","+col+")");
    }
  }

  this.height = raster.length;
  this.width = cols;

  this.encode = function() {
    // Returns the image data as a single array of bytes, using filter method 0.
    var buffer = [];
    for (var row = 0; row < raster.length; row++) {
      buffer.push(0); // each row gets filter type 0.
      for (var col = 0; col < cols; col += 8/bit_depth) {
        var byte = 0;
        for (var sub = 0; sub < 8/bit_depth; sub++) {
          byte <<= bit_depth;
          if (col + sub < cols) {
            byte |= raster[row][col+sub];
          }
        }
        if (byte & ~0xFF) throw new Error("Encoded raster byte out of bounds at ("+row+","+col+")");
        buffer.push(byte);
      }
    }
    return buffer;
  };
};

png.Raster_rgb = function(bit_depth, color_type, raster) {
  // takes an array of arrays of RGB triples.
  // provides encode(), which returns bytes ready for a PNG IDAT chunk.

  // validate depth and type
  if (color_type != 2 && color_type != 6) throw new Error("Only color types 2 and 6 for RGB.");
  if (bit_depth != 8) throw new Error("Bit depths other than 8 are unsupported for RGB.");

  this.bit_depth = bit_depth;
  this.color_type = color_type;

  // validate raster data.
  var cols = raster[0].length;
  for (var row = 0; row < raster.length; row++) {
    if (raster[row].length != cols) {
      throw new Error("Row "+row+" does not have the expected "+cols+" columns.");
    }
    for (var col = 0; col < cols; col++) {
      if (!(color_type == 2 && raster[row][col].length == 3) &&
          !(color_type == 6 && raster[row][col].length == 4)) {
        throw new Error("Not RGB[A] at ("+row+","+col+")");
      }
      for (var i = 0; i < (color_type == 2 ? 3 : 4); i++) {
        if (raster[row][col][i]<0 || raster[row][col][i]>255) {
          throw new Error("RGB out of range at ("+row+","+col+")");
        }
      }
    }
  }

  this.height = raster.length;
  this.width = cols;

  this.encode = function() {
    // Returns the image data as a single array of bytes, using filter method 0.
    var buffer = [];
    for (var row = 0; row < raster.length; row++) {
      buffer.push(0); // each row gets filter type 0.
      for (var col = 0; col < cols; col++) {
        buffer.push.apply(buffer, raster[row][col]);
      }
    }
    return buffer;
  };
};

png.Chunk.IDAT = function(raster) {
  var encoded = raster.encode();
  var zipped = new Zlib.Deflate(encoded).compress();
  return new png.Chunk("IDAT", new png.Bytes(zipped));
};

png.Chunk.IEND = function() {
  return new png.Chunk("IEND", new png.Bytes([]));
};

if (typeof module !== 'undefined') {
  module.exports = png;
}

});
__loader.define("lib/safe.js", 1569, function(exports, module, require) {
/* safe.js - Building a safer world for Pebble.JS Developers
 *
 * This library provides wrapper around all the asynchronous handlers that developers
 * have access to so that error messages are caught and displayed nicely in the pebble tool
 * console.
 */

/* global __loader */

var safe = {};

/* The name of the concatenated file to translate */
safe.translateName = 'pebble-js-app.js';

safe.indent = '    ';

/* Translates a source line position to the originating file */
safe.translatePos = function(name, lineno, colno) {
  if (name === safe.translateName) {
    var pkg = __loader.getPackageByLineno(lineno);
    if (pkg) {
      name = pkg.filename;
      lineno -= pkg.lineno;
    }
  }
  return name + ':' + lineno + ':' + colno;
};

var makeTranslateStack = function(stackLineRegExp, translateLine) {
  return function(stack, level) {
    var lines = stack.split('\n');
    var firstStackLine = -1;
    for (var i = lines.length - 1; i >= 0; --i) {
      var m = lines[i].match(stackLineRegExp);
      if (!m) {
        continue;
      }
      var line = lines[i] = translateLine.apply(this, m);
      if (line) {
        firstStackLine = i;
        if (line.indexOf(module.filename) !== -1) {
          lines.splice(i, 1);
        }
      } else {
        lines.splice(i, lines.length - i);
      }
    }
    if (firstStackLine > -1) {
      lines.splice(firstStackLine, level);
    }
    return lines;
  };
};

/* Translates a node style stack trace line */
var translateLineV8 = function(line, msg, scope, name, lineno, colno) {
  var pos = safe.translatePos(name, lineno, colno);
  return msg + (scope ? ' ' + scope + ' (' + pos + ')' : pos);
};

/* Matches <msg> (<scope> '(')? <name> ':' <lineno> ':' <colno> ')'? */
var stackLineRegExpV8 = /(.+?)(?:\s+([^\s]+)\s+\()?([^\s@:]+):(\d+):(\d+)\)?/;

safe.translateStackV8 = makeTranslateStack(stackLineRegExpV8, translateLineV8);

/* Translates an iOS stack trace line to node style */
var translateLineIOS = function(line, scope, name, lineno, colno) {
  var pos = safe.translatePos(name, lineno, colno);
  return safe.indent + 'at ' + (scope ? scope  + ' (' + pos + ')' : pos);
};

/* Matches (<scope> '@' )? <name> ':' <lineno> ':' <colno> */
var stackLineRegExpIOS = /(?:([^\s@]+)@)?([^\s@:]+):(\d+):(\d+)/;

safe.translateStackIOS = makeTranslateStack(stackLineRegExpIOS, translateLineIOS);

/* Translates an Android stack trace line to node style */
var translateLineAndroid = function(line, msg, scope, name, lineno, colno) {
  if (name !== 'jskit_startup.js') {
    return translateLineV8(line, msg, scope, name, lineno, colno);
  }
};

/* Matches <msg> <scope> '('? filepath <name> ':' <lineno> ':' <colno> ')'? */
var stackLineRegExpAndroid = /^(.*?)(?:\s+([^\s]+)\s+\()?[^\s\(]*?([^\/]*?):(\d+):(\d+)\)?/;

safe.translateStackAndroid = makeTranslateStack(stackLineRegExpAndroid, translateLineAndroid);

/* Translates a stack trace to the originating files */
safe.translateStack = function(stack, level) {
  level = level || 0;
  if (Pebble.platform === 'pypkjs') {
    return safe.translateStackV8(stack, level);
  } else if (stack.match('com.getpebble.android')) {
    return safe.translateStackAndroid(stack, level);
  } else {
    return safe.translateStackIOS(stack, level);
  }
};

var normalizeIndent = function(lines, pos) {
  pos = pos || 0;
  var label = lines[pos].match(/^[^\s]* /);
  if (label) {
    var indent = label[0].replace(/./g, ' ');
    for (var i = pos + 1, ii = lines.length; i < ii; i++) {
      lines[i] = lines[i].replace(/^\t/, indent);
    }
  }
  return lines;
};

safe.translateError = function(err, intro, level) {
  var name = err.name;
  var message = err.message || err.toString();
  var stack = err.stack;
  var result = [intro || 'JavaScript Error:'];
  if (message && (!stack || stack.indexOf(message) === -1)) {
    if (name && message.indexOf(name + ':') === -1) {
      message = name + ': ' + message;
    }
    result.push(message);
  }
  if (stack) {
    Array.prototype.push.apply(result, safe.translateStack(stack, level));
  }
  return normalizeIndent(result, 1).join('\n');
};

/* Dumps error messages to the console. */
safe.dumpError = function(err, intro, level) {
  if (typeof err === 'object') {
    console.log(safe.translateError(err, intro, level));
  } else {
    console.log('Error: dumpError argument is not an object');
  }
};

/* Logs runtime warnings to the console. */
safe.warn = function(message, level, name) {
  var err = new Error(message);
  err.name = name || 'Warning';
  safe.dumpError(err, 'Warning:', level);
};

/* Takes a function and return a new function with a call to it wrapped in a try/catch statement */
safe.protect = function(fn) {
  return fn ? function() {
    try {
      fn.apply(this, arguments);
    } catch (err) {
      safe.dumpError(err);
    }
  } : undefined;
};

/* Wrap event handlers added by Pebble.addEventListener */
var pblAddEventListener = Pebble.addEventListener;
Pebble.addEventListener = function(eventName, eventCallback) {
  pblAddEventListener.call(this, eventName, safe.protect(eventCallback));
};

var pblSendMessage = Pebble.sendAppMessage;
Pebble.sendAppMessage = function(message, success, failure) {
  return pblSendMessage.call(this, message, safe.protect(success), safe.protect(failure));
};

/* Wrap setTimeout and setInterval */
var originalSetTimeout = setTimeout;
window.setTimeout = function(callback, delay) {
  if (safe.warnSetTimeoutNotFunction !== false && typeof callback !== 'function') {
    safe.warn('setTimeout was called with a `' + (typeof callback) + '` type. ' +
              'Did you mean to pass a function?');
    safe.warnSetTimeoutNotFunction = false;
  }
  return originalSetTimeout(safe.protect(callback), delay);
};

var originalSetInterval = setInterval;
window.setInterval = function(callback, delay) {
  if (safe.warnSetIntervalNotFunction !== false && typeof callback !== 'function') {
    safe.warn('setInterval was called with a `' + (typeof callback) + '` type. ' +
              'Did you mean to pass a function?');
    safe.warnSetIntervalNotFunction = false;
  }
  return originalSetInterval(safe.protect(callback), delay);
};

/* Wrap the geolocation API Callbacks */
var watchPosition = navigator.geolocation.watchPosition;
navigator.geolocation.watchPosition = function(success, error, options) {
  return watchPosition.call(this, safe.protect(success), safe.protect(error), options);
};

var getCurrentPosition = navigator.geolocation.getCurrentPosition;
navigator.geolocation.getCurrentPosition = function(success, error, options) {
  return getCurrentPosition.call(this, safe.protect(success), safe.protect(error), options);
};

var ajax;

/* Try to load the ajax library if available and silently fail if it is not found. */
try {
  ajax = require('ajax');
} catch (err) {}

/* Wrap the success and failure callback of the ajax library */
if (ajax) {
  ajax.onHandler = function(eventName, callback) {
    return safe.protect(callback);
  };
}

module.exports = safe;

});
__loader.define("lib/struct.js", 1786, function(exports, module, require) {
/**
 * struct.js - chainable ArrayBuffer DataView wrapper
 *
 * @author Meiguro / http://meiguro.com/
 * @license MIT
 */

var capitalize = function(str) {
  return str.charAt(0).toUpperCase() + str.substr(1);
};

var struct = function(def) {
  this._littleEndian = true;
  this._offset = 0;
  this._cursor = 0;
  this._makeAccessors(def);
  this._view = new DataView(new ArrayBuffer(this._size));
  this._def = def;
};

struct.types = {
  int8: { size: 1 },
  uint8: { size: 1 },
  int16: { size: 2 },
  uint16: { size: 2 },
  int32: { size: 4 },
  uint32: { size: 4 },
  int64: { size: 8 },
  uint64: { size: 8 },
  float32: { size: 2 },
  float64: { size: 4 },
  cstring: { size: 1, dynamic: true },
  data: { size: 0, dynamic: true },
};

var makeDataViewAccessor = function(type, typeName) {
  var getName = 'get' + capitalize(typeName);
  var setName = 'set' + capitalize(typeName);
  type.get = function(offset, little) {
    this._advance = type.size;
    return this._view[getName](offset, little);
  };
  type.set = function(offset, value, little) {
    this._advance = type.size;
    this._view[setName](offset, value, little);
  };
};

for (var k in struct.types) {
  var type = struct.types[k];
  makeDataViewAccessor(type, k);
}

struct.types.bool = struct.types.uint8;

struct.types.uint64.get = function(offset, little) {
  var buffer = this._view;
  var a = buffer.getUint32(offset, little);
  var b = buffer.getUint32(offset + 4, little);
  this._advance = 8;
  return ((little ? b : a) << 32) + (little ? a : b);
};

struct.types.uint64.set = function(offset, value, little) {
  var a = value & 0xFFFFFFFF;
  var b = (value >> 32) & 0xFFFFFFFF;
  var buffer = this._view;
  buffer.setUint32(offset, little ? a : b, little);
  buffer.setUint32(offset + 4, little ? b : a, little);
  this._advance = 8;
};

struct.types.cstring.get = function(offset) {
  var chars = [];
  var buffer = this._view;
  for (var i = offset, ii = buffer.byteLength, j = 0; i < ii && buffer.getUint8(i) !== 0; ++i, ++j) {
    chars[j] = String.fromCharCode(buffer.getUint8(i));
  }
  this._advance = chars.length + 1;
  return decodeURIComponent(escape(chars.join('')));
};

struct.types.cstring.set = function(offset, value) {
  value = unescape(encodeURIComponent(value));
  this._grow(offset + value.length + 1);
  var i = offset;
  var buffer = this._view;
  for (var j = 0, jj = value.length; j < jj && value[i] !== '\0'; ++i, ++j) {
    buffer.setUint8(i, value.charCodeAt(j));
  }
  buffer.setUint8(i, 0);
  this._advance = value.length + 1;
};

struct.types.data.get = function(offset) {
  var length = this._value;
  this._cursor = offset;
  var buffer = this._view;
  var copy = new DataView(new ArrayBuffer(length));
  for (var i = 0; i < length; ++i) {
    copy.setUint8(i, buffer.getUint8(i + offset));
  }
  this._advance = length;
  return copy;
};

struct.types.data.set = function(offset, value) {
  var length = value.byteLength || value.length;
  this._cursor = offset;
  this._grow(offset + length);
  var buffer = this._view;
  if (value instanceof ArrayBuffer) {
    value = new DataView(value);
  }
  for (var i = 0; i < length; ++i) {
    buffer.setUint8(i + offset, value instanceof DataView ? value.getUint8(i) : value[i]);
  }
  this._advance = length;
};

struct.prototype._grow = function(target) {
  var buffer = this._view;
  var size = buffer.byteLength;
  if (target <= size) { return; }
  while (size < target) { size *= 2; }
  var copy = new DataView(new ArrayBuffer(size));
  for (var i = 0; i < buffer.byteLength; ++i) {
    copy.setUint8(i, buffer.getUint8(i));
  }
  this._view = copy;
};

struct.prototype._prevField = function(field) {
  field = field || this._access;
  var fieldIndex = this._fields.indexOf(field);
  return this._fields[fieldIndex - 1];
};

struct.prototype._makeAccessor = function(field) {
  this[field.name] = function(value) {
    var type = field.type;
    
    if (field.dynamic) {
      var prevField = this._prevField(field);
      if (prevField === undefined) {
        this._cursor = 0;
      } else if (this._access === field) {
        this._cursor -= this._advance;
      } else if (this._access !== prevField) {
        throw new Error('dynamic field requires sequential access');
      }
    } else {
      this._cursor = field.index;
    }
    this._access = field;
    var result = this;
    if (arguments.length === 0) {
      result = type.get.call(this, this._offset + this._cursor, this._littleEndian);
      this._value = result;
    } else {
      if (field.transform) {
        value = field.transform(value, field);
      }
      type.set.call(this, this._offset + this._cursor, value, this._littleEndian);
      this._value = value;
    }
    this._cursor += this._advance;
    return result;
  };
  return this;
};

struct.prototype._makeMetaAccessor = function(name, transform) {
  this[name] = function(value, field) {
    transform.call(this, value, field);
    return this;
  };
};

struct.prototype._makeAccessors = function(def, index, fields, prefix) {
  index = index || 0;
  this._fields = ( fields = fields || [] );
  var prevField = fields[fields.length];
  for (var i = 0, ii = def.length; i < ii; ++i) {
    var member = def[i];
    var type = member[0];
    if (typeof type === 'string') {
      type = struct.types[type];
    }
    var name = member[1];
    if (prefix) {
      name = prefix + capitalize(name);
    }
    var transform = member[2];
    if (type instanceof struct) {
      if (transform) {
        this._makeMetaAccessor(name, transform);
      }
      this._makeAccessors(type._def, index, fields, name);
      index = this._size;
      continue;
    }
    var field = {
      index: index,
      type: type,
      name: name,
      transform: transform,
      dynamic: type.dynamic || prevField && prevField.dynamic,
    };
    this._makeAccessor(field);
    fields.push(field);
    index += type.size;
    prevField = field;
  }
  this._size = index;
  return this;
};

struct.prototype.prop = function(def) {
  var fields = this._fields;
  var i = 0, ii = fields.length, name;
  if (arguments.length === 0) {
    var obj = {};
    for (; i < ii; ++i) {
      name = fields[i].name;
      obj[name] = this[name]();
    }
    return obj;
  }
  for (; i < ii; ++i) {
    name = fields[i].name;
    if (name in def) {
      this[name](def[name]);
    }
  }
  return this;
};

struct.prototype.view = function(view) {
  if (arguments.length === 0) {
    return this._view;
  }
  if (view instanceof ArrayBuffer) {
    view = new DataView(view);
  }
  this._view = view;
  return this;
};

struct.prototype.offset = function(offset) {
  if (arguments.length === 0) {
    return this._offset;
  }
  this._offset = offset;
  return this;
};

module.exports = struct;


});
__loader.define("lib/util2.js", 2048, function(exports, module, require) {
/*
 * util2.js by Meiguro - MIT License
 */

var util2 = (function(){

var util2 = {};

util2.noop = function() {};

util2.count = function(o) {
  var i = 0;
  for (var k in o) { ++i; }
  return i;
};

util2.copy = function(a, b) {
  b = b || (a instanceof Array ? [] : {});
  for (var k in a) { b[k] = a[k]; }
  return b;
};

util2.toInteger = function(x) {
  if (!isNaN(x = parseInt(x))) { return x; }
};

util2.toNumber = function(x) {
  if (!isNaN(x = parseFloat(x))) { return x; }
};

util2.toString = function(x) {
  return typeof x === 'object' ? JSON.stringify.apply(this, arguments) : '' + x;
};

util2.toArray = function(x) {
  if (x instanceof Array) { return x; }
  if (x[0]) { return util2.copy(x, []); }
  return [x];
};

util2.trim = function(s) {
  return s ? s.toString().trim() : s;
};

util2.last = function(a) {
  return a[a.length-1];
};

util2.inherit = function(child, parent, proto) {
  child.prototype = Object.create(parent.prototype);
  child.prototype.constructor = child;
  if (proto) {
    util2.copy(proto, child.prototype);
  }
  return child.prototype;
};

var chunkSize = 128;

var randomBytes = function(chunkSize) {
  var z = [];
  for (var i = 0; i < chunkSize; ++i) {
    z[i] = String.fromCharCode(Math.random() * 256);
  }
  return z.join('');
};

util2.randomString = function(regex, size, acc) {
  if (!size) {
    return '';
  }
  if (typeof regex === 'string') {
    regex = new RegExp('(?!'+regex+')[\\s\\S]', 'g');
  }
  acc = acc || '';
  var buf = randomBytes(chunkSize);
  if (buf) {
    acc += buf.replace(regex, '');
  }
  if (acc.length >= size) {
    return acc.substr(0, size);
  } else {
    return util2.randomString(regex, size, acc);
  }
};

var varpat = new RegExp("^([\\s\\S]*?)\\$([_a-zA-Z0-9]+)", "m");

util2.format = function(text, table) {
  var m, z = '';
  while ((m = text.match(varpat))) {
    var subtext = m[0], value = table[m[2]];
    if (typeof value === 'function') { value = value(); }
    z += value !== undefined ? m[1] + value.toString() : subtext;
    text = text.substring(subtext.length);
  }
  z += text;
  return z;
};

if (typeof module !== 'undefined') {
  module.exports = util2;
}

return util2;

})();

});
__loader.define("lib/vector2.js", 2158, function(exports, module, require) {
/**
 * Vector2 from three.js
 * https://github.com/mrdoob/three.js
 *
 * @author mr.doob / http://mrdoob.com/
 * @author philogb / http://blog.thejit.org/
 * @author egraether / http://egraether.com/
 * @author zz85 / http://www.lab4games.net/zz85/blog
 */

/**
 * Create a new vector with given dimensions.
 * @param x
 * @param y
 */
var Vector2 = function ( x, y ) {

  this.x = x || 0;
  this.y = y || 0;

};

Vector2.prototype = {

  constructor: Vector2,

  set: function ( x, y ) {

    this.x = x;
    this.y = y;

    return this;

  },

  copy: function ( v ) {

    this.x = v.x;
    this.y = v.y;

    return this;

  },

  clone: function () {

    return new Vector2( this.x, this.y );

  },

  add: function ( v1, v2 ) {

    this.x = v1.x + v2.x;
    this.y = v1.y + v2.y;

    return this;

  },

  addSelf: function ( v ) {

    this.x += v.x;
    this.y += v.y;

    return this;

  },

  sub: function ( v1, v2 ) {

    this.x = v1.x - v2.x;
    this.y = v1.y - v2.y;

    return this;

  },

  subSelf: function ( v ) {

    this.x -= v.x;
    this.y -= v.y;

    return this;

  },

  multiplyScalar: function ( s ) {

    this.x *= s;
    this.y *= s;

    return this;

  },

  divideScalar: function ( s ) {

    if ( s ) {

      this.x /= s;
      this.y /= s;

    } else {

      this.set( 0, 0 );

    }

    return this;

  },


  negate: function() {

    return this.multiplyScalar( -1 );

  },

  dot: function ( v ) {

    return this.x * v.x + this.y * v.y;

  },

  lengthSq: function () {

    return this.x * this.x + this.y * this.y;

  },

  length: function () {

    return Math.sqrt( this.lengthSq() );

  },

  normalize: function () {

    return this.divideScalar( this.length() );

  },

  distanceTo: function ( v ) {

    return Math.sqrt( this.distanceToSquared( v ) );

  },

  distanceToSquared: function ( v ) {

    var dx = this.x - v.x, dy = this.y - v.y;
    return dx * dx + dy * dy;

  },


  setLength: function ( l ) {

    return this.normalize().multiplyScalar( l );

  },

  equals: function( v ) {

    return ( ( v.x === this.x ) && ( v.y === this.y ) );

  }

};

if (typeof module !== 'undefined') {
  module.exports = Vector2;
}

});
__loader.define("main.js", 2335, function(exports, module, require) {
/*
 * This is the main PebbleJS file. You do not need to modify this file unless
 * you want to change the way PebbleJS starts, the script it runs or the libraries
 * it loads.
 *
 * By default, this will run app.js
 */

require('safe');

Pebble.addEventListener('ready', function(e) {
  // Initialize the Pebble protocol
  require('ui/simply-pebble.js').init();
  // Load local file
  require('app.js');
});

});
__loader.define("platform/feature.js", 2354, function(exports, module, require) {
var Vector2 = require('vector2');
var Platform = require('platform');

var Feature = module.exports;

Feature.platform = function(map, yes, no) {
  var v = map[Platform.version()] || map.unknown;
  var rv;
  if (v && yes !== undefined) {
    rv = typeof yes === 'function' ? yes(v) : yes;
  } else if (!v && no !== undefined) {
    rv = typeof no === 'function' ? no(v) : no;
  }
  return rv !== undefined ? rv : v;
};

Feature.makePlatformTest = function(map) {
  return function(yes, no) {
    return Feature.platform(map, yes, no);
  };
};

Feature.blackAndWhite = Feature.makePlatformTest({
  aplite: true,
  basalt: false,
  chalk: false,
  diorite: true,
  emery: false,
});

Feature.color = Feature.makePlatformTest({
  aplite: false,
  basalt: true,
  chalk: true,
  diorite: false,
  emery: true,
});

Feature.rectangle = Feature.makePlatformTest({
  aplite: true,
  basalt: true,
  chalk: false,
  diorite: true,
  emery: true,
});

Feature.round = Feature.makePlatformTest({
  aplite: false,
  basalt: false,
  chalk: true,
  diorite: false,
  emery: false,
});

Feature.microphone = Feature.makePlatformTest({
  aplite: false,
  basalt: true,
  chalk: true,
  diorite: true,
  emery: true,
});

Feature.resolution = Feature.makePlatformTest({
  aplite: new Vector2(144, 168),
  basalt: new Vector2(144, 168),
  chalk: new Vector2(180, 180),
  diorite: new Vector2(144, 168),
  emery: new Vector2(200, 228),
});

Feature.actionBarWidth = function() {
  return Feature.rectangle(30, 40);
};

Feature.statusBarHeight = function() {
  return 16;
};

});
__loader.define("platform/index.js", 2434, function(exports, module, require) {
var Platform = require('./platform');

module.exports = Platform;

});
__loader.define("platform/platform.js", 2440, function(exports, module, require) {
var Platform = module.exports;

Platform.version = function() {
  if (Pebble.getActiveWatchInfo) {
    return Pebble.getActiveWatchInfo().platform;
  } else {
    return 'aplite';
  }
};

});
__loader.define("settings/index.js", 2452, function(exports, module, require) {
var Settings = require('./settings');

Settings.init();

module.exports = Settings;

});
__loader.define("settings/settings.js", 2460, function(exports, module, require) {
var util2 = require('lib/util2');
var myutil = require('lib/myutil');
var safe = require('lib/safe');
var ajax = require('lib/ajax');
var appinfo = require('appinfo');

var Settings = module.exports;

var parseJson = function(data) {
  try {
    return JSON.parse(data);
  } catch (e) {
    safe.warn('Invalid JSON in localStorage: ' + (e.message || '') + '\n\t' + data);
  }
};

var state;

Settings.settingsUrl = 'http://meiguro.com/simplyjs/settings.html';

Settings.init = function() {
  Settings.reset();

  Settings._loadOptions();
  Settings._loadData();

  // Register listeners for the Settings
  Pebble.addEventListener('showConfiguration', Settings.onOpenConfig);
  Pebble.addEventListener('webviewclosed', Settings.onCloseConfig);
};

Settings.reset = function() {
  state = Settings.state = {
    options: {},
    data: {},
    listeners: [],
    ignoreCancelled: 0,
  };
};

var toHttpUrl = function(url) {
  if (typeof url === 'string' && url.length && !url.match(/^(\w+:)?\/\//)) {
    url = 'http://' + url;
  }
  return url;
};

Settings.mainScriptUrl = function(scriptUrl) {
  scriptUrl = toHttpUrl(scriptUrl);
  if (scriptUrl) {
    localStorage.setItem('mainJsUrl', scriptUrl);
  } else {
    scriptUrl = localStorage.getItem('mainJsUrl');
  }
  return scriptUrl;
};

Settings.getBaseOptions = function() {
  return {
    scriptUrl: Settings.mainScriptUrl(),
  };
};

Settings._getDataKey = function(path, field) {
  path = path || appinfo.uuid;
  return field + ':' + path;
};

Settings._saveData = function(path, field, data) {
  field = field || 'data';
  if (data) {
    state[field] = data;
  } else {
    data = state[field];
  }
  var key = Settings._getDataKey(path, field);
  localStorage.setItem(key, JSON.stringify(data));
};

Settings._loadData = function(path, field, nocache) {
  field = field || 'data';
  state[field] = {};
  var key = Settings._getDataKey(path, field);
  var value = localStorage.getItem(key);
  var data = parseJson(value);
  if (value && typeof data === 'undefined') {
    // There was an issue loading the data, remove it
    localStorage.removeItem(key);
  }
  if (!nocache && typeof data === 'object' && data !== null) {
    state[field] = data;
  }
  return data;
};

Settings._saveOptions = function(path) {
  Settings._saveData(path, 'options');
};

Settings._loadOptions = function(path) {
  Settings._loadData(path, 'options');
};

var makeDataAccessor = function(type, path) {
  return function(field, value) {
    var data = state[type];
    if (arguments.length === 0) {
      return data;
    }
    if (arguments.length === 1 && typeof field !== 'object') {
      return data[field];
    }
    if (typeof field !== 'object' && value === undefined || value === null) {
      delete data[field];
    }
    var def = myutil.toObject(field, value);
    util2.copy(def, data);
    Settings._saveData(path, type);
  };
};

Settings.option = makeDataAccessor('options');

Settings.data = makeDataAccessor('data');

Settings.config = function(opt, open, close) {
  if (typeof opt === 'string') {
    opt = { url: opt };
  }
  opt.url = toHttpUrl(opt.url);
  if (close === undefined) {
    close = open;
    open = util2.noop;
  }
  var listener = {
    params: opt,
    open: open,
    close: close,
  };
  state.listeners.push(listener);
};

Settings.onOpenConfig = function(e) {
  var options;
  var url;
  var listener = util2.last(state.listeners);
  if (listener) {
    e = {
      originalEvent: e,
      options: state.options,
      url: listener.params.url,
    };
    var result;
    if (listener.open) {
      result = listener.open(e);
      if (result === false) {
        return;
      }
    }
    url = typeof result === 'string' ? result : listener.params.url;
    options = state.options;
  } else {
    url = Settings.settingsUrl;
    options = Settings.getBaseOptions();
    return;
  }
  if (listener.params.hash !== false) {
    url += '#' + encodeURIComponent(JSON.stringify(options));
  }
  Pebble.openURL(url);
};

Settings.onCloseConfig = function(e) {
  // Work around for PebbleKit JS Android
  // On Android, an extra cancelled event occurs after a normal close
  if (e.response !== 'CANCELLED') {
    state.ignoreCancelled++;
  } else if (state.ignoreCancelled > 0) {
    state.ignoreCancelled--;
    return;
  }
  var listener = util2.last(state.listeners);
  var options = {};
  var format;
  if (e.response) {
    options = parseJson(decodeURIComponent(e.response));
    if (typeof options === 'object' && options !== null) {
      format = 'json';
    }
    if (!format && e.response.match(/(&|=)/)) {
      options = ajax.deformify(e.response);
      if (util2.count(options) > 0) {
        format = 'form';
      }
    }
  }
  if (listener) {
    e = {
      originalEvent: e,
      response: e.response,
      originalOptions: state.options,
      options: options,
      url: listener.params.url,
      failed: !format,
      format: format,
    };
    if (format && listener.params.autoSave !== false) {
      e.originalOptions = util2.copy(state.options);
      util2.copy(options, state.options);
      Settings._saveOptions();
    }
    if (listener.close) {
      return listener.close(e);
    }
  }
};

});
__loader.define("simply/simply.js", 2679, function(exports, module, require) {
/**
 * Simply.js
 *
 * Provides the classic "SimplyJS" API on top of PebbleJS.
 *
 * Not to be confused with ui/Simply which abstracts the implementation used
 * to interface with the underlying hardware.
 *
 * @namespace simply
 */

var WindowStack = require('ui/windowstack');
var Card = require('ui/card');
var Vibe = require('ui/vibe');

var simply = {};

simply.text = function(textDef) {
  var wind = WindowStack.top();
  if (!wind || !(wind instanceof Card)) {
    wind = new Card(textDef);
    wind.show();
  } else {
    wind.prop(textDef, true);
  }
};

/**
 * Vibrates the Pebble.
 * There are three support vibe types: short, long, and double.
 * @memberOf simply
 * @param {string} [type=short] - The vibe type.
 */
simply.vibe = function(type) {
  return Vibe.vibrate(type);
};

module.exports = simply;

});
__loader.define("smartpackage/package-pebble.js", 2720, function(exports, module, require) {
var myutil = require('myutil');
var package = require('smartpackage/package');
var simply = require('simply/simply');

var packageImpl = module.exports;

var getExecPackage = function(execname) {
  var packages = package.packages;
  for (var path in packages) {
    var pkg = packages[path];
    if (pkg && pkg.execname === execname) {
      return path;
    }
  }
};

var getExceptionFile = function(e, level) {
  var stack = e.stack.split('\n');
  for (var i = level || 0, ii = stack.length; i < ii; ++i) {
    var line = stack[i];
    if (line.match(/^\$\d/)) {
      var path = getExecPackage(line);
      if (path) {
        return path;
      }
    }
  }
  return stack[level];
};

var getExceptionScope = function(e, level) {
  var stack = e.stack.split('\n');
  for (var i = level || 0, ii = stack.length; i < ii; ++i) {
    var line = stack[i];
    if (!line || line.match('native code')) { continue; }
    return line.match(/^\$\d/) && getExecPackage(line) || line;
  }
  return stack[level];
};

var setHandlerPath = function(handler, path, level) {
  var level0 = 4; // caller -> wrap -> apply -> wrap -> set
  handler.path = path ||
      getExceptionScope(new Error(), (level || 0) + level0) ||
      package.basename(package.module.filename);
  return handler;
};

var papply = packageImpl.papply = function(f, args, path) {
  try {
    return f.apply(this, args);
  } catch (e) {
    var scope = package.name(!path && getExceptionFile(e) || getExecPackage(path) || path);
    console.log(scope + ':' + e.line + ': ' + e + '\n' + e.stack);
    simply.text({
      subtitle: scope,
      body: e.line + ' ' + e.message,
    }, true);
  }
};

var protect = packageImpl.protect = function(f, path) {
  return function() {
    return papply(f, arguments, path);
  };
};

packageImpl.wrapHandler = function(handler, level) {
  if (!handler) { return; }
  setHandlerPath(handler, null, level || 1);
  var pkg = package.packages[handler.path];
  if (pkg) {
    return protect(pkg.fwrap(handler), handler.path);
  } else {
    return protect(handler, handler.path);
  }
};

var toSafeName = function(name) {
  name = name.replace(/[^0-9A-Za-z_$]/g, '_');
  if (name.match(/^[0-9]/)) {
    name = '_' + name;
  }
  return name;
};

var nextId = 1;

packageImpl.loadPackage = function(pkg, loader) {
  pkg.execname = toSafeName(pkg.name) + '$' + nextId++;
  pkg.fapply = myutil.defun(pkg.execname, ['f', 'args'],
    'return f.apply(this, args)'
  );
  pkg.fwrap = function(f) {
    return function() {
      return pkg.fapply(f, arguments);
    };
  };
  return papply(loader, null, pkg.name);
};


});
__loader.define("smartpackage/package.js", 2824, function(exports, module, require) {
var ajax = require('ajax');
var util2 = require('util2');
var myutil = require('myutil');
var Settings = require('settings/settings');
var simply = require('simply');

var package = module.exports;

package.packages = {};

package.basepath = function(path) {
  return path.replace(/[^\/]*$/, '');
};

package.basename = function(path) {
  return path.match(/[^\/]*$/)[0];
};

/**
 * Converts a relative path to an absolute path
 * using the path of the currently running script
 * (package.module) or optionaly, the given root.
 *
 * The first argument is optional:
 *   abspath(path);
 *   abspath(root, path);
 */
package.abspath = function(root, path) {
  // Handle optional first argument
  if (!path) {
    path = root;
    root = null;
  }
  // Use the package root if no root provided.
  if (!root && package.module) {
    root = package.basepath(package.module.filename);
  }
  return myutil.abspath(root, path);
};


package.name = function(rootfile, path) {
  if (!path) {
    path = rootfile;
    rootfile = null;
  }
  if (!rootfile && package.module) {
    rootfile = package.basepath(package.module.filename);
  }
  var name = path;
  if (typeof name === 'string') {
    name = name.replace(package.basepath(rootfile), '');
  }
  return name || package.basename(rootfile);
};

package.get = function(root, path) {
  return package.packages[package.abspath(root, path)];
};

package.make = function(path) {
  var pkg = package.packages[path];
  if (pkg) { return; }
  pkg = package.packages[path] = {
    name: package.basename(path),
    savename: 'script:' + path,
    filename: path
  };
  return pkg;
};

package.loader = function(pkg, script) {
  // console shim
  var console2 = util2.copy(console);

  console2.log = function() {
    var msg = pkg.name + ': ' + myutil.slog.apply(this, arguments);
    var width = 45;
    var prefix = (new Array(width + 1)).join('\b'); // erase source line
    var suffix = msg.length < width ? (new Array(width - msg.length + 1)).join(' ') : 0;
    console.log(prefix + msg + suffix);
  };

  // loader
  return function() {
    var exports = pkg.exports;
    var result = myutil.defun(pkg.execName,
      ['module', 'require', 'console', 'Pebble'], script)
      (pkg, package.require, console2, Pebble);

    // backwards compatibility for return-style modules
    if (pkg.exports === exports && result) {
      pkg.exports = result;
    }

    return pkg.exports;
  };
};

package.loadScript = function(url, async) {
  console.log('loading: ' + url);

  var pkg = package.make(url);

  if (!package.module) {
    package.module = pkg;
  }

  pkg.exports = {};

  var loader = util2.noop;
  var makeLoader = function(script) {
    return package.loader(pkg, script);
  };

  ajax({ url: url, cache: false, async: async },
    function(data) {
      if (data && data.length) {
        localStorage.setItem(pkg.savename, data);
        loader = makeLoader(data);
      }
    },
    function(data, status) {
      data = localStorage.getItem(pkg.savename);
      if (data && data.length) {
        console.log(status + ': failed, loading saved script instead');
        loader = makeLoader(data);
      }
    }
  );

  return package.impl.loadPackage(pkg, loader);
};

package.loadMainScript = function(scriptUrl) {
  simply.reset();

  scriptUrl = Settings.mainScriptUrl(scriptUrl);
  if (!scriptUrl) { return; }

  Settings.loadOptions(scriptUrl);

  try {
    package.loadScript(scriptUrl, false);
  } catch (e) {
    simply.text({
      title: 'Failed to load',
      body: scriptUrl,
    }, true);
    return;
  }
};

/**
 * Loads external dependencies, allowing you to write a multi-file project.
 * Package loading loosely follows the CommonJS format.
 * Exporting is possible by modifying or setting module.exports within the required file.
 * The module path is also available as module.path.
 * This currently only supports a relative path to another JavaScript file.
 * @global
 * @param {string} path - The path to the dependency.
 */

package.require = function(path) {
  if (!path.match(/\.js$/)) {
    path += '.js';
  }
  var pkg = package.get(path);
  if (pkg) {
    return pkg.exports;
  }
  path = package.abspath(path);
  return package.loadScript(path, false);
};

});
__loader.define("timeline/index.js", 3001, function(exports, module, require) {
var Timeline = require('./timeline');

Timeline.init();

module.exports = Timeline;

});
__loader.define("timeline/timeline.js", 3009, function(exports, module, require) {
var Timeline = module.exports;

Timeline.init = function() {
  this._launchCallbacks = [];
};

Timeline.launch = function(callback) {
  if (this._launchEvent) {
    callback(this._launchEvent);
  } else {
    this._launchCallbacks.push(callback);
  }
};

Timeline.emitAction = function(args) {
  var e;
  if (args !== undefined) {
    e = {
      action: true,
      launchCode: args,
    };
  } else {
    e = {
      action: false,
    };
  }

  this._launchEvent = e;

  var callbacks = this._launchCallbacks;
  this._launchCallbacks = [];
  for (var i = 0, ii = callbacks.length; i < ii; ++i) {
    if (callbacks[i](e) === false) {
      return false;
    }
  }
};

});
__loader.define("ui/accel.js", 3049, function(exports, module, require) {
var Emitter = require('emitter');

var Accel = new Emitter();

module.exports = Accel;

var WindowStack = require('ui/windowstack');
var Window = require('ui/window');
var simply = require('ui/simply');

var state;

Accel.init = function() {
  if (state) {
    Accel.off();
  }

  state = Accel.state = {
    rate: 100,
    samples: 25,
    subscribe: false,
    subscribeMode: 'auto',
    listeners: [],
  };
};

Accel.onAddHandler = function(type, subtype) {
  if (type === 'data') {
    Accel.autoSubscribe();
  }
};

Accel.onRemoveHandler = function(type, subtype) {
  if (!type || type === 'accelData') {
    Accel.autoSubscribe();
  }
};

var accelDataListenerCount = function() {
  var count = Accel.listenerCount('data');
  var wind = WindowStack.top();
  if (wind) {
    count += wind.listenerCount('accelData');
  }
  return count;
};

Accel.autoSubscribe = function() {
  if (state.subscribeMode !== 'auto') { return; }
  var subscribe = (accelDataListenerCount() > 0);
  if (subscribe !== state.subscribe) {
    return Accel.config(subscribe, true);
  }
};

/**
 * The accelerometer configuration parameter for {@link simply.accelConfig}.
 * The accelerometer data stream is useful for applications such as gesture recognition when accelTap is too limited.
 * However, keep in mind that smaller batch sample sizes and faster rates will drastically impact the battery life of both the Pebble and phone because of the taxing use of the processors and Bluetooth modules.
 * @typedef {object} simply.accelConf
 * @property {number} [rate] - The rate accelerometer data points are generated in hertz. Valid values are 10, 25, 50, and 100. Initializes as 100.
 * @property {number} [samples] - The number of accelerometer data points to accumulate in a batch before calling the event handler. Valid values are 1 to 25 inclusive. Initializes as 25.
 * @property {boolean} [subscribe] - Whether to subscribe to accelerometer data events. {@link simply.accelPeek} cannot be used when subscribed. Simply.js will automatically (un)subscribe for you depending on the amount of accelData handlers registered.
 */

/**
 * Changes the accelerometer configuration.
 * See {@link simply.accelConfig}
 * @memberOf simply
 * @param {simply.accelConfig} accelConf - An object defining the accelerometer configuration.
 */
Accel.config = function(opt, auto) {
  if (arguments.length === 0) {
    return {
      rate: state.rate,
      samples: state.samples,
      subscribe: state.subscribe,
    };
  } else if (typeof opt === 'boolean') {
    opt = { subscribe: opt };
  }
  for (var k in opt) {
    if (k === 'subscribe') {
      state.subscribeMode = opt[k] && !auto ? 'manual' : 'auto';
    }
    state[k] = opt[k];
  }
  return simply.impl.accelConfig(Accel.config());
};

/**
 * Peeks at the current accelerometer values.
 * @memberOf simply
 * @param {simply.eventHandler} callback - A callback function that will be provided the accel data point as an event.
 */
Accel.peek = function(callback) {
  if (state.subscribe) {
    throw new Error('Cannot use accelPeek when listening to accelData events');
  }
  return simply.impl.accelPeek.apply(this, arguments);
};

/**
 * Simply.js accel tap event.
 * Use the event type 'accelTap' to subscribe to these events.
 * @typedef simply.accelTapEvent
 * @property {string} axis - The axis the tap event occurred on: 'x', 'y', or 'z'. This is also the event subtype.
 * @property {number} direction - The direction of the tap along the axis: 1 or -1.
 */

Accel.emitAccelTap = function(axis, direction) {
  var e = {
    axis: axis,
    direction: direction,
  };
  if (Window.emit('accelTap', axis, e) === false) {
    return false;
  }
  Accel.emit('tap', axis, e);
};

/**
 * Simply.js accel data point.
 * Typical values for gravity is around -1000 on the z axis.
 * @typedef simply.accelPoint
 * @property {number} x - The acceleration across the x-axis.
 * @property {number} y - The acceleration across the y-axis.
 * @property {number} z - The acceleration across the z-axis.
 * @property {boolean} vibe - Whether the watch was vibrating when measuring this point.
 * @property {number} time - The amount of ticks in millisecond resolution when measuring this point.
 */

/**
 * Simply.js accel data event.
 * Use the event type 'accelData' to subscribe to these events.
 * @typedef simply.accelDataEvent
 * @property {number} samples - The number of accelerometer samples in this event.
 * @property {simply.accelPoint} accel - The first accel in the batch. This is provided for convenience.
 * @property {simply.accelPoint[]} accels - The accelerometer samples in an array.
 */

Accel.emitAccelData = function(accels, callback) {
  var e = {
    samples: accels.length,
    accel: accels[0],
    accels: accels,
  };
  if (callback) {
    return callback(e);
  }
  if (Window.emit('accelData', null, e) === false) {
    return false;
  }
  Accel.emit('data', e);
};

Accel.init();

});
__loader.define("ui/card.js", 3209, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');
var Emitter = require('emitter');
var WindowStack = require('ui/windowstack');
var Propable = require('ui/propable');
var Window = require('ui/window');
var simply = require('ui/simply');

var textProps = [
  'title',
  'subtitle',
  'body',
];

var textColorProps = [
  'titleColor',
  'subtitleColor',
  'bodyColor',
];

var imageProps = [
  'icon',
  'subicon',
  'banner',
];

var actionProps = [
  'up',
  'select',
  'back',
];

var configProps = [
  'style',
  'backgroundColor'
];

var accessorProps = textProps.concat(textColorProps).concat(imageProps).concat(configProps);
var clearableProps = textProps.concat(imageProps);

var defaults = {
  status: true,
  backgroundColor: 'white',
};

var Card = function(cardDef) {
  Window.call(this, myutil.shadow(defaults, cardDef || {}));
  this._dynamic = false;
};

Card._codeName = 'card';

util2.inherit(Card, Window);

util2.copy(Emitter.prototype, Card.prototype);

Propable.makeAccessors(accessorProps, Card.prototype);

Card.prototype._prop = function() {
  if (this === WindowStack.top()) {
    simply.impl.card.apply(this, arguments);
  }
};

Card.prototype._clear = function(flags_) {
  var flags = myutil.toFlags(flags_);
  if (flags === true) {
    clearableProps.forEach(Propable.unset.bind(this.state));
  }
  Window.prototype._clear.call(this, flags_);
};

module.exports = Card;

});
__loader.define("ui/circle.js", 3285, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');
var Propable = require('ui/propable');
var StageElement = require('ui/element');

var accessorProps = [
  'radius',
];

var defaults = {
  backgroundColor: 'white',
  borderColor: 'clear',
  borderWidth: 1,
};

var Circle = function(elementDef) {
  StageElement.call(this, myutil.shadow(defaults, elementDef || {}));
  this.state.type = StageElement.CircleType;
};

util2.inherit(Circle, StageElement);

Propable.makeAccessors(accessorProps, Circle.prototype);

module.exports = Circle;

});
__loader.define("ui/element.js", 3313, function(exports, module, require) {
var util2 = require('util2');
var Vector2 = require('vector2');
var myutil = require('myutil');
var WindowStack = require('ui/windowstack');
var Propable = require('ui/propable');
var simply = require('ui/simply');

var elementProps = [
  'position',
  'size',
  'backgroundColor',
  'borderColor',
  'borderWidth',
];

var accessorProps = elementProps;

var nextId = 1;

var StageElement = function(elementDef) {
  this.state = elementDef || {};
  this.state.id = nextId++;
  if (!this.state.position) {
    this.state.position = new Vector2();
  }
  if (!this.state.size) {
    this.state.size = new Vector2();
  }
  this._queue = [];
};

var Types = [
  'NoneType',
  'RectType',
  'LineType',
  'CircleType',
  'RadialType',
  'TextType',
  'ImageType',
  'InverterType',
];

Types.forEach(function(name, index) {
  StageElement[name] = index;
});

util2.copy(Propable.prototype, StageElement.prototype);

Propable.makeAccessors(accessorProps, StageElement.prototype);

StageElement.prototype._reset = function() {
  this._queue = [];
};

StageElement.prototype._id = function() {
  return this.state.id;
};

StageElement.prototype._type = function() {
  return this.state.type;
};

StageElement.prototype._prop = function(elementDef) {
  if (this.parent === WindowStack.top()) {
    simply.impl.stageElement(this._id(), this._type(), this.state);
  }
};

StageElement.prototype.index = function() {
  if (!this.parent) { return -1; }
  return this.parent.index(this);
};

StageElement.prototype.remove = function(broadcast) {
  if (!this.parent) { return this; }
  this.parent.remove(this, broadcast);
  return this;
};

StageElement.prototype._animate = function(animateDef, duration) {
  if (this.parent === WindowStack.top()) {
    simply.impl.stageAnimate(this._id(), this.state,
        animateDef, duration || 400, animateDef.easing || 'easeInOut');
  }
};

StageElement.prototype.animate = function(field, value, duration) {
  if (typeof field === 'object') {
    duration = value;
  }
  var animateDef = myutil.toObject(field, value);
  this.queue(function() {
    this._animate(animateDef, duration);
    util2.copy(animateDef, this.state);
  });
  if (!this.state.animating) {
    this.dequeue();
  }
  return this;
};

StageElement.prototype.queue = function(callback) {
  this._queue.push(callback);
};

StageElement.prototype.dequeue = function() {
  var callback = this._queue.shift();
  if (callback) {
    this.state.animating = true;
    callback.call(this, this.dequeue.bind(this));
  } else {
    this.state.animating = false;
  }
};

StageElement.emitAnimateDone = function(id) {
  var wind = WindowStack.top();
  if (!wind || !wind._dynamic) { return; }
  wind.each(function(element) {
    if (element._id() === id) {
      element.dequeue();
      return false;
    }
  });
};

module.exports = StageElement;

});
__loader.define("ui/image.js", 3443, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');
var Propable = require('ui/propable');
var StageElement = require('ui/element');

var imageProps = [
  'image',
  'compositing',
];

var defaults = {
  backgroundColor: 'clear',
  borderColor: 'clear',
  borderWidth: 1,
};

var ImageElement = function(elementDef) {
  StageElement.call(this, myutil.shadow(defaults, elementDef || {}));
  this.state.type = StageElement.ImageType;
};

util2.inherit(ImageElement, StageElement);

Propable.makeAccessors(imageProps, ImageElement.prototype);

module.exports = ImageElement;

});
__loader.define("ui/imageservice.js", 3472, function(exports, module, require) {
var imagelib = require('lib/image');
var myutil = require('myutil');
var Feature = require('platform/feature');
var Resource = require('ui/resource');
var simply = require('ui/simply');

var ImageService = module.exports;

var state;

ImageService.init = function() {
  state = ImageService.state = {
    cache: {},
    nextId: Resource.items.length + 1,
    rootUrl: undefined,
  };
};

var makeImageHash = function(image) {
  var url = image.url;
  var hashPart = '';
  if (image.width) {
    hashPart += ',width:' + image.width;
  }
  if (image.height) {
    hashPart += ',height:' + image.height;
  }
  if (image.dither) {
    hashPart += ',dither:' + image.dither;
  }
  if (hashPart) {
    url += '#' + hashPart.substr(1);
  }
  return url;
};

var parseImageHash = function(hash) {
  var image = {};
  hash = hash.split('#');
  image.url = hash[0];
  hash = hash[1];
  if (!hash) { return image; }
  var args = hash.split(',');
  for (var i = 0, ii = args.length; i < ii; ++i) {
    var arg = args[i];
    if (arg.match(':')) {
      arg = arg.split(':');
      var v = arg[1];
      image[arg[0]] = !isNaN(Number(v)) ? Number(v) : v;
    } else {
      image[arg] = true;
    }
  }
  return image;
};

ImageService.load = function(opt, reset, callback) {
  if (typeof opt === 'string') {
    opt = parseImageHash(opt);
  }
  if (typeof reset === 'function') {
    callback = reset;
    reset = null;
  }
  var url = myutil.abspath(state.rootUrl, opt.url);
  var hash = makeImageHash(opt);
  var image = state.cache[hash];
  var fetch = false;
  if (image) {
    if ((opt.width && image.width !== opt.width) ||
        (opt.height && image.height !== opt.height) ||
        (opt.dither && image.dither !== opt.dither)) {
      reset = true;
    }
    if (reset !== true && image.loaded) {
      return image.id;
    }
  }
  if (!image || reset === true) {
    fetch = true;
    image = {
      id: state.nextId++,
      url: url,
    };
  }
  image.width = opt.width;
  image.height = opt.height;
  image.dither =  opt.dither;
  image.loaded = true;
  state.cache[hash] = image;
  var onLoad = function() {
    simply.impl.image(image.id, image.image);
    if (callback) {
      var e = {
        type: 'image',
        image: image.id,
        url: image.url,
      };
      callback(e);
    }
  };
  if (fetch) {
    var bitdepth = Feature.color(8, 1);
    imagelib.load(image, bitdepth, onLoad);
  } else {
    onLoad();
  }
  return image.id;
};

ImageService.setRootUrl = function(url) {
  state.rootUrl = url;
};

/**
 * Resolve an image path to an id. If the image is defined in appinfo, the index of the resource is used,
 * otherwise a new id is generated for dynamic loading.
 */
ImageService.resolve = function(opt) {
  var id = Resource.getId(opt);
  return typeof id !== 'undefined' ? id : ImageService.load(opt);
};

ImageService.markAllUnloaded = function() {
  for (var k in state.cache) {
    delete state.cache[k].loaded;
  }
};

ImageService.init();

});
__loader.define("ui/index.js", 3605, function(exports, module, require) {
var UI = {};

UI.Vector2 = require('vector2');
UI.Window = require('ui/window');
UI.Card = require('ui/card');
UI.Menu = require('ui/menu');
UI.Rect = require('ui/rect');
UI.Line = require('ui/line');
UI.Circle = require('ui/circle');
UI.Radial = require('ui/radial');
UI.Text = require('ui/text');
UI.TimeText = require('ui/timetext');
UI.Image = require('ui/image');
UI.Inverter = require('ui/inverter');
UI.Vibe = require('ui/vibe');
UI.Light = require('ui/light');

module.exports = UI;

});
__loader.define("ui/inverter.js", 3626, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');
var StageElement = require('ui/element');

var Inverter = function(elementDef) {
  StageElement.call(this, elementDef);
  this.state.type = StageElement.InverterType;
};

util2.inherit(Inverter, StageElement);

module.exports = Inverter;

});
__loader.define("ui/light.js", 3641, function(exports, module, require) {
var simply = require('ui/simply');

var Light = module.exports;

Light.on = function() {
  simply.impl.light('on');
};

Light.auto = function() {
  simply.impl.light('auto');
};

Light.trigger = function() {
  simply.impl.light('trigger');
};

});
__loader.define("ui/line.js", 3659, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');
var Propable = require('ui/propable');
var StageElement = require('ui/element');

var accessorProps = [
  'strokeColor',
  'strokeWidth',
  'position2',
];

var defaults = {
  strokeColor: 'white',
  strokeWidth: 1,
};

var Line = function(elementDef) {
  StageElement.call(this, myutil.shadow(defaults, elementDef || {}));
  this.state.type = StageElement.LineType;
};

util2.inherit(Line, StageElement);

Propable.makeAccessors(accessorProps, Line.prototype);

module.exports = Line;

});
__loader.define("ui/menu.js", 3688, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');
var Emitter = require('emitter');
var Platform = require('platform');
var WindowStack = require('ui/windowstack');
var Window = require('ui/window');
var simply = require('ui/simply');

var defaults = {
  status: true,
  backgroundColor: 'white',
  textColor: 'black',
  highlightBackgroundColor: 'black',
  highlightTextColor: 'white',
};

var Menu = function(menuDef) {
  Window.call(this, myutil.shadow(defaults, menuDef || {}));
  this._dynamic = false;
  this._sections = {};
  this._selection = { sectionIndex: 0, itemIndex: 0 };
  this._selections = [];
};

Menu._codeName = 'menu';

util2.inherit(Menu, Window);

util2.copy(Emitter.prototype, Menu.prototype);

Menu.prototype._show = function() {
  Window.prototype._show.apply(this, arguments);
  this._select();
};

Menu.prototype._select = function() {
  if (this === WindowStack.top()) {
    var select = this._selection;
    simply.impl.menuSelection(select.sectionIndex, select.itemIndex);
  }
};

Menu.prototype._numPreloadItems = (Platform.version() === 'aplite' ? 5 : 50);

Menu.prototype._prop = function(state, clear, pushing) {
  if (this === WindowStack.top()) {
    this._resolveMenu(clear, pushing);
    this._resolveSection(this._selection);
  }
};

Menu.prototype.action = function() {
  throw new Error("Menus don't support action bars.");
};

Menu.prototype.buttonConfig = function() {
  throw new Error("Menus don't support changing button configurations.");
};

Menu.prototype._buttonAutoConfig = function() {};

Menu.prototype._getMetaSection = function(sectionIndex) {
  return (this._sections[sectionIndex] || ( this._sections[sectionIndex] = {} ));
};

Menu.prototype._getSections = function() {
  var sections = this.state.sections;
  if (sections instanceof Array) {
    return sections;
  }
  if (typeof sections === 'number') {
    sections = new Array(sections);
    return (this.state.sections = sections);
  }
  if (typeof sections === 'function') {
    this.sectionsProvider = this.state.sections;
    delete this.state.sections;
  }
  if (this.sectionsProvider) {
    sections = this.sectionsProvider.call(this);
    if (sections) {
      this.state.sections = sections;
      return this._getSections();
    }
  }
  return (this.state.sections = []);
};

Menu.prototype._getSection = function(e, create) {
  var sections = this._getSections();
  var section = sections[e.sectionIndex];
  if (section) {
    return section;
  }
  if (this.sectionProvider) {
    section = this.sectionProvider.call(this, e);
    if (section) {
      return (sections[e.sectionIndex] = section);
    }
  }
  if (!create) { return; }
  return (sections[e.sectionIndex] = {});
};

Menu.prototype._getItems = function(e, create) {
  var section = this._getSection(e, create);
  if (!section) {
    if (e.sectionIndex > 0) { return; }
    section = this.state.sections[0] = {};
  }
  if (section.items instanceof Array) {
    return section.items;
  }
  if (typeof section.items === 'number') {
    return (section.items = new Array(section.items));
  }
  if (typeof section.items === 'function') {
    this._sections[e.sectionIndex] = section.items;
    delete section.items;
  }
  var itemsProvider = this._getMetaSection(e.sectionIndex).items || this.itemsProvider;
  if (itemsProvider) {
    var items = itemsProvider.call(this, e);
    if (items) {
      section.items = items;
      return this._getItems(e, create);
    }
  }
  return (section.items = []);
};

Menu.prototype._getItem = function(e, create) {
  var items = this._getItems(e, create);
  var item = items[e.itemIndex];
  if (item) {
    return item;
  }
  var itemProvider = this._getMetaSection(e.sectionIndex).item || this.itemProvider;
  if (itemProvider) {
    item = itemProvider.call(this, e);
    if (item) {
      return (items[e.itemIndex] = item);
    }
  }
  if (!create) { return; }
  return (items[e.itemIndex] = {});
};

Menu.prototype._resolveMenu = function(clear, pushing) {
  var sections = this._getSections(this);
  if (this === WindowStack.top()) {
    simply.impl.menu(this.state, clear, pushing);
    return true;
  }
};

Menu.prototype._resolveSection = function(e, clear) {
  var section = this._getSection(e);
  if (!section) { return; }
  section = myutil.shadow({
    textColor: this.state.textColor, 
    backgroundColor: this.state.backgroundColor
  }, section);
  section.items = this._getItems(e);
  if (this === WindowStack.top()) {
    simply.impl.menuSection.call(this, e.sectionIndex, section, clear);
    var select = this._selection;
    if (select.sectionIndex === e.sectionIndex) {
      this._preloadItems(select);
    }
    return true;
  }
};

Menu.prototype._resolveItem = function(e) {
  var item = this._getItem(e);
  if (!item) { return; }
  if (this === WindowStack.top()) {
    simply.impl.menuItem.call(this, e.sectionIndex, e.itemIndex, item);
    return true;
  }
};

Menu.prototype._preloadItems = function(e) {
  var select = util2.copy(e);
  select.itemIndex = Math.max(0, select.itemIndex - Math.floor(this._numPreloadItems / 2));
  for (var i = 0; i < this._numPreloadItems; ++i) {
    this._resolveItem(select);
    select.itemIndex++;
  }
};

Menu.prototype._emitSelect = function(e) {
  this._selection = e;
  var item = this._getItem(e);
  switch (e.type) {
    case 'select':
      if (item && typeof item.select === 'function') {
        if (item.select(e) === false) {
          return false;
        }
      }
      break;
    case 'longSelect':
      if (item && typeof item.longSelect === 'function') {
        if (item.longSelect(e) === false) {
          return false;
        }
      }
      break;
    case 'selection':
      var handlers = this._selections;
      this._selections = [];
      if (item && typeof item.selected === 'function') {
        if (item.selected(e) === false) {
          return false;
        }
      }
      for (var i = 0, ii = handlers.length; i < ii; ++i) {
        if (handlers[i](e) === false) {
          break;
        }
      }
      break;
  }
};

Menu.prototype.sections = function(sections) {
  if (typeof sections === 'function') {
    delete this.state.sections;
    this.sectionsProvider = sections;
    this._resolveMenu();
    return this;
  }
  this.state.sections = sections;
  this._resolveMenu();
  return this;
};

Menu.prototype.section = function(sectionIndex, section) {
  if (typeof sectionIndex === 'object') {
    sectionIndex = sectionIndex.sectionIndex || 0;
  } else if (typeof sectionIndex === 'function') {
    this.sectionProvider = sectionIndex;
    return this;
  }
  var menuIndex = { sectionIndex: sectionIndex };
  if (!section) {
    return this._getSection(menuIndex);
  }
  var sections = this._getSections();
  var prevLength = sections.length;
  sections[sectionIndex] = util2.copy(section, sections[sectionIndex]);
  if (sections.length !== prevLength) {
    this._resolveMenu();
  }
  this._resolveSection(menuIndex, typeof section.items !== 'undefined');
  return this;
};

Menu.prototype.items = function(sectionIndex, items) {
  if (typeof sectionIndex === 'object') {
    sectionIndex = sectionIndex.sectionIndex || 0;
  } else if (typeof sectionIndex === 'function') {
    this.itemsProvider = sectionIndex;
    return this;
  }
  if (typeof items === 'function') {
    this._getMetaSection(sectionIndex).items = items;
    return this;
  }
  var menuIndex = { sectionIndex: sectionIndex };
  if (!items) {
    return this._getItems(menuIndex);
  }
  var section = this._getSection(menuIndex, true);
  section.items = items;
  this._resolveSection(menuIndex, true);
  return this;
};

Menu.prototype.item = function(sectionIndex, itemIndex, item) {
  if (typeof sectionIndex === 'object') {
    item = itemIndex || item;
    itemIndex = sectionIndex.itemIndex;
    sectionIndex = sectionIndex.sectionIndex || 0;
  } else if (typeof sectionIndex === 'function') {
    this.itemProvider = sectionIndex;
    return this;
  }
  if (typeof itemIndex === 'function') {
    item = itemIndex;
    itemIndex = null;
  }
  if (typeof item === 'function') {
    this._getMetaSection(sectionIndex).item = item;
    return this;
  }
  var menuIndex = { sectionIndex: sectionIndex, itemIndex: itemIndex };
  if (!item) {
    return this._getItem(menuIndex);
  }
  var items = this._getItems(menuIndex, true);
  var prevLength = items.length;
  items[itemIndex] = util2.copy(item, items[itemIndex]);
  if (items.length !== prevLength) {
    this._resolveSection(menuIndex);
  }
  this._resolveItem(menuIndex);
  return this;
};

Menu.prototype.selection = function(sectionIndex, itemIndex) {
  var callback;
  if (typeof sectionIndex === 'function') {
    callback = sectionIndex;
    sectionIndex = undefined;
  }
  if (callback) {
    this._selections.push(callback);
    simply.impl.menuSelection();
  } else {
    this._selection = {
      sectionIndex: sectionIndex,
      itemIndex: itemIndex,
    };
    this._select();
  }
};

Menu.emit = Window.emit;

Menu.emitSection = function(sectionIndex) {
  var menu = WindowStack.top();
  if (!(menu instanceof Menu)) { return; }
  var e = {
    menu: menu,
    sectionIndex: sectionIndex
  };
  e.section = menu._getSection(e);
  if (Menu.emit('section', null, e) === false) {
    return false;
  }
  menu._resolveSection(e);
};

Menu.emitItem = function(sectionIndex, itemIndex) {
  var menu = WindowStack.top();
  if (!(menu instanceof Menu)) { return; }
  var e = {
    menu: menu,
    sectionIndex: sectionIndex,
    itemIndex: itemIndex,
  };
  e.section = menu._getSection(e);
  e.item = menu._getItem(e);
  if (Menu.emit('item', null, e) === false) {
    return false;
  }
  menu._resolveItem(e);
};

Menu.emitSelect = function(type, sectionIndex, itemIndex) {
  var menu = WindowStack.top();
  if (!(menu instanceof Menu)) { return; }
  var e = {
    menu: menu,
    sectionIndex: sectionIndex,
    itemIndex: itemIndex,
  };
  e.section = menu._getSection(e);
  e.item = menu._getItem(e);
  switch (type) {
    case 'menuSelect': type = 'select'; break;
    case 'menuLongSelect': type = 'longSelect'; break;
    case 'menuSelection': type = 'selection'; break;
  }
  if (Menu.emit(type, null, e) === false) {
    return false;
  }
  menu._emitSelect(e);
};

module.exports = Menu;

});
__loader.define("ui/propable.js", 4075, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');

var Propable = function(def) {
  this.state = def || {};
};

Propable.unset = function(k) {
  delete this[k];
};

Propable.makeAccessor = function(k) {
  return function(value) {
    if (arguments.length === 0) {
      return this.state[k];
    }
    this.state[k] = value;
    this._prop(myutil.toObject(k, value));
    return this;
  };
};

Propable.makeNestedAccessor = function(k) {
  var _k = '_' + k;
  return function(field, value, clear) {
    var nest = this.state[k];
    if (arguments.length === 0) {
      return nest;
    }
    if (arguments.length === 1 && typeof field === 'string') {
      return typeof nest === 'object' ? nest[field] : undefined;
    }
    if (typeof field === 'boolean') {
      value = field;
      field = k;
    }
    if (typeof field === 'object') {
      clear = value;
      value = undefined;
    }
    if (clear) {
      this._clear(k);
    }
    if (field !== undefined && typeof nest !== 'object') {
      nest = this.state[k] = {};
    }
    if (field !== undefined && typeof nest === 'object') {
      util2.copy(myutil.toObject(field, value), nest);
    }
    if (this[_k]) {
      this[_k](nest);
    }
    return this;
  };
};

Propable.makeAccessors = function(props, proto) {
  proto = proto || {};
  props.forEach(function(k) {
    proto[k] = Propable.makeAccessor(k);
  });
  return proto;
};

Propable.makeNestedAccessors = function(props, proto) {
  proto = proto || {};
  props.forEach(function(k) {
    proto[k] = Propable.makeNestedAccessor(k);
  });
  return proto;
};

Propable.prototype.unset = function(k) {
  delete this.state[k];
};

Propable.prototype._clear = function(k) {
  if (k === undefined || k === true) {
    this.state = {};
  } else if (k !== false) {
    this.state[k] = {};
  }
};

Propable.prototype._prop = function(def) {
};

Propable.prototype.prop = function(field, value, clear) {
  if (arguments.length === 0) {
    return util2.copy(this.state);
  }
  if (arguments.length === 1 && typeof field !== 'object') {
    return this.state[field];
  }
  if (typeof field === 'object') {
    clear = value;
  }
  if (clear) {
    this._clear(true);
  }
  var def = myutil.toObject(field, value);
  util2.copy(def, this.state);
  this._prop(def);
  return this;
};

module.exports = Propable;

});
__loader.define("ui/radial.js", 4185, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');
var safe = require('safe');
var Propable = require('ui/propable');
var StageElement = require('ui/element');

var accessorProps = [
  'radius',
  'angle',
  'angle2',
];

var defaults = {
  backgroundColor: 'white',
  borderColor: 'clear',
  borderWidth: 1,
  radius: 0,
  angle: 0,
  angle2: 360,
};

var checkProps = function(def) {
  if (!def) return;
  if ('angleStart' in def && safe.warnAngleStart !== false) {
    safe.warn('`angleStart` has been deprecated in favor of `angle` in order to match\n\t' +
              "Line's `position` and `position2`. Please use `angle` intead.", 2);
    safe.warnAngleStart = false;
  }
  if ('angleEnd' in def && safe.warnAngleEnd !== false) {
    safe.warn('`angleEnd` has been deprecated in favor of `angle2` in order to match\n\t' +
              "Line's `position` and `position2`. Please use `angle2` intead.", 2);
    safe.warnAngleEnd = false;
  }
};

var Radial = function(elementDef) {
  checkProps(elementDef);
  StageElement.call(this, myutil.shadow(defaults, elementDef || {}));
  this.state.type = StageElement.RadialType;
};

util2.inherit(Radial, StageElement);

Propable.makeAccessors(accessorProps, Radial.prototype);

Radial.prototype._prop = function(def) {
  checkProps(def);
  StageElement.prototype._prop.call(this, def);
};

module.exports = Radial;

});
__loader.define("ui/rect.js", 4239, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');
var StageElement = require('ui/element');

var defaults = {
  backgroundColor: 'white',
  borderColor: 'clear',
  borderWidth: 1,
};

var Rect = function(elementDef) {
  StageElement.call(this, myutil.shadow(defaults, elementDef || {}));
  this.state.type = StageElement.RectType;
};

util2.inherit(Rect, StageElement);

module.exports = Rect;

});
__loader.define("ui/resource.js", 4260, function(exports, module, require) {
var myutil = require('lib/myutil');
var appinfo = require('appinfo');

var resources = (function() {
  var resources = appinfo.resources;
  return resources && resources.media || [];
})();

var Resource = {};

Resource.items = resources;

Resource.getId = function(opt) {
  var path = opt;
  if (typeof opt === 'object') {
    path = opt.url;
  }
  path = path.replace(/#.*/, '');
  var cname = myutil.toCConstantName(path);
  for (var i = 0, ii = resources.length; i < ii; ++i) {
    var res = resources[i];
    if (res.name === cname || res.file === path) {
      return i + 1;
    }
  }
};

module.exports = Resource;

});
__loader.define("ui/simply-pebble.js", 4291, function(exports, module, require) {
var Color = require('color');
var struct = require('struct');
var util2 = require('util2');
var myutil = require('myutil');
var Platform = require('platform');
var Wakeup = require('wakeup');
var Timeline = require('timeline');
var Resource = require('ui/resource');
var Accel = require('ui/accel');
var Voice = require('ui/voice');
var ImageService = require('ui/imageservice');
var WindowStack = require('ui/windowstack');
var Window = require('ui/window');
var Menu = require('ui/menu');
var StageElement = require('ui/element');
var Vector2 = require('vector2');

var simply = require('ui/simply');

/**
 * This package provides the underlying implementation for the ui/* classes.
 *
 * This implementation uses PebbleKit JS AppMessage to send commands to a Pebble Watch.
 */

/**
 * First part of this file is defining the commands and types that we will use later.
 */

var state;

var BoolType = function(x) {
  return x ? 1 : 0;
};

var StringType = function(x) {
  return (x === undefined) ? '' : '' + x;
};

var UTF8ByteLength = function(x) {
  return unescape(encodeURIComponent(x)).length;
};

var EnumerableType = function(x) {
  if (x && x.hasOwnProperty('length')) {
    return x.length;
  }
  return x ? Number(x) : 0;
};

var StringLengthType = function(x) {
  return UTF8ByteLength(StringType(x));
};

var TimeType = function(x) {
  if (x instanceof Date) {
    x = x.getTime() / 1000;
  }
  return (x ? Number(x) : 0) + state.timeOffset;
};

var ImageType = function(x) {
  if (x && typeof x !== 'number') {
    return ImageService.resolve(x);
  }
  return x ? Number(x) : 0;
};

var PositionType = function(x) {
  this.positionX(x.x);
  this.positionY(x.y);
};

var SizeType = function(x) {
  this.sizeW(x.x);
  this.sizeH(x.y);
};

var namedColorMap = {
  'clear': 0x00,
  'black': 0xC0,
  'oxfordBlue': 0xC1,
  'dukeBlue': 0xC2,
  'blue': 0xC3,
  'darkGreen': 0xC4,
  'midnightGreen': 0xC5,
  'cobaltBlue': 0xC6,
  'blueMoon': 0xC7,
  'islamicGreen': 0xC8,
  'jaegerGreen': 0xC9,
  'tiffanyBlue': 0xCA,
  'vividCerulean': 0xCB,
  'green': 0xCC,
  'malachite': 0xCD,
  'mediumSpringGreen': 0xCE,
  'cyan': 0xCF,
  'bulgarianRose': 0xD0,
  'imperialPurple': 0xD1,
  'indigo': 0xD2,
  'electricUltramarine': 0xD3,
  'armyGreen': 0xD4,
  'darkGray': 0xD5,
  'liberty': 0xD6,
  'veryLightBlue': 0xD7,
  'kellyGreen': 0xD8,
  'mayGreen': 0xD9,
  'cadetBlue': 0xDA,
  'pictonBlue': 0xDB,
  'brightGreen': 0xDC,
  'screaminGreen': 0xDD,
  'mediumAquamarine': 0xDE,
  'electricBlue': 0xDF,
  'darkCandyAppleRed': 0xE0,
  'jazzberryJam': 0xE1,
  'purple': 0xE2,
  'vividViolet': 0xE3,
  'windsorTan': 0xE4,
  'roseVale': 0xE5,
  'purpureus': 0xE6,
  'lavenderIndigo': 0xE7,
  'limerick': 0xE8,
  'brass': 0xE9,
  'lightGray': 0xEA,
  'babyBlueEyes': 0xEB,
  'springBud': 0xEC,
  'inchworm': 0xED,
  'mintGreen': 0xEE,
  'celeste': 0xEF,
  'red': 0xF0,
  'folly': 0xF1,
  'fashionMagenta': 0xF2,
  'magenta': 0xF3,
  'orange': 0xF4,
  'sunsetOrange': 0xF5,
  'brilliantRose': 0xF6,
  'shockingPink': 0xF7,
  'chromeYellow': 0xF8,
  'rajah': 0xF9,
  'melon': 0xFA,
  'richBrilliantLavender': 0xFB,
  'yellow': 0xFC,
  'icterine': 0xFD,
  'pastelYellow': 0xFE,
  'white': 0xFF,
  'clearWhite': 0x3F,
};

var namedColorMapUpper = (function() {
  var map = {};
  for (var k in namedColorMap) {
    map[k.toUpperCase()] = namedColorMap[k];
  }
  return map;
})();

var ColorType = function(color) {
  if (typeof color === 'string') {
    var name = myutil.toCConstantName(color);
    name = name.replace(/_+/g, '');
    if (name in namedColorMapUpper) {
      return namedColorMapUpper[name];
    }
  }
  var argb = Color.toArgbUint8(color);
  if ((argb & 0xc0) === 0 && argb !== 0) {
    argb = argb | 0xc0;
  }
  return argb;
};

var Font = function(x) {
  var id = Resource.getId(x);
  if (id) {
    return id;
  }
  x = myutil.toCConstantName(x);
  if (!x.match(/^RESOURCE_ID/)) {
    x = 'RESOURCE_ID_' + x;
  }
  x = x.replace(/_+/g, '_');
  return x;
};

var TextOverflowMode = function(x) {
  switch (x) {
    case 'wrap'    : return 0;
    case 'ellipsis': return 1;
    case 'fill'    : return 2;
  }
  return Number(x);
};

var TextAlignment = function(x) {
  switch (x) {
    case 'left'  : return 0;
    case 'center': return 1;
    case 'right' : return 2;
  }
  return Number(x);
};

var TimeUnits = function(x) {
  var z = 0;
  x = myutil.toObject(x, true);
  for (var k in x) {
    switch (k) {
      case 'seconds': z |= (1 << 0); break;
      case 'minutes': z |= (1 << 1); break;
      case 'hours'  : z |= (1 << 2); break;
      case 'days'   : z |= (1 << 3); break;
      case 'months' : z |= (1 << 4); break;
      case 'years'  : z |= (1 << 5); break;
    }
  }
  return z;
};

var CompositingOp = function(x) {
  switch (x) {
    case 'assign':
    case 'normal': return 0;
    case 'assignInverted':
    case 'invert': return 1;
    case 'or'    : return 2;
    case 'and'   : return 3;
    case 'clear' : return 4;
    case 'set'   : return 5;
  }
  return Number(x);
};

var AnimationCurve = function(x) {
  switch (x) {
    case 'linear'   : return 0;
    case 'easeIn'   : return 1;
    case 'easeOut'  : return 2;
    case 'easeInOut': return 3;
  }
  return Number(x);
};

var MenuRowAlign = function(x) {
  switch(x) {
    case 'none'   : return 0;
    case 'center' : return 1;
    case 'top'    : return 2;
    case 'bottom' : return 3;
  }
  return x ? Number(x) : 0;
};

var makeArrayType = function(types) {
  return function(x) {
    var index = types.indexOf(x);
    if (index !== -1) {
      return index;
    }
    return Number(x);
  };
};

var makeFlagsType = function(types) {
  return function(x) {
    var z = 0;
    for (var k in x) {
      if (!x[k]) { continue; }
      var index = types.indexOf(k);
      if (index !== -1) {
        z |= 1 << index;
      }
    }
    return z;
  };
};

var LaunchReasonTypes = [
  'system',
  'user',
  'phone',
  'wakeup',
  'worker',
  'quickLaunch',
  'timelineAction'
];

var LaunchReasonType = makeArrayType(LaunchReasonTypes);

var WindowTypes = [
  'window',
  'menu',
  'card',
];

var WindowType = makeArrayType(WindowTypes);

var ButtonTypes = [
  'back',
  'up',
  'select',
  'down',
];

var ButtonType = makeArrayType(ButtonTypes);

var ButtonFlagsType = makeFlagsType(ButtonTypes);

var CardTextTypes = [
  'title',
  'subtitle',
  'body',
];

var CardTextType = makeArrayType(CardTextTypes);

var CardTextColorTypes = [
  'titleColor',
  'subtitleColor',
  'bodyColor',
];

var CardImageTypes = [
  'icon',
  'subicon',
  'banner',
];

var CardImageType = makeArrayType(CardImageTypes);

var CardStyleTypes = [
  'classic-small',
  'classic-large',
  'mono',
  'small',
  'large',
];

var CardStyleType = makeArrayType(CardStyleTypes);

var VibeTypes = [
  'short',
  'long',
  'double',
];

var VibeType = makeArrayType(VibeTypes);

var LightTypes = [
  'on',
  'auto',
  'trigger'
];

var LightType = makeArrayType(LightTypes);

var DictationSessionStatus = [
  null,
  'transcriptionRejected',
  'transcriptionRejectedWithError',
  'systemAborted',
  'noSpeechDetected',
  'connectivityError',
  'disabled',
  'internalError',
  'recognizerError',
];
// Custom Dictation Errors:
DictationSessionStatus[64] = "sessionAlreadyInProgress";
DictationSessionStatus[65] = "noMicrophone";

var StatusBarSeparatorModeTypes = [
  'none',
  'dotted',
];

var StatusBarSeparatorModeType = makeArrayType(StatusBarSeparatorModeTypes);

var Packet = new struct([
  ['uint16', 'type'],
  ['uint16', 'length'],
]);

var SegmentPacket = new struct([
  [Packet, 'packet'],
  ['bool', 'isLast'],
  ['data', 'buffer'],
]);

var ReadyPacket = new struct([
  [Packet, 'packet'],
]);

var LaunchReasonPacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'reason', LaunchReasonType],
  ['uint32', 'args'],
  ['uint32', 'time'],
  ['bool', 'isTimezone'],
]);

var WakeupSetPacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'timestamp', TimeType],
  ['int32', 'cookie'],
  ['uint8', 'notifyIfMissed', BoolType],
]);

var WakeupSetResultPacket = new struct([
  [Packet, 'packet'],
  ['int32', 'id'],
  ['int32', 'cookie'],
]);

var WakeupCancelPacket = new struct([
  [Packet, 'packet'],
  ['int32', 'id'],
]);

var WakeupEventPacket = new struct([
  [Packet, 'packet'],
  ['int32', 'id'],
  ['int32', 'cookie'],
]);

var WindowShowPacket = new struct([
  [Packet, 'packet'],
  ['uint8', 'type', WindowType],
  ['bool', 'pushing', BoolType],
]);

var WindowHidePacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
]);

var WindowShowEventPacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
]);

var WindowHideEventPacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
]);

var WindowPropsPacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
  ['uint8', 'backgroundColor', ColorType],
  ['bool', 'scrollable', BoolType],
  ['bool', 'paging', BoolType],
]);

var WindowButtonConfigPacket = new struct([
  [Packet, 'packet'],
  ['uint8', 'buttonMask', ButtonFlagsType],
]);

var WindowStatusBarPacket = new struct([
  [Packet, 'packet'],
  ['uint8', 'backgroundColor', ColorType],
  ['uint8', 'color', ColorType],
  ['uint8', 'separator', StatusBarSeparatorModeType],
  ['uint8', 'status', BoolType],
]);

var WindowActionBarPacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'up', ImageType],
  ['uint32', 'select', ImageType],
  ['uint32', 'down', ImageType],
  ['uint8', 'backgroundColor', ColorType],
  ['uint8', 'action', BoolType],
]);

var ClickPacket = new struct([
  [Packet, 'packet'],
  ['uint8', 'button', ButtonType],
]);

var LongClickPacket = new struct([
  [Packet, 'packet'],
  ['uint8', 'button', ButtonType],
]);

var ImagePacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
  ['int16', 'width'],
  ['int16', 'height'],
  ['uint16', 'pixelsLength'],
  ['data', 'pixels'],
]);

var CardClearPacket = new struct([
  [Packet, 'packet'],
  ['uint8', 'flags'],
]);

var CardTextPacket = new struct([
  [Packet, 'packet'],
  ['uint8', 'index', CardTextType],
  ['uint8', 'color', ColorType],
  ['cstring', 'text'],
]);

var CardImagePacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'image', ImageType],
  ['uint8', 'index', CardImageType],
]);

var CardStylePacket = new struct([
  [Packet, 'packet'],
  ['uint8', 'style', CardStyleType],
]);

var VibePacket = new struct([
  [Packet, 'packet'],
  ['uint8', 'type', VibeType],
]);

var LightPacket = new struct([
  [Packet, 'packet'],
  ['uint8', 'type', LightType],
]);

var AccelPeekPacket = new struct([
  [Packet, 'packet'],
]);

var AccelConfigPacket = new struct([
  [Packet, 'packet'],
  ['uint16', 'samples'],
  ['uint8', 'rate'],
  ['bool', 'subscribe', BoolType],
]);

var AccelData = new struct([
  ['int16', 'x'],
  ['int16', 'y'],
  ['int16', 'z'],
  ['bool', 'vibe'],
  ['uint64', 'time'],
]);

var AccelDataPacket = new struct([
  [Packet, 'packet'],
  ['bool', 'peek'],
  ['uint8', 'samples'],
]);

var AccelTapPacket = new struct([
  [Packet, 'packet'],
  ['uint8', 'axis'],
  ['int8', 'direction'],
]);

var MenuClearPacket = new struct([
  [Packet, 'packet'],
]);

var MenuClearSectionPacket = new struct([
  [Packet, 'packet'],
  ['uint16', 'section'],
]);

var MenuPropsPacket = new struct([
  [Packet, 'packet'],
  ['uint16', 'sections', EnumerableType],
  ['uint8', 'backgroundColor', ColorType],
  ['uint8', 'textColor', ColorType],
  ['uint8', 'highlightBackgroundColor', ColorType],
  ['uint8', 'highlightTextColor', ColorType],
]);

var MenuSectionPacket = new struct([
  [Packet, 'packet'],
  ['uint16', 'section'],
  ['uint16', 'items', EnumerableType],
  ['uint8', 'backgroundColor', ColorType],
  ['uint8', 'textColor', ColorType],
  ['uint16', 'titleLength', StringLengthType],
  ['cstring', 'title', StringType],
]);

var MenuGetSectionPacket = new struct([
  [Packet, 'packet'],
  ['uint16', 'section'],
]);

var MenuItemPacket = new struct([
  [Packet, 'packet'],
  ['uint16', 'section'],
  ['uint16', 'item'],
  ['uint32', 'icon', ImageType],
  ['uint16', 'titleLength', StringLengthType],
  ['uint16', 'subtitleLength', StringLengthType],
  ['cstring', 'title', StringType],
  ['cstring', 'subtitle', StringType],
]);

var MenuGetItemPacket = new struct([
  [Packet, 'packet'],
  ['uint16', 'section'],
  ['uint16', 'item'],
]);

var MenuSelectionPacket = new struct([
  [Packet, 'packet'],
  ['uint16', 'section'],
  ['uint16', 'item'],
  ['uint8', 'align', MenuRowAlign],
  ['bool', 'animated', BoolType],
]);

var MenuGetSelectionPacket = new struct([
  [Packet, 'packet'],
]);

var MenuSelectionEventPacket = new struct([
  [Packet, 'packet'],
  ['uint16', 'section'],
  ['uint16', 'item'],
]);

var MenuSelectPacket = new struct([
  [Packet, 'packet'],
  ['uint16', 'section'],
  ['uint16', 'item'],
]);

var MenuLongSelectPacket = new struct([
  [Packet, 'packet'],
  ['uint16', 'section'],
  ['uint16', 'item'],
]);

var StageClearPacket = new struct([
  [Packet, 'packet'],
]);

var ElementInsertPacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
  ['uint8', 'type'],
  ['uint16', 'index'],
]);

var ElementRemovePacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
]);

var GPoint = new struct([
  ['int16', 'x'],
  ['int16', 'y'],
]);

var GSize = new struct([
  ['int16', 'w'],
  ['int16', 'h'],
]);

var GRect = new struct([
  [GPoint, 'origin', PositionType],
  [GSize, 'size', SizeType],
]);

var ElementCommonPacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
  [GPoint, 'position', PositionType],
  [GSize, 'size', SizeType],
  ['uint16', 'borderWidth', EnumerableType],
  ['uint8', 'backgroundColor', ColorType],
  ['uint8', 'borderColor', ColorType],
]);

var ElementRadiusPacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
  ['uint16', 'radius', EnumerableType],
]);

var ElementAnglePacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
  ['uint16', 'angle', EnumerableType],
]);

var ElementAngle2Packet = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
  ['uint16', 'angle2', EnumerableType],
]);

var ElementTextPacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
  ['uint8', 'updateTimeUnits', TimeUnits],
  ['cstring', 'text', StringType],
]);

var ElementTextStylePacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
  ['uint8', 'color', ColorType],
  ['uint8', 'textOverflow', TextOverflowMode],
  ['uint8', 'textAlign', TextAlignment],
  ['uint32', 'customFont'],
  ['cstring', 'systemFont', StringType],
]);

var ElementImagePacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
  ['uint32', 'image', ImageType],
  ['uint8', 'compositing', CompositingOp],
]);

var ElementAnimatePacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
  [GPoint, 'position', PositionType],
  [GSize, 'size', SizeType],
  ['uint32', 'duration'],
  ['uint8', 'easing', AnimationCurve],
]);

var ElementAnimateDonePacket = new struct([
  [Packet, 'packet'],
  ['uint32', 'id'],
]);

var VoiceDictationStartPacket = new struct([
  [Packet, 'packet'],
  ['bool', 'enableConfirmation'],
]);

var VoiceDictationStopPacket = new struct([
  [Packet, 'packet'],
]);

var VoiceDictationDataPacket = new struct([
  [Packet, 'packet'],
  ['int8', 'status'],
  ['cstring', 'transcription'],
]);

var CommandPackets = [
  Packet,
  SegmentPacket,
  ReadyPacket,
  LaunchReasonPacket,
  WakeupSetPacket,
  WakeupSetResultPacket,
  WakeupCancelPacket,
  WakeupEventPacket,
  WindowShowPacket,
  WindowHidePacket,
  WindowShowEventPacket,
  WindowHideEventPacket,
  WindowPropsPacket,
  WindowButtonConfigPacket,
  WindowStatusBarPacket,
  WindowActionBarPacket,
  ClickPacket,
  LongClickPacket,
  ImagePacket,
  CardClearPacket,
  CardTextPacket,
  CardImagePacket,
  CardStylePacket,
  VibePacket,
  LightPacket,
  AccelPeekPacket,
  AccelConfigPacket,
  AccelDataPacket,
  AccelTapPacket,
  MenuClearPacket,
  MenuClearSectionPacket,
  MenuPropsPacket,
  MenuSectionPacket,
  MenuGetSectionPacket,
  MenuItemPacket,
  MenuGetItemPacket,
  MenuSelectionPacket,
  MenuGetSelectionPacket,
  MenuSelectionEventPacket,
  MenuSelectPacket,
  MenuLongSelectPacket,
  StageClearPacket,
  ElementInsertPacket,
  ElementRemovePacket,
  ElementCommonPacket,
  ElementRadiusPacket,
  ElementAnglePacket,
  ElementAngle2Packet,
  ElementTextPacket,
  ElementTextStylePacket,
  ElementImagePacket,
  ElementAnimatePacket,
  ElementAnimateDonePacket,
  VoiceDictationStartPacket,
  VoiceDictationStopPacket,
  VoiceDictationDataPacket,
];

var accelAxes = [
  'x',
  'y',
  'z',
];

var clearFlagMap = {
  action: (1 << 0),
  text: (1 << 1),
  image: (1 << 2),
};

/**
 * SimplyPebble object provides the actual methods to communicate with Pebble.
 *
 * It's an implementation of an abstract interface used by all the other classes.
 */

var SimplyPebble = {};

SimplyPebble.init = function() {
  // Register listeners for app message communication
  Pebble.addEventListener('appmessage', SimplyPebble.onAppMessage);

  // Register this implementation as the one currently in use
  simply.impl = SimplyPebble;

  state = SimplyPebble.state = {};

  state.timeOffset = new Date().getTimezoneOffset() * -60;

  // Initialize the app message queue
  state.messageQueue = new MessageQueue();

  // Initialize the packet queue
  state.packetQueue = new PacketQueue();

  // Signal the Pebble that the Phone's app message is ready
  SimplyPebble.ready();
};

/**
 * MessageQueue is an app message queue that guarantees delivery and order.
 */
var MessageQueue = function() {
  this._queue = [];
  this._sending = false;

  this._consume = this.consume.bind(this);
  this._cycle = this.cycle.bind(this);
};

MessageQueue.prototype.stop = function() {
  this._sending = false;
};

MessageQueue.prototype.consume = function() {
  this._queue.shift();
  if (this._queue.length === 0) {
    return this.stop();
  }
  this.cycle();
};

MessageQueue.prototype.checkSent = function(message, fn) {
  return function() {
    if (message === this._sent) {
      fn();
    }
  }.bind(this);
};

MessageQueue.prototype.cycle = function() {
  if (!this._sending) {
    return;
  }
  var head = this._queue[0];
  if (!head) {
    return this.stop();
  }
  this._sent = head;
  var success = this.checkSent(head, this._consume);
  var failure = this.checkSent(head, this._cycle);
  Pebble.sendAppMessage(head, success, failure);
};

MessageQueue.prototype.send = function(message) {
  this._queue.push(message);
  if (this._sending) {
    return;
  }
  this._sending = true;
  this.cycle();
};

var toByteArray = function(packet) {
  var type = CommandPackets.indexOf(packet);
  var size = Math.max(packet._size, packet._cursor);
  packet.packetType(type);
  packet.packetLength(size);

  var buffer = packet._view;
  var byteArray = new Array(size);
  for (var i = 0; i < size; ++i) {
    byteArray[i] = buffer.getUint8(i);
  }

  return byteArray;
};

/**
 * PacketQueue is a packet queue that combines multiple packets into a single packet.
 * This reduces latency caused by the time spacing between each app message.
 */
var PacketQueue = function() {
  this._message = [];

  this._send = this.send.bind(this);
};

PacketQueue.prototype._maxPayloadSize = (Platform.version() === 'aplite' ? 1024 : 2044) - 32;

PacketQueue.prototype.add = function(packet) {
  var byteArray = toByteArray(packet);
  if (this._message.length + byteArray.length > this._maxPayloadSize) {
    this.send();
  }
  Array.prototype.push.apply(this._message, byteArray);
  clearTimeout(this._timeout);
  this._timeout = setTimeout(this._send, 0);
};

PacketQueue.prototype.send = function() {
  if (this._message.length === 0) {
    return;
  }
  state.messageQueue.send({ 0: this._message });
  this._message = [];
};

SimplyPebble.sendMultiPacket = function(packet) {
  var byteArray = toByteArray(packet);
  var totalSize = byteArray.length;
  var segmentSize = state.packetQueue._maxPayloadSize - Packet._size;
  for (var i = 0; i < totalSize; i += segmentSize) {
    var isLast = (i + segmentSize) >= totalSize;
    var buffer = byteArray.slice(i, Math.min(totalSize, i + segmentSize));
    SegmentPacket.isLast((i + segmentSize) >= totalSize).buffer(buffer);
    state.packetQueue.add(SegmentPacket);
  }
};

SimplyPebble.sendPacket = function(packet) {
  if (packet._cursor < state.packetQueue._maxPayloadSize) {
    state.packetQueue.add(packet);
  } else {
    SimplyPebble.sendMultiPacket(packet);
  }
};

SimplyPebble.ready = function() {
  SimplyPebble.sendPacket(ReadyPacket);
};

SimplyPebble.wakeupSet = function(timestamp, cookie, notifyIfMissed) {
  WakeupSetPacket
    .timestamp(timestamp)
    .cookie(cookie)
    .notifyIfMissed(notifyIfMissed);
  SimplyPebble.sendPacket(WakeupSetPacket);
};

SimplyPebble.wakeupCancel = function(id) {
  SimplyPebble.sendPacket(WakeupCancelPacket.id(id === 'all' ? -1 : id));
};

SimplyPebble.windowShow = function(def) {
  SimplyPebble.sendPacket(WindowShowPacket.prop(def));
};

SimplyPebble.windowHide = function(id) {
  SimplyPebble.sendPacket(WindowHidePacket.id(id));
};

SimplyPebble.windowProps = function(def) {
  WindowPropsPacket
    .prop(def)
    .backgroundColor(def.backgroundColor || 'white');
  SimplyPebble.sendPacket(WindowPropsPacket);
};

SimplyPebble.windowButtonConfig = function(def) {
  SimplyPebble.sendPacket(WindowButtonConfigPacket.buttonMask(def));
};

var toStatusDef = function(statusDef) {
  if (typeof statusDef === 'boolean') {
    statusDef = { status: statusDef };
  }
  return statusDef;
};

SimplyPebble.windowStatusBar = function(def) {
  var statusDef = toStatusDef(def);
  WindowStatusBarPacket
    .separator(statusDef.separator || 'dotted')
    .status(typeof def === 'boolean' ? def : def.status !== false)
    .color(statusDef.color || 'black')
    .backgroundColor(statusDef.backgroundColor || 'white');
  SimplyPebble.sendPacket(WindowStatusBarPacket);
};

SimplyPebble.windowStatusBarCompat = function(def) {
  if (typeof def.fullscreen === 'boolean') {
    SimplyPebble.windowStatusBar(!def.fullscreen);
  } else if (def.status !== undefined) {
    SimplyPebble.windowStatusBar(def.status);
  }
};

var toActionDef = function(actionDef) {
  if (typeof actionDef === 'boolean') {
    actionDef = { action: actionDef };
  }
  return actionDef;
};

SimplyPebble.windowActionBar = function(def) {
  var actionDef = toActionDef(def);
  WindowActionBarPacket
    .up(actionDef.up)
    .select(actionDef.select)
    .down(actionDef.down)
    .action(typeof def === 'boolean' ? def : def.action !== false)
    .backgroundColor(actionDef.backgroundColor || 'black');
  SimplyPebble.sendPacket(WindowActionBarPacket);
};

SimplyPebble.image = function(id, gbitmap) {
  SimplyPebble.sendPacket(ImagePacket.id(id).prop(gbitmap));
};

var toClearFlags = function(clear) {
  if (clear === true || clear === 'all') {
    clear = ~0;
  } else if (typeof clear === 'string') {
    clear = clearFlagMap[clear];
  } else if (typeof clear === 'object') {
    var flags = 0;
    for (var k in clear) {
      if (clear[k] === true) {
        flags |= clearFlagMap[k];
      }
    }
    clear = flags;
  }
  return clear;
};

SimplyPebble.cardClear = function(clear) {
  SimplyPebble.sendPacket(CardClearPacket.flags(toClearFlags(clear)));
};

SimplyPebble.cardText = function(field, text, color) {
  CardTextPacket
    .index(field)
    .color(color || 'clearWhite')
    .text(text || '');
  SimplyPebble.sendPacket(CardTextPacket);
};

SimplyPebble.cardImage = function(field, image) {
  SimplyPebble.sendPacket(CardImagePacket.index(field).image(image));
};

SimplyPebble.cardStyle = function(field, style) {
  SimplyPebble.sendPacket(CardStylePacket.style(style));
};

SimplyPebble.card = function(def, clear, pushing) {
  if (arguments.length === 3) {
    SimplyPebble.windowShow({ type: 'card', pushing: pushing });
  }
  if (clear !== undefined) {
    SimplyPebble.cardClear(clear);
  }
  SimplyPebble.windowProps(def);
  SimplyPebble.windowStatusBarCompat(def);
  if (def.action !== undefined) {
    SimplyPebble.windowActionBar(def.action);
  }
  for (var k in def) {
    var textIndex = CardTextTypes.indexOf(k);
    if (textIndex !== -1) {
      SimplyPebble.cardText(k, def[k], def[CardTextColorTypes[textIndex]]);
    } else if (CardImageTypes.indexOf(k) !== -1) {
      SimplyPebble.cardImage(k, def[k]);
    } else if (k === 'style') {
      SimplyPebble.cardStyle(k, def[k]);
    }
  }
};

SimplyPebble.vibe = function(type) {
  SimplyPebble.sendPacket(VibePacket.type(type));
};

SimplyPebble.light = function(type) {
  SimplyPebble.sendPacket(LightPacket.type(type));
};

var accelListeners = [];

SimplyPebble.accelPeek = function(callback) {
  accelListeners.push(callback);
  SimplyPebble.sendPacket(AccelPeekPacket);
};

SimplyPebble.accelConfig = function(def) {
  SimplyPebble.sendPacket(AccelConfigPacket.prop(def));
};

SimplyPebble.voiceDictationStart = function(callback, enableConfirmation) {
  if (Platform.version() === 'aplite') {
    // If there is no microphone, call with an error event
    callback({
      'err': DictationSessionStatus[65],  // noMicrophone
      'failed': true,
      'transcription': null,
    });
    return;
  } else if (state.dictationCallback) {
    // If there's a transcription in progress, call with an error event
    callback({
      'err': DictationSessionStatus[64],  // dictationAlreadyInProgress
      'failed': true,
      'transcription': null,
    });
    return;
  }

  // Set the callback and send the packet
  state.dictationCallback = callback;
  SimplyPebble.sendPacket(VoiceDictationStartPacket.enableConfirmation(enableConfirmation));
};

SimplyPebble.voiceDictationStop = function() {
  // Send the message and delete the callback
  SimplyPebble.sendPacket(VoiceDictationStopPacket);
  delete state.dictationCallback;
};

SimplyPebble.onVoiceData = function(packet) {
  if (!state.dictationCallback) {
    // Something bad happened
    console.log("No callback specified for dictation session");
  } else {
    var e = {
      'err': DictationSessionStatus[packet.status()],
      'failed': packet.status() !== 0,
      'transcription': packet.transcription(),
    };
    // Invoke and delete the callback
    state.dictationCallback(e);
    delete state.dictationCallback;
  }
};

SimplyPebble.menuClear = function() {
  SimplyPebble.sendPacket(MenuClearPacket);
};

SimplyPebble.menuClearSection = function(section) {
  SimplyPebble.sendPacket(MenuClearSectionPacket.section(section));
};

SimplyPebble.menuProps = function(def) {
  SimplyPebble.sendPacket(MenuPropsPacket.prop(def));
};

SimplyPebble.menuSection = function(section, def, clear) {
  if (clear !== undefined) {
    SimplyPebble.menuClearSection(section);
  }
  MenuSectionPacket
    .section(section)
    .items(def.items)
    .backgroundColor(def.backgroundColor)
    .textColor(def.textColor)
    .titleLength(def.title)
    .title(def.title);
  SimplyPebble.sendPacket(MenuSectionPacket);
};

SimplyPebble.menuItem = function(section, item, def) {
  MenuItemPacket
    .section(section)
    .item(item)
    .icon(def.icon)
    .titleLength(def.title)
    .subtitleLength(def.subtitle)
    .title(def.title)
    .subtitle(def.subtitle);
  SimplyPebble.sendPacket(MenuItemPacket);
};

SimplyPebble.menuSelection = function(section, item, align) {
  if (section === undefined) {
    SimplyPebble.sendPacket(MenuGetSelectionPacket);
    return;
  }
  SimplyPebble.sendPacket(MenuSelectionPacket.section(section).item(item).align(align || 'center'));
};

SimplyPebble.menu = function(def, clear, pushing) {
  if (typeof pushing === 'boolean') {
    SimplyPebble.windowShow({ type: 'menu', pushing: pushing });
  }
  if (clear !== undefined) {
    SimplyPebble.menuClear();
  }
  SimplyPebble.windowProps(def);
  SimplyPebble.windowStatusBarCompat(def);
  SimplyPebble.menuProps(def);
};

SimplyPebble.elementInsert = function(id, type, index) {
  SimplyPebble.sendPacket(ElementInsertPacket.id(id).type(type).index(index));
};

SimplyPebble.elementRemove = function(id) {
  SimplyPebble.sendPacket(ElementRemovePacket.id(id));
};

SimplyPebble.elementFrame = function(packet, def, altDef) {
  var position = def.position || (altDef ? altDef.position : undefined);
  var position2 = def.position2 || (altDef ? altDef.position2 : undefined);
  var size = def.size || (altDef ? altDef.size : undefined);
  if (position && position2) {
    size = position2.clone().subSelf(position);
  }
  packet.position(position);
  packet.size(size);
};

SimplyPebble.elementCommon = function(id, def) {
  if ('strokeColor' in def) {
    ElementCommonPacket.borderColor(def.strokeColor);
  }
  if ('strokeWidth' in def) {
    ElementCommonPacket.borderWidth(def.strokeWidth);
  }
  SimplyPebble.elementFrame(ElementCommonPacket, def);
  ElementCommonPacket
    .id(id)
    .prop(def);
  SimplyPebble.sendPacket(ElementCommonPacket);
};

SimplyPebble.elementRadius = function(id, def) {
  SimplyPebble.sendPacket(ElementRadiusPacket.id(id).radius(def.radius));
};

SimplyPebble.elementAngle = function(id, def) {
  SimplyPebble.sendPacket(ElementAnglePacket.id(id).angle(def.angleStart || def.angle));
};

SimplyPebble.elementAngle2 = function(id, def) {
  SimplyPebble.sendPacket(ElementAngle2Packet.id(id).angle2(def.angleEnd || def.angle2));
};

SimplyPebble.elementText = function(id, text, timeUnits) {
  SimplyPebble.sendPacket(ElementTextPacket.id(id).updateTimeUnits(timeUnits).text(text));
};

SimplyPebble.elementTextStyle = function(id, def) {
  ElementTextStylePacket.id(id).prop(def);
  var font = Font(def.font);
  if (typeof font === 'number') {
    ElementTextStylePacket.customFont(font).systemFont('');
  } else {
    ElementTextStylePacket.customFont(0).systemFont(font);
  }
  SimplyPebble.sendPacket(ElementTextStylePacket);
};

SimplyPebble.elementImage = function(id, image, compositing) {
  SimplyPebble.sendPacket(ElementImagePacket.id(id).image(image).compositing(compositing));
};

SimplyPebble.elementAnimate = function(id, def, animateDef, duration, easing) {
  SimplyPebble.elementFrame(ElementAnimatePacket, animateDef, def);
  ElementAnimatePacket
    .id(id)
    .duration(duration)
    .easing(easing);
  SimplyPebble.sendPacket(ElementAnimatePacket);
};

SimplyPebble.stageClear = function() {
  SimplyPebble.sendPacket(StageClearPacket);
};

SimplyPebble.stageElement = function(id, type, def, index) {
  if (index !== undefined) {
    SimplyPebble.elementInsert(id, type, index);
  }
  SimplyPebble.elementCommon(id, def);
  switch (type) {
    case StageElement.RectType:
    case StageElement.CircleType:
      SimplyPebble.elementRadius(id, def);
      break;
    case StageElement.RadialType:
      SimplyPebble.elementRadius(id, def);
      SimplyPebble.elementAngle(id, def);
      SimplyPebble.elementAngle2(id, def);
      break;
    case StageElement.TextType:
      SimplyPebble.elementRadius(id, def);
      SimplyPebble.elementTextStyle(id, def);
      SimplyPebble.elementText(id, def.text, def.updateTimeUnits);
      break;
    case StageElement.ImageType:
      SimplyPebble.elementRadius(id, def);
      SimplyPebble.elementImage(id, def.image, def.compositing);
      break;
  }
};

SimplyPebble.stageRemove = SimplyPebble.elementRemove;

SimplyPebble.stageAnimate = SimplyPebble.elementAnimate;

SimplyPebble.stage = function(def, clear, pushing) {
  if (arguments.length === 3) {
    SimplyPebble.windowShow({ type: 'window', pushing: pushing });
  }
  SimplyPebble.windowProps(def);
  SimplyPebble.windowStatusBarCompat(def);
  if (clear !== undefined) {
    SimplyPebble.stageClear();
  }
  if (def.action !== undefined) {
    SimplyPebble.windowActionBar(def.action);
  }
};

SimplyPebble.window = SimplyPebble.stage;

var toArrayBuffer = function(array, length) {
  length = length || array.length;
  var copy = new DataView(new ArrayBuffer(length));
  for (var i = 0; i < length; ++i) {
    copy.setUint8(i, array[i]);
  }
  return copy;
};

SimplyPebble.onLaunchReason = function(packet) {
  var reason = LaunchReasonTypes[packet.reason()];
  var args = packet.args();
  var remoteTime = packet.time();
  var isTimezone = packet.isTimezone();
  if (isTimezone) {
    state.timeOffset = 0;
  } else {
    var time = Date.now() / 1000;
    var resolution = 60 * 30;
    state.timeOffset = Math.round((remoteTime - time) / resolution) * resolution;
  }
  if (reason === 'timelineAction') {
    Timeline.emitAction(args);
  } else {
    Timeline.emitAction();
  }
  if (reason !== 'wakeup') {
    Wakeup.emitWakeup();
  }
};

SimplyPebble.onWakeupSetResult = function(packet) {
  var id = packet.id();
  switch (id) {
    case -8: id = 'range'; break;
    case -4: id = 'invalidArgument'; break;
    case -7: id = 'outOfResources'; break;
    case -3: id = 'internal'; break;
  }
  Wakeup.emitSetResult(id, packet.cookie());
};

SimplyPebble.onAccelData = function(packet) {
  var samples = packet.samples();
  var accels = [];
  AccelData._view = packet._view;
  AccelData._offset = packet._size;
  for (var i = 0; i < samples; ++i) {
    accels.push(AccelData.prop());
    AccelData._offset += AccelData._size;
  }
  if (!packet.peek()) {
    Accel.emitAccelData(accels);
  } else {
    var handlers = accelListeners;
    accelListeners = [];
    for (var j = 0, jj = handlers.length; j < jj; ++j) {
      Accel.emitAccelData(accels, handlers[j]);
    }
  }
};

SimplyPebble.onPacket = function(buffer, offset) {
  Packet._view = buffer;
  Packet._offset = offset;
  var packet = CommandPackets[Packet.type()];

  if (!packet) {
    console.log('Received unknown packet: ' + JSON.stringify(buffer));
    return;
  }

  packet._view = Packet._view;
  packet._offset = offset;
  switch (packet) {
    case LaunchReasonPacket:
      SimplyPebble.onLaunchReason(packet);
      break;
    case WakeupSetResultPacket:
      SimplyPebble.onWakeupSetResult(packet);
      break;
    case WakeupEventPacket:
      Wakeup.emitWakeup(packet.id(), packet.cookie());
      break;
    case WindowHideEventPacket:
      ImageService.markAllUnloaded();
      WindowStack.emitHide(packet.id());
      break;
    case ClickPacket:
      Window.emitClick('click', ButtonTypes[packet.button()]);
      break;
    case LongClickPacket:
      Window.emitClick('longClick', ButtonTypes[packet.button()]);
      break;
    case AccelDataPacket:
      SimplyPebble.onAccelData(packet);
      break;
    case AccelTapPacket:
      Accel.emitAccelTap(accelAxes[packet.axis()], packet.direction());
      break;
    case MenuGetSectionPacket:
      Menu.emitSection(packet.section());
      break;
    case MenuGetItemPacket:
      Menu.emitItem(packet.section(), packet.item());
      break;
    case MenuSelectPacket:
      Menu.emitSelect('menuSelect', packet.section(), packet.item());
      break;
    case MenuLongSelectPacket:
      Menu.emitSelect('menuLongSelect', packet.section(), packet.item());
      break;
    case MenuSelectionEventPacket:
      Menu.emitSelect('menuSelection', packet.section(), packet.item());
      break;
    case ElementAnimateDonePacket:
      StageElement.emitAnimateDone(packet.id());
      break;
    case VoiceDictationDataPacket:
      SimplyPebble.onVoiceData(packet);
      break;
  }
};

SimplyPebble.onAppMessage = function(e) {
  var data = e.payload[0];
  
  Packet._view = toArrayBuffer(data);

  var offset = 0;
  var length = data.length;

  do {
    SimplyPebble.onPacket(Packet._view, offset);

    Packet._offset = offset;
    offset += Packet.length();
  } while (offset !== 0 && offset < length);
};

module.exports = SimplyPebble;


});
__loader.define("ui/simply.js", 5794, function(exports, module, require) {
/**
 * This file provides an easy way to switch the actual implementation used by all the
 * ui objects.
 *
 * simply.impl provides the actual communication layer to the hardware.
 */

var simply = {};

// Override this with the actual implementation you want to use.
simply.impl = undefined;

module.exports = simply;

});
__loader.define("ui/stage.js", 5810, function(exports, module, require) {
var util2 = require('util2');
var Emitter = require('emitter');
var WindowStack = require('ui/windowstack');
var simply = require('ui/simply');

var Stage = function(stageDef) {
  this.state = stageDef || {};
  this._items = [];
};

Stage.RectType = 1;
Stage.CircleType = 2;
Stage.RadialType = 6;
Stage.TextType = 3;
Stage.ImageType = 4;
Stage.InverterType = 5;

util2.copy(Emitter.prototype, Stage.prototype);

Stage.prototype._show = function() {
  this.each(function(element, index) {
    element._reset();
    this._insert(index, element);
  }.bind(this));
};

Stage.prototype._prop = function() {
  if (this === WindowStack.top()) {
    simply.impl.stage.apply(this, arguments);
  }
};

Stage.prototype.each = function(callback) {
  this._items.forEach(callback);
  return this;
};

Stage.prototype.at = function(index) {
  return this._items[index];
};

Stage.prototype.index = function(element) {
  return this._items.indexOf(element);
};

Stage.prototype._insert = function(index, element) {
  if (this === WindowStack.top()) {
    simply.impl.stageElement(element._id(), element._type(), element.state, index);
  }
};

Stage.prototype._remove = function(element, broadcast) {
  if (broadcast === false) { return; }
  if (this === WindowStack.top()) {
    simply.impl.stageRemove(element._id());
  }
};

Stage.prototype.insert = function(index, element) {
  element.remove(false);
  this._items.splice(index, 0, element);
  element.parent = this;
  this._insert(this.index(element), element);
  return this;
};

Stage.prototype.add = function(element) {
  return this.insert(this._items.length, element);
};

Stage.prototype.remove = function(element, broadcast) {
  var index = this.index(element);
  if (index === -1) { return this; }
  this._remove(element, broadcast);
  this._items.splice(index, 1);
  delete element.parent;
  return this;
};

module.exports = Stage;

});
__loader.define("ui/tests.js", 5893, function(exports, module, require) {

var tests = {};

tests.setTimeoutErrors = function () {
  /* global wind */
  var i = 0;
  var interval = setInterval(function() {
    clearInterval(interval);
    wind.titlex('i = ' + i++);
  }, 1000);
};

tests.ajaxErrors = function() {
  var ajax = require('ajax');
  var ajaxCallback = function(reqStatus, reqBody, request) {
    console.logx('broken call');
  };
  ajax({ url: 'http://www.google.fr/' }, ajaxCallback, ajaxCallback);
};

tests.geolocationErrors = function () {
  navigator.geolocation.getCurrentPosition(function(coords) {
    console.logx('Got coords: ' + coords);
  });
};

tests.loadAppinfo = function() {
  console.log('longName: ' + require('appinfo').longName);
};

tests.resolveBultinImagePath = function() {
  var ImageService = require('ui/imageservice');
  console.log('image-logo-splash = resource #' + ImageService.resolve('images/logo_splash.png'));
};

for (var test in tests) {
  console.log('Running test: ' + test);
  tests[test]();
}

});
__loader.define("ui/text.js", 5935, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');
var Propable = require('ui/propable');
var StageElement = require('ui/element');

var textProps = [
  'text',
  'font',
  'color',
  'textOverflow',
  'textAlign',
  'updateTimeUnits',
];

var defaults = {
  backgroundColor: 'clear',
  borderColor: 'clear',
  borderWidth: 1,
  color: 'white',
  font: 'gothic-24',
};

var Text = function(elementDef) {
  StageElement.call(this, myutil.shadow(defaults, elementDef || {}));
  this.state.type = StageElement.TextType;
};

util2.inherit(Text, StageElement);

Propable.makeAccessors(textProps, Text.prototype);

module.exports = Text;

});
__loader.define("ui/timetext.js", 5970, function(exports, module, require) {
var util2 = require('util2');
var Text = require('ui/text');

var TimeText = function(elementDef) {
  Text.call(this, elementDef);
  if (this.state.text) {
    this.text(this.state.text);
  }
};

util2.inherit(TimeText, Text);

var formatUnits = {
  a: 'days',
  A: 'days',
  b: 'months',
  B: 'months',
  c: 'seconds',
  d: 'days',
  H: 'hours',
  I: 'hours',
  j: 'days',
  m: 'months',
  M: 'minutes',
  p: 'hours',
  S: 'seconds',
  U: 'days',
  w: 'days',
  W: 'days',
  x: 'days',
  X: 'seconds',
  y: 'years',
  Y: 'years',
};

var getUnitsFromText = function(text) {
  var units = {};
  text.replace(/%(.)/g, function(_, code) {
    var unit = formatUnits[code];
    if (unit) {
      units[unit] = true;
    }
    return _;
  });
  return units;
};

TimeText.prototype.text = function(text) {
  if (arguments.length === 0) {
    return this.state.text;
  }
  this.prop({
    text: text,
    updateTimeUnits: getUnitsFromText(text),
  });
  return this;
};

module.exports = TimeText;

});
__loader.define("ui/vibe.js", 6032, function(exports, module, require) {
var simply = require('ui/simply');

var Vibe = module.exports;

Vibe.vibrate = function(type) {
  simply.impl.vibe(type);
};

});
__loader.define("ui/voice.js", 6042, function(exports, module, require) {
var simply = require('ui/simply');

var Voice = {};

Voice.dictate = function(type, confirm, callback) {
  type = type.toLowerCase();
  switch (type){
    case 'stop':
      simply.impl.voiceDictationStop();
      break;
    case 'start':
      if (typeof callback === 'undefined') {
        callback = confirm;
        confirm = true;
      }

      simply.impl.voiceDictationStart(callback, confirm);
      break;
    default:
      console.log('Unsupported type passed to Voice.dictate');
  }
};

module.exports = Voice;

});
__loader.define("ui/window.js", 6069, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');
var safe = require('safe');
var Emitter = require('emitter');
var Vector2 = require('vector2');
var Feature = require('platform/feature');
var Accel = require('ui/accel');
var WindowStack = require('ui/windowstack');
var Propable = require('ui/propable');
var Stage = require('ui/stage');
var simply = require('ui/simply');

var buttons = [
  'back',
  'up',
  'select',
  'down',
];

var configProps = [
  'fullscreen',
  'style',
  'scrollable',
  'paging',
  'backgroundColor',
];

var statusProps = [
  'status',
  'separator',
  'color',
  'backgroundColor',
];

var actionProps = [
  'action',
  'up',
  'select',
  'back',
  'backgroundColor',
];

var accessorProps = configProps;

var nestedProps = [
  'action',
  'status',
];

var defaults = {
  status: false,
  backgroundColor: 'black',
  scrollable: false,
  paging: Feature.round(true, false),
};

var nextId = 1;

var checkProps = function(def) {
  if (!def) return;
  if ('fullscreen' in def && safe.warnFullscreen !== false) {
    safe.warn('`fullscreen` has been deprecated by `status` which allows settings\n\t' +
              'its color and separator in a similar manner to the `action` property.\n\t' +
              'Remove usages of `fullscreen` to enable usage of `status`.', 2);
    safe.warnFullscreen = false;
  }
};

var Window = function(windowDef) {
  checkProps(windowDef);
  this.state = myutil.shadow(defaults, windowDef || {});
  this.state.id = nextId++;
  this._buttonInit();
  this._items = [];
  this._dynamic = true;
  this._size = new Vector2();
  this.size(); // calculate and set the size
};

Window._codeName = 'window';

util2.copy(Emitter.prototype, Window.prototype);

util2.copy(Propable.prototype, Window.prototype);

util2.copy(Stage.prototype, Window.prototype);

Propable.makeAccessors(accessorProps, Window.prototype);

Propable.makeNestedAccessors(nestedProps, Window.prototype);

Window.prototype._id = function() {
  return this.state.id;
};

Window.prototype._prop = function(def, clear, pushing) {
  checkProps(def);
  Stage.prototype._prop.call(this, def, clear, pushing);
};

Window.prototype._hide = function(broadcast) {
  if (broadcast === false) { return; }
  simply.impl.windowHide(this._id());
};

Window.prototype.hide = function() {
  WindowStack.remove(this, true);
  return this;
};

Window.prototype._show = function(pushing) {
  this._prop(this.state, true, pushing || false);
  this._buttonConfig({});
  if (this._dynamic) {
    Stage.prototype._show.call(this, pushing);
  }
};

Window.prototype.show = function() {
  WindowStack.push(this);
  return this;
};

Window.prototype._insert = function() {
  if (this._dynamic) {
    Stage.prototype._insert.apply(this, arguments);
  }
};

Window.prototype._remove = function() {
  if (this._dynamic) {
    Stage.prototype._remove.apply(this, arguments);
  }
};

Window.prototype._clearStatus = function() {
  statusProps.forEach(Propable.unset.bind(this.state.status));
};

Window.prototype._clearAction = function() {
  actionProps.forEach(Propable.unset.bind(this.state.action));
};

Window.prototype._clear = function(flags_) {
  var flags = myutil.toFlags(flags_);
  if (myutil.flag(flags, 'action')) {
    this._clearAction();
  }
  if (myutil.flag(flags, 'status')) {
    this._clearStatus();
  }
  if (flags_ === true || flags_ === undefined) {
    Propable.prototype._clear.call(this);
  }
};

Window.prototype._action = function(actionDef) {
  if (this === WindowStack.top()) {
    simply.impl.windowActionBar(actionDef);
  }
};

Window.prototype._status = function(statusDef) {
  if (this === WindowStack.top()) {
    simply.impl.windowStatusBar(statusDef);
  }
};

var isBackEvent = function(type, subtype) {
  return ((type === 'click' || type === 'longClick') && subtype === 'back');
};

Window.prototype.onAddHandler = function(type, subtype) {
  if (isBackEvent(type, subtype)) {
    this._buttonAutoConfig();
  }
  if (type === 'accelData') {
    Accel.autoSubscribe();
  }
};

Window.prototype.onRemoveHandler = function(type, subtype) {
  if (!type || isBackEvent(type, subtype)) {
    this._buttonAutoConfig();
  }
  if (!type || type === 'accelData') {
    Accel.autoSubscribe();
  }
};

Window.prototype._buttonInit = function() {
  this._button = {
    config: {},
    configMode: 'auto',
  };
  for (var i = 0, ii = buttons.length; i < ii; i++) {
    var button = buttons[i];
    if (button !== 'back') {
      this._button.config[buttons[i]] = true;
    }
  }
};

/**
 * The button configuration parameter for {@link simply.buttonConfig}.
 * The button configuration allows you to enable to disable buttons without having to register or unregister handlers if that is your preferred style.
 * You may also enable the back button manually as an alternative to registering a click handler with 'back' as its subtype using {@link simply.on}.
 * @typedef {object} simply.buttonConf
 * @property {boolean} [back] - Whether to enable the back button. Initializes as false. Simply.js can also automatically register this for you based on the amount of click handlers with subtype 'back'.
 * @property {boolean} [up] - Whether to enable the up button. Initializes as true. Note that this is disabled when using {@link simply.scrollable}.
 * @property {boolean} [select] - Whether to enable the select button. Initializes as true.
 * @property {boolean} [down] - Whether to enable the down button. Initializes as true. Note that this is disabled when using {@link simply.scrollable}.
 */

/**
 * Changes the button configuration.
 * See {@link simply.buttonConfig}
 * @memberOf simply
 * @param {simply.buttonConfig} buttonConf - An object defining the button configuration.
 */
Window.prototype._buttonConfig = function(buttonConf, auto) {
  if (buttonConf === undefined) {
    var config = {};
    for (var i = 0, ii = buttons.length; i < ii; ++i) {
      var name = buttons[i];
      config[name] = this._button.config[name];
    }
    return config;
  }
  for (var k in buttonConf) {
    if (buttons.indexOf(k) !== -1) {
      if (k === 'back') {
        this._button.configMode = buttonConf.back && !auto ? 'manual' : 'auto';
      }
      this._button.config[k] = buttonConf[k];
    }
  }
  if (simply.impl.windowButtonConfig) {
    return simply.impl.windowButtonConfig(this._button.config);
  }
};

Window.prototype.buttonConfig = function(buttonConf) {
  this._buttonConfig(buttonConf);
};

Window.prototype._buttonAutoConfig = function() {
  if (!this._button || this._button.configMode !== 'auto') {
    return;
  }
  var singleBackCount = this.listenerCount('click', 'back');
  var longBackCount = this.listenerCount('longClick', 'back');
  var useBack = singleBackCount + longBackCount > 0;
  if (useBack !== this._button.config.back) {
    this._button.config.back = useBack;
    return this._buttonConfig(this._button.config, true);
  }
};

Window.prototype.size = function() {
  var state = this.state;
  var size = this._size.copy(Feature.resolution());
  if ('status' in state && state.status !== false) {
    size.y -= Feature.statusBarHeight();
  } else if ('fullscreen' in state && state.fullscreen === false) {
    size.y -= Feature.statusBarHeight();
  }
  if ('action' in state && state.action !== false) {
    size.x -= Feature.actionBarWidth();
  }
  return size;
};

Window.prototype._toString = function() {
  return '[' + this.constructor._codeName + ' ' + this._id() + ']';
};

Window.prototype._emit = function(type, subtype, e) {
  e.window = this;
  var klass = this.constructor;
  if (klass) {
    e[klass._codeName] = this;
  }
  if (this.emit(type, subtype, e) === false) {
    return false;
  }
};

Window.prototype._emitShow = function(type) {
  return this._emit(type, null, {});
};

Window.emit = function(type, subtype, e) {
  var wind = WindowStack.top();
  if (wind) {
    return wind._emit(type, subtype, e);
  }
};

/**
 * Simply.js button click event. This can either be a single click or long click.
 * Use the event type 'click' or 'longClick' to subscribe to these events.
 * @typedef simply.clickEvent
 * @property {string} button - The button that was pressed: 'back', 'up', 'select', or 'down'. This is also the event subtype.
 */

Window.emitClick = function(type, button) {
  var e = {
    button: button,
  };
  return Window.emit(type, button, e);
};

module.exports = Window;

});
__loader.define("ui/windowstack.js", 6386, function(exports, module, require) {
var util2 = require('util2');
var myutil = require('myutil');
var Emitter = require('emitter');
var simply = require('ui/simply');

var WindowStack = function() {
  this.init();
};

util2.copy(Emitter.prototype, WindowStack.prototype);

WindowStack.prototype.init = function() {
  this.off();
  this._items = [];

};

WindowStack.prototype.top = function() {
  return util2.last(this._items);
};

WindowStack.prototype._emitShow = function(item) {
  item.forEachListener(item.onAddHandler);
  item._emitShow('show');

  var e = {
    window: item
  };
  this.emit('show', e);
};

WindowStack.prototype._emitHide = function(item) {
  var e = {
    window: item
  };
  this.emit('hide', e);

  item._emitShow('hide');
  item.forEachListener(item.onRemoveHandler);
};

WindowStack.prototype._show = function(item, pushing) {
  if (!item) { return; }
  item._show(pushing);
  this._emitShow(item);
};

WindowStack.prototype._hide = function(item, broadcast) {
  if (!item) { return; }
  this._emitHide(item);
  item._hide(broadcast);
};

WindowStack.prototype.at = function(index) {
  return this._items[index];
};

WindowStack.prototype.index = function(item) {
  return this._items.indexOf(item);
};

WindowStack.prototype.push = function(item) {
  if (item === this.top()) { return; }
  this.remove(item);
  var prevTop = this.top();
  this._items.push(item);
  this._show(item, true);
  this._hide(prevTop, false);
  console.log('(+) ' + item._toString() + ' : ' + this._toString());
};

WindowStack.prototype.pop = function(broadcast) {
  return this.remove(this.top(), broadcast);
};

WindowStack.prototype.remove = function(item, broadcast) {
  if (typeof item === 'number') {
    item = this.get(item);
  }
  if (!item) { return; }
  var index = this.index(item);
  if (index === -1) { return item; }
  var wasTop = (item === this.top());
  this._items.splice(index, 1);
  if (wasTop) {
    var top = this.top();
    this._show(top);
    this._hide(item, top && top.constructor === item.constructor ? false : broadcast);
  }
  console.log('(-) ' + item._toString() + ' : ' + this._toString());
  return item;
};

WindowStack.prototype.get = function(windowId) {
  var items = this._items;
  for (var i = 0, ii = items.length; i < ii; ++i) {
    var wind = items[i];
    if (wind._id() === windowId) {
      return wind;
    }
  }
};

WindowStack.prototype.each = function(callback) {
  var items = this._items;
  for (var i = 0, ii = items.length; i < ii; ++i) {
    if (callback(items[i], i) === false) {
      break;
    }
  }
};

WindowStack.prototype.length = function() {
  return this._items.length;
};

WindowStack.prototype.emitHide = function(windowId) {
  var wind = this.get(windowId);
  if (wind !== this.top()) { return; }
  this.remove(wind);
};

WindowStack.prototype._toString = function() {
  return this._items.map(function(x){ return x._toString(); }).join(',');
};

module.exports = new WindowStack();

});
__loader.define("vendor/moment.js", 6516, function(exports, module, require) {
//! moment.js
//! version : 2.9.0
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

(function (undefined) {
    /************************************
        Constants
    ************************************/

    var moment,
        VERSION = '2.9.0',
        // the global-scope this is NOT the global object in Node.js
        globalScope = (typeof global !== 'undefined' && (typeof window === 'undefined' || window === global.window)) ? global : this,
        oldGlobalMoment,
        round = Math.round,
        hasOwnProperty = Object.prototype.hasOwnProperty,
        i,

        YEAR = 0,
        MONTH = 1,
        DATE = 2,
        HOUR = 3,
        MINUTE = 4,
        SECOND = 5,
        MILLISECOND = 6,

        // internal storage for locale config files
        locales = {},

        // extra moment internal properties (plugins register props here)
        momentProperties = [],

        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module && module.exports),

        // ASP.NET json date format regex
        aspNetJsonRegex = /^\/?Date\((\-?\d+)/i,
        aspNetTimeSpanJsonRegex = /(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/,

        // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
        // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
        isoDurationRegex = /^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/,

        // format tokens
        formattingTokens = /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Q|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,4}|x|X|zz?|ZZ?|.)/g,
        localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g,

        // parsing token regexes
        parseTokenOneOrTwoDigits = /\d\d?/, // 0 - 99
        parseTokenOneToThreeDigits = /\d{1,3}/, // 0 - 999
        parseTokenOneToFourDigits = /\d{1,4}/, // 0 - 9999
        parseTokenOneToSixDigits = /[+\-]?\d{1,6}/, // -999,999 - 999,999
        parseTokenDigits = /\d+/, // nonzero number of digits
        parseTokenWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i, // any word (or two) characters or numbers including two/three word month in arabic.
        parseTokenTimezone = /Z|[\+\-]\d\d:?\d\d/gi, // +00:00 -00:00 +0000 -0000 or Z
        parseTokenT = /T/i, // T (ISO separator)
        parseTokenOffsetMs = /[\+\-]?\d+/, // 1234567890123
        parseTokenTimestampMs = /[\+\-]?\d+(\.\d{1,3})?/, // 123456789 123456789.123

        //strict parsing regexes
        parseTokenOneDigit = /\d/, // 0 - 9
        parseTokenTwoDigits = /\d\d/, // 00 - 99
        parseTokenThreeDigits = /\d{3}/, // 000 - 999
        parseTokenFourDigits = /\d{4}/, // 0000 - 9999
        parseTokenSixDigits = /[+-]?\d{6}/, // -999,999 - 999,999
        parseTokenSignedNumber = /[+-]?\d+/, // -inf - inf

        // iso 8601 regex
        // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
        isoRegex = /^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/,

        isoFormat = 'YYYY-MM-DDTHH:mm:ssZ',

        isoDates = [
            ['YYYYYY-MM-DD', /[+-]\d{6}-\d{2}-\d{2}/],
            ['YYYY-MM-DD', /\d{4}-\d{2}-\d{2}/],
            ['GGGG-[W]WW-E', /\d{4}-W\d{2}-\d/],
            ['GGGG-[W]WW', /\d{4}-W\d{2}/],
            ['YYYY-DDD', /\d{4}-\d{3}/]
        ],

        // iso time formats and regexes
        isoTimes = [
            ['HH:mm:ss.SSSS', /(T| )\d\d:\d\d:\d\d\.\d+/],
            ['HH:mm:ss', /(T| )\d\d:\d\d:\d\d/],
            ['HH:mm', /(T| )\d\d:\d\d/],
            ['HH', /(T| )\d\d/]
        ],

        // timezone chunker '+10:00' > ['10', '00'] or '-1530' > ['-', '15', '30']
        parseTimezoneChunker = /([\+\-]|\d\d)/gi,

        // getter and setter names
        proxyGettersAndSetters = 'Date|Hours|Minutes|Seconds|Milliseconds'.split('|'),
        unitMillisecondFactors = {
            'Milliseconds' : 1,
            'Seconds' : 1e3,
            'Minutes' : 6e4,
            'Hours' : 36e5,
            'Days' : 864e5,
            'Months' : 2592e6,
            'Years' : 31536e6
        },

        unitAliases = {
            ms : 'millisecond',
            s : 'second',
            m : 'minute',
            h : 'hour',
            d : 'day',
            D : 'date',
            w : 'week',
            W : 'isoWeek',
            M : 'month',
            Q : 'quarter',
            y : 'year',
            DDD : 'dayOfYear',
            e : 'weekday',
            E : 'isoWeekday',
            gg: 'weekYear',
            GG: 'isoWeekYear'
        },

        camelFunctions = {
            dayofyear : 'dayOfYear',
            isoweekday : 'isoWeekday',
            isoweek : 'isoWeek',
            weekyear : 'weekYear',
            isoweekyear : 'isoWeekYear'
        },

        // format function strings
        formatFunctions = {},

        // default relative time thresholds
        relativeTimeThresholds = {
            s: 45,  // seconds to minute
            m: 45,  // minutes to hour
            h: 22,  // hours to day
            d: 26,  // days to month
            M: 11   // months to year
        },

        // tokens to ordinalize and pad
        ordinalizeTokens = 'DDD w W M D d'.split(' '),
        paddedTokens = 'M D H h m s w W'.split(' '),

        formatTokenFunctions = {
            M    : function () {
                return this.month() + 1;
            },
            MMM  : function (format) {
                return this.localeData().monthsShort(this, format);
            },
            MMMM : function (format) {
                return this.localeData().months(this, format);
            },
            D    : function () {
                return this.date();
            },
            DDD  : function () {
                return this.dayOfYear();
            },
            d    : function () {
                return this.day();
            },
            dd   : function (format) {
                return this.localeData().weekdaysMin(this, format);
            },
            ddd  : function (format) {
                return this.localeData().weekdaysShort(this, format);
            },
            dddd : function (format) {
                return this.localeData().weekdays(this, format);
            },
            w    : function () {
                return this.week();
            },
            W    : function () {
                return this.isoWeek();
            },
            YY   : function () {
                return leftZeroFill(this.year() % 100, 2);
            },
            YYYY : function () {
                return leftZeroFill(this.year(), 4);
            },
            YYYYY : function () {
                return leftZeroFill(this.year(), 5);
            },
            YYYYYY : function () {
                var y = this.year(), sign = y >= 0 ? '+' : '-';
                return sign + leftZeroFill(Math.abs(y), 6);
            },
            gg   : function () {
                return leftZeroFill(this.weekYear() % 100, 2);
            },
            gggg : function () {
                return leftZeroFill(this.weekYear(), 4);
            },
            ggggg : function () {
                return leftZeroFill(this.weekYear(), 5);
            },
            GG   : function () {
                return leftZeroFill(this.isoWeekYear() % 100, 2);
            },
            GGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 4);
            },
            GGGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 5);
            },
            e : function () {
                return this.weekday();
            },
            E : function () {
                return this.isoWeekday();
            },
            a    : function () {
                return this.localeData().meridiem(this.hours(), this.minutes(), true);
            },
            A    : function () {
                return this.localeData().meridiem(this.hours(), this.minutes(), false);
            },
            H    : function () {
                return this.hours();
            },
            h    : function () {
                return this.hours() % 12 || 12;
            },
            m    : function () {
                return this.minutes();
            },
            s    : function () {
                return this.seconds();
            },
            S    : function () {
                return toInt(this.milliseconds() / 100);
            },
            SS   : function () {
                return leftZeroFill(toInt(this.milliseconds() / 10), 2);
            },
            SSS  : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            SSSS : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            Z    : function () {
                var a = this.utcOffset(),
                    b = '+';
                if (a < 0) {
                    a = -a;
                    b = '-';
                }
                return b + leftZeroFill(toInt(a / 60), 2) + ':' + leftZeroFill(toInt(a) % 60, 2);
            },
            ZZ   : function () {
                var a = this.utcOffset(),
                    b = '+';
                if (a < 0) {
                    a = -a;
                    b = '-';
                }
                return b + leftZeroFill(toInt(a / 60), 2) + leftZeroFill(toInt(a) % 60, 2);
            },
            z : function () {
                return this.zoneAbbr();
            },
            zz : function () {
                return this.zoneName();
            },
            x    : function () {
                return this.valueOf();
            },
            X    : function () {
                return this.unix();
            },
            Q : function () {
                return this.quarter();
            }
        },

        deprecations = {},

        lists = ['months', 'monthsShort', 'weekdays', 'weekdaysShort', 'weekdaysMin'],

        updateInProgress = false;

    // Pick the first defined of two or three arguments. dfl comes from
    // default.
    function dfl(a, b, c) {
        switch (arguments.length) {
            case 2: return a != null ? a : b;
            case 3: return a != null ? a : b != null ? b : c;
            default: throw new Error('Implement me');
        }
    }

    function hasOwnProp(a, b) {
        return hasOwnProperty.call(a, b);
    }

    function defaultParsingFlags() {
        // We need to deep clone this object, and es5 standard is not very
        // helpful.
        return {
            empty : false,
            unusedTokens : [],
            unusedInput : [],
            overflow : -2,
            charsLeftOver : 0,
            nullInput : false,
            invalidMonth : null,
            invalidFormat : false,
            userInvalidated : false,
            iso: false
        };
    }

    function printMsg(msg) {
        if (moment.suppressDeprecationWarnings === false &&
                typeof console !== 'undefined' && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;
        return extend(function () {
            if (firstTime) {
                printMsg(msg);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    function deprecateSimple(name, msg) {
        if (!deprecations[name]) {
            printMsg(msg);
            deprecations[name] = true;
        }
    }

    function padToken(func, count) {
        return function (a) {
            return leftZeroFill(func.call(this, a), count);
        };
    }
    function ordinalizeToken(func, period) {
        return function (a) {
            return this.localeData().ordinal(func.call(this, a), period);
        };
    }

    function monthDiff(a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        return -(wholeMonthDiff + adjust);
    }

    while (ordinalizeTokens.length) {
        i = ordinalizeTokens.pop();
        formatTokenFunctions[i + 'o'] = ordinalizeToken(formatTokenFunctions[i], i);
    }
    while (paddedTokens.length) {
        i = paddedTokens.pop();
        formatTokenFunctions[i + i] = padToken(formatTokenFunctions[i], 2);
    }
    formatTokenFunctions.DDDD = padToken(formatTokenFunctions.DDD, 3);


    function meridiemFixWrap(locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // thie is not supposed to happen
            return hour;
        }
    }

    /************************************
        Constructors
    ************************************/

    function Locale() {
    }

    // Moment prototype object
    function Moment(config, skipOverflow) {
        if (skipOverflow !== false) {
            checkOverflow(config);
        }
        copyConfig(this, config);
        this._d = new Date(+config._d);
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            moment.updateOffset(this);
            updateInProgress = false;
        }
    }

    // Duration Constructor
    function Duration(duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 36e5; // 1000 * 60 * 60
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = moment.localeData();

        this._bubble();
    }

    /************************************
        Helpers
    ************************************/


    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function copyConfig(to, from) {
        var i, prop, val;

        if (typeof from._isAMomentObject !== 'undefined') {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (typeof from._i !== 'undefined') {
            to._i = from._i;
        }
        if (typeof from._f !== 'undefined') {
            to._f = from._f;
        }
        if (typeof from._l !== 'undefined') {
            to._l = from._l;
        }
        if (typeof from._strict !== 'undefined') {
            to._strict = from._strict;
        }
        if (typeof from._tzm !== 'undefined') {
            to._tzm = from._tzm;
        }
        if (typeof from._isUTC !== 'undefined') {
            to._isUTC = from._isUTC;
        }
        if (typeof from._offset !== 'undefined') {
            to._offset = from._offset;
        }
        if (typeof from._pf !== 'undefined') {
            to._pf = from._pf;
        }
        if (typeof from._locale !== 'undefined') {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i in momentProperties) {
                prop = momentProperties[i];
                val = from[prop];
                if (typeof val !== 'undefined') {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    function absRound(number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    // left zero fill a number
    // see http://jsperf.com/left-zero-filling for performance comparison
    function leftZeroFill(number, targetLength, forceSign) {
        var output = '' + Math.abs(number),
            sign = number >= 0;

        while (output.length < targetLength) {
            output = '0' + output;
        }
        return (sign ? (forceSign ? '+' : '') : '-') + output;
    }

    function positiveMomentsDifference(base, other) {
        var res = {milliseconds: 0, months: 0};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        other = makeAs(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period).');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = moment.duration(val, period);
            addOrSubtractDurationFromMoment(this, dur, direction);
            return this;
        };
    }

    function addOrSubtractDurationFromMoment(mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = duration._days,
            months = duration._months;
        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(+mom._d + milliseconds * isAdding);
        }
        if (days) {
            rawSetter(mom, 'Date', rawGetter(mom, 'Date') + days * isAdding);
        }
        if (months) {
            rawMonthSetter(mom, rawGetter(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            moment.updateOffset(mom, days || months);
        }
    }

    // check if is an array
    function isArray(input) {
        return Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return Object.prototype.toString.call(input) === '[object Date]' ||
            input instanceof Date;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function normalizeUnits(units) {
        if (units) {
            var lowered = units.toLowerCase().replace(/(.)s$/, '$1');
            units = unitAliases[units] || camelFunctions[lowered] || lowered;
        }
        return units;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeList(field) {
        var count, setter;

        if (field.indexOf('week') === 0) {
            count = 7;
            setter = 'day';
        }
        else if (field.indexOf('month') === 0) {
            count = 12;
            setter = 'month';
        }
        else {
            return;
        }

        moment[field] = function (format, index) {
            var i, getter,
                method = moment._locale[field],
                results = [];

            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            getter = function (i) {
                var m = moment().utc().set(setter, i);
                return method.call(moment._locale, m, format || '');
            };

            if (index != null) {
                return getter(index);
            }
            else {
                for (i = 0; i < count; i++) {
                    results.push(getter(i));
                }
                return results;
            }
        };
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            if (coercedNumber >= 0) {
                value = Math.floor(coercedNumber);
            } else {
                value = Math.ceil(coercedNumber);
            }
        }

        return value;
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    function weeksInYear(year, dow, doy) {
        return weekOfYear(moment([year, 11, 31 + dow - doy]), dow, doy).week;
    }

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    function checkOverflow(m) {
        var overflow;
        if (m._a && m._pf.overflow === -2) {
            overflow =
                m._a[MONTH] < 0 || m._a[MONTH] > 11 ? MONTH :
                m._a[DATE] < 1 || m._a[DATE] > daysInMonth(m._a[YEAR], m._a[MONTH]) ? DATE :
                m._a[HOUR] < 0 || m._a[HOUR] > 24 ||
                    (m._a[HOUR] === 24 && (m._a[MINUTE] !== 0 ||
                                           m._a[SECOND] !== 0 ||
                                           m._a[MILLISECOND] !== 0)) ? HOUR :
                m._a[MINUTE] < 0 || m._a[MINUTE] > 59 ? MINUTE :
                m._a[SECOND] < 0 || m._a[SECOND] > 59 ? SECOND :
                m._a[MILLISECOND] < 0 || m._a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (m._pf._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }

            m._pf.overflow = overflow;
        }
    }

    function isValid(m) {
        if (m._isValid == null) {
            m._isValid = !isNaN(m._d.getTime()) &&
                m._pf.overflow < 0 &&
                !m._pf.empty &&
                !m._pf.invalidMonth &&
                !m._pf.nullInput &&
                !m._pf.invalidFormat &&
                !m._pf.userInvalidated;

            if (m._strict) {
                m._isValid = m._isValid &&
                    m._pf.charsLeftOver === 0 &&
                    m._pf.unusedTokens.length === 0 &&
                    m._pf.bigHour === undefined;
            }
        }
        return m._isValid;
    }

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return null;
    }

    function loadLocale(name) {
        var oldLocale = null;
        if (!locales[name] && hasModule) {
            try {
                oldLocale = moment.locale();
                require('./locale/' + name);
                // because defineLocale currently also sets the global locale, we want to undo that for lazy loaded locales
                moment.locale(oldLocale);
            } catch (e) { }
        }
        return locales[name];
    }

    // Return a moment from input, that is local/utc/utcOffset equivalent to
    // model.
    function makeAs(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (moment.isMoment(input) || isDate(input) ?
                    +input : +moment(input)) - (+res);
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(+res._d + diff);
            moment.updateOffset(res, false);
            return res;
        } else {
            return moment(input).local();
        }
    }

    /************************************
        Locale
    ************************************/


    extend(Locale.prototype, {

        set : function (config) {
            var prop, i;
            for (i in config) {
                prop = config[i];
                if (typeof prop === 'function') {
                    this[i] = prop;
                } else {
                    this['_' + i] = prop;
                }
            }
            // Lenient ordinal parsing accepts just a number in addition to
            // number + (possibly) stuff coming from _ordinalParseLenient.
            this._ordinalParseLenient = new RegExp(this._ordinalParse.source + '|' + /\d{1,2}/.source);
        },

        _months : 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_'),
        months : function (m) {
            return this._months[m.month()];
        },

        _monthsShort : 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_'),
        monthsShort : function (m) {
            return this._monthsShort[m.month()];
        },

        monthsParse : function (monthName, format, strict) {
            var i, mom, regex;

            if (!this._monthsParse) {
                this._monthsParse = [];
                this._longMonthsParse = [];
                this._shortMonthsParse = [];
            }

            for (i = 0; i < 12; i++) {
                // make the regex if we don't have it already
                mom = moment.utc([2000, i]);
                if (strict && !this._longMonthsParse[i]) {
                    this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                    this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
                }
                if (!strict && !this._monthsParse[i]) {
                    regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                    this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                    return i;
                } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                    return i;
                } else if (!strict && this._monthsParse[i].test(monthName)) {
                    return i;
                }
            }
        },

        _weekdays : 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_'),
        weekdays : function (m) {
            return this._weekdays[m.day()];
        },

        _weekdaysShort : 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_'),
        weekdaysShort : function (m) {
            return this._weekdaysShort[m.day()];
        },

        _weekdaysMin : 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_'),
        weekdaysMin : function (m) {
            return this._weekdaysMin[m.day()];
        },

        weekdaysParse : function (weekdayName) {
            var i, mom, regex;

            if (!this._weekdaysParse) {
                this._weekdaysParse = [];
            }

            for (i = 0; i < 7; i++) {
                // make the regex if we don't have it already
                if (!this._weekdaysParse[i]) {
                    mom = moment([2000, 1]).day(i);
                    regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                    this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._weekdaysParse[i].test(weekdayName)) {
                    return i;
                }
            }
        },

        _longDateFormat : {
            LTS : 'h:mm:ss A',
            LT : 'h:mm A',
            L : 'MM/DD/YYYY',
            LL : 'MMMM D, YYYY',
            LLL : 'MMMM D, YYYY LT',
            LLLL : 'dddd, MMMM D, YYYY LT'
        },
        longDateFormat : function (key) {
            var output = this._longDateFormat[key];
            if (!output && this._longDateFormat[key.toUpperCase()]) {
                output = this._longDateFormat[key.toUpperCase()].replace(/MMMM|MM|DD|dddd/g, function (val) {
                    return val.slice(1);
                });
                this._longDateFormat[key] = output;
            }
            return output;
        },

        isPM : function (input) {
            // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
            // Using charAt should be more compatible.
            return ((input + '').toLowerCase().charAt(0) === 'p');
        },

        _meridiemParse : /[ap]\.?m?\.?/i,
        meridiem : function (hours, minutes, isLower) {
            if (hours > 11) {
                return isLower ? 'pm' : 'PM';
            } else {
                return isLower ? 'am' : 'AM';
            }
        },


        _calendar : {
            sameDay : '[Today at] LT',
            nextDay : '[Tomorrow at] LT',
            nextWeek : 'dddd [at] LT',
            lastDay : '[Yesterday at] LT',
            lastWeek : '[Last] dddd [at] LT',
            sameElse : 'L'
        },
        calendar : function (key, mom, now) {
            var output = this._calendar[key];
            return typeof output === 'function' ? output.apply(mom, [now]) : output;
        },

        _relativeTime : {
            future : 'in %s',
            past : '%s ago',
            s : 'a few seconds',
            m : 'a minute',
            mm : '%d minutes',
            h : 'an hour',
            hh : '%d hours',
            d : 'a day',
            dd : '%d days',
            M : 'a month',
            MM : '%d months',
            y : 'a year',
            yy : '%d years'
        },

        relativeTime : function (number, withoutSuffix, string, isFuture) {
            var output = this._relativeTime[string];
            return (typeof output === 'function') ?
                output(number, withoutSuffix, string, isFuture) :
                output.replace(/%d/i, number);
        },

        pastFuture : function (diff, output) {
            var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
            return typeof format === 'function' ? format(output) : format.replace(/%s/i, output);
        },

        ordinal : function (number) {
            return this._ordinal.replace('%d', number);
        },
        _ordinal : '%d',
        _ordinalParse : /\d{1,2}/,

        preparse : function (string) {
            return string;
        },

        postformat : function (string) {
            return string;
        },

        week : function (mom) {
            return weekOfYear(mom, this._week.dow, this._week.doy).week;
        },

        _week : {
            dow : 0, // Sunday is the first day of the week.
            doy : 6  // The week that contains Jan 1st is the first week of the year.
        },

        firstDayOfWeek : function () {
            return this._week.dow;
        },

        firstDayOfYear : function () {
            return this._week.doy;
        },

        _invalidDate: 'Invalid date',
        invalidDate: function () {
            return this._invalidDate;
        }
    });

    /************************************
        Formatting
    ************************************/


    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '';
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());

        if (!formatFunctions[format]) {
            formatFunctions[format] = makeFormatFunction(format);
        }

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }


    /************************************
        Parsing
    ************************************/


    // get the regex to find the next token
    function getParseRegexForToken(token, config) {
        var a, strict = config._strict;
        switch (token) {
        case 'Q':
            return parseTokenOneDigit;
        case 'DDDD':
            return parseTokenThreeDigits;
        case 'YYYY':
        case 'GGGG':
        case 'gggg':
            return strict ? parseTokenFourDigits : parseTokenOneToFourDigits;
        case 'Y':
        case 'G':
        case 'g':
            return parseTokenSignedNumber;
        case 'YYYYYY':
        case 'YYYYY':
        case 'GGGGG':
        case 'ggggg':
            return strict ? parseTokenSixDigits : parseTokenOneToSixDigits;
        case 'S':
            if (strict) {
                return parseTokenOneDigit;
            }
            /* falls through */
        case 'SS':
            if (strict) {
                return parseTokenTwoDigits;
            }
            /* falls through */
        case 'SSS':
            if (strict) {
                return parseTokenThreeDigits;
            }
            /* falls through */
        case 'DDD':
            return parseTokenOneToThreeDigits;
        case 'MMM':
        case 'MMMM':
        case 'dd':
        case 'ddd':
        case 'dddd':
            return parseTokenWord;
        case 'a':
        case 'A':
            return config._locale._meridiemParse;
        case 'x':
            return parseTokenOffsetMs;
        case 'X':
            return parseTokenTimestampMs;
        case 'Z':
        case 'ZZ':
            return parseTokenTimezone;
        case 'T':
            return parseTokenT;
        case 'SSSS':
            return parseTokenDigits;
        case 'MM':
        case 'DD':
        case 'YY':
        case 'GG':
        case 'gg':
        case 'HH':
        case 'hh':
        case 'mm':
        case 'ss':
        case 'ww':
        case 'WW':
            return strict ? parseTokenTwoDigits : parseTokenOneOrTwoDigits;
        case 'M':
        case 'D':
        case 'd':
        case 'H':
        case 'h':
        case 'm':
        case 's':
        case 'w':
        case 'W':
        case 'e':
        case 'E':
            return parseTokenOneOrTwoDigits;
        case 'Do':
            return strict ? config._locale._ordinalParse : config._locale._ordinalParseLenient;
        default :
            a = new RegExp(regexpEscape(unescapeFormat(token.replace('\\', '')), 'i'));
            return a;
        }
    }

    function utcOffsetFromString(string) {
        string = string || '';
        var possibleTzMatches = (string.match(parseTokenTimezone) || []),
            tzChunk = possibleTzMatches[possibleTzMatches.length - 1] || [],
            parts = (tzChunk + '').match(parseTimezoneChunker) || ['-', 0, 0],
            minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? minutes : -minutes;
    }

    // function to convert string input to date
    function addTimeToArrayFromToken(token, input, config) {
        var a, datePartArray = config._a;

        switch (token) {
        // QUARTER
        case 'Q':
            if (input != null) {
                datePartArray[MONTH] = (toInt(input) - 1) * 3;
            }
            break;
        // MONTH
        case 'M' : // fall through to MM
        case 'MM' :
            if (input != null) {
                datePartArray[MONTH] = toInt(input) - 1;
            }
            break;
        case 'MMM' : // fall through to MMMM
        case 'MMMM' :
            a = config._locale.monthsParse(input, token, config._strict);
            // if we didn't find a month name, mark the date as invalid.
            if (a != null) {
                datePartArray[MONTH] = a;
            } else {
                config._pf.invalidMonth = input;
            }
            break;
        // DAY OF MONTH
        case 'D' : // fall through to DD
        case 'DD' :
            if (input != null) {
                datePartArray[DATE] = toInt(input);
            }
            break;
        case 'Do' :
            if (input != null) {
                datePartArray[DATE] = toInt(parseInt(
                            input.match(/\d{1,2}/)[0], 10));
            }
            break;
        // DAY OF YEAR
        case 'DDD' : // fall through to DDDD
        case 'DDDD' :
            if (input != null) {
                config._dayOfYear = toInt(input);
            }

            break;
        // YEAR
        case 'YY' :
            datePartArray[YEAR] = moment.parseTwoDigitYear(input);
            break;
        case 'YYYY' :
        case 'YYYYY' :
        case 'YYYYYY' :
            datePartArray[YEAR] = toInt(input);
            break;
        // AM / PM
        case 'a' : // fall through to A
        case 'A' :
            config._meridiem = input;
            // config._isPm = config._locale.isPM(input);
            break;
        // HOUR
        case 'h' : // fall through to hh
        case 'hh' :
            config._pf.bigHour = true;
            /* falls through */
        case 'H' : // fall through to HH
        case 'HH' :
            datePartArray[HOUR] = toInt(input);
            break;
        // MINUTE
        case 'm' : // fall through to mm
        case 'mm' :
            datePartArray[MINUTE] = toInt(input);
            break;
        // SECOND
        case 's' : // fall through to ss
        case 'ss' :
            datePartArray[SECOND] = toInt(input);
            break;
        // MILLISECOND
        case 'S' :
        case 'SS' :
        case 'SSS' :
        case 'SSSS' :
            datePartArray[MILLISECOND] = toInt(('0.' + input) * 1000);
            break;
        // UNIX OFFSET (MILLISECONDS)
        case 'x':
            config._d = new Date(toInt(input));
            break;
        // UNIX TIMESTAMP WITH MS
        case 'X':
            config._d = new Date(parseFloat(input) * 1000);
            break;
        // TIMEZONE
        case 'Z' : // fall through to ZZ
        case 'ZZ' :
            config._useUTC = true;
            config._tzm = utcOffsetFromString(input);
            break;
        // WEEKDAY - human
        case 'dd':
        case 'ddd':
        case 'dddd':
            a = config._locale.weekdaysParse(input);
            // if we didn't get a weekday name, mark the date as invalid
            if (a != null) {
                config._w = config._w || {};
                config._w['d'] = a;
            } else {
                config._pf.invalidWeekday = input;
            }
            break;
        // WEEK, WEEK DAY - numeric
        case 'w':
        case 'ww':
        case 'W':
        case 'WW':
        case 'd':
        case 'e':
        case 'E':
            token = token.substr(0, 1);
            /* falls through */
        case 'gggg':
        case 'GGGG':
        case 'GGGGG':
            token = token.substr(0, 2);
            if (input) {
                config._w = config._w || {};
                config._w[token] = toInt(input);
            }
            break;
        case 'gg':
        case 'GG':
            config._w = config._w || {};
            config._w[token] = moment.parseTwoDigitYear(input);
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = dfl(w.GG, config._a[YEAR], weekOfYear(moment(), 1, 4).year);
            week = dfl(w.W, 1);
            weekday = dfl(w.E, 1);
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            weekYear = dfl(w.gg, config._a[YEAR], weekOfYear(moment(), dow, doy).year);
            week = dfl(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < dow) {
                    ++week;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        temp = dayOfYearFromWeeks(weekYear, week, weekday, doy, dow);

        config._a[YEAR] = temp.year;
        config._dayOfYear = temp.dayOfYear;
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function dateFromConfig(config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = dfl(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                config._pf._overflowDayOfYear = true;
            }

            date = makeUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? makeUTCDate : makeDate).apply(null, input);
        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }
    }

    function dateFromObject(config) {
        var normalizedInput;

        if (config._d) {
            return;
        }

        normalizedInput = normalizeObjectUnits(config._i);
        config._a = [
            normalizedInput.year,
            normalizedInput.month,
            normalizedInput.day || normalizedInput.date,
            normalizedInput.hour,
            normalizedInput.minute,
            normalizedInput.second,
            normalizedInput.millisecond
        ];

        dateFromConfig(config);
    }

    function currentDateArray(config) {
        var now = new Date();
        if (config._useUTC) {
            return [
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate()
            ];
        } else {
            return [now.getFullYear(), now.getMonth(), now.getDate()];
        }
    }

    // date from string and format string
    function makeDateFromStringAndFormat(config) {
        if (config._f === moment.ISO_8601) {
            parseISO(config);
            return;
        }

        config._a = [];
        config._pf.empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    config._pf.unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    config._pf.empty = false;
                }
                else {
                    config._pf.unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                config._pf.unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        config._pf.charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            config._pf.unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._pf.bigHour === true && config._a[HOUR] <= 12) {
            config._pf.bigHour = undefined;
        }
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR],
                config._meridiem);
        dateFromConfig(config);
        checkOverflow(config);
    }

    function unescapeFormat(s) {
        return s.replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        });
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function regexpEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    // date from string and array of format strings
    function makeDateFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            config._pf.invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._pf = defaultParsingFlags();
            tempConfig._f = config._f[i];
            makeDateFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += tempConfig._pf.charsLeftOver;

            //or tokens
            currentScore += tempConfig._pf.unusedTokens.length * 10;

            tempConfig._pf.score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    // date from iso format
    function parseISO(config) {
        var i, l,
            string = config._i,
            match = isoRegex.exec(string);

        if (match) {
            config._pf.iso = true;
            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(string)) {
                    // match[5] should be 'T' or undefined
                    config._f = isoDates[i][0] + (match[6] || ' ');
                    break;
                }
            }
            for (i = 0, l = isoTimes.length; i < l; i++) {
                if (isoTimes[i][1].exec(string)) {
                    config._f += isoTimes[i][0];
                    break;
                }
            }
            if (string.match(parseTokenTimezone)) {
                config._f += 'Z';
            }
            makeDateFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function makeDateFromString(config) {
        parseISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            moment.createFromInputFallback(config);
        }
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function makeDateFromInput(config) {
        var input = config._i, matched;
        if (input === undefined) {
            config._d = new Date();
        } else if (isDate(input)) {
            config._d = new Date(+input);
        } else if ((matched = aspNetJsonRegex.exec(input)) !== null) {
            config._d = new Date(+matched[1]);
        } else if (typeof input === 'string') {
            makeDateFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            dateFromConfig(config);
        } else if (typeof(input) === 'object') {
            dateFromObject(config);
        } else if (typeof(input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            moment.createFromInputFallback(config);
        }
    }

    function makeDate(y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor doesn't accept years < 1970
        if (y < 1970) {
            date.setFullYear(y);
        }
        return date;
    }

    function makeUTCDate(y) {
        var date = new Date(Date.UTC.apply(null, arguments));
        if (y < 1970) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    function parseWeekday(input, locale) {
        if (typeof input === 'string') {
            if (!isNaN(input)) {
                input = parseInt(input, 10);
            }
            else {
                input = locale.weekdaysParse(input);
                if (typeof input !== 'number') {
                    return null;
                }
            }
        }
        return input;
    }

    /************************************
        Relative Time
    ************************************/


    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime(posNegDuration, withoutSuffix, locale) {
        var duration = moment.duration(posNegDuration).abs(),
            seconds = round(duration.as('s')),
            minutes = round(duration.as('m')),
            hours = round(duration.as('h')),
            days = round(duration.as('d')),
            months = round(duration.as('M')),
            years = round(duration.as('y')),

            args = seconds < relativeTimeThresholds.s && ['s', seconds] ||
                minutes === 1 && ['m'] ||
                minutes < relativeTimeThresholds.m && ['mm', minutes] ||
                hours === 1 && ['h'] ||
                hours < relativeTimeThresholds.h && ['hh', hours] ||
                days === 1 && ['d'] ||
                days < relativeTimeThresholds.d && ['dd', days] ||
                months === 1 && ['M'] ||
                months < relativeTimeThresholds.M && ['MM', months] ||
                years === 1 && ['y'] || ['yy', years];

        args[2] = withoutSuffix;
        args[3] = +posNegDuration > 0;
        args[4] = locale;
        return substituteTimeAgo.apply({}, args);
    }


    /************************************
        Week of Year
    ************************************/


    // firstDayOfWeek       0 = sun, 6 = sat
    //                      the day of the week that starts the week
    //                      (usually sunday or monday)
    // firstDayOfWeekOfYear 0 = sun, 6 = sat
    //                      the first week is the week that contains the first
    //                      of this day of the week
    //                      (eg. ISO weeks use thursday (4))
    function weekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
        var end = firstDayOfWeekOfYear - firstDayOfWeek,
            daysToDayOfWeek = firstDayOfWeekOfYear - mom.day(),
            adjustedMoment;


        if (daysToDayOfWeek > end) {
            daysToDayOfWeek -= 7;
        }

        if (daysToDayOfWeek < end - 7) {
            daysToDayOfWeek += 7;
        }

        adjustedMoment = moment(mom).add(daysToDayOfWeek, 'd');
        return {
            week: Math.ceil(adjustedMoment.dayOfYear() / 7),
            year: adjustedMoment.year()
        };
    }

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, firstDayOfWeekOfYear, firstDayOfWeek) {
        var d = makeUTCDate(year, 0, 1).getUTCDay(), daysToAdd, dayOfYear;

        d = d === 0 ? 7 : d;
        weekday = weekday != null ? weekday : firstDayOfWeek;
        daysToAdd = firstDayOfWeek - d + (d > firstDayOfWeekOfYear ? 7 : 0) - (d < firstDayOfWeek ? 7 : 0);
        dayOfYear = 7 * (week - 1) + (weekday - firstDayOfWeek) + daysToAdd + 1;

        return {
            year: dayOfYear > 0 ? year : year - 1,
            dayOfYear: dayOfYear > 0 ?  dayOfYear : daysInYear(year - 1) + dayOfYear
        };
    }

    /************************************
        Top Level Functions
    ************************************/

    function makeMoment(config) {
        var input = config._i,
            format = config._f,
            res;

        config._locale = config._locale || moment.localeData(config._l);

        if (input === null || (format === undefined && input === '')) {
            return moment.invalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (moment.isMoment(input)) {
            return new Moment(input, true);
        } else if (format) {
            if (isArray(format)) {
                makeDateFromStringAndArray(config);
            } else {
                makeDateFromStringAndFormat(config);
            }
        } else {
            makeDateFromInput(config);
        }

        res = new Moment(config);
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    moment = function (input, format, locale, strict) {
        var c;

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._i = input;
        c._f = format;
        c._l = locale;
        c._strict = strict;
        c._isUTC = false;
        c._pf = defaultParsingFlags();

        return makeMoment(c);
    };

    moment.suppressDeprecationWarnings = false;

    moment.createFromInputFallback = deprecate(
        'moment construction falls back to js Date. This is ' +
        'discouraged and will be removed in upcoming major ' +
        'release. Please refer to ' +
        'https://github.com/moment/moment/issues/1407 for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return moment();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    moment.min = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    };

    moment.max = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    };

    // creating with utc
    moment.utc = function (input, format, locale, strict) {
        var c;

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._useUTC = true;
        c._isUTC = true;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;
        c._pf = defaultParsingFlags();

        return makeMoment(c).utc();
    };

    // creating with unix timestamp (in seconds)
    moment.unix = function (input) {
        return moment(input * 1000);
    };

    // duration
    moment.duration = function (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            parseIso,
            diffRes;

        if (moment.isDuration(input)) {
            duration = {
                ms: input._milliseconds,
                d: input._days,
                M: input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetTimeSpanJsonRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y: 0,
                d: toInt(match[DATE]) * sign,
                h: toInt(match[HOUR]) * sign,
                m: toInt(match[MINUTE]) * sign,
                s: toInt(match[SECOND]) * sign,
                ms: toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = isoDurationRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            parseIso = function (inp) {
                // We'd normally use ~~inp for this, but unfortunately it also
                // converts floats to ints.
                // inp may be undefined, so careful calling replace on it.
                var res = inp && parseFloat(inp.replace(',', '.'));
                // apply sign while we're at it
                return (isNaN(res) ? 0 : res) * sign;
            };
            duration = {
                y: parseIso(match[2]),
                M: parseIso(match[3]),
                d: parseIso(match[4]),
                h: parseIso(match[5]),
                m: parseIso(match[6]),
                s: parseIso(match[7]),
                w: parseIso(match[8])
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' &&
                ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(moment(duration.from), moment(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (moment.isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    };

    // version number
    moment.version = VERSION;

    // default format
    moment.defaultFormat = isoFormat;

    // constant that refers to the ISO standard
    moment.ISO_8601 = function () {};

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    moment.momentProperties = momentProperties;

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    moment.updateOffset = function () {};

    // This function allows you to set a threshold for relative time strings
    moment.relativeTimeThreshold = function (threshold, limit) {
        if (relativeTimeThresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return relativeTimeThresholds[threshold];
        }
        relativeTimeThresholds[threshold] = limit;
        return true;
    };

    moment.lang = deprecate(
        'moment.lang is deprecated. Use moment.locale instead.',
        function (key, value) {
            return moment.locale(key, value);
        }
    );

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    moment.locale = function (key, values) {
        var data;
        if (key) {
            if (typeof(values) !== 'undefined') {
                data = moment.defineLocale(key, values);
            }
            else {
                data = moment.localeData(key);
            }

            if (data) {
                moment.duration._locale = moment._locale = data;
            }
        }

        return moment._locale._abbr;
    };

    moment.defineLocale = function (name, values) {
        if (values !== null) {
            values.abbr = name;
            if (!locales[name]) {
                locales[name] = new Locale();
            }
            locales[name].set(values);

            // backwards compat for now: also set the locale
            moment.locale(name);

            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    };

    moment.langData = deprecate(
        'moment.langData is deprecated. Use moment.localeData instead.',
        function (key) {
            return moment.localeData(key);
        }
    );

    // returns locale data
    moment.localeData = function (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return moment._locale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    };

    // compare moment object
    moment.isMoment = function (obj) {
        return obj instanceof Moment ||
            (obj != null && hasOwnProp(obj, '_isAMomentObject'));
    };

    // for typechecking Duration objects
    moment.isDuration = function (obj) {
        return obj instanceof Duration;
    };

    for (i = lists.length - 1; i >= 0; --i) {
        makeList(lists[i]);
    }

    moment.normalizeUnits = function (units) {
        return normalizeUnits(units);
    };

    moment.invalid = function (flags) {
        var m = moment.utc(NaN);
        if (flags != null) {
            extend(m._pf, flags);
        }
        else {
            m._pf.userInvalidated = true;
        }

        return m;
    };

    moment.parseZone = function () {
        return moment.apply(null, arguments).parseZone();
    };

    moment.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    moment.isDate = isDate;

    /************************************
        Moment Prototype
    ************************************/


    extend(moment.fn = Moment.prototype, {

        clone : function () {
            return moment(this);
        },

        valueOf : function () {
            return +this._d - ((this._offset || 0) * 60000);
        },

        unix : function () {
            return Math.floor(+this / 1000);
        },

        toString : function () {
            return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
        },

        toDate : function () {
            return this._offset ? new Date(+this) : this._d;
        },

        toISOString : function () {
            var m = moment(this).utc();
            if (0 < m.year() && m.year() <= 9999) {
                if ('function' === typeof Date.prototype.toISOString) {
                    // native implementation is ~50x faster, use it when we can
                    return this.toDate().toISOString();
                } else {
                    return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
                }
            } else {
                return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        },

        toArray : function () {
            var m = this;
            return [
                m.year(),
                m.month(),
                m.date(),
                m.hours(),
                m.minutes(),
                m.seconds(),
                m.milliseconds()
            ];
        },

        isValid : function () {
            return isValid(this);
        },

        isDSTShifted : function () {
            if (this._a) {
                return this.isValid() && compareArrays(this._a, (this._isUTC ? moment.utc(this._a) : moment(this._a)).toArray()) > 0;
            }

            return false;
        },

        parsingFlags : function () {
            return extend({}, this._pf);
        },

        invalidAt: function () {
            return this._pf.overflow;
        },

        utc : function (keepLocalTime) {
            return this.utcOffset(0, keepLocalTime);
        },

        local : function (keepLocalTime) {
            if (this._isUTC) {
                this.utcOffset(0, keepLocalTime);
                this._isUTC = false;

                if (keepLocalTime) {
                    this.subtract(this._dateUtcOffset(), 'm');
                }
            }
            return this;
        },

        format : function (inputString) {
            var output = formatMoment(this, inputString || moment.defaultFormat);
            return this.localeData().postformat(output);
        },

        add : createAdder(1, 'add'),

        subtract : createAdder(-1, 'subtract'),

        diff : function (input, units, asFloat) {
            var that = makeAs(input, this),
                zoneDiff = (that.utcOffset() - this.utcOffset()) * 6e4,
                anchor, diff, output, daysAdjust;

            units = normalizeUnits(units);

            if (units === 'year' || units === 'month' || units === 'quarter') {
                output = monthDiff(this, that);
                if (units === 'quarter') {
                    output = output / 3;
                } else if (units === 'year') {
                    output = output / 12;
                }
            } else {
                diff = this - that;
                output = units === 'second' ? diff / 1e3 : // 1000
                    units === 'minute' ? diff / 6e4 : // 1000 * 60
                    units === 'hour' ? diff / 36e5 : // 1000 * 60 * 60
                    units === 'day' ? (diff - zoneDiff) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                    units === 'week' ? (diff - zoneDiff) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                    diff;
            }
            return asFloat ? output : absRound(output);
        },

        from : function (time, withoutSuffix) {
            return moment.duration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        },

        fromNow : function (withoutSuffix) {
            return this.from(moment(), withoutSuffix);
        },

        calendar : function (time) {
            // We want to compare the start of today, vs this.
            // Getting start-of-today depends on whether we're locat/utc/offset
            // or not.
            var now = time || moment(),
                sod = makeAs(now, this).startOf('day'),
                diff = this.diff(sod, 'days', true),
                format = diff < -6 ? 'sameElse' :
                    diff < -1 ? 'lastWeek' :
                    diff < 0 ? 'lastDay' :
                    diff < 1 ? 'sameDay' :
                    diff < 2 ? 'nextDay' :
                    diff < 7 ? 'nextWeek' : 'sameElse';
            return this.format(this.localeData().calendar(format, this, moment(now)));
        },

        isLeapYear : function () {
            return isLeapYear(this.year());
        },

        isDST : function () {
            return (this.utcOffset() > this.clone().month(0).utcOffset() ||
                this.utcOffset() > this.clone().month(5).utcOffset());
        },

        day : function (input) {
            var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
            if (input != null) {
                input = parseWeekday(input, this.localeData());
                return this.add(input - day, 'd');
            } else {
                return day;
            }
        },

        month : makeAccessor('Month', true),

        startOf : function (units) {
            units = normalizeUnits(units);
            // the following switch intentionally omits break keywords
            // to utilize falling through the cases.
            switch (units) {
            case 'year':
                this.month(0);
                /* falls through */
            case 'quarter':
            case 'month':
                this.date(1);
                /* falls through */
            case 'week':
            case 'isoWeek':
            case 'day':
                this.hours(0);
                /* falls through */
            case 'hour':
                this.minutes(0);
                /* falls through */
            case 'minute':
                this.seconds(0);
                /* falls through */
            case 'second':
                this.milliseconds(0);
                /* falls through */
            }

            // weeks are a special case
            if (units === 'week') {
                this.weekday(0);
            } else if (units === 'isoWeek') {
                this.isoWeekday(1);
            }

            // quarters are also special
            if (units === 'quarter') {
                this.month(Math.floor(this.month() / 3) * 3);
            }

            return this;
        },

        endOf: function (units) {
            units = normalizeUnits(units);
            if (units === undefined || units === 'millisecond') {
                return this;
            }
            return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
        },

        isAfter: function (input, units) {
            var inputMs;
            units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this > +input;
            } else {
                inputMs = moment.isMoment(input) ? +input : +moment(input);
                return inputMs < +this.clone().startOf(units);
            }
        },

        isBefore: function (input, units) {
            var inputMs;
            units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this < +input;
            } else {
                inputMs = moment.isMoment(input) ? +input : +moment(input);
                return +this.clone().endOf(units) < inputMs;
            }
        },

        isBetween: function (from, to, units) {
            return this.isAfter(from, units) && this.isBefore(to, units);
        },

        isSame: function (input, units) {
            var inputMs;
            units = normalizeUnits(units || 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this === +input;
            } else {
                inputMs = +moment(input);
                return +(this.clone().startOf(units)) <= inputMs && inputMs <= +(this.clone().endOf(units));
            }
        },

        min: deprecate(
                 'moment().min is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548',
                 function (other) {
                     other = moment.apply(null, arguments);
                     return other < this ? this : other;
                 }
         ),

        max: deprecate(
                'moment().max is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548',
                function (other) {
                    other = moment.apply(null, arguments);
                    return other > this ? this : other;
                }
        ),

        zone : deprecate(
                'moment().zone is deprecated, use moment().utcOffset instead. ' +
                'https://github.com/moment/moment/issues/1779',
                function (input, keepLocalTime) {
                    if (input != null) {
                        if (typeof input !== 'string') {
                            input = -input;
                        }

                        this.utcOffset(input, keepLocalTime);

                        return this;
                    } else {
                        return -this.utcOffset();
                    }
                }
        ),

        // keepLocalTime = true means only change the timezone, without
        // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
        // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
        // +0200, so we adjust the time as needed, to be valid.
        //
        // Keeping the time actually adds/subtracts (one hour)
        // from the actual represented time. That is why we call updateOffset
        // a second time. In case it wants us to change the offset again
        // _changeInProgress == true case, then we have to adjust, because
        // there is no such time in the given timezone.
        utcOffset : function (input, keepLocalTime) {
            var offset = this._offset || 0,
                localAdjust;
            if (input != null) {
                if (typeof input === 'string') {
                    input = utcOffsetFromString(input);
                }
                if (Math.abs(input) < 16) {
                    input = input * 60;
                }
                if (!this._isUTC && keepLocalTime) {
                    localAdjust = this._dateUtcOffset();
                }
                this._offset = input;
                this._isUTC = true;
                if (localAdjust != null) {
                    this.add(localAdjust, 'm');
                }
                if (offset !== input) {
                    if (!keepLocalTime || this._changeInProgress) {
                        addOrSubtractDurationFromMoment(this,
                                moment.duration(input - offset, 'm'), 1, false);
                    } else if (!this._changeInProgress) {
                        this._changeInProgress = true;
                        moment.updateOffset(this, true);
                        this._changeInProgress = null;
                    }
                }

                return this;
            } else {
                return this._isUTC ? offset : this._dateUtcOffset();
            }
        },

        isLocal : function () {
            return !this._isUTC;
        },

        isUtcOffset : function () {
            return this._isUTC;
        },

        isUtc : function () {
            return this._isUTC && this._offset === 0;
        },

        zoneAbbr : function () {
            return this._isUTC ? 'UTC' : '';
        },

        zoneName : function () {
            return this._isUTC ? 'Coordinated Universal Time' : '';
        },

        parseZone : function () {
            if (this._tzm) {
                this.utcOffset(this._tzm);
            } else if (typeof this._i === 'string') {
                this.utcOffset(utcOffsetFromString(this._i));
            }
            return this;
        },

        hasAlignedHourOffset : function (input) {
            if (!input) {
                input = 0;
            }
            else {
                input = moment(input).utcOffset();
            }

            return (this.utcOffset() - input) % 60 === 0;
        },

        daysInMonth : function () {
            return daysInMonth(this.year(), this.month());
        },

        dayOfYear : function (input) {
            var dayOfYear = round((moment(this).startOf('day') - moment(this).startOf('year')) / 864e5) + 1;
            return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
        },

        quarter : function (input) {
            return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
        },

        weekYear : function (input) {
            var year = weekOfYear(this, this.localeData()._week.dow, this.localeData()._week.doy).year;
            return input == null ? year : this.add((input - year), 'y');
        },

        isoWeekYear : function (input) {
            var year = weekOfYear(this, 1, 4).year;
            return input == null ? year : this.add((input - year), 'y');
        },

        week : function (input) {
            var week = this.localeData().week(this);
            return input == null ? week : this.add((input - week) * 7, 'd');
        },

        isoWeek : function (input) {
            var week = weekOfYear(this, 1, 4).week;
            return input == null ? week : this.add((input - week) * 7, 'd');
        },

        weekday : function (input) {
            var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
            return input == null ? weekday : this.add(input - weekday, 'd');
        },

        isoWeekday : function (input) {
            // behaves the same as moment#day except
            // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
            // as a setter, sunday should belong to the previous week.
            return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
        },

        isoWeeksInYear : function () {
            return weeksInYear(this.year(), 1, 4);
        },

        weeksInYear : function () {
            var weekInfo = this.localeData()._week;
            return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units]();
        },

        set : function (units, value) {
            var unit;
            if (typeof units === 'object') {
                for (unit in units) {
                    this.set(unit, units[unit]);
                }
            }
            else {
                units = normalizeUnits(units);
                if (typeof this[units] === 'function') {
                    this[units](value);
                }
            }
            return this;
        },

        // If passed a locale key, it will set the locale for this
        // instance.  Otherwise, it will return the locale configuration
        // variables for this instance.
        locale : function (key) {
            var newLocaleData;

            if (key === undefined) {
                return this._locale._abbr;
            } else {
                newLocaleData = moment.localeData(key);
                if (newLocaleData != null) {
                    this._locale = newLocaleData;
                }
                return this;
            }
        },

        lang : deprecate(
            'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
            function (key) {
                if (key === undefined) {
                    return this.localeData();
                } else {
                    return this.locale(key);
                }
            }
        ),

        localeData : function () {
            return this._locale;
        },

        _dateUtcOffset : function () {
            // On Firefox.24 Date#getTimezoneOffset returns a floating point.
            // https://github.com/moment/moment/pull/1871
            return -Math.round(this._d.getTimezoneOffset() / 15) * 15;
        }

    });

    function rawMonthSetter(mom, value) {
        var dayOfMonth;

        // TODO: Move this out of here!
        if (typeof value === 'string') {
            value = mom.localeData().monthsParse(value);
            // TODO: Another silent failure?
            if (typeof value !== 'number') {
                return mom;
            }
        }

        dayOfMonth = Math.min(mom.date(),
                daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function rawGetter(mom, unit) {
        return mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]();
    }

    function rawSetter(mom, unit, value) {
        if (unit === 'Month') {
            return rawMonthSetter(mom, value);
        } else {
            return mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
        }
    }

    function makeAccessor(unit, keepTime) {
        return function (value) {
            if (value != null) {
                rawSetter(this, unit, value);
                moment.updateOffset(this, keepTime);
                return this;
            } else {
                return rawGetter(this, unit);
            }
        };
    }

    moment.fn.millisecond = moment.fn.milliseconds = makeAccessor('Milliseconds', false);
    moment.fn.second = moment.fn.seconds = makeAccessor('Seconds', false);
    moment.fn.minute = moment.fn.minutes = makeAccessor('Minutes', false);
    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    moment.fn.hour = moment.fn.hours = makeAccessor('Hours', true);
    // moment.fn.month is defined separately
    moment.fn.date = makeAccessor('Date', true);
    moment.fn.dates = deprecate('dates accessor is deprecated. Use date instead.', makeAccessor('Date', true));
    moment.fn.year = makeAccessor('FullYear', true);
    moment.fn.years = deprecate('years accessor is deprecated. Use year instead.', makeAccessor('FullYear', true));

    // add plural methods
    moment.fn.days = moment.fn.day;
    moment.fn.months = moment.fn.month;
    moment.fn.weeks = moment.fn.week;
    moment.fn.isoWeeks = moment.fn.isoWeek;
    moment.fn.quarters = moment.fn.quarter;

    // add aliased format methods
    moment.fn.toJSON = moment.fn.toISOString;

    // alias isUtc for dev-friendliness
    moment.fn.isUTC = moment.fn.isUtc;

    /************************************
        Duration Prototype
    ************************************/


    function daysToYears (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        return days * 400 / 146097;
    }

    function yearsToDays (years) {
        // years * 365 + absRound(years / 4) -
        //     absRound(years / 100) + absRound(years / 400);
        return years * 146097 / 400;
    }

    extend(moment.duration.fn = Duration.prototype, {

        _bubble : function () {
            var milliseconds = this._milliseconds,
                days = this._days,
                months = this._months,
                data = this._data,
                seconds, minutes, hours, years = 0;

            // The following code bubbles up values, see the tests for
            // examples of what that means.
            data.milliseconds = milliseconds % 1000;

            seconds = absRound(milliseconds / 1000);
            data.seconds = seconds % 60;

            minutes = absRound(seconds / 60);
            data.minutes = minutes % 60;

            hours = absRound(minutes / 60);
            data.hours = hours % 24;

            days += absRound(hours / 24);

            // Accurately convert days to years, assume start from year 0.
            years = absRound(daysToYears(days));
            days -= absRound(yearsToDays(years));

            // 30 days to a month
            // TODO (iskren): Use anchor date (like 1st Jan) to compute this.
            months += absRound(days / 30);
            days %= 30;

            // 12 months -> 1 year
            years += absRound(months / 12);
            months %= 12;

            data.days = days;
            data.months = months;
            data.years = years;
        },

        abs : function () {
            this._milliseconds = Math.abs(this._milliseconds);
            this._days = Math.abs(this._days);
            this._months = Math.abs(this._months);

            this._data.milliseconds = Math.abs(this._data.milliseconds);
            this._data.seconds = Math.abs(this._data.seconds);
            this._data.minutes = Math.abs(this._data.minutes);
            this._data.hours = Math.abs(this._data.hours);
            this._data.months = Math.abs(this._data.months);
            this._data.years = Math.abs(this._data.years);

            return this;
        },

        weeks : function () {
            return absRound(this.days() / 7);
        },

        valueOf : function () {
            return this._milliseconds +
              this._days * 864e5 +
              (this._months % 12) * 2592e6 +
              toInt(this._months / 12) * 31536e6;
        },

        humanize : function (withSuffix) {
            var output = relativeTime(this, !withSuffix, this.localeData());

            if (withSuffix) {
                output = this.localeData().pastFuture(+this, output);
            }

            return this.localeData().postformat(output);
        },

        add : function (input, val) {
            // supports only 2.0-style add(1, 's') or add(moment)
            var dur = moment.duration(input, val);

            this._milliseconds += dur._milliseconds;
            this._days += dur._days;
            this._months += dur._months;

            this._bubble();

            return this;
        },

        subtract : function (input, val) {
            var dur = moment.duration(input, val);

            this._milliseconds -= dur._milliseconds;
            this._days -= dur._days;
            this._months -= dur._months;

            this._bubble();

            return this;
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units.toLowerCase() + 's']();
        },

        as : function (units) {
            var days, months;
            units = normalizeUnits(units);

            if (units === 'month' || units === 'year') {
                days = this._days + this._milliseconds / 864e5;
                months = this._months + daysToYears(days) * 12;
                return units === 'month' ? months : months / 12;
            } else {
                // handle milliseconds separately because of floating point math errors (issue #1867)
                days = this._days + Math.round(yearsToDays(this._months / 12));
                switch (units) {
                    case 'week': return days / 7 + this._milliseconds / 6048e5;
                    case 'day': return days + this._milliseconds / 864e5;
                    case 'hour': return days * 24 + this._milliseconds / 36e5;
                    case 'minute': return days * 24 * 60 + this._milliseconds / 6e4;
                    case 'second': return days * 24 * 60 * 60 + this._milliseconds / 1000;
                    // Math.floor prevents floating point math errors here
                    case 'millisecond': return Math.floor(days * 24 * 60 * 60 * 1000) + this._milliseconds;
                    default: throw new Error('Unknown unit ' + units);
                }
            }
        },

        lang : moment.fn.lang,
        locale : moment.fn.locale,

        toIsoString : deprecate(
            'toIsoString() is deprecated. Please use toISOString() instead ' +
            '(notice the capitals)',
            function () {
                return this.toISOString();
            }
        ),

        toISOString : function () {
            // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
            var years = Math.abs(this.years()),
                months = Math.abs(this.months()),
                days = Math.abs(this.days()),
                hours = Math.abs(this.hours()),
                minutes = Math.abs(this.minutes()),
                seconds = Math.abs(this.seconds() + this.milliseconds() / 1000);

            if (!this.asSeconds()) {
                // this is the same as C#'s (Noda) and python (isodate)...
                // but not other JS (goog.date)
                return 'P0D';
            }

            return (this.asSeconds() < 0 ? '-' : '') +
                'P' +
                (years ? years + 'Y' : '') +
                (months ? months + 'M' : '') +
                (days ? days + 'D' : '') +
                ((hours || minutes || seconds) ? 'T' : '') +
                (hours ? hours + 'H' : '') +
                (minutes ? minutes + 'M' : '') +
                (seconds ? seconds + 'S' : '');
        },

        localeData : function () {
            return this._locale;
        },

        toJSON : function () {
            return this.toISOString();
        }
    });

    moment.duration.fn.toString = moment.duration.fn.toISOString;

    function makeDurationGetter(name) {
        moment.duration.fn[name] = function () {
            return this._data[name];
        };
    }

    for (i in unitMillisecondFactors) {
        if (hasOwnProp(unitMillisecondFactors, i)) {
            makeDurationGetter(i.toLowerCase());
        }
    }

    moment.duration.fn.asMilliseconds = function () {
        return this.as('ms');
    };
    moment.duration.fn.asSeconds = function () {
        return this.as('s');
    };
    moment.duration.fn.asMinutes = function () {
        return this.as('m');
    };
    moment.duration.fn.asHours = function () {
        return this.as('h');
    };
    moment.duration.fn.asDays = function () {
        return this.as('d');
    };
    moment.duration.fn.asWeeks = function () {
        return this.as('weeks');
    };
    moment.duration.fn.asMonths = function () {
        return this.as('M');
    };
    moment.duration.fn.asYears = function () {
        return this.as('y');
    };

    /************************************
        Default Locale
    ************************************/


    // Set default locale, other locale will inherit from English.
    moment.locale('en', {
        ordinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    /* EMBED_LOCALES */

    /************************************
        Exposing Moment
    ************************************/

    function makeGlobal(shouldDeprecate) {
        /*global ender:false */
        if (typeof ender !== 'undefined') {
            return;
        }
        oldGlobalMoment = globalScope.moment;
        if (shouldDeprecate) {
            globalScope.moment = deprecate(
                    'Accessing Moment through the global scope is ' +
                    'deprecated, and will be removed in an upcoming ' +
                    'release.',
                    moment);
        } else {
            globalScope.moment = moment;
        }
    }

    // CommonJS module is defined
    if (hasModule) {
        module.exports = moment;
    } else if (typeof define === 'function' && define.amd) {
        define(function (require, exports, module) {
            if (module.config && module.config() && module.config().noGlobal === true) {
                // release the global variable
                globalScope.moment = oldGlobalMoment;
            }

            return moment;
        });
        makeGlobal(true);
    } else {
        makeGlobal();
    }
}).call(this);

});
__loader.define("vendor/png.js", 9562, function(exports, module, require) {
// Generated by CoffeeScript 1.4.0

/*
# MIT LICENSE
# Copyright (c) 2011 Devon Govett
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy of this 
# software and associated documentation files (the "Software"), to deal in the Software 
# without restriction, including without limitation the rights to use, copy, modify, merge, 
# publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons 
# to whom the Software is furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in all copies or 
# substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING 
# BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND 
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, 
# DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var Zlib;
if (typeof require !== 'undefined') {
  Zlib = require('zlib');
} else {
  Zlib = window.Zlib;
}

(function() {
  var PNG;

  PNG = (function() {
    var APNG_BLEND_OP_OVER, APNG_BLEND_OP_SOURCE, APNG_DISPOSE_OP_BACKGROUND, APNG_DISPOSE_OP_NONE, APNG_DISPOSE_OP_PREVIOUS, makeImage, scratchCanvas, scratchCtx;

    PNG.load = function(url, canvas, callback) {
      var xhr,
        _this = this;
      if (typeof canvas === 'function') {
        callback = canvas;
      }
      xhr = new XMLHttpRequest;
      xhr.open("GET", url, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = function() {
        var data, png;
        data = new Uint8Array(xhr.response || xhr.mozResponseArrayBuffer);
        png = new PNG(data);
        if (typeof (canvas != null ? canvas.getContext : void 0) === 'function') {
          png.render(canvas);
        }
        return typeof callback === "function" ? callback(png) : void 0;
      };
      return xhr.send(null);
    };

    APNG_DISPOSE_OP_NONE = 0;

    APNG_DISPOSE_OP_BACKGROUND = 1;

    APNG_DISPOSE_OP_PREVIOUS = 2;

    APNG_BLEND_OP_SOURCE = 0;

    APNG_BLEND_OP_OVER = 1;

    function PNG(data) {
      var chunkSize, colors, delayDen, delayNum, frame, i, index, key, section, short, text, _i, _j, _ref;
      this.data = data;
      this.pos = 8;
      this.palette = [];
      this.imgData = [];
      this.transparency = {};
      this.animation = null;
      this.text = {};
      frame = null;
      while (true) {
        chunkSize = this.readUInt32();
        section = ((function() {
          var _i, _results;
          _results = [];
          for (i = _i = 0; _i < 4; i = ++_i) {
            _results.push(String.fromCharCode(this.data[this.pos++]));
          }
          return _results;
        }).call(this)).join('');
        switch (section) {
          case 'IHDR':
            this.width = this.readUInt32();
            this.height = this.readUInt32();
            this.bits = this.data[this.pos++];
            this.colorType = this.data[this.pos++];
            this.compressionMethod = this.data[this.pos++];
            this.filterMethod = this.data[this.pos++];
            this.interlaceMethod = this.data[this.pos++];
            break;
          case 'acTL':
            this.animation = {
              numFrames: this.readUInt32(),
              numPlays: this.readUInt32() || Infinity,
              frames: []
            };
            break;
          case 'PLTE':
            this.palette = this.read(chunkSize);
            break;
          case 'fcTL':
            if (frame) {
              this.animation.frames.push(frame);
            }
            this.pos += 4;
            frame = {
              width: this.readUInt32(),
              height: this.readUInt32(),
              xOffset: this.readUInt32(),
              yOffset: this.readUInt32()
            };
            delayNum = this.readUInt16();
            delayDen = this.readUInt16() || 100;
            frame.delay = 1000 * delayNum / delayDen;
            frame.disposeOp = this.data[this.pos++];
            frame.blendOp = this.data[this.pos++];
            frame.data = [];
            break;
          case 'IDAT':
          case 'fdAT':
            if (section === 'fdAT') {
              this.pos += 4;
              chunkSize -= 4;
            }
            data = (frame != null ? frame.data : void 0) || this.imgData;
            for (i = _i = 0; 0 <= chunkSize ? _i < chunkSize : _i > chunkSize; i = 0 <= chunkSize ? ++_i : --_i) {
              data.push(this.data[this.pos++]);
            }
            break;
          case 'tRNS':
            this.transparency = {};
            switch (this.colorType) {
              case 3:
                this.transparency.indexed = this.read(chunkSize);
                short = 255 - this.transparency.indexed.length;
                if (short > 0) {
                  for (i = _j = 0; 0 <= short ? _j < short : _j > short; i = 0 <= short ? ++_j : --_j) {
                    this.transparency.indexed.push(255);
                  }
                }
                break;
              case 0:
                this.transparency.grayscale = this.read(chunkSize)[0];
                break;
              case 2:
                this.transparency.rgb = this.read(chunkSize);
            }
            break;
          case 'tEXt':
            text = this.read(chunkSize);
            index = text.indexOf(0);
            key = String.fromCharCode.apply(String, text.slice(0, index));
            this.text[key] = String.fromCharCode.apply(String, text.slice(index + 1));
            break;
          case 'IEND':
            if (frame) {
              this.animation.frames.push(frame);
            }
            this.colors = (function() {
              switch (this.colorType) {
                case 0:
                case 3:
                case 4:
                  return 1;
                case 2:
                case 6:
                  return 3;
              }
            }).call(this);
            this.hasAlphaChannel = (_ref = this.colorType) === 4 || _ref === 6;
            colors = this.colors + (this.hasAlphaChannel ? 1 : 0);
            this.pixelBitlength = this.bits * colors;
            this.colorSpace = (function() {
              switch (this.colors) {
                case 1:
                  return 'DeviceGray';
                case 3:
                  return 'DeviceRGB';
              }
            }).call(this);
            this.imgData = new Uint8Array(this.imgData);
            return;
          default:
            this.pos += chunkSize;
        }
        this.pos += 4;
        if (this.pos > this.data.length) {
          throw new Error("Incomplete or corrupt PNG file");
        }
      }
      return;
    }

    PNG.prototype.read = function(bytes) {
      var i, _i, _results;
      _results = [];
      for (i = _i = 0; 0 <= bytes ? _i < bytes : _i > bytes; i = 0 <= bytes ? ++_i : --_i) {
        _results.push(this.data[this.pos++]);
      }
      return _results;
    };

    PNG.prototype.readUInt32 = function() {
      var b1, b2, b3, b4;
      b1 = this.data[this.pos++] << 24;
      b2 = this.data[this.pos++] << 16;
      b3 = this.data[this.pos++] << 8;
      b4 = this.data[this.pos++];
      return b1 | b2 | b3 | b4;
    };

    PNG.prototype.readUInt16 = function() {
      var b1, b2;
      b1 = this.data[this.pos++] << 8;
      b2 = this.data[this.pos++];
      return b1 | b2;
    };

    PNG.prototype.decodePixels = function(data) {
      var byte, c, col, i, left, length, p, pa, paeth, pb, pc, pixelBytes, pixels, pos, row, scanlineLength, upper, upperLeft, _i, _j, _k, _l, _m;
      if (data == null) {
        data = this.imgData;
      }
      if (data.length === 0) {
        return new Uint8Array(0);
      }
      data = new Zlib.Inflate(data);
      data = data.decompress();
      pixelBytes = this.pixelBitlength / 8;
      scanlineLength = pixelBytes * this.width;
      pixels = new Uint8Array(scanlineLength * this.height);
      length = data.length;
      row = 0;
      pos = 0;
      c = 0;
      while (pos < length) {
        switch (data[pos++]) {
          case 0:
            for (i = _i = 0; _i < scanlineLength; i = _i += 1) {
              pixels[c++] = data[pos++];
            }
            break;
          case 1:
            for (i = _j = 0; _j < scanlineLength; i = _j += 1) {
              byte = data[pos++];
              left = i < pixelBytes ? 0 : pixels[c - pixelBytes];
              pixels[c++] = (byte + left) % 256;
            }
            break;
          case 2:
            for (i = _k = 0; _k < scanlineLength; i = _k += 1) {
              byte = data[pos++];
              col = (i - (i % pixelBytes)) / pixelBytes;
              upper = row && pixels[(row - 1) * scanlineLength + col * pixelBytes + (i % pixelBytes)];
              pixels[c++] = (upper + byte) % 256;
            }
            break;
          case 3:
            for (i = _l = 0; _l < scanlineLength; i = _l += 1) {
              byte = data[pos++];
              col = (i - (i % pixelBytes)) / pixelBytes;
              left = i < pixelBytes ? 0 : pixels[c - pixelBytes];
              upper = row && pixels[(row - 1) * scanlineLength + col * pixelBytes + (i % pixelBytes)];
              pixels[c++] = (byte + Math.floor((left + upper) / 2)) % 256;
            }
            break;
          case 4:
            for (i = _m = 0; _m < scanlineLength; i = _m += 1) {
              byte = data[pos++];
              col = (i - (i % pixelBytes)) / pixelBytes;
              left = i < pixelBytes ? 0 : pixels[c - pixelBytes];
              if (row === 0) {
                upper = upperLeft = 0;
              } else {
                upper = pixels[(row - 1) * scanlineLength + col * pixelBytes + (i % pixelBytes)];
                upperLeft = col && pixels[(row - 1) * scanlineLength + (col - 1) * pixelBytes + (i % pixelBytes)];
              }
              p = left + upper - upperLeft;
              pa = Math.abs(p - left);
              pb = Math.abs(p - upper);
              pc = Math.abs(p - upperLeft);
              if (pa <= pb && pa <= pc) {
                paeth = left;
              } else if (pb <= pc) {
                paeth = upper;
              } else {
                paeth = upperLeft;
              }
              pixels[c++] = (byte + paeth) % 256;
            }
            break;
          default:
            throw new Error("Invalid filter algorithm: " + data[pos - 1]);
        }
        row++;
      }
      return pixels;
    };

    PNG.prototype.decodePalette = function() {
      var c, i, length, palette, pos, ret, transparency, _i, _ref, _ref1;
      palette = this.palette;
      transparency = this.transparency.indexed || [];
      ret = new Uint8Array((transparency.length || 0) + palette.length);
      pos = 0;
      length = palette.length;
      c = 0;
      for (i = _i = 0, _ref = palette.length; _i < _ref; i = _i += 3) {
        ret[pos++] = palette[i];
        ret[pos++] = palette[i + 1];
        ret[pos++] = palette[i + 2];
        ret[pos++] = (_ref1 = transparency[c++]) != null ? _ref1 : 255;
      }
      return ret;
    };

    PNG.prototype.copyToImageData = function(imageData, pixels) {
      var alpha, colors, data, i, input, j, k, length, palette, v, _ref;
      colors = this.colors;
      palette = null;
      alpha = this.hasAlphaChannel;
      if (this.palette.length) {
        palette = (_ref = this._decodedPalette) != null ? _ref : this._decodedPalette = this.decodePalette();
        colors = 4;
        alpha = true;
      }
      data = imageData.data || imageData;
      length = data.length;
      input = palette || pixels;
      i = j = 0;
      if (colors === 1) {
        while (i < length) {
          k = palette ? pixels[i / 4] * 4 : j;
          v = input[k++];
          data[i++] = v;
          data[i++] = v;
          data[i++] = v;
          data[i++] = alpha ? input[k++] : 255;
          j = k;
        }
      } else {
        while (i < length) {
          k = palette ? pixels[i / 4] * 4 : j;
          data[i++] = input[k++];
          data[i++] = input[k++];
          data[i++] = input[k++];
          data[i++] = alpha ? input[k++] : 255;
          j = k;
        }
      }
    };

    PNG.prototype.decode = function() {
      var ret;
      ret = new Uint8Array(this.width * this.height * 4);
      this.copyToImageData(ret, this.decodePixels());
      return ret;
    };

    makeImage = function(imageData) {
      var img;
      scratchCtx.width = imageData.width;
      scratchCtx.height = imageData.height;
      scratchCtx.clearRect(0, 0, imageData.width, imageData.height);
      scratchCtx.putImageData(imageData, 0, 0);
      img = new Image;
      img.src = scratchCanvas.toDataURL();
      return img;
    };

    PNG.prototype.decodeFrames = function(ctx) {
      var frame, i, imageData, pixels, _i, _len, _ref, _results;
      if (!this.animation) {
        return;
      }
      _ref = this.animation.frames;
      _results = [];
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        frame = _ref[i];
        imageData = ctx.createImageData(frame.width, frame.height);
        pixels = this.decodePixels(new Uint8Array(frame.data));
        this.copyToImageData(imageData, pixels);
        frame.imageData = imageData;
        _results.push(frame.image = makeImage(imageData));
      }
      return _results;
    };

    PNG.prototype.renderFrame = function(ctx, number) {
      var frame, frames, prev;
      frames = this.animation.frames;
      frame = frames[number];
      prev = frames[number - 1];
      if (number === 0) {
        ctx.clearRect(0, 0, this.width, this.height);
      }
      if ((prev != null ? prev.disposeOp : void 0) === APNG_DISPOSE_OP_BACKGROUND) {
        ctx.clearRect(prev.xOffset, prev.yOffset, prev.width, prev.height);
      } else if ((prev != null ? prev.disposeOp : void 0) === APNG_DISPOSE_OP_PREVIOUS) {
        ctx.putImageData(prev.imageData, prev.xOffset, prev.yOffset);
      }
      if (frame.blendOp === APNG_BLEND_OP_SOURCE) {
        ctx.clearRect(frame.xOffset, frame.yOffset, frame.width, frame.height);
      }
      return ctx.drawImage(frame.image, frame.xOffset, frame.yOffset);
    };

    PNG.prototype.animate = function(ctx) {
      var doFrame, frameNumber, frames, numFrames, numPlays, _ref,
        _this = this;
      frameNumber = 0;
      _ref = this.animation, numFrames = _ref.numFrames, frames = _ref.frames, numPlays = _ref.numPlays;
      return (doFrame = function() {
        var f, frame;
        f = frameNumber++ % numFrames;
        frame = frames[f];
        _this.renderFrame(ctx, f);
        if (numFrames > 1 && frameNumber / numFrames < numPlays) {
          return _this.animation._timeout = setTimeout(doFrame, frame.delay);
        }
      })();
    };

    PNG.prototype.stopAnimation = function() {
      var _ref;
      return clearTimeout((_ref = this.animation) != null ? _ref._timeout : void 0);
    };

    PNG.prototype.render = function(canvas) {
      var ctx, data;
      if (canvas._png) {
        canvas._png.stopAnimation();
      }
      canvas._png = this;
      canvas.width = this.width;
      canvas.height = this.height;
      ctx = canvas.getContext("2d");
      if (this.animation) {
        this.decodeFrames(ctx);
        return this.animate(ctx);
      } else {
        data = ctx.createImageData(this.width, this.height);
        this.copyToImageData(data, this.decodePixels());
        return ctx.putImageData(data, 0, 0);
      }
    };

    return PNG;

  })();

  if (typeof module !== 'undefined') {
    module.exports = PNG;
  } else {
    window.PNG = PNG;
  }

}).call(this);

});
__loader.define("vendor/zlib.js", 10029, function(exports, module, require) {
/**
 * zlib.js Deflate + Inflate
 *
 * @link https://github.com/imaya/zlib.js
 * @author imaya
 * @license MIT
 **/
(function() {'use strict';function l(d){throw d;}var v=void 0,x=!0,aa=this;function D(d,a){var c=d.split("."),e=aa;!(c[0]in e)&&e.execScript&&e.execScript("var "+c[0]);for(var b;c.length&&(b=c.shift());)!c.length&&a!==v?e[b]=a:e=e[b]?e[b]:e[b]={}};var F="undefined"!==typeof Uint8Array&&"undefined"!==typeof Uint16Array&&"undefined"!==typeof Uint32Array&&"undefined"!==typeof DataView;function H(d,a){this.index="number"===typeof a?a:0;this.i=0;this.buffer=d instanceof(F?Uint8Array:Array)?d:new (F?Uint8Array:Array)(32768);2*this.buffer.length<=this.index&&l(Error("invalid index"));this.buffer.length<=this.index&&this.f()}H.prototype.f=function(){var d=this.buffer,a,c=d.length,e=new (F?Uint8Array:Array)(c<<1);if(F)e.set(d);else for(a=0;a<c;++a)e[a]=d[a];return this.buffer=e};
H.prototype.d=function(d,a,c){var e=this.buffer,b=this.index,f=this.i,g=e[b],h;c&&1<a&&(d=8<a?(N[d&255]<<24|N[d>>>8&255]<<16|N[d>>>16&255]<<8|N[d>>>24&255])>>32-a:N[d]>>8-a);if(8>a+f)g=g<<a|d,f+=a;else for(h=0;h<a;++h)g=g<<1|d>>a-h-1&1,8===++f&&(f=0,e[b++]=N[g],g=0,b===e.length&&(e=this.f()));e[b]=g;this.buffer=e;this.i=f;this.index=b};H.prototype.finish=function(){var d=this.buffer,a=this.index,c;0<this.i&&(d[a]<<=8-this.i,d[a]=N[d[a]],a++);F?c=d.subarray(0,a):(d.length=a,c=d);return c};
var fa=new (F?Uint8Array:Array)(256),O;for(O=0;256>O;++O){for(var P=O,Q=P,ga=7,P=P>>>1;P;P>>>=1)Q<<=1,Q|=P&1,--ga;fa[O]=(Q<<ga&255)>>>0}var N=fa;function ha(d){this.buffer=new (F?Uint16Array:Array)(2*d);this.length=0}ha.prototype.getParent=function(d){return 2*((d-2)/4|0)};ha.prototype.push=function(d,a){var c,e,b=this.buffer,f;c=this.length;b[this.length++]=a;for(b[this.length++]=d;0<c;)if(e=this.getParent(c),b[c]>b[e])f=b[c],b[c]=b[e],b[e]=f,f=b[c+1],b[c+1]=b[e+1],b[e+1]=f,c=e;else break;return this.length};
ha.prototype.pop=function(){var d,a,c=this.buffer,e,b,f;a=c[0];d=c[1];this.length-=2;c[0]=c[this.length];c[1]=c[this.length+1];for(f=0;;){b=2*f+2;if(b>=this.length)break;b+2<this.length&&c[b+2]>c[b]&&(b+=2);if(c[b]>c[f])e=c[f],c[f]=c[b],c[b]=e,e=c[f+1],c[f+1]=c[b+1],c[b+1]=e;else break;f=b}return{index:d,value:a,length:this.length}};function R(d){var a=d.length,c=0,e=Number.POSITIVE_INFINITY,b,f,g,h,k,n,q,r,p,m;for(r=0;r<a;++r)d[r]>c&&(c=d[r]),d[r]<e&&(e=d[r]);b=1<<c;f=new (F?Uint32Array:Array)(b);g=1;h=0;for(k=2;g<=c;){for(r=0;r<a;++r)if(d[r]===g){n=0;q=h;for(p=0;p<g;++p)n=n<<1|q&1,q>>=1;m=g<<16|r;for(p=n;p<b;p+=k)f[p]=m;++h}++g;h<<=1;k<<=1}return[f,c,e]};function ia(d,a){this.h=ma;this.w=0;this.input=F&&d instanceof Array?new Uint8Array(d):d;this.b=0;a&&(a.lazy&&(this.w=a.lazy),"number"===typeof a.compressionType&&(this.h=a.compressionType),a.outputBuffer&&(this.a=F&&a.outputBuffer instanceof Array?new Uint8Array(a.outputBuffer):a.outputBuffer),"number"===typeof a.outputIndex&&(this.b=a.outputIndex));this.a||(this.a=new (F?Uint8Array:Array)(32768))}var ma=2,na={NONE:0,r:1,k:ma,O:3},oa=[],S;
for(S=0;288>S;S++)switch(x){case 143>=S:oa.push([S+48,8]);break;case 255>=S:oa.push([S-144+400,9]);break;case 279>=S:oa.push([S-256+0,7]);break;case 287>=S:oa.push([S-280+192,8]);break;default:l("invalid literal: "+S)}
ia.prototype.j=function(){var d,a,c,e,b=this.input;switch(this.h){case 0:c=0;for(e=b.length;c<e;){a=F?b.subarray(c,c+65535):b.slice(c,c+65535);c+=a.length;var f=a,g=c===e,h=v,k=v,n=v,q=v,r=v,p=this.a,m=this.b;if(F){for(p=new Uint8Array(this.a.buffer);p.length<=m+f.length+5;)p=new Uint8Array(p.length<<1);p.set(this.a)}h=g?1:0;p[m++]=h|0;k=f.length;n=~k+65536&65535;p[m++]=k&255;p[m++]=k>>>8&255;p[m++]=n&255;p[m++]=n>>>8&255;if(F)p.set(f,m),m+=f.length,p=p.subarray(0,m);else{q=0;for(r=f.length;q<r;++q)p[m++]=
f[q];p.length=m}this.b=m;this.a=p}break;case 1:var s=new H(F?new Uint8Array(this.a.buffer):this.a,this.b);s.d(1,1,x);s.d(1,2,x);var w=pa(this,b),y,ja,A;y=0;for(ja=w.length;y<ja;y++)if(A=w[y],H.prototype.d.apply(s,oa[A]),256<A)s.d(w[++y],w[++y],x),s.d(w[++y],5),s.d(w[++y],w[++y],x);else if(256===A)break;this.a=s.finish();this.b=this.a.length;break;case ma:var C=new H(F?new Uint8Array(this.a.buffer):this.a,this.b),Ea,M,U,V,W,gb=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],ba,Fa,ca,Ga,ka,ra=Array(19),
Ha,X,la,z,Ia;Ea=ma;C.d(1,1,x);C.d(Ea,2,x);M=pa(this,b);ba=qa(this.M,15);Fa=sa(ba);ca=qa(this.L,7);Ga=sa(ca);for(U=286;257<U&&0===ba[U-1];U--);for(V=30;1<V&&0===ca[V-1];V--);var Ja=U,Ka=V,I=new (F?Uint32Array:Array)(Ja+Ka),t,J,u,da,G=new (F?Uint32Array:Array)(316),E,B,K=new (F?Uint8Array:Array)(19);for(t=J=0;t<Ja;t++)I[J++]=ba[t];for(t=0;t<Ka;t++)I[J++]=ca[t];if(!F){t=0;for(da=K.length;t<da;++t)K[t]=0}t=E=0;for(da=I.length;t<da;t+=J){for(J=1;t+J<da&&I[t+J]===I[t];++J);u=J;if(0===I[t])if(3>u)for(;0<
u--;)G[E++]=0,K[0]++;else for(;0<u;)B=138>u?u:138,B>u-3&&B<u&&(B=u-3),10>=B?(G[E++]=17,G[E++]=B-3,K[17]++):(G[E++]=18,G[E++]=B-11,K[18]++),u-=B;else if(G[E++]=I[t],K[I[t]]++,u--,3>u)for(;0<u--;)G[E++]=I[t],K[I[t]]++;else for(;0<u;)B=6>u?u:6,B>u-3&&B<u&&(B=u-3),G[E++]=16,G[E++]=B-3,K[16]++,u-=B}d=F?G.subarray(0,E):G.slice(0,E);ka=qa(K,7);for(z=0;19>z;z++)ra[z]=ka[gb[z]];for(W=19;4<W&&0===ra[W-1];W--);Ha=sa(ka);C.d(U-257,5,x);C.d(V-1,5,x);C.d(W-4,4,x);for(z=0;z<W;z++)C.d(ra[z],3,x);z=0;for(Ia=d.length;z<
Ia;z++)if(X=d[z],C.d(Ha[X],ka[X],x),16<=X){z++;switch(X){case 16:la=2;break;case 17:la=3;break;case 18:la=7;break;default:l("invalid code: "+X)}C.d(d[z],la,x)}var La=[Fa,ba],Ma=[Ga,ca],L,Na,ea,ua,Oa,Pa,Qa,Ra;Oa=La[0];Pa=La[1];Qa=Ma[0];Ra=Ma[1];L=0;for(Na=M.length;L<Na;++L)if(ea=M[L],C.d(Oa[ea],Pa[ea],x),256<ea)C.d(M[++L],M[++L],x),ua=M[++L],C.d(Qa[ua],Ra[ua],x),C.d(M[++L],M[++L],x);else if(256===ea)break;this.a=C.finish();this.b=this.a.length;break;default:l("invalid compression type")}return this.a};
function ta(d,a){this.length=d;this.H=a}
var va=function(){function d(b){switch(x){case 3===b:return[257,b-3,0];case 4===b:return[258,b-4,0];case 5===b:return[259,b-5,0];case 6===b:return[260,b-6,0];case 7===b:return[261,b-7,0];case 8===b:return[262,b-8,0];case 9===b:return[263,b-9,0];case 10===b:return[264,b-10,0];case 12>=b:return[265,b-11,1];case 14>=b:return[266,b-13,1];case 16>=b:return[267,b-15,1];case 18>=b:return[268,b-17,1];case 22>=b:return[269,b-19,2];case 26>=b:return[270,b-23,2];case 30>=b:return[271,b-27,2];case 34>=b:return[272,
b-31,2];case 42>=b:return[273,b-35,3];case 50>=b:return[274,b-43,3];case 58>=b:return[275,b-51,3];case 66>=b:return[276,b-59,3];case 82>=b:return[277,b-67,4];case 98>=b:return[278,b-83,4];case 114>=b:return[279,b-99,4];case 130>=b:return[280,b-115,4];case 162>=b:return[281,b-131,5];case 194>=b:return[282,b-163,5];case 226>=b:return[283,b-195,5];case 257>=b:return[284,b-227,5];case 258===b:return[285,b-258,0];default:l("invalid length: "+b)}}var a=[],c,e;for(c=3;258>=c;c++)e=d(c),a[c]=e[2]<<24|e[1]<<
16|e[0];return a}(),wa=F?new Uint32Array(va):va;
function pa(d,a){function c(b,c){var a=b.H,d=[],e=0,f;f=wa[b.length];d[e++]=f&65535;d[e++]=f>>16&255;d[e++]=f>>24;var g;switch(x){case 1===a:g=[0,a-1,0];break;case 2===a:g=[1,a-2,0];break;case 3===a:g=[2,a-3,0];break;case 4===a:g=[3,a-4,0];break;case 6>=a:g=[4,a-5,1];break;case 8>=a:g=[5,a-7,1];break;case 12>=a:g=[6,a-9,2];break;case 16>=a:g=[7,a-13,2];break;case 24>=a:g=[8,a-17,3];break;case 32>=a:g=[9,a-25,3];break;case 48>=a:g=[10,a-33,4];break;case 64>=a:g=[11,a-49,4];break;case 96>=a:g=[12,a-
65,5];break;case 128>=a:g=[13,a-97,5];break;case 192>=a:g=[14,a-129,6];break;case 256>=a:g=[15,a-193,6];break;case 384>=a:g=[16,a-257,7];break;case 512>=a:g=[17,a-385,7];break;case 768>=a:g=[18,a-513,8];break;case 1024>=a:g=[19,a-769,8];break;case 1536>=a:g=[20,a-1025,9];break;case 2048>=a:g=[21,a-1537,9];break;case 3072>=a:g=[22,a-2049,10];break;case 4096>=a:g=[23,a-3073,10];break;case 6144>=a:g=[24,a-4097,11];break;case 8192>=a:g=[25,a-6145,11];break;case 12288>=a:g=[26,a-8193,12];break;case 16384>=
a:g=[27,a-12289,12];break;case 24576>=a:g=[28,a-16385,13];break;case 32768>=a:g=[29,a-24577,13];break;default:l("invalid distance")}f=g;d[e++]=f[0];d[e++]=f[1];d[e++]=f[2];var h,k;h=0;for(k=d.length;h<k;++h)p[m++]=d[h];w[d[0]]++;y[d[3]]++;s=b.length+c-1;r=null}var e,b,f,g,h,k={},n,q,r,p=F?new Uint16Array(2*a.length):[],m=0,s=0,w=new (F?Uint32Array:Array)(286),y=new (F?Uint32Array:Array)(30),ja=d.w,A;if(!F){for(f=0;285>=f;)w[f++]=0;for(f=0;29>=f;)y[f++]=0}w[256]=1;e=0;for(b=a.length;e<b;++e){f=h=0;
for(g=3;f<g&&e+f!==b;++f)h=h<<8|a[e+f];k[h]===v&&(k[h]=[]);n=k[h];if(!(0<s--)){for(;0<n.length&&32768<e-n[0];)n.shift();if(e+3>=b){r&&c(r,-1);f=0;for(g=b-e;f<g;++f)A=a[e+f],p[m++]=A,++w[A];break}0<n.length?(q=xa(a,e,n),r?r.length<q.length?(A=a[e-1],p[m++]=A,++w[A],c(q,0)):c(r,-1):q.length<ja?r=q:c(q,0)):r?c(r,-1):(A=a[e],p[m++]=A,++w[A])}n.push(e)}p[m++]=256;w[256]++;d.M=w;d.L=y;return F?p.subarray(0,m):p}
function xa(d,a,c){var e,b,f=0,g,h,k,n,q=d.length;h=0;n=c.length;a:for(;h<n;h++){e=c[n-h-1];g=3;if(3<f){for(k=f;3<k;k--)if(d[e+k-1]!==d[a+k-1])continue a;g=f}for(;258>g&&a+g<q&&d[e+g]===d[a+g];)++g;g>f&&(b=e,f=g);if(258===g)break}return new ta(f,a-b)}
function qa(d,a){var c=d.length,e=new ha(572),b=new (F?Uint8Array:Array)(c),f,g,h,k,n;if(!F)for(k=0;k<c;k++)b[k]=0;for(k=0;k<c;++k)0<d[k]&&e.push(k,d[k]);f=Array(e.length/2);g=new (F?Uint32Array:Array)(e.length/2);if(1===f.length)return b[e.pop().index]=1,b;k=0;for(n=e.length/2;k<n;++k)f[k]=e.pop(),g[k]=f[k].value;h=ya(g,g.length,a);k=0;for(n=f.length;k<n;++k)b[f[k].index]=h[k];return b}
function ya(d,a,c){function e(b){var c=k[b][n[b]];c===a?(e(b+1),e(b+1)):--g[c];++n[b]}var b=new (F?Uint16Array:Array)(c),f=new (F?Uint8Array:Array)(c),g=new (F?Uint8Array:Array)(a),h=Array(c),k=Array(c),n=Array(c),q=(1<<c)-a,r=1<<c-1,p,m,s,w,y;b[c-1]=a;for(m=0;m<c;++m)q<r?f[m]=0:(f[m]=1,q-=r),q<<=1,b[c-2-m]=(b[c-1-m]/2|0)+a;b[0]=f[0];h[0]=Array(b[0]);k[0]=Array(b[0]);for(m=1;m<c;++m)b[m]>2*b[m-1]+f[m]&&(b[m]=2*b[m-1]+f[m]),h[m]=Array(b[m]),k[m]=Array(b[m]);for(p=0;p<a;++p)g[p]=c;for(s=0;s<b[c-1];++s)h[c-
1][s]=d[s],k[c-1][s]=s;for(p=0;p<c;++p)n[p]=0;1===f[c-1]&&(--g[0],++n[c-1]);for(m=c-2;0<=m;--m){w=p=0;y=n[m+1];for(s=0;s<b[m];s++)w=h[m+1][y]+h[m+1][y+1],w>d[p]?(h[m][s]=w,k[m][s]=a,y+=2):(h[m][s]=d[p],k[m][s]=p,++p);n[m]=0;1===f[m]&&e(m)}return g}
function sa(d){var a=new (F?Uint16Array:Array)(d.length),c=[],e=[],b=0,f,g,h,k;f=0;for(g=d.length;f<g;f++)c[d[f]]=(c[d[f]]|0)+1;f=1;for(g=16;f<=g;f++)e[f]=b,b+=c[f]|0,b<<=1;f=0;for(g=d.length;f<g;f++){b=e[d[f]];e[d[f]]+=1;h=a[f]=0;for(k=d[f];h<k;h++)a[f]=a[f]<<1|b&1,b>>>=1}return a};function T(d,a){this.l=[];this.m=32768;this.e=this.g=this.c=this.q=0;this.input=F?new Uint8Array(d):d;this.s=!1;this.n=za;this.C=!1;if(a||!(a={}))a.index&&(this.c=a.index),a.bufferSize&&(this.m=a.bufferSize),a.bufferType&&(this.n=a.bufferType),a.resize&&(this.C=a.resize);switch(this.n){case Aa:this.b=32768;this.a=new (F?Uint8Array:Array)(32768+this.m+258);break;case za:this.b=0;this.a=new (F?Uint8Array:Array)(this.m);this.f=this.K;this.t=this.I;this.o=this.J;break;default:l(Error("invalid inflate mode"))}}
var Aa=0,za=1,Ba={F:Aa,D:za};
T.prototype.p=function(){for(;!this.s;){var d=Y(this,3);d&1&&(this.s=x);d>>>=1;switch(d){case 0:var a=this.input,c=this.c,e=this.a,b=this.b,f=a.length,g=v,h=v,k=e.length,n=v;this.e=this.g=0;c+1>=f&&l(Error("invalid uncompressed block header: LEN"));g=a[c++]|a[c++]<<8;c+1>=f&&l(Error("invalid uncompressed block header: NLEN"));h=a[c++]|a[c++]<<8;g===~h&&l(Error("invalid uncompressed block header: length verify"));c+g>a.length&&l(Error("input buffer is broken"));switch(this.n){case Aa:for(;b+g>e.length;){n=
k-b;g-=n;if(F)e.set(a.subarray(c,c+n),b),b+=n,c+=n;else for(;n--;)e[b++]=a[c++];this.b=b;e=this.f();b=this.b}break;case za:for(;b+g>e.length;)e=this.f({v:2});break;default:l(Error("invalid inflate mode"))}if(F)e.set(a.subarray(c,c+g),b),b+=g,c+=g;else for(;g--;)e[b++]=a[c++];this.c=c;this.b=b;this.a=e;break;case 1:this.o(Ca,Da);break;case 2:Sa(this);break;default:l(Error("unknown BTYPE: "+d))}}return this.t()};
var Ta=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],Ua=F?new Uint16Array(Ta):Ta,Va=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,258,258],Wa=F?new Uint16Array(Va):Va,Xa=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0],Ya=F?new Uint8Array(Xa):Xa,Za=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],$a=F?new Uint16Array(Za):Za,ab=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,
10,11,11,12,12,13,13],bb=F?new Uint8Array(ab):ab,cb=new (F?Uint8Array:Array)(288),Z,db;Z=0;for(db=cb.length;Z<db;++Z)cb[Z]=143>=Z?8:255>=Z?9:279>=Z?7:8;var Ca=R(cb),eb=new (F?Uint8Array:Array)(30),fb,hb;fb=0;for(hb=eb.length;fb<hb;++fb)eb[fb]=5;var Da=R(eb);function Y(d,a){for(var c=d.g,e=d.e,b=d.input,f=d.c,g=b.length,h;e<a;)f>=g&&l(Error("input buffer is broken")),c|=b[f++]<<e,e+=8;h=c&(1<<a)-1;d.g=c>>>a;d.e=e-a;d.c=f;return h}
function ib(d,a){for(var c=d.g,e=d.e,b=d.input,f=d.c,g=b.length,h=a[0],k=a[1],n,q;e<k&&!(f>=g);)c|=b[f++]<<e,e+=8;n=h[c&(1<<k)-1];q=n>>>16;d.g=c>>q;d.e=e-q;d.c=f;return n&65535}
function Sa(d){function a(a,b,c){var d,e=this.z,f,g;for(g=0;g<a;)switch(d=ib(this,b),d){case 16:for(f=3+Y(this,2);f--;)c[g++]=e;break;case 17:for(f=3+Y(this,3);f--;)c[g++]=0;e=0;break;case 18:for(f=11+Y(this,7);f--;)c[g++]=0;e=0;break;default:e=c[g++]=d}this.z=e;return c}var c=Y(d,5)+257,e=Y(d,5)+1,b=Y(d,4)+4,f=new (F?Uint8Array:Array)(Ua.length),g,h,k,n;for(n=0;n<b;++n)f[Ua[n]]=Y(d,3);if(!F){n=b;for(b=f.length;n<b;++n)f[Ua[n]]=0}g=R(f);h=new (F?Uint8Array:Array)(c);k=new (F?Uint8Array:Array)(e);
d.z=0;d.o(R(a.call(d,c,g,h)),R(a.call(d,e,g,k)))}T.prototype.o=function(d,a){var c=this.a,e=this.b;this.u=d;for(var b=c.length-258,f,g,h,k;256!==(f=ib(this,d));)if(256>f)e>=b&&(this.b=e,c=this.f(),e=this.b),c[e++]=f;else{g=f-257;k=Wa[g];0<Ya[g]&&(k+=Y(this,Ya[g]));f=ib(this,a);h=$a[f];0<bb[f]&&(h+=Y(this,bb[f]));e>=b&&(this.b=e,c=this.f(),e=this.b);for(;k--;)c[e]=c[e++-h]}for(;8<=this.e;)this.e-=8,this.c--;this.b=e};
T.prototype.J=function(d,a){var c=this.a,e=this.b;this.u=d;for(var b=c.length,f,g,h,k;256!==(f=ib(this,d));)if(256>f)e>=b&&(c=this.f(),b=c.length),c[e++]=f;else{g=f-257;k=Wa[g];0<Ya[g]&&(k+=Y(this,Ya[g]));f=ib(this,a);h=$a[f];0<bb[f]&&(h+=Y(this,bb[f]));e+k>b&&(c=this.f(),b=c.length);for(;k--;)c[e]=c[e++-h]}for(;8<=this.e;)this.e-=8,this.c--;this.b=e};
T.prototype.f=function(){var d=new (F?Uint8Array:Array)(this.b-32768),a=this.b-32768,c,e,b=this.a;if(F)d.set(b.subarray(32768,d.length));else{c=0;for(e=d.length;c<e;++c)d[c]=b[c+32768]}this.l.push(d);this.q+=d.length;if(F)b.set(b.subarray(a,a+32768));else for(c=0;32768>c;++c)b[c]=b[a+c];this.b=32768;return b};
T.prototype.K=function(d){var a,c=this.input.length/this.c+1|0,e,b,f,g=this.input,h=this.a;d&&("number"===typeof d.v&&(c=d.v),"number"===typeof d.G&&(c+=d.G));2>c?(e=(g.length-this.c)/this.u[2],f=258*(e/2)|0,b=f<h.length?h.length+f:h.length<<1):b=h.length*c;F?(a=new Uint8Array(b),a.set(h)):a=h;return this.a=a};
T.prototype.t=function(){var d=0,a=this.a,c=this.l,e,b=new (F?Uint8Array:Array)(this.q+(this.b-32768)),f,g,h,k;if(0===c.length)return F?this.a.subarray(32768,this.b):this.a.slice(32768,this.b);f=0;for(g=c.length;f<g;++f){e=c[f];h=0;for(k=e.length;h<k;++h)b[d++]=e[h]}f=32768;for(g=this.b;f<g;++f)b[d++]=a[f];this.l=[];return this.buffer=b};
T.prototype.I=function(){var d,a=this.b;F?this.C?(d=new Uint8Array(a),d.set(this.a.subarray(0,a))):d=this.a.subarray(0,a):(this.a.length>a&&(this.a.length=a),d=this.a);return this.buffer=d};function jb(d){if("string"===typeof d){var a=d.split(""),c,e;c=0;for(e=a.length;c<e;c++)a[c]=(a[c].charCodeAt(0)&255)>>>0;d=a}for(var b=1,f=0,g=d.length,h,k=0;0<g;){h=1024<g?1024:g;g-=h;do b+=d[k++],f+=b;while(--h);b%=65521;f%=65521}return(f<<16|b)>>>0};function kb(d,a){var c,e;this.input=d;this.c=0;if(a||!(a={}))a.index&&(this.c=a.index),a.verify&&(this.N=a.verify);c=d[this.c++];e=d[this.c++];switch(c&15){case lb:this.method=lb;break;default:l(Error("unsupported compression method"))}0!==((c<<8)+e)%31&&l(Error("invalid fcheck flag:"+((c<<8)+e)%31));e&32&&l(Error("fdict flag is not supported"));this.B=new T(d,{index:this.c,bufferSize:a.bufferSize,bufferType:a.bufferType,resize:a.resize})}
kb.prototype.p=function(){var d=this.input,a,c;a=this.B.p();this.c=this.B.c;this.N&&(c=(d[this.c++]<<24|d[this.c++]<<16|d[this.c++]<<8|d[this.c++])>>>0,c!==jb(a)&&l(Error("invalid adler-32 checksum")));return a};var lb=8;function mb(d,a){this.input=d;this.a=new (F?Uint8Array:Array)(32768);this.h=$.k;var c={},e;if((a||!(a={}))&&"number"===typeof a.compressionType)this.h=a.compressionType;for(e in a)c[e]=a[e];c.outputBuffer=this.a;this.A=new ia(this.input,c)}var $=na;
mb.prototype.j=function(){var d,a,c,e,b,f,g,h=0;g=this.a;d=lb;switch(d){case lb:a=Math.LOG2E*Math.log(32768)-8;break;default:l(Error("invalid compression method"))}c=a<<4|d;g[h++]=c;switch(d){case lb:switch(this.h){case $.NONE:b=0;break;case $.r:b=1;break;case $.k:b=2;break;default:l(Error("unsupported compression type"))}break;default:l(Error("invalid compression method"))}e=b<<6|0;g[h++]=e|31-(256*c+e)%31;f=jb(this.input);this.A.b=h;g=this.A.j();h=g.length;F&&(g=new Uint8Array(g.buffer),g.length<=
h+4&&(this.a=new Uint8Array(g.length+4),this.a.set(g),g=this.a),g=g.subarray(0,h+4));g[h++]=f>>24&255;g[h++]=f>>16&255;g[h++]=f>>8&255;g[h++]=f&255;return g};function nb(d,a){var c,e,b,f;if(Object.keys)c=Object.keys(a);else for(e in c=[],b=0,a)c[b++]=e;b=0;for(f=c.length;b<f;++b)e=c[b],D(d+"."+e,a[e])};D("Zlib.Inflate",kb);D("Zlib.Inflate.prototype.decompress",kb.prototype.p);nb("Zlib.Inflate.BufferType",{ADAPTIVE:Ba.D,BLOCK:Ba.F});D("Zlib.Deflate",mb);D("Zlib.Deflate.compress",function(d,a){return(new mb(d,a)).j()});D("Zlib.Deflate.prototype.compress",mb.prototype.j);nb("Zlib.Deflate.CompressionType",{NONE:$.NONE,FIXED:$.r,DYNAMIC:$.k});}).call(window);
if (typeof module !== 'undefined') {
  module.exports = Zlib;
}

});
__loader.define("wakeup/index.js", 10081, function(exports, module, require) {
var Wakeup = require('./wakeup');

module.exports = Wakeup;

});
__loader.define("wakeup/wakeup.js", 10087, function(exports, module, require) {
var util2 = require('util2');
var Emitter = require('emitter');
var Settings = require('settings');
var simply = require('ui/simply');

var Wakeup = function() {
  this.init();
};

Wakeup.prototype.cleanupGracePeriod = 60 * 5;

util2.copy(Emitter.prototype, Wakeup.prototype);

Wakeup.prototype.init = function() {
  this._setRequests = [];
  this._launchCallbacks = [];
  this._loadData();
  this._cleanup();
};

Wakeup.prototype._loadData = function() {
  this.state = Settings._loadData(null, 'wakeup', true) || {};
  this.state.wakeups = this.state.wakeups || {};
};

Wakeup.prototype._saveData = function() {
  Settings._saveData(null, 'wakeup', this.state);
};

Wakeup.prototype._cleanup = function() {
  var id;
  var ids = [];
  for (id in this.state.wakeups) {
    ids.push(id);
  }
  var cleanupTime = Date.now() / 1000 - Wakeup.cleanupGracePeriod;
  var deleted = false;
  for (var i = 0, ii = ids.length; i < ii; ++i) {
    id = ids[i];
    var wakeup = this.state.wakeups[id];
    if (wakeup.params.time < cleanupTime) {
      deleted = true;
      delete this.state.wakeups[id];
    }
  }
  if (deleted) {
    this._saveData();
  }
};

Wakeup.prototype.get = function(id) {
  var wakeup = this.state.wakeups[id];
  if (wakeup) {
    return {
      id: wakeup.id,
      cookie: wakeup.cookie,
      data: wakeup.data,
      time: wakeup.params.time,
      notifyIfMissed: !!wakeup.params.notifyIfMissed,
    };
  }
};

Wakeup.prototype.each = function(callback) {
  var i = 0;
  for (var id in this.state.wakeups) {
    if (callback(this.get(id), i++) === false) {
      break;
    }
  }
};

Wakeup.prototype.schedule = function(opt, callback) {
  if (typeof opt !== 'object' || opt instanceof Date) {
    opt = { time: opt };
  }
  var cookie = opt.cookie || 0;
  this._setRequests.push({
    params: opt,
    data: opt.data,
    callback: callback,
  });
  this.launch(function() {
    simply.impl.wakeupSet(opt.time, cookie, opt.notifyIfMissed);
  });
};

Wakeup.prototype.cancel = function(id) {
  if (id === 'all') {
    this.state.wakeups = {};
  } else {
    delete this.state.wakeups[id];
  }
  simply.impl.wakeupCancel(id);
};

Wakeup.prototype.launch = function(callback) {
  if (this._launchEvent) {
    callback(this._launchEvent);
  } else {
    this._launchCallbacks.push(callback);
  }
};

Wakeup.prototype._makeBaseEvent = function(id, cookie) {
  var wakeup = this.state.wakeups[id];
  var e = {
    id: id,
    cookie: cookie,
  };
  if (wakeup) {
    e.data = wakeup.data;
  }
  return e;
};

Wakeup.prototype._makeWakeupEvent = function(id, cookie) {
  var e;
  if (id !== undefined) {
    e = this._makeBaseEvent(id, cookie);
    e.wakeup = true;
  } else {
    e = { wakeup: false };
  }
  return e;
};

Wakeup.prototype._setWakeup = function(id, wakeup) {
  this.state.wakeups[id] = wakeup;
  this._saveData();
};

Wakeup.prototype._removeWakeup = function(id) {
  if (id in this.state.wakeups) {
    delete this.state.wakeups[id];
    this._saveData();
  }
};

Wakeup.prototype.emitSetResult = function(id, cookie) {
  var req = this._setRequests.shift();
  if (!req) {
    return;
  }
  var e;
  if (typeof id === 'number') {
    this._setWakeup(id, {
      id: id,
      cookie: cookie,
      data: req.data,
      params: req.params,
    });
    e = this._makeBaseEvent(id, cookie);
    e.failed = false;
  } else {
    e = {
      error: id,
      failed: true,
      cookie: cookie,
      data: req.data,
    };
  }
  return req.callback(e);
};

Wakeup.prototype.emitWakeup = function(id, cookie) {
  var e = this._makeWakeupEvent(id, cookie);

  if (!this._launchEvent) {
    e.launch = true;
    if (this._emitWakeupLaunch(e) === false) {
      return false;
    }
  } else {
    e.launch = false;
  }

  if (e.wakeup) {
    this._removeWakeup(id);
    if (this.emit('wakeup', e) === false) {
      return false;
    }
  }
};

Wakeup.prototype._emitWakeupLaunch = function(e) {
  this._launchEvent = e;

  var callbacks = this._launchCallbacks;
  this._launchCallbacks = [];

  for (var i = 0, ii = callbacks.length; i < ii; ++i) {
    if (callbacks[i](e) === false) {
      return false;
    }
  }
};

module.exports = new Wakeup();

});
__loader.define("appinfo.json", 10289, function(exports, module, require) {
module.exports = {
  "appKeys": {},
  "capabilities": [
    "configurable"
  ],
  "companyName": "triveri@outlook.com",
  "longName": "Discord",
  "resources": {
    "media": [
      {
        "file": "images/appicon.png",
        "name": "IMAGE_MENU_ICON",
        "type": "bitmap"
      },
      {
        "file": "images/logo_splash.png",
        "name": "IMAGE_LOGO_SPLASH",
        "type": "bitmap"
      },
      {
        "file": "images/tile_splash.png",
        "name": "IMAGE_TILE_SPLASH",
        "type": "bitmap"
      },
      {
        "file": "fonts/UbuntuMono-Regular.ttf",
        "name": "MONO_FONT_14",
        "type": "font"
      },
      {
        "file": "images/Discord.png",
        "menuIcon": true,
        "name": "IMAGES_DISCORD_PNG",
        "type": "bitmap"
      }
    ]
  },
  "sdkVersion": "3",
  "shortName": "Discord",
  "targetPlatforms": [
    "aplite",
    "basalt",
    "chalk",
    "diorite"
  ],
  "uuid": "19a7512c-1ba8-4576-9d44-69b797bca74d",
  "versionCode": 1,
  "versionLabel": "9.0",
  "watchapp": {
    "hiddenApp": false,
    "watchface": false
  }
};
});
__loader.require("main");
