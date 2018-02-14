let request = require('sync-request');
let fs = require('fs');
let md5 = require('md5');
let strtotime = require('strtotime');
let rss = require('rss');
let mime = require('mime-types')
let express = require('express');

const CLIENT_ID = "DQskPX1pntALRzMp4HSxya3Mc0AO66Ro";

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

	get_soundcloud_json(url){
		let api_url = "https://api.soundcloud.com/resolve.json?client_id=" + CLIENT_ID + "&url=" + url;
		let res = request('GET', api_url);
		let json;
		if (res.statusCode != 200)
			this.die('request to soundcloud failed!');

		try {
			json = JSON.parse(res.body);
		}
		catch(err){
			this.die('json file is wrong!');
		}

		return json;
	}

	get_feed(){
		let url = this.get_soundcloud_url();
		let cache = this.get_cache();
		if (cache)
			return cache;

		let sc = this.get_soundcloud_json(url);
		if (sc.kind != 'user')
			this.user = this.get_soundcloud_json(sc.user.permalink_url);
		else
			this.user = sc;

		return this.generate_feed(sc).xml(true);
	}

	generate_feed(sc){
		let feed = this.generate_basic_feed(sc);
		let tracks = sc.kind == 'user' ? this.get_soundcloud_json(sc.permalink_url + "/tracks") : sc.tracks;

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
		tracks = tracks.reverse();
		for (let i = 0; i < tracks.length; i++){
			let track = tracks[i];
			let download_url = track.download_url ? track.download_url : track.stream_url;
			feed.item({
				title: track.title,
				description: track.description,
				url: track.permalink_url,
				guid: track.permalink_url,
				enclosure: {
					url: download_url + '?client_id=' + CLIENT_ID,
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
		if (fs.existsSync(cache) && this.time() - fs.statSync(cache).mtimeMs*1000 < strtotime(this.cache_time)) {
			return fs.readFileSync(cache);
		}
		else
			return false;
	}

	save_cache(feed){
		if (!fs.existsSync('cache'))
			fs.mkdirSync('cache');

		fs.writeFile(this.get_cache_path(), feed.xml(true));
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

	die(message){
		this.res.statusCode = 500;
		this.res.setHeader('Content-Type', 'text/html');
		this.res.send(message);
		this.res.set("Connection", "close");
	}

	print(message){
		//this.res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
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
