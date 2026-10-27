const $=s=>document.querySelector(s),main=$('main'),C=new Map();
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const st={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
const J=(u,o)=>fetch(u,o).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()});
let S={tmdb:st.get('tmdb',''),jf:st.get('jf',{url:'',key:''}),lib:st.get('lib',{watch:[],items:{},watched:{},pos:{}})},DL=new Map(),SRC=[],view='home',cur=null;
st.get('dls',[]).forEach(d=>DL.set(d.id,{...d,done:1,total:1,state:'done'}));
const save=()=>st.set('lib',S.lib);
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
// metadata
const tm=p=>J(`https://api.themoviedb.org/3${p}${p.includes('?')?'&':'?'}api_key=${S.tmdb}`);
const nT=(r,t)=>{const type=r.media_type||t||(r.title?'movie':'tv');return{id:`tmdb:${type}:${r.id}`,title:r.title||r.name,year:(r.release_date||r.first_air_date||'').slice(0,4),
  poster:r.poster_path&&'https://image.tmdb.org/t/p/w342'+r.poster_path,overview:r.overview,rating:r.vote_average?.toFixed(1)}};
const al=(sort,s)=>J('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({query:`{Page(perPage:20){media(type:ANIME,${s?`search:${JSON.stringify(s)},`:''}sort:${sort}){id title{romaji english}seasonYear coverImage{large}description averageScore}}}`})}).then(r=>r.data.Page.media.map(m=>({
  id:'anilist:anime:'+m.id,title:m.title.english||m.title.romaji,year:m.seasonYear,poster:m.coverImage.large,overview:(m.description||'').replace(/<[^>]+>/g,''),rating:m.averageScore&&(m.averageScore/10).toFixed(1)})));
