/*
 * 中国尸变纪元 · 余响 v2.4
 * 右侧独立娱乐侧栏。读取最近角色回复的剧情和 <us_survival_panel>；
 * 围绕当前剧情展示片段、场景感想、虚构旁听频道和私人剪贴簿。
 * 不修改剧情、人物、物品、状态栏或聊天消息，不向 AI 发送新指令。
 * “旁听频道”是对当前场景的娱乐演绎，并非现实剧情中发生的通信。
 */
(() => {
  'use strict';
  const VERSION = '2.4.0';
  const ROOT = 'shibian-story-echo-v2';
  const OWNER = '__shibianStoryEchoV2';
  const STORE = 'shibian-story-echo-v2:scrapbook';
  let host=window;
  try { if(window.parent!==window && window.parent.document?.body) host=window.parent; }catch(_){}
  const doc=host.document;
  try {host[OWNER]?.destroy?.();}catch(_){}
  doc.getElementById(ROOT)?.remove();

  const node=doc.createElement('div'); node.id=ROOT;
  const shadow=node.attachShadow({mode:'open'});
  shadow.innerHTML=`
  <style>
    :host{all:initial;position:fixed;right:0;top:44%;z-index:2147483000;font:13px/1.6 system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#efe0d4}
    *,*:before,*:after{box-sizing:border-box} button,textarea{font:inherit} button{cursor:pointer}
    .pin{width:26px;height:32px;min-height:0;padding:0;border:1px solid #c98b68;border-right:0;border-radius:9px 0 0 9px;color:#f8e0c6;background:linear-gradient(135deg,#803331,#35151f);box-shadow:0 5px 25px #0008;font:15px/1 Georgia,serif;display:grid;place-items:center}
    .pin small{display:none}
    .phone{display:none;position:fixed;right:8px;top:50%;transform:translateY(-50%);width:min(370px,calc(100vw - 16px));max-height:min(705px,calc(100dvh - 18px));border:1px solid #95604f;border-radius:20px;background:#141014;box-shadow:0 15px 70px #000c,0 0 0 3px #100a0e;overflow:hidden;flex-direction:column}
    .phone[data-open='1']{display:flex}
    .mast{padding:10px 15px 10px;background:radial-gradient(circle at 90% 3%,#9c414433,transparent 49%),linear-gradient(125deg,#502027,#24131b);border-bottom:1px solid #75473f}
    .close{flex:none;width:29px;height:29px;padding:0;border:1px solid #9c6559;border-radius:7px;color:#f6d5c3;background:#371a21;font-size:20px;line-height:1}
    .scene-head{display:flex;align-items:center;gap:10px}
    .scene-line{display:flex;gap:7px;align-items:center;min-width:0;flex:1;font-size:13px;font-weight:700;color:#f1d5c2;line-height:1.5}
    .light{width:6px;height:6px;border-radius:50%;background:#d07a50;box-shadow:0 0 9px #e6855380;flex:none}
    .ellipsis{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
    .nav{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:6px;background:#21151a;border-bottom:1px solid #58363a}
    .tab{border:1px solid transparent;border-radius:7px;color:#bda89e;background:#2b1a20;padding:8px 2px;font-weight:bold;font-size:12px}
    .tab[aria-selected='true']{background:#75332f;color:#ffe6cc;border-color:#ac6b57}
    .body{overflow:auto;overscroll-behavior:contain;min-height:0;flex:1;padding:12px 15px 15px;background:radial-gradient(circle at 45% -80px,#53282835,transparent 220px),#141014}
    .page{display:none}.page[data-active='1']{display:block}
    .over{font:10px/1.7 ui-monospace,monospace;color:#cf9479;letter-spacing:1.5px}
    h2{font:bold 18px/1.4 'Songti SC',serif;color:#f3d2ba;letter-spacing:1px;margin:2px 0 5px}
    p{margin:6px 0}.muted{color:#ac9890;font-size:11px;line-height:1.8}
    #sceneMeta{font-size:12px;line-height:1.55;color:#bea397;margin:2px 0 4px}
    .plaque{background:linear-gradient(140deg,#302021,#20171b);border:1px solid #6d4941;border-radius:9px;padding:12px;margin-top:8px}
    .mainquote{font:12px/1.8 'Songti SC','PingFang SC',serif;color:#f4dfc9;white-space:pre-wrap;overflow-wrap:anywhere;max-height:156px;overflow:auto}
    .label{font:10px/1.5 ui-monospace,monospace;color:#cc9a7f;letter-spacing:.8px;margin-bottom:6px}
    .chips{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 7px}
    .chip{font-size:11px;color:#ddc5b5;padding:5px 9px;background:#291c21;border:1px solid #72504a;border-radius:7px}
    .teaser{padding:10px 11px;margin:9px 0;background:#23191e;border-left:3px solid #b36d52;border-radius:3px 8px 8px 3px;font-size:12px;line-height:1.8;color:#ebd1bd}
    .smallbox{padding:9px 10px;margin:9px 0;background:#1d171b;border:1px solid #503939;border-radius:7px}
    .headrow{display:flex;justify-content:space-between;gap:10px;align-items:center;color:#d8a989;font-size:11px;font-weight:700;margin-bottom:7px}
    .entry{display:flex;gap:9px;margin-top:11px;align-items:flex-start}
    .avatar{display:grid;place-items:center;flex:none;width:28px;height:28px;background:#463036;color:#e9c0a3;border:1px solid #71514a;border-radius:8px;font-family:serif;font-weight:bold}
    .bubble{max-width:100%;min-width:0;flex:1;padding:9px 11px;border-radius:2px 10px 10px 10px;background:#2b2024;border:1px solid #50383a}
    .speaker{color:#e0ae92;font-size:10px;margin-bottom:3px;font-weight:750}
    .says{color:#efdbca;font-size:12px;line-height:1.75;white-space:pre-wrap;overflow-wrap:anywhere}
    .stamp{display:inline-block;color:#c49b83;font:10px ui-monospace,monospace;border:1px solid #704b45;border-radius:4px;padding:3px 6px;margin-top:5px}
    .buttonrow{display:flex;gap:8px;margin-top:13px;flex-wrap:wrap}
    .btn{border:1px solid #ad725a;border-radius:8px;color:#fee0c6;background:#723135;font-size:12px;font-weight:bold;padding:8px 11px}
    .btn.ghost{background:#292126;border-color:#66514d;color:#e2ccbb}
    textarea{width:100%;min-height:90px;resize:vertical;padding:10px;line-height:1.8;background:#1d171b;color:#f2decc;border:1px solid #775449;border-radius:9px;margin-top:10px;outline:none}
    textarea::placeholder{color:#887775}
    .saved{border:1px solid #58413e;background:#251b20;margin-top:10px;padding:11px;border-radius:8px;color:#e5d0c0;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
    .saved .headrow{margin-bottom:5px}
    .tinybtn{border:1px solid #73524d;border-radius:5px;padding:4px 7px;background:#36252a;color:#dec1b2;font-size:10px}
    .bottom{flex:none;display:flex;justify-content:space-between;gap:10px;padding:9px 13px;border-top:1px solid #4a3034;color:#ad9185;font-size:10px;background:#1d151a}
    .accent{color:#d9a182}
    @media(max-width:460px){.phone{right:5px;width:calc(100vw - 10px);max-height:calc(100dvh - 12px)}.body{padding:11px 13px 13px}}
    @media(prefers-reduced-motion:no-preference){.phone[data-open='1']{animation:appear .15s ease-out}@keyframes appear{from{opacity:.6;translate:5px 0}to{opacity:1;translate:0 0}}}
  </style>
  <button class="pin" data-act="open" aria-label="打开余响侧栏">◇</button>
  <section class="phone" data-open="0" role="dialog" aria-label="尸变纪元余响辅助侧栏">
    <header class="mast">
      <div class="scene-head"><div class="scene-line"><span class="light"></span><span id="sceneMarker" class="ellipsis">正在等待剧情落下……</span></div><button class="close" data-act="close" aria-label="关闭侧栏">×</button></div>
    </header>
    <nav class="nav"><button class="tab" data-tab="moment" aria-selected="true">此刻</button><button class="tab" data-tab="echo" aria-selected="false">人间余音</button><button class="tab" data-tab="book" aria-selected="false">拾遗簿</button></nav>
    <div class="body">
      <section class="page" data-page="moment" data-active="1">
        <h2 id="momentTitle">尚未读到剧情</h2>
        <p class="muted" id="sceneMeta"></p>
        <div class="plaque"><div class="label">眼前发生的事</div><div class="mainquote" id="story">点开侧栏后读取最新回复。</div></div>
        <div class="chips" id="facts"></div>
        <div class="smallbox"><div class="label">余韵</div><div id="mood" class="says">剧情在这里留下余温。</div></div>
        <div class="buttonrow"><button class="btn" data-act="refresh">更新这一刻</button><button class="btn ghost" data-act="clip">收进拾遗簿</button></div>
      </section>
      <section class="page" data-page="echo" data-active="0">
        <h2 id="echoTitle">在现实声音之间</h2>
                <div id="echoList"></div>
        <div class="buttonrow"><button class="btn" data-act="another">再听一会儿</button></div>
      </section>
      <section class="page" data-page="book" data-active="0">
        <h2>拾遗簿</h2>
        <textarea id="memo" maxlength="450" placeholder="例如：今天终于找到能歇脚的地方。"></textarea>
        <div class="buttonrow"><button class="btn" data-act="save">留一张纸条</button><button class="btn ghost" data-act="export">复制全部记录</button></div>
        <div id="saved"></div>
      </section>
    </div>
    <footer class="bottom"><span id="footerText">纸页轻响</span><span class="accent">◇</span></footer>
  </section>`;
  (doc.body||doc.documentElement).appendChild(node);

  const q=s=>shadow.querySelector(s);
  const qa=s=>Array.from(shadow.querySelectorAll(s));
  const put=(id,v)=>{const el=q('#'+id);if(el)el.textContent=String(v??'');};
  const state={opened:false,tab:'moment',scene:null,turn:0,saved:[],refreshing:false,timer:0,off:[]};
  try{const read=JSON.parse(host.localStorage.getItem(STORE)||'[]'); if(Array.isArray(read))state.saved=read.filter(x=>x&&typeof x.text==='string').slice(0,70);}catch(_){}
  function persist(){try{host.localStorage.setItem(STORE,JSON.stringify(state.saved));return true;}catch(_){return false;}}
  function notice(t){put('footerText',t);}
  function setTab(tab){state.tab=tab;qa('[data-tab]').forEach(e=>e.setAttribute('aria-selected',String(e.dataset.tab===tab)));qa('[data-page]').forEach(e=>e.dataset.active=String(Number(e.dataset.page===tab)));if(tab==='book')renderBook();}
  function open(toggle){state.opened=toggle;q('.phone').dataset.open=String(Number(toggle));q('.pin').style.display=toggle?'none':'';if(toggle)void refresh();}
  function api(name){try{const table={getLastMessageId:typeof getLastMessageId==='function'?getLastMessageId:null,getChatMessages:typeof getChatMessages==='function'?getChatMessages:null,eventOn:typeof eventOn==='function'?eventOn:null,eventRemoveListener:typeof eventRemoveListener==='function'?eventRemoveListener:null};if(table[name])return table[name];}catch(_){};try{if(typeof window[name]==='function')return window[name].bind(window);}catch(_){};try{if(typeof host[name]==='function')return host[name].bind(host);}catch(_){};return null;}
  function rows(v){return Array.isArray(v)?v:v&&typeof v==='object'?[v]:[];}
  function getBody(r){if(typeof r==='string')return r; if(!r)return '';const index=Number(r.swipe_id);if(Array.isArray(r.swipes)&&Number.isInteger(index)&&typeof r.swipes[index]==='string')return r.swipes[index];return r.message||r.mes||'';}
  function isUser(r){return !!(r?.is_user||r?.role==='user'||r?.role==='human');}
  function getTag(text,key){return new RegExp('<'+key+'\\b[^>]*>\\s*([\\s\\S]*?)\\s*<\\/'+key+'\\s*>','i').exec(text)?.[1]?.trim()||'';}
  function removePanels(raw){return String(raw||'').replace(/<us_survival_panel\b[^>]*>[\s\S]*?<\/us_survival_panel\s*>/gi,'').replace(/<action_check\b[^>]*>[\s\S]*?<\/action_check\s*>/gi,'').replace(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable\s*>/gi,'').replace(/<JSONPatch\b[^>]*>[\s\S]*?<\/JSONPatch\s*>/gi,'').replace(/<[^>]{1,120}>/g,'').replace(/\n{3,}/g,'\n\n').trim();}
  function parse(raw){const panel=/<us_survival_panel\b[^>]*>[\s\S]*?<\/us_survival_panel\s*>/i.exec(raw)?.[0]||'';const status={};for(const k of ['outbreak_stage','date','time','location','weather','road_status','body_status','inventory','vehicle_present','vehicle_name','people'])status[k]=getTag(panel,k);
    status.peopleDetails=[];for(let i=1;i<=5;i++){const content=getTag(panel,'person'+i);const name=getTag(content,'name');if(name)status.peopleDetails.push({name,description:getTag(content,'status'),appearance:getTag(content,'appearance')});}
    const story=removePanels(raw).slice(0,1800);
    return {raw,story,status};
  }
  async function latest(){
    const get=api('getChatMessages'),last=api('getLastMessageId');let n=null;const candidates=[];
    if(last){try{const id=Number(await Promise.resolve(last()));if(Number.isInteger(id)&&id>=0)n=id;}catch(_){}}
    if(get){try{const r=rows(await Promise.resolve(get(-1)));candidates.push(...r);if(n===null){const id=Number(r[0]?.message_id);if(Number.isInteger(id)&&id>=0)n=id;}}catch(_){}
      if(n!==null){for(let i=n;i>=Math.max(0,n-10);i--){try{candidates.push(...rows(await Promise.resolve(get(i))));}catch(_){}}}
    }
    try{const ctx=(typeof SillyTavern!=='undefined'?SillyTavern:window.SillyTavern||host.SillyTavern)?.getContext?.();if(Array.isArray(ctx?.chat))candidates.push(...ctx.chat.slice(-12).reverse());}catch(_){}
    // 以最新时间倒序，且优先当前选中页；没有剧情的用户消息跳过
    for(const row of candidates){if(isUser(row))continue;const raw=getBody(row);if(typeof raw!=='string'||!raw.trim())continue;const parsed=parse(raw);if(parsed.story||parsed.status.location)return parsed;}
    return null;
  }
  function kind(scene){const s=scene.status;const combined=[scene.story,s.location,s.outbreak_stage].join(' ');if(/绿地|整备室|储物空间/.test(s.location))return 'green';if(/医院|诊所|药店|病房/.test(combined))return 'clinic';if(/小区|住宅|楼道|单元|电梯|公寓|楼梯/.test(combined))return 'home';if(/车辆|公路|高速|服务区|隧道|汽车|驾驶|开车/.test(combined))return 'road';if(/超市|便利店|商场|货架|仓库/.test(combined))return 'store';return 'street';}
  function phase(scene){const stage=scene.status.outbreak_stage||'';if(/第1天|第一天|最初|爆发|初期|前7天|第2天|第3天/.test(stage))return 'early';if(/崩溃|第2周|第二周|三周|一个月内|第30天/.test(stage))return 'middle';if(/生存|长期|重建|一年|第1个月至/.test(stage))return 'late';return 'unknown';}
  const cards={
    home:{title:'有人还记得以前的楼道',mood:'楼道、邻门、脚步声。熟悉的居住空间突然变得需要仔细倾听；最日常的声音也会让人停一下。',voices:[['小区群','楼上有没有人？……没别的，就是确认一下群里还活跃。'],['匿名住户','我以前嫌电梯老停，现在连那个叮声都想听见。'],['门缝后的生活','谁家能把电视声开小点……算了，开着也挺好的。'],['夜间群消息','别再发早安表情包了。等等，还是发吧。']]},
    clinic:{title:'灯光照过空荡的走廊',mood:'诊所和医院最让人记得的是一种混合了消毒水与疲惫的气味。墙上的指示牌依旧认真，却回答不了所有问题。',voices:[['值班记录','最后一个班的人没有签字，签到表还是翻在昨天。'],['药盒背面','这里写着饭后服用，可已经没人提醒几点该吃饭。'],['候诊区旁听','以前嫌排队太久，现在倒想听见有人喊下一位。'],['杂讯夹缝','请保持通道畅通……这句自动广播还记得怎么说。']]},
    road:{title:'还在延伸的路',mood:'路牌依旧指向熟悉的地名，只是路边再也没有人催促你赶路。',voices:[['车载广播','下一首歌献给还记得那条回家路线的人。'],['服务区留言','开水没有了，热水两个字还亮在墙上。'],['驾驶者的自言自语','这一路最奢侈的声音，可能是副驾驶有人说快到了。'],['路边闲谈','导航说您已偏航。导航，你倒是看看路啊。']]},
    store:{title:'货架之间的生活痕迹',mood:'价签、促销牌和购物篮还在原来的位置。很久以前，这里的人烦恼的是哪个牌子更划算。',voices:[['货架边','第二件半价，这会儿看起来像个讽刺笑话。'],['收银台','找零都省了，可我宁愿把零钱数到手软。'],['旧广播','亲爱的顾客……欢迎光临……吱——'],['便利贴','走之前，居然还习惯把购物车推回去。']]},
    green:{title:'安静到能听见自己',mood:'薄暮铺在桌角，温度刚刚好。杯沿、椅背和衣袖都安安静静，连呼吸也放慢了。',voices:[['心绪','如果安静也能装进背包，我会给它留个位置。'],['纸角','在这里坐了一会儿。不是因为没事做，而是想记住。'],['留白','……没有脚步催促。风倒还在。'],['日记','今天暂时不用追赶任何声音。']]},
    street:{title:'城市还剩下许多声音',mood:'城市从来不是一瞬间安静下来的。路灯、招牌、风吹过的塑料布，这些普通事物现在都像在坚持日常。',voices:[['城市角落','公交站牌上的到站时间已经不会更新了。'],['没人领取的通知','请各位居民有序……后半句被风吹跑了。'],['某条旧录音','您拨打的电话暂时无法接通。'],['街头便利贴','如果明天还有太阳，我想晒一下被子。']]},
  };
  // 场景词仅用于触发“联想”；不把它变成新的剧情事实。
  const sceneMotifs=[
    {re:/声控灯|路灯|手电|灯光/,mood:'一束灯光忽然成了场景里最容易被注意到的东西。',voice:'灯还亮着这件事，在以前根本不值得特意告诉别人。'},
    {re:/咳嗽|脚步|摩擦声|敲门|撞击/,mood:'隔着门传来的细小声响，足够让人多听半秒。',voice:'隔壁有声音，至少说明这栋楼还不是一张空照片。'},
    {re:/雨衣|小雨|暴雨|雨点|下雨/,mood:'雨声铺满空隙，人的脚步反而显得更近。',voice:'天气预报要是还准，就算一件好事。'},
    {re:/电视|屏幕|广播|收音机|黑屏/,mood:'熟悉的电子设备突然沉默，连广告都变成了被想念的声音。',voice:'我竟然有点想念以前广告插播的声音。'},
    {re:/便利店|超市|货架|收银/,mood:'商品还在原位，正常生活的秩序却换了含义。',voice:'谁还能记得以前购物篮里最常忘记买的东西？'},
    {re:/公路|高速|车轮|导航|路牌/,mood:'道路还向前延伸，下一段旅途却没人替你预先写好。',voice:'以前开车嫌堵，现在倒有点想看见堵车的尾灯。'},
    {re:/薄暮|绿地|整备室/,mood:'傍晚似乎被拉长了，可以暂时把话说得慢一点。',voice:'时间像停在这里，至少能记得今天还有一小段安静。'},
  ];
  function motifs(scene){return sceneMotifs.filter(m=>m.re.test(scene.story)).slice(0,2);}
  function chooseMessages(scene){
    const type=kind(scene),period=phase(scene),info=cards[type];
    const related=motifs(scene).map(m=>[type==='green'?'心绪':type==='clinic'?'候诊碎语':type==='home'?'楼道闲言':type==='road'?'路上闲话':type==='store'?'货架碎语':'街角碎语',m.voice]);
    const lines=[...related,...info.voices].slice(0,6);
    if(type==='green')return {title:'薄暮之间',lines};
    if(period==='early')return {title:type==='home'?'楼里还有人说话':'还没停下的声音',lines};
    if(period==='middle')return {title:'断断续续的旧声音',lines};
    if(period==='late')return {title:'留在日子里的话',lines};
    return {title:'一些细碎的声音',lines};
  }
  function addText(container,tag,className,value){const item=doc.createElement(tag);item.className=className;item.textContent=value;container.appendChild(item);return item;}
  function renderMoment(){const scene=state.scene;
    if(!scene){put('momentTitle','还没有接上这一幕');put('sceneMarker','等待剧情');put('sceneMeta','');put('story','——');q('#facts').replaceChildren();put('mood','——');return;}
    const s=scene.status,typ=kind(scene),info=cards[typ];put('momentTitle',info.title);put('sceneMarker',[s.location,s.time].filter(Boolean).join(' · ')||'此刻');put('sceneMeta',[s.date,s.time,s.outbreak_stage].filter(Boolean).join(' · '));
    put('story',scene.story.slice(0,480)||'——');put('mood',[info.mood,...motifs(scene).map(m=>m.mood)].join(' '));
    const facts=q('#facts');facts.replaceChildren();for(const value of [s.weather,s.road_status,s.peopleDetails.length?'在场：'+s.peopleDetails.map(x=>x.name).join('、'):''].filter(Boolean).slice(0,4)){addText(facts,'span','chip',value.length>48?value.slice(0,48)+'…':value);}
  }
  function renderEcho(){const out=q('#echoList');out.replaceChildren();if(!state.scene){put('echoTitle','等剧情到来');return;}
    const data=chooseMessages(state.scene);put('echoTitle',data.title);
    const rotation=state.turn%data.lines.length;const lines=[...data.lines.slice(rotation),...data.lines.slice(0,rotation)].slice(0,3);
    lines.forEach(([who,what],i)=>{const row=addText(out,'div','entry','');const av=addText(row,'div','avatar',['✦','◇','·'][i]);const b=addText(row,'div','bubble','');addText(b,'div','speaker',who);addText(b,'div','says',what);});
  }
  function renderBook(){const out=q('#saved');out.replaceChildren();if(!state.saved.length){addText(out,'p','muted','这一页还空着。');return;}
    for(const r of state.saved){const block=addText(out,'div','saved','');const row=addText(block,'div','headrow','');addText(row,'span','',r.kind==='clip'?'◇ 收藏的剧情':'✎ 私人纸条');const remove=addText(row,'button','tinybtn','删除');remove.dataset.act='del';remove.dataset.id=r.id;addText(block,'div','',r.text);}
  }
  async function refresh(){if(state.refreshing)return;state.refreshing=true;notice('正在拾取当前剧情…');try{const reply=await latest();if(reply){const same=state.scene?.raw===reply.raw;state.scene=reply;if(!same)state.turn=0;renderMoment();renderEcho();notice('已更新');}else{state.scene=null;renderMoment();renderEcho();notice('尚未读到角色回复');}}catch(e){notice('读取失败：'+String(e?.message||e).slice(0,55));}finally{state.refreshing=false;}}
  function addSaved(text,kind){state.saved.unshift({id:String(Date.now())+'-'+Math.random().toString(36).slice(2,7),kind,text:text.slice(0,500)});state.saved=state.saved.slice(0,70);const ok=persist();notice(ok?'已收进拾遗簿':'已在当前会话收存（本地存储受限）');renderBook();}
  async function exportBook(){if(!state.saved.length){notice('拾遗簿还是空的');return;}try{await host.navigator.clipboard.writeText(state.saved.map(x=>'【'+(x.kind==='clip'?'剧情':'纸条')+'】\n'+x.text).join('\n\n---\n\n'));notice('已复制拾遗簿');}catch(_){notice('剪贴板不可用，可直接选择记录复制');}}
  shadow.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.tab){setTab(button.dataset.tab);return;}switch(button.dataset.act){case 'open':open(true);break;case 'close':open(false);break;case 'refresh':void refresh();break;case 'another':state.turn++;renderEcho();break;case 'clip':if(!state.scene?.story){notice('先读取剧情才可收藏');break;}addSaved(state.scene.story.slice(0,480),'clip');setTab('book');break;case 'save':{const input=q('#memo'),txt=input.value.trim();if(!txt){notice('先写一句话');break;}addSaved(txt,'note');input.value='';break;}case 'export':void exportBook();break;case 'del':state.saved=state.saved.filter(x=>x.id!==button.dataset.id);persist();renderBook();notice('已删除记录');break;}});
  shadow.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.opened)open(false);});
  const on=api('eventOn'),off=api('eventRemoveListener');if(on&&off){let events={};try{events=(typeof tavern_events!=='undefined'?tavern_events:null)||window.tavern_events||host.tavern_events||{};}catch(_){}for(const name of ['MESSAGE_RECEIVED','MESSAGE_UPDATED','MESSAGE_SWIPED','CHAT_CHANGED']){const evt=events[name];if(!evt)continue;const fn=()=>{if(!state.opened)return;host.clearTimeout(state.timer);state.timer=host.setTimeout(()=>void refresh(),420);};try{on(evt,fn);state.off.push(()=>off(evt,fn));}catch(_){}}}
  renderMoment();renderEcho();renderBook();
  const controller={version:VERSION,open:()=>open(true),refresh,destroy(){host.clearTimeout(state.timer);state.off.forEach(fn=>{try{fn();}catch(_){}});node.remove();if(host[OWNER]===controller)delete host[OWNER];}};
  host[OWNER]=controller;
})();
