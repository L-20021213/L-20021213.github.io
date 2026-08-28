(() => {const CACHE_NAME = 'siax-blog-swpp';
const BASE_URL = 'https://siax.cn/';
const VERSION_PATH = 'https://id.v3/';
const ESCAPE = 0;
const INVALID_KEY = 'X-Swpp-Invalid';
const STORAGE_TIMESTAMP = 'X-Swpp-Time';
const UPDATE_JSON_URL = 'swpp/update.json';
const UPDATE_CD = 600000;
const isFetchSuccessful = (response) => [200, 301, 302, 307, 308].includes(response.status);
const matchCacheRule = (url) => {
          const HOUR = 3600 * 1000;
          const DAY = 24 * HOUR;
          // 不缓存也不拦截的域名
          const SKIP_HOSTS = ['meting.qjqq.cn', 'i0.hdslb.com'];

          /**
           * 返回 false = 不缓存且完全不拦截（浏览器默认网络请求）
           * 返回正数 = 定时缓存（毫秒）；返回负数 = 永久缓存
           */
          const getCacheRule = (u, isLocal) => {
            const host = u.hostname;
            const path = u.pathname;

            // 音乐接口（避免缓存干扰进度条）、B站番剧封面直接放行
            if (SKIP_HOSTS.includes(host)) return false;

            // ===== 本站资源 =====
            if (isLocal) {
              // 页面 HTML：永久缓存（由 swpp 增量更新机制负责刷新）
              if (path.endsWith('/') || path.endsWith('.html')) return -1;
              // 本地 js/css/字体/图标：永久缓存（文件带 hash，安全）
              if (/\.(js|mjs|css|woff2?|ttf|eot|otf|svg|ico)$/i.test(path)) return -1;
              // 本地图片：30 天
              if (/\.(png|jpe?g|gif|webp|avif)$/i.test(path)) return 30 * DAY;
              // 本地 JSON（本地搜索数据等）：30 分钟
              if (path.endsWith('.json')) return 30 * 60 * 1000;
              return false;
            }

            // ===== 外部 CDN 资源（保证 CDN 挂掉也能正常加载） =====
            // ★ CDN 镜像分组（由 hexo-swpp-plus 按 swpp_plus.cdn 配置生成）
            const CDN_MIRRORS = {
              "jsdelivrLike": [
              "cdn.jsdelivr.net",
              "fastly.jsdelivr.net",
              "cdn.siax.cn",
              "jsd.siax.cn"],

              "bareNpm": [
              "unpkg.com",
              "npm.elemecdn.com",
              "npm.onmicrosoft.cn",
              "cdn.cbd.int"],

              "cdnjsHosts": [
              "cdnjs.cloudflare.com",
              "cdn.staticfile.org"]

            };
            const isNpmCdn =
            CDN_MIRRORS.jsdelivrLike.includes(host) || CDN_MIRRORS.bareNpm.includes(host);
            // cdnjs 系（/ajax/libs/ 格式）
            const isCdnjsCdn = CDN_MIRRORS.cdnjsHosts.includes(host);

            if (isNpmCdn || isCdnjsCdn) {
              // js/css/字体：永久缓存（URL 带版本号，安全）
              if (/\.(js|mjs|css|woff2?|ttf|eot|otf)$/i.test(path)) return -1;
              // 图片：30 天
              if (/\.(png|jpe?g|gif|webp|avif)$/i.test(path)) return 30 * DAY;
              // 其他静态文件：7 天
              return 7 * DAY;
            }

            // 其他外部资源：不缓存不拦截
            return false;
          };

          return getCacheRule(url, url.host === self.location.host);
        };
const normalizeUrl = (url) => {
                if (url.endsWith('/index.html'))
                    return url.substring(0, url.length - 10);
                if (url.endsWith('.html'))
                    return url.substring(0, url.length - 5);
                else
                    return url;
            };
const matchUpdateRule = (exp) => {
                /**
                 * 遍历所有value
                 * @param action 接受value并返回bool的函数
                 * @return 如果 value 只有一个则返回 `action(value)`，否则返回所有运算的或运算（带短路）
                 */
                const forEachValues = (action) => {
                    const value = exp.value;
                    if (Array.isArray(value)) {
                        for (let it of value) {
                            if (action(it))
                                return true;
                        }
                        return false;
                    }
                    else
                        return action(value);
                };
                switch (exp.flag) {
                    case 'html':
                        return url => /\/$|\.html$/.test(url);
                    case 'suf':
                        return url => forEachValues(value => url.endsWith(value));
                    case 'pre':
                        return url => forEachValues(value => url.startsWith(value));
                    case 'str':
                        return url => forEachValues(value => url.includes(value));
                    case 'reg':
                        return url => forEachValues(value => new RegExp(value, 'i').test(url));
                    default:
                        throw exp;
                }
            };
const matchFromCaches = (request) => caches.match(request, { cacheName: CACHE_NAME });
const writeResponseToCache = async (request, response, date) => {
                if (date) {
                    const headers = new Headers(response.headers);
                    headers.set(STORAGE_TIMESTAMP, new Date().toISOString());
                    response = new Response(response.body, {
                        status: response.status,
                        headers
                    });
                }
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, response);
            };
const markCacheInvalid = (request) => matchFromCaches(request).then(response => {
                if (!response)
                    return;
                const headers = new Headers(response.headers);
                headers.set(INVALID_KEY, '1');
                return writeResponseToCache(request, new Response(response.body, { status: response.status, headers }));
            });
const isValidCache = (response, rule) => {
                const headers = response.headers;
                if (headers.has(INVALID_KEY))
                    return false;
                // 只有本站资源允许永久缓存
                if (rule < 0) {
                    const url = response.url;
                    const baseLength = BASE_URL.length;
                    if (url.startsWith(BASE_URL) && (url.length === baseLength || url[baseLength] === '/')) {
                        return true;
                    }
                    // 将rule设置为一天（24小时）
                    rule = 24 * 60 * 60 * 1000;
                }
                const storage = headers.get(STORAGE_TIMESTAMP);
                if (!storage)
                    return true;
                const storageDate = new Date(storage).getTime();
                const nowTimestamp = Date.now();
                // @ts-ignore
                return nowTimestamp - storageDate < rule;
            };
const readVersion = () => matchFromCaches(VERSION_PATH)
                .then(response => response?.json?.());
const writeVersion = (version) => {
                version.tp = Date.now();
                return writeResponseToCache(VERSION_PATH, new Response(JSON.stringify(version)));
            };
const postMessage = async (type, data, ...goals) => {
                if (!goals.length) {
                    // @ts-ignore
                    goals = await clients.matchAll();
                }
                const body = { type, data };
                for (let client of goals) {
                    client.postMessage(body);
                }
            };
const transferError2Response = (err) => new Response(JSON.stringify({
                type: err.name,
                message: err.message,
                stack: err.stack,
                addition: err
            }), {
                status: 599,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
const fetchWrapper = (request, banCache, cors, optional) => {
                const init = {
                    referrerPolicy: request.referrerPolicy ?? '',
                    ...optional
                };
                init.cache = banCache ? 'no-store' : 'default';
                if (cors) {
                    init.mode = 'cors';
                    init.credentials = 'same-origin';
                }
                return fetch(request, init);
            };
const isCors = () => false;
const getFastestRequests = (request) => {
        const url = new URL(request.url);
        const host = url.hostname;
        const path = url.pathname;
        const search = url.search;

        // 只对静态资源竞速，避免 API 等动态请求被并发干扰
        if (!/\.(js|mjs|css|woff2?|ttf|eot|otf|png|jpe?g|gif|webp|avif)$/i.test(path)) {
          return undefined;
        }

        const list = [request];

        // ★ CDN 镜像分组（由 hexo-swpp-plus 按 swpp_plus.cdn 配置生成）
        const CDN_MIRRORS = {
          "jsdelivrLike": [
          "cdn.jsdelivr.net",
          "fastly.jsdelivr.net",
          "cdn.siax.cn",
          "jsd.siax.cn"],

          "bareNpm": [
          "unpkg.com",
          "npm.elemecdn.com",
          "npm.onmicrosoft.cn",
          "cdn.cbd.int"],

          "cdnjsHosts": [
          "cdnjs.cloudflare.com",
          "cdn.staticfile.org"]

        };
        const { jsdelivrLike, bareNpm, cdnjsHosts } = CDN_MIRRORS;

        // ===== 竞速分组说明 =====
        // 同一文件在各镜像的 URL 格式不同，必须按分组重写路径：
        //   jsdelivrLike: /npm/包@版本/文件   —— 备用地址保留 /npm/ 前缀
        //   bareNpm:      /包@版本/文件        —— 备用地址无前缀（转 jsdelivrLike 时补 /npm/）
        //   cdnjsHosts:   /ajax/libs/库/版本/文件 —— 两域名互换，路径原样

        let npmPath;
        if (jsdelivrLike.includes(host) && path.startsWith('/npm/')) {
          npmPath = path.slice('/npm'.length); // /pkg@ver/file
        } else if (bareNpm.includes(host)) {
          npmPath = path; // /pkg@ver/file
        }
        if (npmPath) {
          for (const h of jsdelivrLike) {
            if (h === host) continue;
            list.push(new Request('https://' + h + '/npm' + npmPath + search));
          }
          for (const h of bareNpm) {
            if (h === host) continue;
            list.push(new Request('https://' + h + npmPath + search));
          }
        }

        // cdnjs 系资源互相兜底（/ajax/libs/ 格式）：两域名互换，路径原样
        if (path.startsWith('/ajax/libs/') && cdnjsHosts.includes(host)) {
          for (const h of cdnjsHosts) {
            if (h === host) continue;
            list.push(new Request('https://' + h + path + search));
          }
        }

        if (list.length > 1) {
          // 竞速触发计数（存在 SW 全局，便于确认竞速在生效）
          ;self.__swppRaceCount = (self.__swppRaceCount || 0) + 1;
          console.log(
            '[SWPP] 前端竞速已开启（第 ' +
            self.__swppRaceCount +
            ' 次），多 CDN 并发抢答中:\n' +
            '[SWPP]   原地址: ' +
            request.url +
            '\n[SWPP]   备用地址:\n[SWPP]     - ' +
            list.
            slice(1).
            map((r) => r.url).
            join('\n[SWPP]     - ')
          );
          return list;
        }
        return undefined;
      };
const getStandbyRequests = null;
const fetchFastest = async (list, optional) => {
                const fallbackFetch = (request, controller) => {
                    return fetchWrapper(request, true, true, {
                        ...optional,
                        signal: controller?.signal
                    });
                };
                const controllers = Array.from({ length: list.length }, () => new AbortController());
                try {
                    const { i: index, r: response } = await Promise.any(list.map((it, index) => fallbackFetch(it, controllers[index])
                        .then(response => isFetchSuccessful(response) ? { i: index, r: response } : Promise.reject(response))));
                    for (let k = 0; k < list.length; k++) {
                        if (k != index)
                            controllers[k].abort();
                    }
                    return response;
                }
                catch (err) {
                    const value = err.errors[0];
                    return value.body ? value : transferError2Response(err);
                }
            };
const fetchStandby = async (request, standbyRequests, optional) => {
                const fallbackFetch = (request, controller) => {
                    return fetchWrapper(request, true, true, {
                        ...optional,
                        signal: controller?.signal
                    });
                };
                // 需要用到的一些字段，未初始化的后面会进行初始化
                let id, standbyResolve, standbyReject;
                // 尝试封装 response
                const resolveResponse = (index, response) => isFetchSuccessful(response) ? { i: index, r: response } : Promise.reject(response);
                const { t: time, r: src, l: listGetter } = standbyRequests;
                const controllers = new Array(listGetter.length + 1);
                // 尝试同时拉取 standbyRequests 中的所有 Request
                const task = () => Promise.any(listGetter().map((it, index) => fallbackFetch(it, controllers[index + 1] = new AbortController())
                    .then(response => resolveResponse(index + 1, response)))).then(obj => standbyResolve(obj))
                    .catch(() => standbyReject());
                // 尝试拉取初始 request
                const firstFetch = fallbackFetch(src || request, controllers[0] = new AbortController())
                    .then(response => resolveResponse(0, response))
                    .catch(err => {
                    // 如果失败则跳过等待
                    clearTimeout(id);
                    // noinspection JSIgnoredPromiseFromCall
                    task();
                    return Promise.reject(err); // 保留当前错误
                });
                // 延时拉取其它 request
                const standby = new Promise((resolve1, reject1) => {
                    standbyResolve = resolve1;
                    standbyReject = reject1;
                    id = setTimeout(task, time);
                });
                try {
                    const { i: index, r: response } = await Promise.any([firstFetch, standby]);
                    // 中断未完成的请求
                    for (let k = 0; controllers[k]; k++) {
                        if (k != index)
                            controllers[k].abort();
                    }
                    return response;
                }
                catch (err) {
                    const value = err.errors[0];
                    return value.body ? value : transferError2Response(err);
                }
            };
const fetchFile = (requestOrUrl, optional) => {
    // @ts-ignore
    const request = requestOrUrl.url ? requestOrUrl : new Request(requestOrUrl);
    const fastestList = getFastestRequests(request);
    if (fastestList)
        return fetchFastest(fastestList, optional);
    return fetchWrapper(request, true, isCors(request), optional).catch(transferError2Response);
};
const isBlockRequest = () => false;
const modifyRequest = () => null;
const handleEscape = async () => {
                const oldVersion = await readVersion();
                if (ESCAPE && oldVersion && oldVersion.escape !== ESCAPE) {
                    await caches.delete(CACHE_NAME);
                    await postMessage('escape', null);
                }
            };
const handleUpdate = async (oldVersion, force) => {
                if (!force && oldVersion && Date.now() - oldVersion.tp < UPDATE_CD)
                    return;
                const json = await (await fetch(UPDATE_JSON_URL, {
                    // @ts-ignore
                    priority: 'high'
                })).json();
                const { global, info } = json;
                const newVersion = { global, local: info[0].version, escape: ESCAPE };
                // 新访客或触发了逃生门
                if (!oldVersion || (ESCAPE && ESCAPE !== oldVersion.escape)) {
                    await writeVersion(newVersion);
                    return oldVersion ? 1 : -1;
                }
                // 已是最新版本时跳过剩余步骤
                if (oldVersion.global === global && oldVersion.local === newVersion.local) {
                    await writeVersion(oldVersion);
                    return;
                }
                // 按版本顺序更新缓存，直到找到当前版本
                const expressionList = [];
                for (let infoElement of info) {
                    if (infoElement.version === oldVersion.local) {
                        const urlList = [];
                        const cache = await caches.open(CACHE_NAME);
                        const keys = await cache.keys();
                        for (let request of keys) {
                            const url = request.url;
                            if (url !== VERSION_PATH && expressionList.find(it => it(url))) {
                                await markCacheInvalid(request);
                                urlList.push(url);
                            }
                        }
                        await writeVersion(newVersion);
                        return urlList;
                    }
                    const changeList = infoElement.change;
                    if (changeList) {
                        for (let change of changeList) {
                            expressionList.push(matchUpdateRule(change));
                        }
                    }
                }
                // 运行到这里说明版本号丢失
                await caches.delete(CACHE_NAME);
                await writeVersion(newVersion);
                return 2;
            };
const handleFetchEvent = (event) => {
                // @ts-ignore
                let request = event.request;
                if (request.method !== 'GET' || !request.url.startsWith('http'))
                    return;
                if (isBlockRequest(request)) {
                    // @ts-ignore
                    return event.respondWith(new Response(null, { status: 204 }));
                }
                const newRequest = modifyRequest(request);
                if (newRequest)
                    request = newRequest;
                let cleanUrl = request.url;
                for (let i = 0; i < cleanUrl.length; i++) {
                    const item = cleanUrl[i];
                    if (item === '?' || item === '#') {
                        cleanUrl = cleanUrl.substring(0, i);
                    }
                }
                const cacheKey = new URL(normalizeUrl(cleanUrl));
                const cacheRule = matchCacheRule(cacheKey);
                if (cacheRule) {
                    // @ts-ignore
                    event.respondWith(matchFromCaches(cacheKey).then(cacheResponse => {
                        if (cacheResponse && isValidCache(cacheResponse, cacheRule))
                            return cacheResponse;
                        const responsePromise = fetchFile(request)
                            .then(response => {
                            if (isFetchSuccessful(response)) {
                                // noinspection JSIgnoredPromiseFromCall
                                writeResponseToCache(cacheKey, response.clone());
                                return response;
                            }
                            return cacheResponse ?? response;
                        });
                        return cacheResponse ? responsePromise.catch(() => cacheResponse) : responsePromise;
                    }));
                }
                else if (newRequest) {
                    // @ts-ignore
                    event.respondWith(fetchWrapper(request, false, isCors(request)));
                }
            };
self.addEventListener('install', (event) => {
        ;self.skipWaiting();
        if (ESCAPE) handleEscape();
        // 预缓存首页：断网时仍可访问，失败不阻塞安装
        event.waitUntil(
          caches.
          open(CACHE_NAME).
          then((cache) => cache.add(new Request('/', { cache: 'no-cache' })).catch(() => {})).
          catch(() => {})
        );
      });
self.addEventListener('activate', (event) => {
        // 保留框架默认行为：激活后立即对所有页面生效
        event.waitUntil(self.clients.claim());
        console.log(
          '[SWPP] Service Worker 已激活\n' +
          '[SWPP] 前端竞速已开启: CDN 静态资源将多地址并发抢答，CDN 挂掉自动切换\n' +
          '[SWPP] 离线兜底已开启: 断网时可访问首页与已浏览过的文章'
        );
      });
self.addEventListener('fetch', (event) => handleFetchEvent(event));
self.addEventListener('periodicSync', (event) => {
                // @ts-ignore
                if (event.tag === 'update') {
                    // @ts-ignore
                    event.waitUntil(handleUpdate(null, true));
                }
            });
self.addEventListener('message', async (event) => {
                // @ts-ignore
                const data = event.data;
                switch (data.type) {
                    case 'update':
                        const oldVersion = await readVersion();
                        const updateResult = await handleUpdate(oldVersion);
                        if (!updateResult)
                            return;
                        switch (updateResult) {
                            case -1:
                                return postMessage('new', null);
                            case 1:
                                return postMessage('revise', null);
                            case 2:
                                return postMessage('update', null);
                            default:
                                if (Array.isArray(updateResult)) {
                                    return postMessage('update', updateResult);
                                }
                        }
                }
            })})()