// sources
const P={
  jellyfin:async t=>{if(!S.jf.url)return[];const r=await J(`${S.jf.url}/Items?Recursive=true&IncludeItemTypes=Movie,Episode&searchTerm=${encodeURIComponent(t.title)}&api_key=${S.jf.key}`);
    return r.Items.map(i=>({label:'Jellyfin: '+i.Name,url:`${S.jf.url}/Videos/${i.Id}/stream?static=true&api_key=${S.jf.key}`}))},
  archive:async t=>{const r=await J(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(`title:(${t.title}) AND mediatype:movies`)}&fl[]=identifier&fl[]=title&rows=5&output=json`);
    const out=[];for(const d of r.response.docs){const m=await J('https://archive.org/metadata/'+d.identifier),f=m.files?.find(x=>/\.mp4$/i.test(x.name));
      if(f)out.push({label:'Internet Archive: '+d.title,url:`https://archive.org/download/${d.identifier}/${encodeURIComponent(f.name)}`})}return out}};
// views
const card=i=>{C.set(i.id,i);return`<div class="card" data-id="${esc(i.id)}"><img src="${esc(i.poster||'')}" alt=""><b>${esc(i.title)}</b><small>${i.year||''} ${i.rating?'★'+i.rating:''}</small></div>`};
const row=(t,a)=>a.length?`<h2>${t}</h2><div class="row">${a.map(card).join('')}</div>`:'';
const V={
  async home(){const[a,b,c]=await Promise.all([tm('/trending/all/week'),tm('/movie/popular'),tm('/tv/popular')]);
    main.innerHTML=row('Trending this week',a.results.filter(r=>r.media_type!=='person').map(r=>nT(r)))+row('Popular movies',b.results.map(r=>nT(r,'movie')))+row('Popular series',c.results.map(r=>nT(r,'tv')))},
  async anime(){const[a,b]=await Promise.all([al('TRENDING_DESC'),al('POPULARITY_DESC')]);main.innerHTML=row('Trending anime',a)+row('All-time popular',b)},
  library(){const L=S.lib,list=L.watch.map(id=>L.items[id]).filter(Boolean),seen=Object.keys(L.watched).map(id=>L.items[id]).filter(Boolean);
    main.innerHTML=(row('Watchlist',list)+row('Watched',seen))||'<p class="dim">Nothing saved yet. Open a title and choose Add to watchlist.</p>'},
  downloads(){main.innerHTML='<h2>Downloads</h2><p class="dim">Keep this tab open while a download runs.</p>'+([...DL.values()].map(d=>`<div class="item"><span>${esc(d.name)} <small class="dim">${d.state}</small></span>
    <progress value="${d.done}" max="${d.total||d.done||1}"></progress>${d.state==='downloading'?`<button data-cancel="${d.id}">Cancel</button>`:''}
    ${d.state==='done'?`<button class="pri" data-open="${d.id}">Play offline</button><button data-del="${d.id}">Delete</button>`:''}</div>`).join('')||'<p class="dim">No downloads yet. Pick a source on any title and choose Download.</p>')},
  settings(msg){main.innerHTML=`<h2>Settings</h2><p class="dim">${msg||'Everything is stored in this browser. No analytics, ads, or trackers.'}</p>
    <p>TMDB API key<br><input id="k" value="${esc(S.tmdb)}"></p>
    <p>Jellyfin server URL (https)<br><input id="ju" placeholder="https://jellyfin.example.com" value="${esc(S.jf.url)}"></p>
    <p>Jellyfin API key<br><input id="jk" value="${esc(S.jf.key)}"></p><p><button class="pri" data-act="saveCfg">Save</button></p>`},
  async search(q){const[t,a]=await Promise.all([tm('/search/multi?query='+encodeURIComponent(q)),al('SEARCH_MATCH',q)]);
    main.innerHTML=row('Movies and series',t.results.filter(r=>r.media_type!=='person').map(r=>nT(r)))+row('Anime',a)}};
async function go(v,arg){view=v;main.innerHTML='<p class="dim">Loading…</p>';try{await V[v](arg)}catch(e){main.innerHTML=`<p>Could not load: ${esc(e.message)}. Check your TMDB key in Settings.</p>`}}
async function detail(id){const i=cur=C.get(id)||S.lib.items[id];SRC=[];
  main.innerHTML=`<div class="detail"><img src="${esc(i.poster||'')}" alt=""><h1>${esc(i.title)}</h1><p class="dim">${i.year||''} ${i.rating?'★'+i.rating:''}</p><p>${esc(i.overview)}</p>
  <button data-wl="${esc(id)}">${S.lib.watch.includes(id)?'Remove from watchlist':'Add to watchlist'}</button>
  <button data-seen="${esc(id)}">${S.lib.watched[id]?'Mark unwatched':'Mark watched'}</button></div>
  <h2>Sources</h2><div id="src" class="dim">Searching your sources…</div>
  <p><label class="dim">Play a video from this device<br><input type="file" id="lf" accept="video/*"></label></p>
  <p><input id="url" placeholder="Paste a direct video or HLS (.m3u8) URL"> <button data-play="-1">Play</button><button data-dl="-1">Download</button></p>`;
  $('#lf').onchange=e=>{const f=e.target.files[0];f&&play(URL.createObjectURL(f))};
  const res=await Promise.allSettled(Object.values(P).map(f=>f(i)));SRC=res.flatMap(r=>r.status==='fulfilled'?r.value:[]);
  const el=$('#src');if(el)el.innerHTML=SRC.map((s,n)=>`<div class="item"><span>${esc(s.label)}</span><button class="pri" data-play="${n}">Play</button><button data-dl="${n}">Download</button></div>`).join('')||'No matches in Jellyfin or the Internet Archive.'}
// player
const vid=$('video');let hls,tick;
const loadHls=()=>window.Hls?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';s.onload=ok;s.onerror=no;document.head.append(s)});
async function play(url){$('#player').hidden=false;hls?.destroy();vid.querySelectorAll('track').forEach(t=>t.remove());
  if(/\.m3u8/i.test(url)&&!vid.canPlayType('application/vnd.apple.mpegurl')){await loadHls();hls=new Hls();hls.loadSource(url);hls.attachMedia(vid)}else vid.src=url;
  const id=cur?.id,t=S.lib.pos[id];if(t)vid.addEventListener('loadedmetadata',()=>vid.currentTime=t,{once:true});vid.play().catch(()=>{});
  clearInterval(tick);tick=setInterval(()=>{if(id&&!vid.paused){S.lib.pos[id]=vid.currentTime;S.lib.items[id]=cur;save()}},5000)}
vid.onended=()=>{if(cur){S.lib.watched[cur.id]=1;S.lib.items[cur.id]=cur;delete S.lib.pos[cur.id];save()}};
$('#close').onclick=()=>{vid.pause();vid.removeAttribute('src');clearInterval(tick);$('#player').hidden=true};
$('#sub').onchange=async e=>{const f=e.target.files[0];if(!f)return;let t=await f.text();
  if(f.name.endsWith('.srt'))t='WEBVTT\n\n'+t.replace(/\r/g,'').replace(/(\d+:\d+:\d+),(\d+)/g,'$1.$2');
  const tr=document.createElement('track');tr.kind='subtitles';tr.label=f.name;tr.default=true;tr.src=URL.createObjectURL(new Blob([t],{type:'text/vtt'}));vid.append(tr)};
// downloads (stored in the browser's Cache Storage; held in memory while downloading)
async function startDl(url,name){const d={id:String(Date.now()),name,done:0,total:0,state:'downloading'};DL.set(d.id,d);go('downloads');
  try{d.ctl=new AbortController();const r=await fetch(url,{signal:d.ctl.signal});if(!r.ok)throw 0;d.total=+r.headers.get('content-length')||0;
    const rd=r.body.getReader(),parts=[];for(;;){const{done,value}=await rd.read();if(done)break;parts.push(value);d.done+=value.length;if(view==='downloads')V.downloads()}
    await(await caches.open('dl')).put('/offline/'+d.id,new Response(new Blob(parts),{headers:{'Content-Type':r.headers.get('content-type')||'video/mp4'}}));
    d.state='done';st.set('dls',[...DL.values()].filter(x=>x.state==='done').map(x=>({id:x.id,name:x.name})))}
  catch{if(d.state!=='cancelled')d.state='error'}
  if(view==='downloads')V.downloads()}
// events
const srcUrl=n=>+n<0?$('#url').value.trim():SRC[n].url;
document.addEventListener('click',async e=>{const b=e.target.closest('[data-nav],[data-id],[data-play],[data-dl],[data-wl],[data-seen],[data-cancel],[data-open],[data-del],[data-act]');if(!b)return;const d=b.dataset;
  if(d.nav)return go(d.nav);if(d.id)return detail(d.id);
  if(d.play!==undefined){const u=srcUrl(d.play);if(u)play(u)}
  if(d.dl!==undefined){const u=srcUrl(d.dl);if(u){const ext=(u.split('?')[0].match(/\.\w{2,4}$/)||['.mp4'])[0];startDl(u,cur.title+ext)}}
  if(d.wl){const w=S.lib.watch,i=w.indexOf(d.wl);i<0?w.push(d.wl):w.splice(i,1);S.lib.items[d.wl]=cur;save();detail(d.wl)}
  if(d.seen){S.lib.watched[d.seen]?delete S.lib.watched[d.seen]:S.lib.watched[d.seen]=1;S.lib.items[d.seen]=cur;save();detail(d.seen)}
  if(d.cancel){const x=DL.get(d.cancel);x.state='cancelled';x.ctl.abort();DL.delete(d.cancel);V.downloads()}
  if(d.open){const r=await(await caches.open('dl')).match('/offline/'+d.open);if(r)play(URL.createObjectURL(await r.blob()))}
  if(d.del){await(await caches.open('dl')).delete('/offline/'+d.del);DL.delete(d.del);st.set('dls',[...DL.values()].filter(x=>x.state==='done').map(x=>({id:x.id,name:x.name})));V.downloads()}
  if(d.act==='saveCfg'){S.tmdb=$('#k').value.trim();S.jf={url:$('#ju').value.trim().replace(/\/$/,''),key:$('#jk').value.trim()};
    try{await tm('/configuration');st.set('tmdb',S.tmdb);st.set('jf',S.jf);go('home')}catch{V.settings('That TMDB key was rejected. Check it and try again.')}}});
$('#q').onkeydown=e=>{if(e.key==='Enter'&&e.target.value.trim())go('search',e.target.value.trim())};
S.tmdb?go('home'):V.settings('Welcome. Paste your free TMDB API key (themoviedb.org → Settings → API) to get started.');
