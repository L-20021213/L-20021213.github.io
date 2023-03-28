//缓存库名称
const CACHE_NAME = 'Chuckle'
const VERSION_CACHE_NAME = 'ChuckleTime'
//缓存离线超时时间
const MAX_ACCESS_CACHE_TIME = 60 * 60 * 24 * 10

function time() {
    return new Date().getTime()
}

const dbHelper = {
    read: (key) => {
        return new Promise((resolve) => {
            caches.match(key).then(function (res) {
                if (!res) resolve(null)
                res.text().then(text => resolve(text))
            }).catch(() => {
                resolve(null)
            })
        })
    },
    write: (key, value) => {
        return new Promise((resolve, reject) => {
            caches.open(VERSION_CACHE_NAME).then(function (cache) {
                // noinspection JSIgnoredPromiseFromCall
                cache.put(key, new Response(value));
                resolve()
            }).catch(() => {
                reject()
            })
        })
    },
    delete: (key) => {
        caches.match(key).then(response => {
            if (response) caches.open(VERSION_CACHE_NAME).then(cache => cache.delete(key))
        })
    }
}

//存储缓存入库时间
const dbTime = {
    read: (key) => dbHelper.read(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`)),
    write: (key, value) => dbHelper.write(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`), value),
    delete: (key) => dbHelper.delete(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`))
}

//存储缓存最后一次访问的时间
const dbAccess = {
    update: (key) => dbHelper.write(new Request(`https://ACCESS-CACHE/${encodeURIComponent(key)}`), time()),
    check: async (key) => {
        const realKey = new Request(`https://ACCESS-CACHE/${encodeURIComponent(key)}`)
        const value = await dbHelper.read(realKey)
        if (value) {
            dbHelper.delete(realKey)
            return time() - value < MAX_ACCESS_CACHE_TIME
        } else return false
    }
}

self.addEventListener('install', () => self.skipWaiting())

/**
 * 缓存列表
 * @param url 匹配规则
 * @param time 缓存有效时间
 * @param clean 清理缓存时是否无视最终访问时间直接删除
 */
const cacheList = {
    /* font: {
        url: /(jet|HarmonyOS)\.(woff2|woff|ttf)$/g,
        time: Number.MAX_VALUE,
        clean: false
    }, */
    tianli: {
        url: /(^(https:\/\/cdn1\.tianli0\.top).*@\d.*)/g,
        time: Number.MAX_VALUE,
        clean: true
    },
    unpkg: {
        url: /(^(https:\/\/unpkg\.zhimg\.com).*@\d.*)/g,
        time: Number.MAX_VALUE,
        clean: true
    },
    static: {
        url: /(^(https:\/\/npm\.elemecdn\.com).*@\d.*)|((jinrishici\.js|\.cur)$)/g,
        time: Number.MAX_VALUE,
        clean: true
    },
    update: {
        url: /(^(https:\/\/sianx\.com).*(\/)$)/g,
        time: 60 * 60 * 12,
        clean: true
    },
    resources: {
        url: /(^(https:\/\/(www\.sianx\.com|sianx\.com|blog\.sianx\.com))).*\.(css|html|webp|png|jpg|gif|js|woff2|woff|mtn|ttf|json|svg)$/g,
        time: 60 * 60 * 24 * 5,
        clean: true
    },
    /* stand: {
        url: /^https:\/\/image\.kmar\.top\/indexBg/g,
        time: 60 * 60 * 24 * 7,
        clean: true
    } */
}

/**
 * 链接替换列表
 * @param source 源链接
 * @param dist 目标链接
 */
const replaceList = {
   /*  gh: {
        source: ['https://cdn.jsdelivr.net/'],
        dist: 'https://cdn1.tianli0.top/'
    }, */
    /* npm: {
        source: [
            '//cdn.jsdelivr.net/npm',
            '//unpkg.zhimg.com'
        ],
        dist: '//npm.elemecdn.com'
    }, */
    /* emoji: {
        source: ['/gh/EmptyDreams/resources/icon'],
        dist: '/gh/EmptyDreams/twikoo-emoji'
    } */
}

//判断指定url击中了哪一种缓存，都没有击中则返回null
function findCache(url) {
    for (let key in cacheList) {
        const value = cacheList[key]
        if (url.match(value.url)) return value
    }
    return null
}

//检查连接是否需要重定向至另外的链接，如果需要则返回新的Request，否则返回null
function replaceRequest(request) {
    let url = request.url;
    let flag = false
    for (let key in replaceList) {
        const value = replaceList[key]
        for (let source of value.source) {
            if (url.match(source)) {
                url = url.replace(source, value.dist)
                flag = true
            }
        }
    }
    return flag ? new Request(url) : null
}

async function fetchEvent(request, response, cacheDist) {
    const NOW_TIME = time()
    // noinspection ES6MissingAwait
    dbAccess.update(request.url)
    const maxTime = cacheDist.time
    let remove = false
    if (response) {
        const time = await dbTime.read(request.url)
        if (time) {
            const difTime = NOW_TIME - time
            if (difTime < maxTime) return response
        }
        remove = true
    }
    const fetchFunction = () => fetch(request).then(response => {
        dbTime.write(request.url, NOW_TIME)
        if (response.ok || response.status === 0) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
    })
    if (!remove) return fetchFunction()
    const timeOut = () => new Promise((resolve => setTimeout(() => resolve(response), 400)))
    return Promise.race([
        timeOut(),
        fetchFunction()]
    ).catch(err => console.error('不可达的链接：' + request.url + '\n错误信息：' + err))
}

