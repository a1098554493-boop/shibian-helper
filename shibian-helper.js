/* 尸变纪元角色专属助手 v1.0.0
 * 给 PiuPiu 酱 / 酒馆助手兼容脚本环境的独立角色 JS。
 * 作用：侧边悬浮面板，读取 MVU 真实楼层数据，比较前后楼层。
 * 不替代 MagVarUpdate，不伪造 / 自动写入剧情数值。
 * 放到你的 GitHub 后，角色脚本中 import 这个文件即可。 */
(async function shibianRoleHelper() {
  'use strict';
  const BUILD = '1.0.0';
  const ROOT_ID = 'shibian-v2-side-assistant';
  const OWNER = '__shibianV2Assistant';
  let hostWindow = window;
  try {
    if (window.parent && window.parent !== window && window.parent.document && window.parent.document.body) {
      hostWindow = window.parent;
    }
  } catch (_) { /* iframe 隔离时退回当前页面 */ }
  const doc = hostWindow.document;
  const hostState = hostWindow[OWNER];
  if (hostState && hostState.destroy && doc.getElementById(ROOT_ID)) {
    // 如果这张卡重复加载，不创建第二个气泡。
    return;
  }

  const state = {
    opened: false, events: 0, lastEvent: '无', lastError: '',
    latest: null, before: null, previousMessageId: null,
    latestMessageId: null, mvuReady: false, timer: null,
    detach: [], refreshes: 0, dataOrigin: '尚未读取',
  };
  const clean = (x) => x === undefined ? '缺失' : x === null ? '未设定' : String(x);
  const field = (v) => Array.isArray(v) && v.length === 2 && typeof v[1] === 'string' ? v[0] : v;
  const deref = (obj, path) => path.reduce((o, key) => (o && typeof o === 'object' ? o[key] : undefined), obj);
  const hasState = (o) => o && typeof o === 'object' && o.stat_data && typeof o.stat_data === 'object';
  const asState = (o) => hasState(o) ? o.stat_data : null;
  const digest = (stat) => {
    const at = (path) => field(deref(stat || {}, path));
    const world = stat?.世界 || {};
    return {
      date: at(['世界','日期']), time: at(['世界','时间']),
      space: at(['当前位置','空间']), location: [at(['当前位置','城市']),at(['当前位置','场所'])].filter(v=>v && v!=='未设定').join(' / '),
      stage: field(world.灾变阶段), stamina: at(['主角','体力']), hunger: at(['主角','饥饿']), thirst: at(['主角','口渴']),
      weapon: at(['特殊能力','善良之枪','当前持有武器']),
      weapons: at(['特殊能力','善良之枪','武器记录']),
      inv: at(['随身物品']), store: at(['储物空间']), vehicle: at(['当前车辆']),
      party: at(['同场人物']), relations: at(['人物关系'])
    };
  };
  async function fetchMessage(id) {
    try {
      if (typeof Mvu !== 'undefined' && Mvu && typeof Mvu.getMvuData === 'function') {
        const v = await Promise.resolve(Mvu.getMvuData({ type: 'message', message_id: id }));
        if (hasState(v)) return { stat: asState(v), source: 'Mvu.getMvuData' };
      }
    } catch (err) { state.lastError = 'Mvu.getMvuData: ' + clean(err?.message || err); }
    try {
      if (typeof getVariables === 'function') {
        const v = await Promise.resolve(getVariables({ type: 'message', message_id: id }));
        if (hasState(v)) return { stat: asState(v), source: 'getVariables' };
      }
    } catch (err) { state.lastError = 'getVariables: ' + clean(err?.message || err); }
    return null;
  }
  async function fetchLastTwo() {
    // 用负楼层 ID 检查最新消息；找不到 stat_data 不等于成功。
    let latest = null, before = null, latestMessageId = null, prevMessageId = null;
    for (let id = -1; id >= -12; id--) {
      const found = await fetchMessage(id);
      if (!found) continue;
      if (!latest) { latest = found; latestMessageId = id; }
      else { before = found; prevMessageId = id; break; }
    }
    return { latest, before, latestMessageId, prevMessageId };
  }
  const BOX = `
    <style>
    #${ROOT_ID}{all:initial;color:#f4ddd0;font-family:system-ui,-apple-system,"PingFang SC","Microsoft Yahei",sans-serif;font-size:13px}
    #${ROOT_ID} *{box-sizing:border-box}
    #${ROOT_ID} .sb-bubble{position:fixed;right:8px;top:45%;transform:translateY(-50%);z-index:2147483000;width:48px;height:52px;border:2px solid #b67a62;border-radius:13px 0 0 13px;background:linear-gradient(145deg,#711f29,#271217);color:#f6dcc5;box-shadow:0 5px 25px #0009;font:800 18px/1 sans-serif;cursor:pointer;touch-action:manipulation}
    #${ROOT_ID} .sb-bubble span{display:block;font-size:9px;font-weight:500;margin-top:4px;opacity:.8}
    #${ROOT_ID} .sb-panel{position:fixed;right:58px;top:14%;width:min(370px,calc(100vw - 75px));max-height:73vh;overflow:hidden;z-index:2147483001;background:linear-gradient(145deg,#281419,#140d10);border:2px solid #804349;border-radius:12px;box-shadow:0 10px 38px #000c;display:none}
    #${ROOT_ID} .sb-panel.sb-open{display:flex;flex-direction:column}
    #${ROOT_ID} .sb-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px;background:#61232d;border-bottom:1px solid #a25c56}
    #${ROOT_ID} .sb-head strong{font-size:16px;color:#fff0d6}
    #${ROOT_ID} .sb-head small{font-size:10px;color:#edc9af}
    #${ROOT_ID} .sb-close{background:#401d25;border:1px solid #a76a62;border-radius:6px;color:#ffe7d7;padding:6px 10px;cursor:pointer}
    #${ROOT_ID} .sb-main{overflow-y:auto;overscroll-behavior:contain;padding:12px;line-height:1.6}
    #${ROOT_ID} .sb-summary{font-size:12px;border-bottom:1px solid #5f3438;padding-bottom:9px;margin-bottom:9px;color:#ddab97}
    #${ROOT_ID} .sb-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    #${ROOT_ID} .sb-tile{background:#1c1114;border:1px solid #5c3539;border-radius:7px;padding:7px;min-width:0}
    #${ROOT_ID} .sb-tile span{display:block;font-size:10px;color:#bd9b90}
    #${ROOT_ID} .sb-tile b{display:block;font-size:15px;color:#f9d1b4;word-break:break-all}
    #${ROOT_ID} .sb-section{margin:10px 0 4px;color:#f4c2a7;font-weight:700;border-bottom:1px solid #563036;padding-bottom:3px}
    #${ROOT_ID} .sb-delta{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;color:#dbc6b8;padding:7px 8px;border:1px dashed #6b4643;border-radius:6px;background:#171114;max-height:145px;overflow:auto}
    #${ROOT_ID} .sb-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
    #${ROOT_ID} .sb-actions button{border:1px solid #9e635b;border-radius:7px;background:#42252a;color:#f7d5c0;padding:7px 10px;cursor:pointer;font-size:12px}
    #${ROOT_ID} .sb-actions button:first-child{background:#7c2934}
    #${ROOT_ID} .sb-note{margin-top:10px;font-size:11px;color:#bca39a}
    </style>
    <button type="button" class="sb-bubble" aria-label="打开尸变纪元助手">尸<span>MVU</span></button>
    <section class="sb-panel" role="dialog" aria-label="尸变纪元 MVU 助手">
      <div class="sb-head"><div><strong>尸变纪元 · 专属助手</strong><small> v${BUILD} · 真实楼层存档</small></div><button type="button" class="sb-close">关闭</button></div>
      <div class="sb-main">
        <div class="sb-summary" id="sb-summary">正在等待数据...</div>
        <div class="sb-grid">
          <div class="sb-tile"><span>剧情日期/时间</span><b id="sb-date">—</b></div>
          <div class="sb-tile"><span>位置/空间</span><b id="sb-place">—</b></div>
          <div class="sb-tile"><span>体力</span><b id="sb-stamina">—</b></div>
          <div class="sb-tile"><span>饱腹 / 水分</span><b id="sb-needs">—</b></div>
        </div>
        <div class="sb-section">武器和物资</div><div class="sb-delta" id="sb-gear">—</div>
        <div class="sb-section">最近两份存档的差异</div><div class="sb-delta" id="sb-diff">—</div>
        <div class="sb-actions"><button type="button" id="sb-refresh">读取最新存档</button><button type="button" id="sb-copy">复制诊断</button></div>
        <div class="sb-note" id="sb-note">只读面板。不会擅自改变背包、体力或弹药。</div>
      </div>
    </section>`;

  const root = doc.createElement('div');
  root.id = ROOT_ID;
  root.innerHTML = BOX;
  (doc.body || doc.documentElement).appendChild(root);
  const node = (id) => root.querySelector('#' + id);
  const put = (id, str) => { const e=node(id); if (e) e.textContent=String(str); };
  const listKeys = (x, max=10) => {
    if (!x || typeof x !== 'object') return '无记录';
    const keys = Object.keys(x).filter(k=>k!=='$internal');
    return keys.length ? keys.slice(0,max).join('、')+(keys.length>max?' 等'+keys.length+'项':'') : '无记录';
  };
  const snapshot = (stat) => {
    const d=digest(stat);
    const types = ['date','time','space','location','stage','stamina','hunger','thirst','weapon'];
    return types.map(k => `${k}: ${clean(d[k])}`).join('\n') + '\n物品：'+listKeys(d.inv)+'\n弹药：'+JSON.stringify(d.weapons||{}).slice(0,400);
  };
  function formatDelta(latest, before) {
    if (!before) return '缺少可比较的上一份楼层数据，不能判断本轮是否落库。';
    const a=digest(latest), b=digest(before);
    const rename={date:'日期',time:'时间',space:'空间',location:'位置',stage:'灾变阶段',stamina:'体力',hunger:'饥饿',thirst:'口渴',weapon:'当前武器',inv:'随身物品',store:'储物空间',weapons:'枪械记录',vehicle:'车辆',party:'同场人物',relations:'人物关系'};
    const changes=[];
    for (const k of Object.keys(rename)) {
      const x=JSON.stringify(a[k]), y=JSON.stringify(b[k]);
      if (x!==y) {
        const brief=v=> typeof v==='object' && v!==null ? JSON.stringify(v).slice(0,100) : clean(v);
        changes.push(`${rename[k]}: ${brief(b[k])} → ${brief(a[k])}`);
      }
    }
    return changes.length ? changes.join('\n') : '两份存档完全相同。可能没有更新，也可能仍读取到相同的快照。';
  }
  async function refresh() {
    state.refreshes++;
    const pair=await fetchLastTwo();
    state.latest=pair.latest?.stat || null;
    state.before=pair.before?.stat || null;
    state.latestMessageId=pair.latestMessageId;
    state.previousMessageId=pair.prevMessageId;
    state.dataOrigin=pair.latest?.source || '未找到有效的 stat_data';
    const d=digest(state.latest);
    const loaded=state.latest !== null;
    put('sb-summary', loaded
      ? `JS：运行中；MVU：${typeof Mvu!=='undefined'?'可访问':'未找到'}；读取：${state.dataOrigin} [${pair.latestMessageId}]；捕获更新事件：${state.events}`
      : `JS 已启动，但没有读取到有效 stat_data。${state.lastError?'错误：'+state.lastError:''}`);
    put('sb-date',clean(d.date)+' '+clean(d.time));
    put('sb-place',clean(d.space)+(d.location?' / '+d.location:''));
    put('sb-stamina',clean(d.stamina));
    const satiety=typeof d.hunger==='number' ? 100-d.hunger : undefined;
    const water=typeof d.thirst==='number' ? 100-d.thirst : undefined;
    put('sb-needs',clean(satiety)+' / '+clean(water));
    put('sb-gear', '手持枪：'+clean(d.weapon)+'\n弹药记录：'+JSON.stringify(d.weapons||{})+'\n随身物品：'+listKeys(d.inv)+'\n人物：'+listKeys(d.relations));
    put('sb-diff', loaded?formatDelta(state.latest,state.before):'尚无真实存档可比较。');
    put('sb-note','只读，绝不自动修改数值。最近事件：'+state.lastEvent+'。如状态栏和此处不同，应以真正 stat_data 为依据。');
  }
  function report() {
    const title='尸变纪元助手 v'+BUILD+'\n';
    if (!state.latest) return title+'当前未读到有效 stat_data。\n错误：'+state.lastError;
    return title+'来源：'+state.dataOrigin+'\n'+snapshot(state.latest)+'\n差异：\n'+formatDelta(state.latest,state.before);
  }
  root.querySelector('.sb-bubble').addEventListener('click', () => {
    state.opened=!state.opened;
    root.querySelector('.sb-panel').classList.toggle('sb-open',state.opened);
    if(state.opened) refresh().catch(err => { state.lastError=clean(err?.message || err); put('sb-summary',state.lastError); });
  });
  root.querySelector('.sb-close').addEventListener('click', () => {
    state.opened=false;root.querySelector('.sb-panel').classList.remove('sb-open');
  });
  node('sb-refresh').addEventListener('click', () => refresh().catch(err => {state.lastError=clean(err);put('sb-summary',state.lastError); }));
  node('sb-copy').addEventListener('click', async () => {
    const s=report();
    try { if(hostWindow.navigator?.clipboard?.writeText) {await hostWindow.navigator.clipboard.writeText(s);put('sb-note','诊断已复制。');return;} } catch(_) {}
    try { if(typeof copyToClipboard==='function'){await copyToClipboard(s);put('sb-note','诊断已复制。');return;} }catch(_){}
    put('sb-note','复制不可用，请截图侧边面板。');
  });

  const onUpdate=()=>{
    state.events++;
    state.lastEvent='MVU更新结束事件 #'+state.events;
    // 等宿主把快照落盘之后再重读，不在事件钩子内自行写入、避免覆盖。
    if(state.timer) clearTimeout(state.timer);
    state.timer=setTimeout(()=>refresh().catch(err=>{state.lastError=clean(err);}),750);
  };
  const ev=(typeof Mvu!=='undefined' && Mvu?.events?.VARIABLE_UPDATE_ENDED) || 'mag_variable_update_ended';
  try {
    if(typeof eventOn==='function') {
      eventOn(ev,onUpdate);
      if(typeof eventRemoveListener==='function') state.detach.push(()=>eventRemoveListener(ev,onUpdate));
    }
  } catch(e) { state.lastError='事件注册失败：'+clean(e?.message||e); }
  try {
    if (typeof waitGlobalInitialized==='function') {
      // 不阻断页面显示。失败时仍能从侧边面板查看诊断。
      Promise.resolve(waitGlobalInitialized('Mvu'))
        .then(()=>{state.mvuReady=true;refresh().catch(()=>{});})
        .catch(e=>{state.lastError='MVU 初始化等待失败：'+clean(e?.message||e);});
    }
  } catch(e) {state.lastError=clean(e?.message||e);}
  state.timer=setTimeout(()=>refresh().catch(e=>{state.lastError=clean(e?.message||e);}),1400);
  hostWindow[OWNER] = {
    version: BUILD,
    refresh,
    destroy() {
      if (state.timer) clearTimeout(state.timer);
      for(const detach of state.detach) try{detach();}catch(_){}
      root.remove();
      try {delete hostWindow[OWNER];}catch(_){}
    }
  };
  console.info('[尸变纪元] 专属助手已挂载。右侧「尸」按钮可打开。v'+BUILD);
})();
