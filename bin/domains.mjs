#!/usr/bin/env zx

import dns from "node:dns";

const prefixes = [
	"yotta",
	"zetta",
	"exa",
	"peta",
	"tera",
	"giga",
	"mega",
	"kilo",
	"hecto",
	"deca",
	"deci",
	"centi",
	"milli",
	"micro",
	"nano",
	"pico",
	"femto",
	"atto",
	"zepto",
	"yocto",
];

const units = [
	"meter",
	"gram",
	"second",
	"ampere",
	"kelvin",
	"mole",
	"candela",
	"radian",
	"steradian",
	"hertz",
	"newton",
	"pascal",
	"joule",
	"watt",
	"coulomb",
	"volt",
	"farad",
	"ohm",
	"siemens",
	"weber",
	"tesla",
	"henry",
	"lumen",
	"lux",
	"becquerel",
];

dns.setServers([
  "1.1.1.1",
  "1.0.0.1",
  "8.8.8.8",
  "8.8.4.4"
]);

for (const prefix of prefixes) {
	for (const unit of units) {
		setTimeout(() => checkAvailable(`${prefix}${unit}.com`, console.log), 1500);
	}
}

function checkAvailable(domain, callback) {
	dns.resolve(domain, (err, addresses) => {
		if (err) {
			callback(domain, "\t", `<${err.code}>`);
		} else {
			callback(domain, "\t", addresses.join(', '));
		}
	});
}