self.addEventListener('fetch', async event => {
    const replace = replaceRequest(event.request)
    const request = replace === null ? event.request : replace
    const cacheDist = findCache(request.url)
    if (cacheDist !== null) {
        event.respondWith(caches.match(request)
            .then(async (response) => fetchEvent(request, response, cacheDist))
        )
    } else if (replace !== null) {
        event.respondWith(fetch(request))
    }
})

self.addEventListener('message', function (event) {
    //刷新缓存
    if (event.data === 'refresh') {
        caches.open(CACHE_NAME).then(function (cache) {
            cache.keys().then(function (keys) {
                for (let key of keys) {
                    const value = findCache(key.url)
                    if (value == null || value.clean || !dbAccess.check(key.url)) {
                        // noinspection JSIgnoredPromiseFromCall
                        cache.delete(key)
                        dbTime.delete(key)
                    }
                }
                event.source.postMessage('success')
            })
        })
    }
})

//前端智能切换CDN
let cachelist = [];
self.addEventListener('install', async function (installEvent) {
    self.skipWaiting();
    installEvent.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                console.log('Opened cache');
                return cache.addAll(cachelist);
            })
    );
});
self.addEventListener('fetch', async event => {
    try {
        event.respondWith(handle(event.request))
    } catch (msg) {
        event.respondWith(handleerr(event.request, msg))
    }
});
const handleerr = async (req, msg) => {
    return new Response(`<h1>CDN分流器遇到了致命错误</h1>
    <b>${msg}</b>`, { headers: { "content-type": "text/html; charset=utf-8" } })
}
let cdn = {
    "gh": {
        jsdelivr: {
            "url": "https://cdn.jsdelivr.net/gh"
        },
        jsdelivr_fastly: {
            "url": "https://fastly.jsdelivr.net/gh"
        },
        jsdelivr_gcore: {
            "url": "https://gcore.jsdelivr.net/gh"
        },
        jsdelivr_testingcf: {
            "url": "https://testingcf.jsdelivr.net/gh"
        },
        jsdelivr_sianx: {
            "url": "https://jsd.sianx.com/gh"
        },
        jsdelivr_quantil: {
            "url": "https://quantil.jsdelivr.net/gh"
        }
    },
    "combine": {
        jsdelivr: {
            "url": "https://cdn.jsdelivr.net/combine"
        },
        jsdelivr_fastly: {
            "url": "https://fastly.jsdelivr.net/combine"
        },
        jsdelivr_gcore: {
            "url": "https://gcore.jsdelivr.net/combine"
        },
        jsdelivr_testingcf: {
            "url": "https://testingcf.jsdelivr.net/combine"
        },
        jsdelivr_sianx: {
            "url": "https://jsd.sianx.com/combine"
        },
        jsdelivr_quantil: {
            "url": "https://quantil.jsdelivr.net/combine"
        }
    },
    "npm": {
        jsdelivr: {
            "url": "https://cdn.jsdelivr.net/npm"
        },
        jsdelivr_fastly: {
            "url": "https://fastly.jsdelivr.net/npm"
        },
        jsdelivr_gcore: {
            "url": "https://gcore.jsdelivr.net/npm"
        },
        jsdelivr_testingcf: {
            "url": "https://testingcf.jsdelivr.net/npm"
        },
        jsdelivr_quantil: {
            "url": "https://quantil.jsdelivr.net/npm"
        },
        jsdelivr_sianx: {
            "url": "https://jsd.sianx.com/npm"
        },
        zhimg: {
            "url": "https://unpkg.zhimg.com"
        },
        unpkg: {
            "url": "https://unpkg.com"
        }

    }
}
const handle = async function (req) {
    const urlStr = req.url
    const domain = (urlStr.split('/'))[2]
    let urls = []
    for (let i in cdn) {
        for (let j in cdn[i]) {
            if (domain == cdn[i][j].url.split('https://')[1].split('/')[0] && urlStr.match(cdn[i][j].url)) {
                urls = []
                for (let k in cdn[i]) {
                    urls.push(urlStr.replace(cdn[i][j].url, cdn[i][k].url))
                }
                if (urlStr.indexOf('@latest/') > -1) {
                    return lfetch(urls, urlStr)
                } else {
                    return caches.match(req).then(function (resp) {
                        return resp || lfetch(urls, urlStr).then(function (res) {
                            return caches.open(CACHE_NAME).then(function (cache) {
                                cache.put(req, res.clone());
                                return res;
                            });
                        });
                    })
                }
            }
        }
    }
    return fetch(req)
}
const lfetch = async (urls, url) => {
    let controller = new AbortController();
    const PauseProgress = async (res) => {
        return new Response(await (res).arrayBuffer(), { status: res.status, headers: res.headers });
    };
    if (!Promise.any) {
        Promise.any = function (promises) {
            return new Promise((resolve, reject) => {
                promises = Array.isArray(promises) ? promises : []
                let len = promises.length
                let errs = []
                if (len === 0) return reject(new AggregateError('All promises were rejected'))
                promises.forEach((promise) => {
                    promise.then(value => {
                        resolve(value)
                    }, err => {
                        len--
                        errs.push(err)
                        if (len === 0) {
                            reject(new AggregateError(errs))
                        }
                    })
                })
            })
        }
    }
    return Promise.any(urls.map(urls => {
        return new Promise((resolve, reject) => {
            fetch(urls, {
                signal: controller.signal
            })
                .then(PauseProgress)
                .then(res => {
                    if (res.status == 200) {
                        controller.abort();
                        resolve(res)
                    } else {
                        reject(res)
                    }
                })
        })
    }))
}
