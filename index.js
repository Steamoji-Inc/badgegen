
const { jsPDF } = require('jspdf')
const https = require('https')

function asset_url(fname) {
	return 'https://assets.steamoji.com/' + fname;
}

async function generateBadge(options={}) {
	const pdf_opts = options.pdf || {
		format: [50, 75]
	}

	const user = options.user || {
		profileImage: asset_url("profileImages/2df7ff0b-9092-11ea-8a88-0242ac110003-blue-me.jpg"),
		level: "tinkerer",
	}

	const fetch_imgs = [
	  { name: 'avatar_bg', url: asset_url('img/badge/badge-avatar-bg.png') }
	, { name: 'yellow_bg', url: asset_url('img/badge/badge-yellow-bg.png') }
	, { name: 'profile', url: user.profileImage },
	]

	const img_data = await Promise.all(fetch_imgs.map(v => fetch(v.url)))

	const imgs = img_data.reduce((obj, data, i) => {
		obj[fetch_imgs[i].name] = data
		return obj
	}, {});

	const doc = new jsPDF(pdf_opts);

	let x = 7;
	let y = 10;
	const width = 35;

	doc.addImage(imgs.avatar_bg, 'PNG', x, x, width, 25)
	doc.addImage(imgs.yellow_bg, 'PNG', x, 40, width, 20)

	doc.save("badge.pdf");
}

module.exports = generateBadge

function fetch(url) {
	return new Promise((resolve, reject) => {
		https.get(url, (res) => {
			const data = [];
			res.on('data', (chunk) => {
				data.push(chunk);
			}).on('end', () => {
				resolve(Buffer.concat(data));
			});
		}).on('error', (err) => {
			reject(err)
		});
	})
}