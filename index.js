
const { jsPDF } = require('jspdf')
const QRCode = require('./qrcode')

function base64_to_buf(base64) {
	var binary_string = window.atob(base64);
	var len = binary_string.length;
	var bytes = new Uint8Array(len);
	for (var i = 0; i < len; i++) {
		bytes[i] = binary_string.charCodeAt(i);
	}
	return bytes
}

function asset_url(fname) {
	return 'https://staging-uploads-media-assets.s3.amazonaws.com/' + fname;
}

async function dofetch(job) {
	const resp = await fetch(job.url)
	return (await job.process(resp))
}

async function process_img(resp) {
	const buf = await resp.arrayBuffer()
	return new Uint8Array(buf)
}

function onload(elem) {
	return new Promise(resolve => {
		elem.addEventListener('load', resolve)
	});
}

function roundedImage(ctx, x,y,width,height,radius){
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

async function render_profile_image(profile_url, opts={}) {
	let img = new Image()
	let img_loaded = onload(img);
	img.crossOrigin = "anonymous";
	img.src = profile_url

	await img_loaded

	const canvas = opts.canvasElem || document.createElement("canvas")
	canvas.width = 500;
	canvas.height = 500;
	var ctx = canvas.getContext("2d");

	ctx.save()

	const x = 0;
	const y = 0;
	const width = opts.width;
	const height = opts.height;
	const radius = opts.width / 2;

	roundedImage(ctx, x, y, width, height, radius)
	ctx.clip()
	ctx.drawImage(img, x, y, width, height)
	ctx.restore()

	const b64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, '')
	return base64_to_buf(b64)
}

async function process_font(resp) {
	return await resp.text()
}

async function generateBadge(options={}) {
	const width = 50;
	const height = 75;

	const pdf_opts = options.pdf || {
		format: [width, height]
	}

	const user = options.user || {
		profileImage: asset_url("profileImages/2df7ff0b-9092-11ea-8a88-0242ac110003-blue-me.jpg"),
		name: "Apprentice",
		id: "2df7ff0b-9092-11ea-8a88-0242ac110003",
		level: "tinkerer",
	}

	const level = (user.level && user.level.toLowerCase()) || 'tinkerer'

	const fetch_imgs = [
		{ name: 'avatar_bg', url: asset_url('img/badge/badge-avatar-bg-big.png'), process: process_img }
		,{ name: 'yellow_bg', url: asset_url('img/badge/badge-yellow-bg-big.png'), process: process_img }
		,{ name: 'level', url: asset_url(`img/levels/${level}.png`), process: process_img }
		,{ name: 'bungee', url: asset_url('fonts/Bungee-Regular.ttf.txt'), process: process_font }
		/* { name: 'profile', url: user.profileImage, process: }, */
	]

	const img_data = await Promise.all(fetch_imgs.map(dofetch))

	const downloads = img_data.reduce((obj, data, i) => {
		obj[fetch_imgs[i].name] = data
		return obj
	}, {});

	const doc = new jsPDF(pdf_opts);
	doc.addFileToVFS('Bungee.ttf', downloads.bungee)
	doc.addFont('Bungee.ttf', 'Bungee', 'normal')

	const BG_WIDTH_PERC = 0.83
	const PADDING = 1.5

	const AVATAR_BG_WIDTH = 408
	const AVATAR_BG_HEIGHT = 300
	const AVATAR_BG_ASPECT = AVATAR_BG_WIDTH / AVATAR_BG_HEIGHT

	const NAMEPLATE_BG_WIDTH = 512
	const NAMEPLATE_BG_HEIGHT = 184
	const NAMEPLATE_BG_ASPECT = NAMEPLATE_BG_WIDTH / NAMEPLATE_BG_HEIGHT

	let bg_width = width * BG_WIDTH_PERC
	let bg_height = bg_width / AVATAR_BG_ASPECT

	let x = width / 2 - bg_width / 2;
	let y = 2.8;

	let avatar_width = bg_width * 0.7
	let avatar_height = avatar_width

	let avatar_x = x + (bg_width/2) - (avatar_width/2)
	let avatar_y = y + (bg_height/2) - (avatar_height/2)

	let name_bg_y = y + bg_height + PADDING
	let name_bg_width = bg_width
	let name_bg_height = name_bg_width / NAMEPLATE_BG_ASPECT


	let level_y = name_bg_y + name_bg_height + PADDING
	let level_size = name_bg_width / 2 - PADDING
	let qr_x = x + level_size + PADDING

	const prof_img = await render_profile_image(user.profileImage, {
		width: 500, height: 500
	})

	doc.setFillColor(options.backgroundColor || '#FEFEFE')
	doc.rect(0, 0, width, height, 'F')
	doc.addImage(downloads.avatar_bg, 'PNG', x, y, bg_width, bg_height)
	doc.addImage(prof_img, 'PNG', avatar_x, avatar_y, avatar_width, avatar_height)
	doc.addImage(downloads.yellow_bg, 'PNG', x, name_bg_y, name_bg_width, name_bg_height)

	doc.setTextColor('#FFFFFF')
	doc.setFont('Bungee')

	fitText(doc, user.name, name_bg_width * 0.8)

	let dim = doc.getTextDimensions(user.name)

	let name_x = x + name_bg_width / 2
	let name_y = name_bg_y + name_bg_height / 2 + dim.h / 4

	doc.text(user.name, name_x, name_y, {align: 'center'})

	doc.addImage(downloads.level, 'PNG', x, level_y, level_size, level_size)

	const qr = await getQR(user.id, options.qrElem || document.createElement('div'))
	doc.addImage(qr, 'PNG', qr_x, level_y, level_size, level_size)

	doc.save(options.filename || "badge.pdf");
}

async function getQR(text, elem) {
        var qrcode = new QRCode(elem, {
		text: text,
		width: 300,
		height: 300,
		colorDark: '#2E338C'
	})

	const img = elem.querySelector('img')
	await onload(img)
	let src = img.src.replace(/^data:image\/png;base64,/, '')
	return base64_to_buf(src)
}

function fitText(doc, text, width) {
	let fontSize = 24
	while(true) {
		doc.setFontSize(fontSize)
		let dim = doc.getTextDimensions(text)
		fontSize--;

		if (fontSize === 0 || dim.w < width)
			break;
	}
}

module.exports = generateBadge
