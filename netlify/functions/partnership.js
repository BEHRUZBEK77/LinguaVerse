'use strict';
// LinguaVerse automated partner onboarding. Requires official provider OAuth credentials.
// No silent approval if API evidence is missing; no staff review queue.
const crypto = require('node:crypto');
const fsdb = require('./_firestore.js');
const { verifyIdToken } = require('./_auth.js');
const { creatorActive } = require('./_video-entitlements.js');
const keys = require('./_keys.js');
const SITE = () => (process.env.URL || 'https://linguaverse.akromovbehruz7.workers.dev').replace(/\/$/, '');
const API = 'https://www.googleapis.com/youtube/v3';
const CORS = {'Access-Control-Allow-Origin':SITE(), 'Access-Control-Allow-Headers':'Content-Type,Authorization', 'Access-Control-Allow-Methods':'POST,GET,OPTIONS', 'Cache-Control':'no-store'};
const response = (statusCode, data, headers={}) => ({statusCode,headers:{...CORS,'Content-Type':'application/json; charset=utf-8',...headers},body:JSON.stringify(data)});
const redirect = url => ({statusCode:302,headers:{...CORS,Location:url,'Cache-Control':'no-store'},body:''});
const clean = (v,max=150)=>String(v??'').trim().slice(0,max);
const random = () => crypto.randomBytes(22).toString('base64url');
const dt = v => v instanceof Date ? v.getTime() : v?.$t ? Date.parse(v.$t) : Date.parse(v||'')||0;
const sameDay = (d,age=0)=>Date.now() - age*86400_000;
const safeUrl = v => {try {const u=new URL(v);return ['https:'].includes(u.protocol) ? u : null;}catch{return null;}};
const contractVersion='2026-11-09-v1';
const cutVideos = input => [...new Set((Array.isArray(input)?input:[]).map(x=>clean(x,300)))].slice(0,20);
function ytId(x) {const u=safeUrl(x);if(!u) return null;const h=u.hostname.toLowerCase();const id=h.endsWith('youtu.be')?u.pathname.slice(1):/(^|\.)youtube\.com$/.test(h)?u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1]:null;return /^[\w-]{11}$/.test(id||'')?id:null;}
async function jsonFetch(url, opts={}) {const r=await fetch(url,{...opts,signal:AbortSignal.timeout(12000)});const t=await r.text();let d={};try{d=JSON.parse(t);}catch{}if(!r.ok){const e=new Error(`Provider HTTP ${r.status}: ${clean(d.error?.message||t,180)}`);e.transient=r.status===429||r.status>=500;throw e;}return d;}
async function ytKey(){await keys.refreshFromFirestore().catch(()=>{});return process.env.YOUTUBE_API_KEY||keys.get('YOUTUBE_API_KEY')||'';}
async function ytApi(route,params,accessToken){const u=new URL(API+'/'+route);for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));const key=await ytKey();if(!accessToken&&!key)throw new Error('YouTube API kaliti sozlanmagan');if(!accessToken)u.searchParams.set('key',key);return jsonFetch(u,{headers:accessToken?{Authorization:`Bearer ${accessToken}`}:{}});}
async function youtubeAccount(accessToken){const d=await ytApi('channels',{part:'id,snippet,statistics,contentDetails',mine:'true'},accessToken);return d.items?.[0]||null;}
async function youtubeAudit(channelId,{after=0,max=12}={}){
  const ch=(await ytApi('channels',{part:'id,snippet,statistics,contentDetails',id:channelId})).items?.[0];
  if(!ch||ch.statistics?.hiddenSubscriberCount)return {ok:false,reason:'Kanal yoki obunachilar soni yopiq'};
  const subscribers=Number(ch.statistics?.subscriberCount||0);
  if(subscribers<1000)return {ok:false,reason:'YouTube uchun kamida 1000 obunachi kerak',subscribers};
  const listId=ch.contentDetails?.relatedPlaylists?.uploads; if(!listId)return {ok:false,reason:'Kanal videolari ro‘yxati olinmadi',subscribers};
  let ids=[],next=null;for(let page=0;page<Math.min(max,5);page++){
    const d=await ytApi('playlistItems',{part:'contentDetails',playlistId:listId,maxResults:50,...(next?{pageToken:next}:{})});
    ids.push(...(d.items||[]).map(v=>v.contentDetails?.videoId).filter(Boolean));next=d.nextPageToken;if(!next||ids.length>=250)break;
  }
  const matched=[];
  for(let i=0;i<ids.length;i+=50){const d=await ytApi('videos',{part:'snippet,status,contentDetails',id:ids.slice(i,i+50).join(',')});
    for(const v of d.items||[]){const s=v.snippet||{};if(s.channelId!==channelId||v.status?.privacyStatus!=='public')continue;
      if(!/lingua\s?verse|linguaverce|linguaverse/i.test(`${s.title||''}\n${s.description||''}`))continue;
      const time=Date.parse(s.publishedAt||'')||0;if(after&&time<after)continue;
      matched.push({id:v.id,at:time});
    }
  }
  return {ok:true,subscribers,found:matched.length,videos:matched.sort((a,b)=>b.at-a.at).slice(0,100)};
}
async function youtubeProvidedAudit(channelId, submitted) {
  const ids=[...new Set((submitted||[]).map(ytId).filter(Boolean))].slice(0,50);
  if(ids.length<5)return {found:0,videos:[]};
  const d=await ytApi('videos',{part:'snippet,status',id:ids.join(',')});
  const matched=(d.items||[]).filter(v=>v.snippet?.channelId===channelId && v.status?.privacyStatus==='public')
    .filter(v=>/lingua\s?verse|linguaverce|linguaverse/i.test(`${v.snippet?.title||''}\n${v.snippet?.description||''}`));
  return {found:matched.length,videos:matched.map(v=>({id:v.id,at:Date.parse(v.snippet?.publishedAt||'')||0}))};
}
function validColor(v){return /^#[a-f\d]{6}$/i.test(v||'')?v:'#19bda9';}
function slug(v){return clean(v,60).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,36);}
function validDomain(d){const x=clean(d,100).toLowerCase();return /^(?=.{4,100}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])\.[a-z]{2,}$/.test(x)&&!x.includes('..')?x:null;}
function partnerUrl(uid){return `partners/${uid}`;}
async function requireUser(body){const t=body?.idToken;const u=await verifyIdToken(t);if(u.anonymous)throw Object.assign(new Error('Akkauntga kiring'),{status:403});return u;}
async function saveApplication(uid,body){
  const kind=clean(body.kind,20);if(!['youtube','instagram','brand','school','educator','community','affiliate'].includes(kind))throw Object.assign(new Error('Hamkor turi noto‘g‘ri'),{status:400});
  const current=await fsdb.getDoc(partnerUrl(uid)); if(current?.createdAt&&dt(current.createdAt)>sameDay(0.03))throw Object.assign(new Error('Arizangiz qabul qilingan. Birozdan so‘ng qayta urinib ko‘ring.'),{status:429});
  const brand=clean(body.company,90), domain=kind==='brand'?validDomain(body.domain):null;
  if(!brand||!body.consent)throw Object.assign(new Error('Nom va shartlarga rozilik kerak'),{status:400});
  if(kind==='brand'&&!domain)throw Object.assign(new Error('Brendning rasmiy domenini kiriting'),{status:400});
  const challenge=random(); const record={uid,kind,name:brand,tagline:clean(body.tagline,140),color:validColor(body.color),contact:clean(body.contact,160),status:'pending-verification',domain,challenge:domain?challenge:null,videoLinks:cutVideos(body.videoLinks),platform:kind==='youtube'?'youtube':kind==='instagram'?'instagram':null,contractVersion,consentedAt:new Date(),createdAt:new Date(),updatedAt:new Date(),earningsPercentPlatform:40,earningsPercentPartner:60,payoutStatus:'not-configured'};
  await fsdb.setDoc(partnerUrl(uid),record);return {ok:true,status:record.status,kind,challenge:domain?`_linguaverse-verify.${domain} TXT linguaverse=${challenge}`:null,providerConnected:false};
}
async function domainCheck(uid){
  const p=await fsdb.getDoc(partnerUrl(uid));if(!p?.domain||!p.challenge)throw Object.assign(new Error('Brend domeni topilmadi'),{status:400});
  const u=new URL('https://cloudflare-dns.com/dns-query');u.searchParams.set('name',`_linguaverse-verify.${p.domain}`);u.searchParams.set('type','TXT');
  const r=await jsonFetch(u,{headers:{Accept:'application/dns-json'}});
  const ok=(r.Answer||[]).some(a=>a.type===16&&String(a.data||'').replace(/^"|"$/g,'').includes(`linguaverse=${p.challenge}`));
  if(!ok)return {ok:false,status:'pending-verification',message:'DNS TXT tasdiqlanmadi; DNS tarqalishi biroz vaqt olishi mumkin.'};
  const ownSlug=slug(p.name)+'-'+uid.slice(0,6).toLowerCase();
  await fsdb.setDoc(partnerUrl(uid),{status:'active-brand-site',slug:ownSlug,domainVerifiedAt:new Date(),updatedAt:new Date()});
  // Legal identity / paid revenue-sharing cannot be inferred from DNS ownership.
  return {ok:true,status:'active-brand-site',brandUrl:`${SITE()}/languages-html/partners.html?brand=${ownSlug}`,payoutStatus:'not-configured'};
}
function oauthConfig(provider){if(provider==='youtube')return {client:process.env.YOUTUBE_OAUTH_CLIENT_ID,secret:process.env.YOUTUBE_OAUTH_CLIENT_SECRET,redirect:process.env.YOUTUBE_OAUTH_REDIRECT_URI,auth:'https://accounts.google.com/o/oauth2/v2/auth',scope:'https://www.googleapis.com/auth/youtube.readonly'};
return {client:process.env.INSTAGRAM_APP_ID,secret:process.env.INSTAGRAM_APP_SECRET,redirect:process.env.INSTAGRAM_REDIRECT_URI,auth:'https://www.instagram.com/oauth/authorize',scope:'instagram_business_basic'};}
async function startSocial(uid,provider){
 const p=await fsdb.getDoc(partnerUrl(uid));if(!p||p.kind!==provider)throw Object.assign(new Error('Avval shu platformaga hamkorlik arizasi yuboring'),{status:409});
 const cfg=oauthConfig(provider);if(!cfg.client||!cfg.secret||!cfg.redirect)throw Object.assign(new Error(`${provider} OAuth sozlamalari hali ulanmagan`),{status:503});
 const state=random();await fsdb.addDoc('partnerOAuth',{uid,provider,expiresAt:new Date(Date.now()+600000),used:false},state);
 const u=new URL(cfg.auth);Object.entries({client_id:cfg.client,redirect_uri:cfg.redirect,response_type:'code',scope:cfg.scope,state,...(provider==='youtube'?{access_type:'online',prompt:'consent'}:{})}).forEach(([k,v])=>u.searchParams.set(k,v));
 return {ok:true,authorizationUrl:u.toString()};
}
async function instagramAccount(code,cfg){
 const fd=new URLSearchParams({client_id:cfg.client,client_secret:cfg.secret,grant_type:'authorization_code',redirect_uri:cfg.redirect,code});
 const d=await jsonFetch('https://api.instagram.com/oauth/access_token',{method:'POST',body:fd});const token=d.access_token||d.data?.[0]?.access_token;
 if(!token)throw new Error('Instagram token olinmadi');
 const long=await jsonFetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(cfg.secret)}&access_token=${encodeURIComponent(token)}`).catch(()=>({access_token:token}));
 const accessToken=long.access_token||token;const a=await jsonFetch(`https://graph.instagram.com/me?fields=id,user_id,username,followers_count,media_count&access_token=${encodeURIComponent(accessToken)}`);
 if(!a.id||!Number.isFinite(Number(a.followers_count)))throw new Error('Instagram Professional hisob statistikasi mavjud emas');
 return {accessToken,account:a};
}
function encSecret(token){const key=process.env.PARTNER_ENCRYPTION_KEY||'';if(!/^[0-9a-f]{64}$/i.test(key))throw new Error('PARTNER_ENCRYPTION_KEY sozlanmagan (32-byte hex)');const iv=crypto.randomBytes(12);const c=crypto.createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);const e=Buffer.concat([c.update(token,'utf8'),c.final()]);return [iv.toString('base64url'),c.getAuthTag().toString('base64url'),e.toString('base64url')].join('.');}
function decSecret(data){const [a,b,c]=String(data||'').split('.');const key=process.env.PARTNER_ENCRYPTION_KEY||'';if(!a||!b||!c||!/^[0-9a-f]{64}$/i.test(key))throw new Error('Instagram tokenni ochib bo‘lmadi');const d=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),Buffer.from(a,'base64url'));d.setAuthTag(Buffer.from(b,'base64url'));return Buffer.concat([d.update(Buffer.from(c,'base64url')),d.final()]).toString('utf8');}
async function instagramAudit(token,{after=0}={}){
 const origin='https://graph.instagram.com';const data=await jsonFetch(`${origin}/me?fields=id,user_id,username,followers_count&access_token=${encodeURIComponent(token)}`);const followers=Number(data.followers_count||0);
 if(followers<10000)return {ok:false,followers,reason:'Instagram uchun kamida 10000 obunachi kerak'};
 const media=await jsonFetch(`${origin}/me/media?fields=id,caption,media_type,media_product_type,timestamp,permalink&limit=100&access_token=${encodeURIComponent(token)}`);const matches=(media.data||[]).filter(x=>['VIDEO','REELS'].includes(x.media_type)||x.media_product_type==='REELS').filter(x=>/lingua\s?verse|linguaverce|linguaverse/i.test(x.caption||'')).filter(x=>!after||Date.parse(x.timestamp||'')>=after).map(x=>({id:x.id,at:Date.parse(x.timestamp||'')||0}));return {ok:true,followers,found:matches.length,videos:matches};
}
async function activateCreator(uid,p,stats){
 const now=new Date();const due=new Date(Date.now()+30*86400_000);const activeUntil=new Date(due.getTime()+72*3600_000);
 const creator={status:'active',provider:p.kind,channelId:p.channelId||null,instagramId:p.instagramId||null,approvedAt:now,periodStart:now,nextDueAt:due,activeUntil,subscribers:stats.subscribers??stats.followers,initialVideos:stats.found,lastCheckedAt:now};
 await fsdb.setDoc(partnerUrl(uid),{status:'active-creator',creator,...creator,updatedAt:new Date()});await fsdb.setDoc(`users/${uid}`,{creator});return {ok:true,status:'active-creator',plan:'youtuber',activeUntil:activeUntil.toISOString()};
}
async function oauthCallback(query){
 const state=clean(query.state,120),code=clean(query.code,1200);if(!state||!code)return redirect(SITE()+'/languages-html/partners.html?oauth=failed');
 let s=await fsdb.getDoc(`partnerOAuth/${state}`);if(!s||s.used||dt(s.expiresAt)<Date.now())return redirect(SITE()+'/languages-html/partners.html?oauth=expired');
 try { await fsdb.transact(`partnerOAuth/${state}`,cur=>{if(!cur||cur.used||dt(cur.expiresAt)<Date.now())throw new Error('OAuth state already used');return {used:true,usedAt:new Date()};}); } catch {return redirect(SITE()+'/languages-html/partners.html?oauth=expired');}const p=await fsdb.getDoc(partnerUrl(s.uid));const cfg=oauthConfig(s.provider);
 if(!p||p.kind!==s.provider)return redirect(SITE()+'/languages-html/partners.html?oauth=failed');
 try{
   if(s.provider==='youtube'){
     const token=await jsonFetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:cfg.client,client_secret:cfg.secret,redirect_uri:cfg.redirect,grant_type:'authorization_code'})});
     const a=await youtubeAccount(token.access_token);if(!a?.id)throw new Error('YouTube kanal topilmadi');
     const stats=await youtubeAudit(a.id);const supplied=await youtubeProvidedAudit(a.id,p.videoLinks);stats.found=Math.max(stats.found||0,supplied.found);await fsdb.setDoc(partnerUrl(s.uid),{channelId:a.id,channelTitle:clean(a.snippet?.title),lastCheckedAt:new Date()});
     if(!stats.ok||stats.found<5){await fsdb.setDoc(partnerUrl(s.uid),{status:'requirements-not-met',reason:stats.reason||`5 ta LinguaVerse videosi o‘rniga ${stats.found} ta topildi`});return redirect(SITE()+'/languages-html/partners.html?oauth=requirements');}
     await activateCreator(s.uid,{...p,channelId:a.id},stats);
   }else{
     const {accessToken,account}=await instagramAccount(code,cfg);const stats=await instagramAudit(accessToken);const encrypted=encSecret(accessToken);
     await fsdb.setDoc(partnerUrl(s.uid),{instagramId:account.id,instagramName:clean(account.username),encryptedInstagramToken:encrypted,lastTokenRefreshedAt:new Date(),lastCheckedAt:new Date()});
     if(!stats.ok||stats.found<5){await fsdb.setDoc(partnerUrl(s.uid),{status:'requirements-not-met',reason:stats.reason||'Kamida 5 ta LinguaVerse videosi talab etiladi'});return redirect(SITE()+'/languages-html/partners.html?oauth=requirements');}
     await activateCreator(s.uid,{...p,instagramId:account.id},stats);
   }
   return redirect(SITE()+'/languages-html/partners.html?oauth=approved');
 }catch(e){console.error('partner.oauth',s.provider,e.message);await fsdb.setDoc(partnerUrl(s.uid),{status:'verification-retry',reason:'Tashqi platforma tekshiruvi bajarilmadi',lastErrorAt:new Date()});return redirect(SITE()+'/languages-html/partners.html?oauth=retry');}
}
async function recheck(){
 const rows=await fsdb.queryList('partners',[],null,1000);let checked=0,paused=0,continued=0,failed=0;
 for(const p of rows){if(p.status!=='active-creator'||!['youtube','instagram'].includes(p.kind))continue;checked++;
  try{
    let data;
    if(p.kind==='youtube') data=await youtubeAudit(p.channelId,{after:dt(p.creator?.periodStart)||0});
    else {
      let token=decSecret(p.encryptedInstagramToken);
      if(Date.now()-dt(p.lastTokenRefreshedAt)>30*86400_000) {
        try {
          const renewed=await jsonFetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
          if(renewed.access_token) {token=renewed.access_token;await fsdb.setDoc(partnerUrl(p.uid),{encryptedInstagramToken:encSecret(token),lastTokenRefreshedAt:new Date()});}
        } catch(e) { console.warn('partner.instagram.refresh',e.message); }
      }
      data=await instagramAudit(token,{after:dt(p.creator?.periodStart)||0});
    }
    const due=dt(p.creator?.nextDueAt),now=Date.now();let status='active',reason='';
    if(!data.ok){status='paused';reason=data.reason||'Platform talablariga javob bermaydi';}
    else if(now>=due&&data.found<3){status='paused';reason='30 kun ichida kamida 3 ta yangi video chiqmagan';}
    let creator={...(p.creator||{}),status,subscribers:data.subscribers??data.followers??0,lastCheckedAt:new Date()};
    if(status==='active'&&now>=due){const next=new Date(now+30*86400_000);creator.periodStart=new Date();creator.nextDueAt=next;creator.activeUntil=new Date(next.getTime()+72*3600_000);}
    if(status!=='active'){creator.activeUntil=new Date();creator.pausedReason=reason;paused++;}else continued++;
    await fsdb.setDoc(partnerUrl(p.uid),{status:status==='active'?'active-creator':'paused-creator',creator,reason,updatedAt:new Date()});await fsdb.setDoc(`users/${p.uid}`,{creator});
  }catch(e){failed++;console.error('partner.cron',p.uid,e.message);/* transient errors: keep existing rights until signed activeUntil expires */}
 }
 return {ok:true,checked,continued,paused,failed};
}
exports.handler=async event=>{
 if(event.httpMethod==='OPTIONS')return {statusCode:204,headers:CORS,body:''};
 const q=event.queryStringParameters||{};
 try{
  if(event.httpMethod==='GET'){
    if(q.action==='oauth')return oauthCallback(q);
    if(q.brand){const rows=await fsdb.queryList('partners',[{field:'slug',op:'EQUAL',value:clean(q.brand,50)}],null,2);const p=rows.find(x=>x.status==='active-brand-site');return p?response(200,{name:p.name,tagline:p.tagline,color:p.color,slug:p.slug,domain:p.domain,platformShare:40,partnerShare:60}):response(404,{error:'Hamkorlik sahifasi mavjud emas'});}
    return response(200,{ok:true,program:'LinguaVerse Partnerships',contractVersion});
  }
  if(event.httpMethod!=='POST')return response(405,{error:'Method not allowed'});
  let body={};try{body=JSON.parse(event.body||'{}');}catch{return response(400,{error:'JSON noto‘g‘ri'});}
  if(body.action==='cron'){
    const auth=event.headers?.authorization||event.headers?.Authorization||'';
    if(!process.env.PARTNERSHIP_CRON_SECRET||auth!==`Bearer ${process.env.PARTNERSHIP_CRON_SECRET}`)return response(403,{error:'Unauthorized'});
    return response(200,await recheck());
  }
  const user=await requireUser(body);
  if(body.action==='apply')return response(200,await saveApplication(user.uid,body));
  if(body.action==='verify-domain')return response(200,await domainCheck(user.uid));
  if(body.action==='start-social')return response(200,await startSocial(user.uid,clean(body.provider,20)));
  if(body.action==='status'){
    const p=await fsdb.getDoc(partnerUrl(user.uid));if(!p)return response(200,{status:'not-applied'});
    return response(200,{status:p.status,kind:p.kind,name:p.name,creatorActive:creatorActive({creator:p.creator}),reason:p.reason||'',nextDueAt:p.creator?.nextDueAt||null,activeUntil:p.creator?.activeUntil||null,brandSlug:p.slug||null,challenge:p.domain?`_linguaverse-verify.${p.domain} TXT linguaverse=${p.challenge}`:null});
  }
  return response(400,{error:'Unknown action'});
 }catch(e){console.error('partner.api',e.message);return response(e.status||500,{error:e.status===400||e.status===403||e.status===409||e.status===429||e.status===503?e.message:'So‘rov bajarilmadi, keyin qayta urinib ko‘ring.'});}
};
exports._test={ytId,validDomain,slug,validColor};
