#!/usr/bin/env zx

$.verbose = false

const [host = ''] = process.argv.slice(3);
const services = [`http://ip-api.com/json/${host}`, `https://freegeoip.app/json/${host}`];
const resp = await Promise.race(services.map((url) => fetch(url)));

if (resp.ok) {
	const data = await resp.json();

	if (!('success' in data) || data.status === 'success') {
    const result = {
      ip: data?.query ?? data?.ip,
      as: `${data?.isp ?? 'N/A'}${data?.isp !== data?.org ? ' / ' + data?.org : ''}`,
      location: [data?.city, (data?.regionName ?? data?.region_name), (data?.country ?? data?.country_name)].filter(
        (e, i, arr) => e !== '' && arr.lastIndexOf(e) === i
      ),
      timezone: data?.timezone ?? data?.time_zone ?? 'N/A',
      lat: data?.lat ?? data?.latitude ?? 'N/A',
      lon: data?.lon ?? data?.longitude ?? 'N/A'
    }

		console.log(chalk.gray(`      IP:`), chalk.cyan(result.ip));
		console.log(chalk.gray(` ISP/Org:`), result.as);
		console.log(chalk.gray(` Address:`), result.location.join(', '));
		console.log(chalk.gray(`Timezone:`), result.timezone);
		console.log(chalk.gray(`Location:`), `${result.lat}, ${result.lon}`);
	}
}
