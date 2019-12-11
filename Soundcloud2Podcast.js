let request = require('sync-request');
let fs = require('fs');
let md5 = require('md5');
let strtotime = require('strtotime');
let rss = require('rss');
let mime = require('mime-types')
let express = require('express');

const CLIENT_ID_PATH = 'client_id';
const YOUTUBE_DL_CLIENT_ID_URL = 'https://raw.githubusercontent.com/ytdl-org/youtube-dl/master/youtube_dl/extractor/soundcloud.py';

module.exports = class Soundcloud2Podcast {

	constructor(url = '', cache_time = '1 hour') {
		this.url = url;
		this.cache_time;

		let app = express();
		app.listen(3000, () => {
			console.log('Soundcloud2Podcast app listening on port 3000!');
		});

		app.get('/', (req, res) => {
			this.req = req;
			this.res = res;
			this.main();
		});
    }

	main(){
		this.print(this.get_feed());
	}

	get_soundcloud_url(){
		let url = this.req.query.url;
		if (url)
			this.url = url;
		else
			url = this.url;

		if (!url || !url.startsWith('https://soundcloud.com/'))
			this.die('soundcloud url is wrong!');
		return url;
	}

	getSoundcloudJson(url){
		let clientId = this.getLocalClientId();
		let res = this.getSoundcloudApi(url, clientId, false);

		if (!res){
			this.saveRemoteClientId();
			res = this.getSoundcloudApi(url, true);
		}

		let json;
		try {
			json = JSON.parse(res.body);
		}
		catch(err){
			console.error(err);
			this.die('json file is wrong!');
		}
		return json;
	}

	getSoundcloudApi(url, dieIfFailed){
		let apiUrl = "https://api.soundcloud.com/resolve.json?client_id=" + this.clientId + "&url=" + url;
		let res = request('GET', apiUrl);
		if (res.statusCode != 200){
			 if (dieIfFailed)
				this.die('request to soundcloud failed!');
		else
			return false;
		}

		return res;
	}

	get_feed(){
		let url = this.get_soundcloud_url();
		let cache = this.get_cache();
		if (cache)
			return cache;

		let sc = this.getSoundcloudJson(url);
		if (sc.kind != 'user')
			this.user = this.getSoundcloudJson(sc.user.permalink_url);
		else
			this.user = sc;

		return this.generate_feed(sc).xml(true);
	}

	generate_feed(sc){
		let feed = this.generate_basic_feed(sc);
		let tracks = sc.kind == 'user' ? this.getSoundcloudJson(sc.permalink_url + "/tracks") : sc.tracks;

		feed = this.add_items_to_feed(feed, tracks);

		this.save_cache(feed);

		return feed;
	}

	generate_basic_feed(sc){
		let options = {
			title: sc.title ? sc.title : this.user.username,
			description: sc.description,
			feed_url: this.get_current_url(),
			site_url: sc.permalink_url,
			pubDate: sc.last_modified,
			ttl: 60,
		};

		this.addChannelImage(options, sc);
		if (sc.license)
			options.copyright = sc.license + ' ' + this.user.username;

		return new rss(options);
	}

	add_items_to_feed(feed, tracks){
		tracks.sort((track1, track2) => {
			return strtotime(track2.created_at) - strtotime(track1.created_at);		
		});
		for (let i = 0; i < tracks.length; i++){
			let track = tracks[i];
			let download_url = track.download_url ? track.download_url : track.stream_url;
			feed.item({
				title: track.title,
				description: track.description,
				url: track.permalink_url,
				guid: track.permalink_url,
				date: track.created_at,
				enclosure: {
					url: download_url + '?client_id=' + this.clientId,
					size: track.original_content_size,
					type: mime.lookup(track.original_format)
				},
				custom_elements: [
					{'itunes:author': this.user.username},
					{'itunes:image': {
						_attr: {
							href: track.artwork_url
						}
					}},
				]
			});
		}
		return feed;
	}

	get_cache(){
		let cache = this.get_cache_path();
		if (fs.existsSync(cache) &&  strtotime('now') < strtotime(this.cache_time, fs.statSync(cache).mtimeMs*1000)) {
			return fs.readFileSync(cache);
		}
		else
			return false;
	}

	save_cache(feed){
		if (!fs.existsSync('cache'))
			fs.mkdirSync('cache');

		fs.writeFile(this.get_cache_path(), feed.xml(true), () => {});
	}

	get_cache_path(){
		return 'cache/' + md5(this.url) + '.xml';
	}

	addChannelImage(options, sc){
		let image_url = sc.artwork_url ? sc.artwork_url : this.user.avatar_url;
		if (image_url){
			options.image_url = image_url;
			options.custom_namespaces = {'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd'};
			options.custom_elements = [{'itunes:image': {_attr: {href: image_url}}}];
		}
	}

	getLocalClientId(){
		if (!fs.existsSync(CLIENT_ID_PATH))
			return this.saveRemoteClientId();

		this.clientId = fs.readFileSync(CLIENT_ID_PATH);
		return this.clientId;
	}

	saveRemoteClientId(){
		let res = request('GET', YOUTUBE_DL_CLIENT_ID_URL);
		if (res.statusCode != 200)
			this.die('request to youtube-dl failed!');

		let pattern = /_CLIENT_ID = \'([a-zA-Z0-9]*)\'/;
		let matches = res.body.toString().match(pattern);

		if (!matches[1])
			die('clientid not found!');
			
		fs.writeFile(CLIENT_ID_PATH, matches[1], () => {});
		this.clientId = matches[1];
		return this.clientId;
	}

	die(message){
		this.res.statusCode = 500;
		this.res.setHeader('Content-Type', 'text/html');
		this.res.send(message);
		this.res.set("Connection", "close");
	}

	print(message){
		this.res.set('Content-Type', 'application/rss+xml; charset=utf-8');
		this.res.send(message);
		this.res.set("Connection", "close");
	}

	time(){
		return Math.floor(new Date() / 1000);
	}

	get_current_url(){
		return this.req.protocol + '://' + this.req.get('host') + this.req.originalUrl;
	}
}
