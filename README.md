# node-soundcloud2podcast
Convert Soundcloud playlist or user to podcast feed for NodeJS

## Usage
### Manually Download
1. Download node-soundcloud2podcast.
2. Install required dependencies with npm:  
`$ npm install`
3. Run index.js:  
`$ node index.js`
4. Transfer souncloud url in url parameter:  
 `http://example.com:3000/?url=https://soundcloud.com/user/`

### npm
1. Install soundcloud2podcast:  
`$ npm i soundcloud2podcast`
2. Transfer souncloud url in url parameter:  
 `http://example.com:3000/?url=https://soundcloud.com/user/`
3. Two options: 
<ul>
 <li><h4>Create object:</h4>

```js
let Soundcloud2Podcast = require('soundcloud2podcast');
new Soundcloud2Podcast(url, cacheTime);
```
   - `url` **url string** Url to the souncloud page to convert.
   - `cacheTime` _optional_ **string** Time to refresh the feed cache (example: `30 minutes`). Default: 1 hour.
</li>
<li> <h4>Run index.js:</h4>  
 <code>node node_modules/soundcloud2podcast/index.js</code>
 </li>
 </ul>
 
## License
GPL.

You can contact me for another license.
