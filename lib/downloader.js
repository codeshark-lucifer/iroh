import https from 'https';
import vm from 'vm';

export default class YouTubeDownloader {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
    }

    _get(url, headers = {}) {
        return new Promise((resolve, reject) => {
            const options = { headers: { 'User-Agent': this.userAgent, ...headers } };
            https.get(url, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ data, headers: res.headers, statusCode: res.statusCode }));
            }).on('error', reject);
        });
    }

    _decipherN(playerJs, videoUrl) {
        const urlObj = new URL(videoUrl);
        const originalN = urlObj.searchParams.get('n');
        if (!originalN) return null;

        const mockWindow = {
            navigator: { userAgent: this.userAgent },
            location: { href: 'https://www.youtube.com', hostname: 'www.youtube.com' },
            document: { createElement: () => ({ style: {} }), documentElement: { style: {} }, body: { style: {} }, location: { hostname: 'www.youtube.com' } },
            addEventListener: () => {}, setTimeout, clearTimeout, setInterval, clearInterval
        };

        const context = vm.createContext({
            window: mockWindow, self: mockWindow, navigator: mockWindow.navigator,
            document: mockWindow.document, location: mockWindow.location,
            XMLHttpRequest: class { open() {}; send() {}; addEventListener() {} },
            setTimeout, clearTimeout, setInterval, clearInterval,
            Image: class {}, Audio: class {}, console: { log: () => {} },
            atob: (str) => Buffer.from(str, 'base64').toString('binary'),
            btoa: (str) => Buffer.from(str, 'binary').toString('base64')
        });

        try {
            const wrappedJs = `var _yt_player = {}; ${playerJs}; globalThis._yt_player = _yt_player;`;
            vm.runInContext(wrappedJs, context);
        } catch (e) {}

        const _yt_player = context._yt_player || {};
        let OR = _yt_player.OR;

        if (!OR) {
            for (const key in _yt_player) {
                const val = _yt_player[key];
                if (typeof val === 'function' && val.prototype && typeof val.prototype.get === 'function') {
                    try {
                        const inst = new val(videoUrl, true);
                        const result = inst.get('n');
                        if (result && result !== originalN) { OR = val; break; }
                    } catch (e) {}
                }
            }
        }

        if (!OR) return originalN;

        try {
            const orInstance = new OR(videoUrl, true);
            return orInstance.get('n') || originalN;
        } catch(e) {
            return originalN;
        }
    }

    _decipherSignature(playerJs, sig, url, sp = 'sig') {
        let n6Match = playerJs.match(/(?<!\.)\b([a-zA-Z0-9$]+)=function\([^\)]*\){[^}]+?\.set\("alr","yes"\)/);
        if (!n6Match) {
            n6Match = playerJs.match(/(?<!\.)\b([A-Za-z0-9$]{2,})=function\(\w\)\{\w=\w\.split\(""\);[\s\S]*?return \w\.join\(""\)\}/);
        }
        if (!n6Match) return sig;

        const n6Name = n6Match[1];
        const escapedName = n6Name.replace(/\$/g, '\\\$');
        const n6BodyMatch = playerJs.match(new RegExp(`(?:var\\s+)?${escapedName}\\s*=\\s*function\\([^\\)]*\\){([\\s\\S]*?)}`)) ||
                            playerJs.match(new RegExp(`function\\s+${escapedName}\\([^\\)]*\\){([\\s\\S]*?)}`));
        if (!n6BodyMatch) return sig;
        const n6Body = n6BodyMatch[1];

        const lnCallMatch = n6Body.match(/([a-zA-Z0-9$]+)\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*([a-zA-Z0-9$]+)\s*\(\s*(\d+)\s*,\s*(\d+)\s*,/);
        if (!lnCallMatch) return sig;
        
        const lnName = lnCallMatch[1];
        const lnArg1 = parseInt(lnCallMatch[2]);
        const lnArg2 = parseInt(lnCallMatch[3]);
        const dhName = lnCallMatch[4];
        const dhArg1 = parseInt(lnCallMatch[5]);
        const dhArg2 = parseInt(lnCallMatch[6]);

        const mockWindow = {
            navigator: { userAgent: this.userAgent },
            location: { href: 'https://www.youtube.com', hostname: 'www.youtube.com' },
            document: { createElement: () => ({ style: {} }), documentElement: { style: {} }, body: { style: {} }, location: { hostname: 'www.youtube.com' } },
            addEventListener: () => {}, setTimeout, clearTimeout, setInterval, clearInterval
        };

        const contextObject = {
            window: mockWindow, self: mockWindow, navigator: mockWindow.navigator,
            document: mockWindow.document, location: mockWindow.location,
            XMLHttpRequest: class { open() {}; send() {}; addEventListener() {} },
            setTimeout, clearTimeout, setInterval, clearInterval,
            Image: class {}, Audio: class {}, console: { log: () => {} },
            atob: (str) => Buffer.from(str, 'base64').toString('binary'),
            btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
            decodeURIComponent, encodeURIComponent, Uint8Array, Int32Array, Float64Array, Array, Object, Math, JSON,
            globalThis: null
        };
        contextObject.globalThis = contextObject;
        const context = vm.createContext(contextObject);

        let modifiedJs = playerJs;
        const closureStartStr = '(function(g){';
        const closureEndStr = '})(_yt_player);';
        const startIdx = modifiedJs.indexOf(closureStartStr);
        const endIdx = modifiedJs.lastIndexOf(closureEndStr);
        
        if (startIdx !== -1 && endIdx !== -1) {
            const bodyStart = startIdx + closureStartStr.length;
            const body = modifiedJs.slice(bodyStart, endIdx);
            modifiedJs = modifiedJs.slice(0, bodyStart) + `\n try { ${body} } catch(e) {} \n` + modifiedJs.slice(endIdx);
        }

        modifiedJs = modifiedJs.replace(new RegExp(`(${lnName.replace(/\$/g, '\\$')}\\s*=\\s*function)`), `globalThis._decipherLN=$1`);
        modifiedJs = modifiedJs.replace(new RegExp(`(${dhName.replace(/\$/g, '\\$')}\\s*=\\s*function)`), `globalThis._decipherDH=$1`);

        try {
            vm.runInContext(modifiedJs, context);
            if (typeof context._decipherLN === 'function' && typeof context._decipherDH === 'function') {
                const decipheredSig = context._decipherLN(lnArg1, lnArg2, context._decipherDH(dhArg1, dhArg2, decodeURIComponent(sig)));
                const finalSig = Array.isArray(decipheredSig) ? decipheredSig.join("") : decipheredSig;
                if (typeof finalSig === 'string') return `${url}&${sp}=${encodeURIComponent(finalSig)}`;
            }
        } catch (e) {}

        return `${url}&${sp}=${encodeURIComponent(sig)}`;
    }

    _getUrlFromFormat(format, playerJs) {
        let foundUrl = null;
        let cipherString = null;

        if (typeof format.url === 'string') {
            foundUrl = format.url;
        } else if (typeof format.signatureCipher === 'string' || typeof format.cipher === 'string') {
            cipherString = format.signatureCipher || format.cipher;
        } else {
            for (const key in format) {
                if (typeof format[key] === 'string' && format[key].includes('https://')) {
                    foundUrl = format[key];
                    break;
                } else if (typeof format[key] === 'string' && (format[key].includes('url=') || format[key].includes('sig='))) {
                    cipherString = format[key];
                    break;
                }
            }
        }

        if (cipherString && !foundUrl) {
            const params = new URLSearchParams(cipherString);
            const s = params.get('s');
            const sp = params.get('sp') || 'sig';
            const baseUrl = params.get('url');
            if (baseUrl) {
                return this._decipherSignature(playerJs, s, baseUrl, sp);
            }
        }

        if (!foundUrl) return null;

        const signatureToken = format.signature || format.sig || format.s;
        if (signatureToken) {
            return this._decipherSignature(playerJs, signatureToken, foundUrl, 'sig');
        }

        return foundUrl;
    }

    _formatHeight(format) {
        let height = typeof format.height === 'number' ? format.height : 0;
        if (!height && typeof format.qualityLabel === 'string') {
            const match = format.qualityLabel.match(/(\d+)p/);
            height = match ? parseInt(match[1], 10) : 0;
        }
        return height;
    }

    _processUrlTokens(rawUrl, playerJs) {
        const urlObj = new URL(rawUrl);
        const nVal = urlObj.searchParams.get('n');
        if (nVal) {
            const transformedN = this._decipherN(playerJs, urlObj.toString());
            if (transformedN) urlObj.searchParams.set('n', transformedN);
        }
        return urlObj.toString();
    }

    async _fetchStreamingData(videoId) {
        const { data: html } = await this._get(`https://www.youtube.com/watch?v=${videoId}`);
        const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]+?});/) || html.match(/var\s+ytInitialPlayerResponse\s*=\s*({[\s\S]+?});/);
        if (!playerResponseMatch) throw new Error('No player response payload discovered.');
        
        const playerResponse = JSON.parse(playerResponseMatch[1]);
        const streamingData = playerResponse.streamingData;
        if (!streamingData) throw new Error('Streaming configuration mapping is absent.');

        const playerJsMatch = html.match(/src="([^"]+base\.js)"/) || html.match(/"jsUrl":"([^"]+)"/);
        if (!playerJsMatch) throw new Error('Player validation script path unfound.');
        
        let playerJsUrl = playerJsMatch[1];
        if (playerJsUrl.startsWith('/')) playerJsUrl = 'https://www.youtube.com' + playerJsUrl;

        const { data: playerJs } = await this._get(playerJsUrl);

        return { streamingData, playerJs };
    }

    async getDownloadStream(videoId, mode = 'audio') {
        const { streamingData, playerJs } = await this._fetchStreamingData(videoId);
        const allFormats = [...(streamingData.formats || []), ...(streamingData.adaptiveFormats || [])];

        let targetFormat = null;

        if (mode === 'video') {
            const videoFormats = allFormats.filter(f => {
                const mime = (f.mimeType || '').toLowerCase();
                if (!mime.includes('video')) return false;
                f._decipheredUrl = this._getUrlFromFormat(f, playerJs);
                return !!f._decipheredUrl;
            });

            if (!videoFormats.length) throw new Error('No playable video tracks available.');

            videoFormats.sort((a, b) => {
                const aHeight = this._formatHeight(a);
                const bHeight = this._formatHeight(b);
                if (aHeight !== bHeight) return bHeight - aHeight;
                return (b.bitrate || 0) - (a.bitrate || 0);
            });
            targetFormat = videoFormats[0];
        } else {
            const audioFormats = allFormats.filter(f => {
                const mime = (f.mimeType || '').toLowerCase();
                // We accept anything with audio, but we'll sort pure audio to the top
                if (!mime.includes('audio') && !mime.includes('mp4a')) return false; 
                f._decipheredUrl = this._getUrlFromFormat(f, playerJs);
                return !!f._decipheredUrl;
            });

            if (!audioFormats.length) throw new Error('No playable audio tracks detected.');

            // Sort: 1. Pure audio (audio/) first, 2. then by bitrate
            audioFormats.sort((a, b) => {
                const aIsPure = (a.mimeType || '').includes('audio/');
                const bIsPure = (b.mimeType || '').includes('audio/');
                if (aIsPure && !bIsPure) return -1;
                if (!aIsPure && bIsPure) return 1;
                return (b.bitrate || 0) - (a.bitrate || 0);
            });
            targetFormat = audioFormats[0];
            console.log(`[JOB: Audio] Selected itag=${targetFormat.itag} (${targetFormat.mimeType})`);
        }

        const finalUrl = this._processUrlTokens(targetFormat._decipheredUrl, playerJs);
        
        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    'User-Agent': this.userAgent,
                    'Referer': `https://www.youtube.com/watch?v=${videoId}`
                }
            };
            https.get(finalUrl, options, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    this._getFinalStream(res.headers.location, videoId).then(resolve).catch(reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`CDN returned ${res.statusCode}`));
                    return;
                }
                resolve({ stream: res, itag: targetFormat.itag, mimeType: targetFormat.mimeType });
            }).on('error', reject);
        });
    }

    _getFinalStream(url, videoId) {
        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    'User-Agent': this.userAgent,
                    'Referer': `https://www.youtube.com/watch?v=${videoId}`
                }
            };
            https.get(url, options, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`CDN returned ${res.statusCode}`));
                    return;
                }
                resolve({ stream: res });
            }).on('error', reject);
        });
    }
}
