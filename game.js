/* Silverveil: a dependency-free Canvas action RPG. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const mapCtx = $('minimap').getContext('2d');
  const W = 1280, H = 720, TAU = Math.PI * 2;
  const WORLD={width:2560,height:1440,cx:1280,cy:750};
  const ARENA={minX:180,maxX:2380,minY:310,maxY:1170};
  const WAVE_COUNTS=[0,12,18,24,30,24];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clock = n => `${Math.floor(n / 60).toString().padStart(2, '0')}:${Math.floor(n % 60).toString().padStart(2, '0')}`;
  const heroImage = new Image(); heroImage.src = 'assets/aelith.png';
  const heroActions = new Image(); heroActions.src = 'assets/aelith-actions.png';
  const heroWalk = new Image(); heroWalk.src = 'assets/aelith-walk.png';
  // Atlas cells: ready, windup, slash, follow-through, dash, raise, slam, thrust.
  const actionFrames = {
    attack: [[0,1],[.18,2],[.58,3],[.94,0]],
    dash: [[0,4],[.88,0]],
    nova: [[0,5],[.32,6],[.88,0]],
    blade: [[0,1],[.18,7],[.86,3],[.96,0]]
  };
  let mode = 'intro', time = 0, ambientTime = 0, wave = 0, score = 0, kills = 0, combo = 0, comboUntil = 0;
  let enemies = [], particles = [], effects = [], projectiles = [], loot = [], texts = [];
  let waveDelay = -1, pendingUpgrades = 0, shake = 0, announceUntil = 0, toastUntil = 0;
  let best = 0; try { const stored=Number(localStorage.getItem('silverveil-best'));best=Number.isFinite(stored)?Math.max(0,stored):0; } catch { /* Storage is optional. */ }
  $('bestScore').textContent = best.toLocaleString('id-ID');
  const keys = new Set(), pointer = {x: 700, y: 350, held: false, aiming: false};
  const stick = {x: 0, y: 0, active: false};
  const mobileQuery=window.matchMedia?.('(max-width: 700px), (pointer: coarse)');
  let oneFinger=Boolean(mobileQuery?.matches);
  const gesture={id:null,x:0,y:0};
  let player, audioCtx, soundOn = false, lastAttack = -10, attackStep = 0;
  const skillButtons = [...document.querySelectorAll('.skill[data-action]')];
  const decorations = [];
  let seed = 51;
  function seeded() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  for (let i = 0; i < 320; i++) decorations.push({x: seeded()*WORLD.width, y: seeded()*WORLD.height, r: 1+seeded()*3, a: seeded(), type: seeded()});
  const pillars = [{x:145,y:285},{x:2415,y:285},{x:145,y:1210},{x:2415,y:1210},{x:700,y:270},{x:1860,y:270},{x:700,y:1230},{x:1860,y:1230}];

  function resetPlayer() {
    player = {x:WORLD.cx,y:WORLD.cy,hp:180,maxHp:180,mana:100,maxMana:100,power:1,regen:7,level:1,xp:0,nextXp:70,potions:0,speed:200,face:1,angle:0,invincible:0,dashTime:0,dashX:1,dashY:0,walk:0,stride:0,moving:false,animation:null,cooldowns:{attack:0,dash:0,nova:0,blade:0,potion:0}};
  }
  resetPlayer();

  function beep(freq, duration=.09, type='sine', volume=.04, end=0) {
    if (!soundOn || !audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type=type; osc.frequency.setValueAtTime(freq,audioCtx.currentTime);
    if(end) osc.frequency.exponentialRampToValueAtTime(end,audioCtx.currentTime+duration);
    gain.gain.setValueAtTime(volume,audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
    osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);
  }
  async function enableAudio() {
    try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); await audioCtx.resume(); soundOn=!soundOn; }
    catch { toast('Audio tidak tersedia di browser ini.');soundOn=false; }
    $('soundLabel').textContent=soundOn?'ON':'OFF';
    $('soundBtn').setAttribute('aria-label',soundOn?'Matikan suara':'Aktifkan suara');
    if(soundOn) beep(440,.25,'sine',.025,660);
  }
  function toast(message) {$('toast').textContent=message;toastUntil=ambientTime+2;$('toast').classList.add('show');}
  function announce(title, subtitle='') {
    $('announcement').replaceChildren(document.createTextNode(title));
    if(subtitle){const s=document.createElement('small');s.textContent=subtitle;$('announcement').append(s);}
    announceUntil=time+2.8;$('announcement').classList.add('show');
  }
  function burst(x,y,color,count=14,force=90) {
    count=Math.min(count,Math.max(0,650-particles.length));
    for(let i=0;i<count;i++){const a=rand(0,TAU),v=rand(force*.2,force);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,color,life:rand(.25,.7),max:.7,size:rand(1,3)});}
  }
  function floatText(x,y,text,color='#dfeef0',size=17){if(texts.length<90)texts.push({x,y,text,color,size,life:.85});}
  function start() {
    resetPlayer();time=0;wave=0;score=0;kills=0;combo=0;comboUntil=0;
    enemies=[];particles=[];effects=[];projectiles=[];loot=[];texts=[];
    pendingUpgrades=0;waveDelay=-1;shake=0;lastAttack=-10;attackStep=0;
    keys.clear();pointer.held=false;stick.x=stick.y=0;
    releaseStick();
    document.querySelectorAll('.overlay').forEach(e=>e.classList.add('hidden'));
    $('bossHud').classList.add('hidden');$('combo').textContent='';
    mode='playing';nextWave();updateHud();
  }
  function spawnEnemy(type, x, y) {
    const stats = {wraith:{hp:62+wave*8,speed:80+wave*6,r:18,damage:11,xp:16},brute:{hp:150+wave*16,speed:60,r:26,damage:26,xp:30},caster:{hp:80+wave*8,speed:62,r:18,damage:16,xp:22},boss:{hp:1900,speed:60,r:48,damage:30,xp:250}}[type];
    enemies.push({...stats,maxHp:stats.hp,x,y,type,hit:0,attack:rand(.7,1.4),cast:rand(2,4),stun:0,phase:rand(0,TAU),tell:0,tellDuration:1.05,slamRadius:135,slamDamage:48,slamX:0,slamY:0,spawn:.8});
    burst(x,y,'#779b93',15,50);
  }
  function waveSpawnPoint(angle){
    let fallback=null,best=-Infinity;
    for(let attempt=0;attempt<12;attempt++){
      const a=angle+attempt*TAU/12,r=rand(470,680);
      const point={x:clamp(player.x+Math.cos(a)*r,ARENA.minX,ARENA.maxX),y:clamp(player.y+Math.sin(a)*r,ARENA.minY,ARENA.maxY)};
      const d=distance(player,point);
      if(d>best){best=d;fallback=point;}
      if(d>=360&&enemies.every(e=>distance(e,point)>52))return point;
    }
    return fallback;
  }
  function nextWave() {
    wave++;waveDelay=-1;
    if(wave>5){finish(true);return;}
    const count=WAVE_COUNTS[wave];
    for(let i=0;i<count;i++){
      const a=i/count*TAU+rand(-.2,.2);
      let type='wraith';
      if(wave>=2 && i%4===0)type='brute';
      if(wave>=2 && i%4===1)type='caster';
      const point=waveSpawnPoint(a);spawnEnemy(type,point.x,point.y);
    }
    if(wave===5){const point=waveSpawnPoint(-Math.PI/2);spawnEnemy('boss',point.x,point.y);$('bossHud').classList.remove('hidden');}
    announce(wave===5?'THE HOLLOW KING':`GELOMBANG ${String(wave).padStart(2,'0')}`,wave>=2?'Hindari zona merah sebelum meledak.':'Kegelapan mendekat. Tetap bergerak.');
    beep(180,.6,'sine',.04,90);
  }
  function nearestEnemy(max=Infinity) {
    let target=null, d=max;
    for(const e of enemies){const n=distance(player,e);if(e.hp>0&&n<d){d=n;target=e;}}
    return target;
  }
  function aim() {
    const near=nearestEnemy(230);
    if(pointer.aiming)return Math.atan2(pointer.y-player.y,pointer.x-player.x);
    if(near)return Math.atan2(near.y-player.y,near.x-player.x);
    return player.angle;
  }
  function hurtEnemy(e,damage,kx=0,ky=0) {
    if(e.hp<=0)return;
    const critical=Math.random()<.13;
    const dealt=Math.round(damage*(critical?1.65:1));
    e.hp-=dealt;e.hit=.16;e.stun=e.type==='boss'?.03:.08;
    e.x=clamp(e.x+kx*(e.type==='boss'?.15:1),ARENA.minX,ARENA.maxX);e.y=clamp(e.y+ky*(e.type==='boss'?.15:1),ARENA.minY,ARENA.maxY);
    floatText(e.x+rand(-12,12),e.y-45,critical?`${dealt}!`:dealt,critical?'#ecdc9f':'#d9edf0',critical?22:16);
    burst(e.x,e.y-20,'#9ddbdd',9,85);
    combo++;comboUntil=time+2.6;shake=Math.min(shake+1.4,5);
    if(e.hp<=0){
      kills++;score+=Math.round((e.type==='boss'?1500:e.type==='brute'?160:100)*(1+Math.min(combo,50)*.015));
      player.xp+=e.xp;burst(e.x,e.y-18,e.type==='boss'?'#dcc393':'#85b9be',25,140);
      if(Math.random()<.28)loot.push({x:e.x,y:e.y,type:Math.random()<.45?'health':'mana',phase:rand(0,TAU)});
      while(player.xp>=player.nextXp){player.xp-=player.nextXp;player.level++;player.nextXp=Math.round(player.nextXp*1.45);pendingUpgrades++;}
      beep(e.type==='boss'?110:480,.15,'sine',.018,200);
    }
  }
  function animateHero(type, duration, angle, step=0) {
    player.animation={type,duration,elapsed:0,angle,face:Math.cos(angle)>=0?1:-1,step};
  }
  function heroPose() {
    const a=player.animation;
    const pose={atlas:'action',frame:0,face:player.face,x:0,y:Math.sin(player.walk)*.7,rotation:0,sx:1,sy:1,trail:0};
    if(!a){
      if(player.moving){
        pose.atlas='walk';pose.frame=Math.floor(player.stride*8)%8;
        pose.y=-Math.abs(Math.sin(player.stride*TAU))*1.5;
        pose.rotation=Math.sin(player.stride*TAU)*.012;
      }
      return pose;
    }
    const t=clamp(a.elapsed/a.duration,0,1),pulse=Math.sin(t*Math.PI);
    pose.face=a.face;
    for(const [at,frame] of actionFrames[a.type])if(t>=at)pose.frame=frame;
    let reach=0;
    if(a.type==='attack'){
      // Anticipation -> quick forward strike -> settle back onto the feet.
      const strike=t<.18?-5*Math.sin(t/.18*Math.PI):Math.sin((t-.18)/.82*Math.PI)*(a.step===2?23:15);
      reach=strike;pose.rotation=(a.step===1?-.1:.09)*pulse;pose.sy=1-.055*pulse;
      pose.y=-Math.sin(t*Math.PI)*3;pose.trail=a.step===2?pulse*.22:0;
    } else if(a.type==='dash'){
      pose.rotation=.16*pulse;pose.sx=1+.1*pulse;pose.sy=1-.1*pulse;pose.trail=.24*pulse;
    } else if(a.type==='nova'){
      // Rise with the sword, then drop into the ground-strike keyframe.
      pose.y=t<.32?-Math.sin(t/.32*Math.PI)*12:Math.sin((t-.32)/.68*Math.PI)*5;
      pose.sy=1-(t>.32?.06:0)*pulse;
    } else if(a.type==='blade'){
      reach=20*pulse;pose.rotation=.08*pulse;pose.y=-3*pulse;pose.trail=.14*pulse;
    }
    pose.x=Math.cos(a.angle)*reach;pose.y+=Math.sin(a.angle)*reach*.6;
    return pose;
  }
  function action(name, direction) {
    if(mode!=='playing')return;
    const cd=player.cooldowns;
    if(cd[name]>0)return;
    // Held basic attack must not replace a cast or dash pose on the next frame.
    if(name==='attack'&&player.animation&&player.animation.type!=='attack')return;
    const a=direction??aim();
    if(name==='attack'){
      attackStep=time-lastAttack<.85?(attackStep+1)%3:0;lastAttack=time;
      cd.attack=attackStep===2?.46:.3;player.angle=a;player.face=Math.cos(a)>=0?1:-1;
      animateHero('attack',cd.attack,a,attackStep);
      const reach=attackStep===2?132:112,wide=attackStep===2?1.5:1.15;
      effects.push({type:'slash',x:player.x,y:player.y-14,angle:a,life:.24,max:.24,reach,step:attackStep});
      const knockback=attackStep===2?18:7;
      for(const e of enemies){const d=distance(player,e),ea=Math.atan2(e.y-player.y,e.x-player.x),diff=Math.atan2(Math.sin(ea-a),Math.cos(ea-a));if(d<reach+e.r&&Math.abs(diff)<wide)hurtEnemy(e,(attackStep===2?43:28)*player.power,Math.cos(a)*knockback,Math.sin(a)*knockback);}
      beep(500,.11,'triangle',.035,95);
    } else if(name==='dash'){
      let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x;
      let dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+stick.y;
      if(direction!==undefined){dx=Math.cos(direction);dy=Math.sin(direction);}
      const len=Math.hypot(dx,dy);if(len){dx/=len;dy/=len;}else{dx=Math.cos(player.angle);dy=Math.sin(player.angle);}
      player.dashX=dx;player.dashY=dy;player.dashTime=.19;player.invincible=.32;cd.dash=1.65;
      animateHero('dash',.25,Math.atan2(dy,dx));
      beep(180,.15,'sine',.045,600);
    } else if(name==='nova'){
      if(player.mana<35){toast('Mana tidak cukup untuk Frost Nova');return;}
      player.mana-=35;cd.nova=7;
      animateHero('nova',.65,a);
      effects.push({type:'nova',x:player.x,y:player.y,life:.65,max:.65,reach:205});
      for(const e of enemies)if(distance(player,e)<205+e.r){hurtEnemy(e,67*player.power);e.stun=e.type==='boss'?.25:1.1;}
      burst(player.x,player.y,'#a0e9f3',55,290);shake=5;beep(800,.5,'sine',.05,120);
    } else if(name==='blade'){
      if(player.mana<25){toast('Mana tidak cukup untuk Moonblade');return;}
      player.mana-=25;cd.blade=3.5;player.angle=a;player.face=Math.cos(a)>=0?1:-1;
      animateHero('blade',.42,a);
      projectiles.push({x:player.x,y:player.y-10,vx:Math.cos(a)*530,vy:Math.sin(a)*530,life:1.3,r:25,friendly:true,damage:60*player.power,hit:new Set()});
      beep(900,.25,'triangle',.025,250);

    }
  }
  function hurtPlayer(amount) {
    if(player.invincible>0||mode!=='playing')return;
    player.hp=Math.max(0,player.hp-amount);player.invincible=.42;shake=7;
    floatText(player.x,player.y-80,`âˆ’${amount}`,'#eab0a6',21);burst(player.x,player.y-30,'#c88b87',14,80);beep(100,.2,'sawtooth',.025,45);
    if(player.hp<=0)finish(false);
  }
  function finish(win) {
    mode=win?'victory':'dead';pointer.held=false;keys.clear();
    releaseStick();
    if(win)score+=2000;
    best=Math.max(best,score);try{localStorage.setItem('silverveil-best',String(best));}catch{}
    $('endEyebrow').textContent=win?'THE SANCTUM IS FREE':'THE LIGHT FADES';
    $('endTitle').textContent=win?'Cahaya kembali bersinar':'Kesatria telah gugur';
    $('endCopy').textContent=win?'Vorath dikalahkan. Kisah Aelith baru dimulai.':'Bahkan cahaya dapat menyala kembali.';
    $('endScore').textContent=score.toLocaleString('id-ID');$('endKills').textContent=kills;$('endTime').textContent=clock(time);
    $('endOverlay').classList.remove('hidden');$('bestScore').textContent=best.toLocaleString('id-ID');updateHud();
  }
  function pause() {
    if(mode==='playing'){mode='paused';keys.clear();pointer.held=false;releaseStick();$('pauseOverlay').classList.remove('hidden');}
    else if(mode==='paused'){mode='playing';$('pauseOverlay').classList.add('hidden');}
  }
  function upgrade(choice) {
    if(mode!=='upgrade')return;
    if(choice==='power')player.power*=1.2;
    if(choice==='vitality'){player.maxHp+=40;}
    if(choice==='spirit'){player.regen*=1.4;player.mana=100;}
    pendingUpgrades--;mode='playing';$('upgradeOverlay').classList.add('hidden');
    burst(player.x,player.y,'#d8c68f',30,100);beep(440,.25,'sine',.04,880);updateHud();
  }

  function insideSlam(e,point=player){return Math.hypot(point.x-e.slamX,(point.y-e.slamY)/.65)<e.slamRadius+12;}
  function beginSlam(e,radius,damage,duration){
    e.tell=e.tellDuration=duration;e.slamRadius=radius;e.slamDamage=damage;
    // Lock the warning to this position: moving out really avoids the impact.
    e.slamX=player.x;e.slamY=player.y;
  }
  function autoBattle() {
    if(!oneFinger||mode!=='playing')return;
    const cd=player.cooldowns;
    // Assist the chosen movement direction; never dodge for an idle player.
    const steering=Math.hypot(stick.x,stick.y)>.1||['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].some(k=>keys.has(k));
    const danger=enemies.find(e=>e.hp>0&&e.tell>0&&e.tell<.25&&insideSlam(e));
    if(danger&&cd.dash<=0&&steering){
      action('dash');return;
    }
    if(player.animation)return;
    const active=enemies.filter(e=>e.hp>0&&e.spawn<=0);
    const target=active.reduce((best,e)=>!best||distance(player,e)<distance(player,best)?e:best,null);
    if(!target)return;
    const d=distance(player,target),a=Math.atan2(target.y-player.y,target.x-player.x);
    const nearby=active.filter(e=>distance(player,e)<190+e.r);
    if(cd.nova<=0&&player.mana>=35&&(nearby.length>=3||nearby.some(e=>e.type==='boss')||(player.hp<player.maxHp*.5&&nearby.length))){action('nova',a);return;}
    if(cd.blade<=0&&player.mana>=25&&d<420&&(d>112+target.r||target.type==='boss')){action('blade',a);return;}
    if(cd.attack<=0&&d<112+target.r)action('attack',a);
  }
  function update(dt) {
    time+=dt;player.invincible=Math.max(0,player.invincible-dt);player.dashTime=Math.max(0,player.dashTime-dt);
    if(player.animation){player.animation.elapsed+=dt;if(player.animation.elapsed>=player.animation.duration)player.animation=null;}
    for(const k in player.cooldowns)player.cooldowns[k]=Math.max(0,player.cooldowns[k]-dt);
    player.mana=Math.min(100,player.mana+player.regen*dt);
    let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x;
    let dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+stick.y;
    const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}
    if(len<=.1){dx=0;dy=0;}
    if(player.dashTime>0){dx=player.dashX*3.8;dy=player.dashY*3.8;burst(player.x,player.y-22,'#87d4de',2,20);}
    else if(len>.1){player.angle=Math.atan2(dy,dx);if(Math.abs(dx)>.05)player.face=dx>0?1:-1;}
    const oldX=player.x,oldY=player.y;
    player.x=clamp(player.x+dx*player.speed*dt,ARENA.minX,ARENA.maxX);player.y=clamp(player.y+dy*player.speed*dt,ARENA.minY,ARENA.maxY);
    const traveled=Math.hypot(player.x-oldX,player.y-oldY);
    player.moving=traveled>.001;player.walk+=dt*(player.moving?12:2);
    // Distance drives the gait, so slow joystick motion and diagonal movement
    // keep the same stride length. A wall or released input stops the feet.
    if(!player.moving)player.stride=0;
    else if(player.dashTime<=0)player.stride=(player.stride+traveled/130)%1;
    if(oneFinger)autoBattle();
    else if(keys.has('j')||pointer.held)action('attack');
    for(const e of enemies){
      if(e.hp<=0)continue;
      e.hit=Math.max(0,e.hit-dt);e.spawn=Math.max(0,e.spawn-dt);e.stun=Math.max(0,e.stun-dt);e.phase+=dt*3;
      if(e.spawn>0)continue;
      const dist=distance(e,player),a=Math.atan2(player.y-e.y,player.x-e.x);
      if(e.tell>0){
        e.tell-=dt;
        if(e.tell<=0){effects.push({type:'impact',x:e.slamX,y:e.slamY,life:.6,max:.6,reach:e.slamRadius});burst(e.slamX,e.slamY,'#dc9b7c',30,150);if(insideSlam(e))hurtPlayer(e.slamDamage);shake=5;}
        continue;
      }
      if(e.stun>0)continue;
      let desired=e.type==='caster'?285:e.r+14;
      if(dist>desired){e.x+=Math.cos(a)*e.speed*dt;e.y+=Math.sin(a)*e.speed*dt;}
      if(e.type==='caster'&&dist<145){e.x-=Math.cos(a)*e.speed*dt;e.y-=Math.sin(a)*e.speed*dt;}
      e.attack-=dt;e.cast-=dt;
      if(dist<e.r+30&&e.attack<=0){hurtPlayer(e.damage);e.attack=e.type==='boss'?1.5:1.1;}
      if(e.type==='caster'&&e.cast<=0&&dist<460){projectiles.push({x:e.x,y:e.y-15,vx:Math.cos(a)*185,vy:Math.sin(a)*185,life:4,r:9,friendly:false,damage:e.damage});beginSlam(e,72,24+wave*2,.9);e.cast=3.4;}
      if(e.type==='brute'&&e.cast<=0&&dist<230){beginSlam(e,88,30+wave*2,.8);e.cast=3.5;}
      if(e.type==='boss'&&e.cast<=0&&dist<420){
        beginSlam(e,135,48,1.05);e.cast=e.hp<e.maxHp*.5?2.5:3.5;
        if(e.hp<e.maxHp*.5){for(let i=0;i<8;i++){const angle=i*TAU/8+time;projectiles.push({x:e.x,y:e.y-20,vx:Math.cos(angle)*140,vy:Math.sin(angle)*140,life:3.5,r:10,friendly:false,damage:17});}}
      }
      e.x=clamp(e.x,ARENA.minX,ARENA.maxX);e.y=clamp(e.y,ARENA.minY,ARENA.maxY);
    }
    // Separate bodies to keep a surrounding horde readable and avoid stacking.
    for(let i=0;i<enemies.length;i++)for(let j=i+1;j<enemies.length;j++){
      const a=enemies[i],b=enemies[j],d=distance(a,b),min=(a.r+b.r)*.78;
      if(d>0&&d<min){const push=(min-d)*.5,x=(a.x-b.x)/d*push,y=(a.y-b.y)/d*push;a.x+=x;a.y+=y;b.x-=x;b.y-=y;}
    }
    for(const e of enemies){e.x=clamp(e.x,ARENA.minX,ARENA.maxX);e.y=clamp(e.y,ARENA.minY,ARENA.maxY);}
    for(const p of projectiles){
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
      if(p.friendly){for(const e of enemies)if(e.hp>0&&!p.hit.has(e)&&Math.hypot(e.x-p.x,e.y-12-p.y)<e.r+p.r){p.hit.add(e);hurtEnemy(e,p.damage,p.vx*.035,p.vy*.035);}}
      else if(Math.hypot(player.x-p.x,player.y-18-p.y)<p.r+18){hurtPlayer(p.damage);p.life=0;burst(p.x,p.y,'#dc977e',8,50);}
    }
    projectiles=projectiles.filter(p=>p.life>0&&p.x>-50&&p.x<WORLD.width+50&&p.y>-50&&p.y<WORLD.height+50);
    enemies=enemies.filter(e=>e.hp>0);
    for(const l of loot){
      const d=distance(l,player);
      if(l.type!=='health'&&d<110){const a=Math.atan2(player.y-l.y,player.x-l.x);l.x+=Math.cos(a)*230*dt;l.y+=Math.sin(a)*230*dt;}
      if(d<24&&(l.type!=='health'||player.hp<player.maxHp)){l.collected=true;if(l.type==='health'){player.hp=Math.min(player.maxHp,player.hp+24);floatText(player.x,player.y-60,'+24 HP','#b6e1a2',13);}else{player.mana=Math.min(100,player.mana+22);floatText(player.x,player.y-60,'+22 MP','#a2dcea',13);}beep(650,.09,'sine',.015,900);}
    }
    loot=loot.filter(l=>!l.collected);
    if(mode!=='playing')return;
    if(comboUntil<time)combo=0;
    if(announceUntil<time)$('announcement').classList.remove('show');
    if(!enemies.length){
      if(wave===5){finish(true);return;}
      if(waveDelay<0){waveDelay=3;player.mana=100;announce('GELOMBANG SELESAI','Mana penuh · Ambil orb hijau untuk pulihkan HP');}
      else {waveDelay-=dt;if(waveDelay<=0)nextWave();}
    }
    if(pendingUpgrades>0){mode='upgrade';keys.clear();pointer.held=false;releaseStick();$('upgradeOverlay').classList.remove('hidden');}
    updateHud();
  }
  function updateHud() {
    $('hpFill').style.width=`${player.hp/player.maxHp*100}%`;$('hpText').textContent=`${Math.ceil(player.hp)} / ${player.maxHp}`;
    $('manaFill').style.width=`${player.mana}%`;$('manaText').textContent=`${Math.floor(player.mana)} / 100`;
    $('xpFill').style.width=`${player.xp/player.nextXp*100}%`;$('level').textContent=player.level;
    $('score').textContent=score.toLocaleString('id-ID');$('timer').textContent=clock(time);$('potions').textContent=player.potions;
    $('waveText').textContent=`GELOMBANG ${String(wave||1).padStart(2,'0')} / 05`;
    $('enemyText').textContent=mode==='intro'?'Menanti kesatria':`${enemies.length} musuh tersisa`;
    $('objectiveText').textContent=wave===5?'Kalahkan Vorath, The Hollow King':'Bertahan di Forsaken Sanctum';
    $('combo').innerHTML=combo>=3?`${combo}<small>HIT COMBO</small>`:'';
    const boss=enemies.find(e=>e.type==='boss');if(boss)$('bossFill').style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;
    const total={attack:.46,dash:1.65,nova:7,blade:3.5,potion:1};
    for(const b of skillButtons){const a=b.dataset.action,n=player.cooldowns[a];b.querySelector('i').style.height=`${n/total[a]*100}%`;b.classList.toggle('cooling',n>.1&&a!=='attack');b.dataset.cooldown=n.toFixed(1);b.classList.toggle('unavailable',(a==='nova'&&player.mana<35)||(a==='blade'&&player.mana<25)||(a==='potion'&&!player.potions));}
  }
  function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=color;ctx.fill();}
  function polygon(points,fill,stroke){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  const floor=document.createElement('canvas');floor.width=WORLD.width;floor.height=WORLD.height;
  function drawEnvironment() {
    const c=floor.getContext('2d');
    c.fillStyle='#14282f';c.fillRect(0,0,WORLD.width,WORLD.height);
    c.fillStyle='#111f26';c.fillRect(80,180,2400,1130);
    c.fillStyle='#304348';c.fillRect(105,205,2350,1090);
    c.fillStyle='#23373b';c.fillRect(120,220,2320,1050);
    c.save();c.beginPath();c.rect(120,220,2320,1050);c.clip();
    for(let y=220;y<1270;y+=43)for(let x=60;x<2500;x+=105){
      const row=Math.floor(y/43),xx=x+(row%2)*52;
      c.fillStyle=`rgba(65,85,87,${.13+row%4*.035})`;c.fillRect(xx+2,y+2,101,39);
      c.strokeStyle='#07151d60';c.strokeRect(xx,y,105,43);
      c.strokeStyle='#7f92901c';c.beginPath();c.moveTo(xx+3,y+2);c.lineTo(xx+101,y+2);c.stroke();
    }
    for(const d of decorations){
      c.strokeStyle=d.type<.5?'#07161d55':'#79916b33';c.beginPath();c.moveTo(d.x,d.y);c.lineTo(d.x+d.r*6,d.y+5);c.lineTo(d.x+d.r*9,d.y+2);c.stroke();
    }
    for(const [x,y,size] of [[WORLD.cx,WORLD.cy,240],[620,500,100],[1940,500,100],[620,1030,100],[1940,1030,100]]){
      for(const r of [size,size-10,size*.78]){c.beginPath();c.ellipse(x,y,r,r*.57,0,0,TAU);c.strokeStyle='#9aac8b38';c.stroke();}
      for(let i=0;i<12;i++){const a=i*TAU/12;c.save();c.translate(x+Math.cos(a)*(size-24),y+Math.sin(a)*(size-24)*.57);c.rotate(a);c.strokeStyle='#b7b88b55';c.strokeRect(-4,-4,8,8);c.restore();}
      c.beginPath();c.moveTo(x,y-45);c.lineTo(x+40,y);c.lineTo(x,y+45);c.lineTo(x-40,y);c.closePath();c.stroke();
    }
    c.restore();c.strokeStyle='#95ac9360';c.lineWidth=2;c.strokeRect(160,290,2240,900);
    // Boundary stones make the larger world's edges readable without scaling its tiles.
    for(let x=120;x<2440;x+=80)for(const y of [240,1250]){c.fillStyle='#3a5053';c.fillRect(x,y,70,12);c.strokeStyle='#7f929044';c.strokeRect(x,y,70,12);}
  }
  function drawPillar(x,y){
    ellipse(x+18,y+5,51,17,'#030e1660');
    polygon([[x-32,y],[x,y+17],[x+34,y],[x,y-18]],'#536264','#8b96824d');
    polygon([[x-32,y],[x,y+17],[x,y+29],[x-32,y+11]],'#26383e');polygon([[x,y+17],[x+34,y],[x+34,y+11],[x,y+29]],'#192d35');
    polygon([[x-21,y-9],[x-21,y-96],[x,y-106],[x,y+2]],'#435456','#697b7855');
    polygon([[x,y+2],[x,y-106],[x+22,y-96],[x+22,y-9]],'#263a40');
    polygon([[x-26,y-97],[x,y-111],[x+27,y-98],[x,y-85]],'#61706b','#84918555');
    ctx.strokeStyle='#182d3466';ctx.beginPath();ctx.moveTo(x-10,y-90);ctx.lineTo(x-4,y-64);ctx.lineTo(x-12,y-35);ctx.stroke();
    polygon([[x-15,y-103],[x,y-112],[x+16,y-103],[x,y-95]],'#182b33');
  }
  // Cache the static scene, keeping the per-frame rendering light.
  drawEnvironment();
  function drawLights(){
    for(const p of pillars){
      drawPillar(p.x,p.y);
      const y=p.y-117,fl=.85+Math.sin(ambientTime*7+p.x)*.1;
      glow(p.x,y,85*fl,'#78dce432');glow(p.x,y,24,'#9ef6eb70');
      polygon([[p.x-8,y+10],[p.x-5,y-6],[p.x+1,y-22-fl*5],[p.x+7,y-3],[p.x+6,y+10]],'#8ed6d5');
      polygon([[p.x-3,y+8],[p.x,y-14],[p.x+4,y+7]],'#d3f8df');
    }
    for(let i=0;i<22;i++){
      const x=(i*113+Math.sin(ambientTime*.3+i)*45+WORLD.width)%WORLD.width,y=(i*131-ambientTime*(3+i%3)+WORLD.height*100)%WORLD.height;
      ellipse(x,y,1.2,1.2,`rgba(174,218,210,${.15+Math.sin(ambientTime+i)*.12})`);
    }
    const fog=ctx.createLinearGradient(0,0,W,0);fog.addColorStop(0,'#aac5c109');fog.addColorStop(.5,'#718e9800');fog.addColorStop(1,'#aac5c10c');ctx.fillStyle=fog;ctx.fillRect(0,180+Math.sin(ambientTime*.2)*25,W,210);
  }
  function drawHero() {
    const p=player,pose=heroPose();
    ellipse(p.x,p.y+3,25,9,'#020e17a0');glow(p.x,p.y-4,47,'#94ddec19');
    ctx.save();ctx.translate(p.x+pose.x,p.y+pose.y);ctx.scale(pose.face,1);
    if(oneFinger)ctx.scale(.9,.9);
    ctx.rotate(pose.rotation);ctx.scale(pose.sx,pose.sy);
    if(p.invincible>0&&Math.floor(ambientTime*18)%2)ctx.globalAlpha=.5;
    const walking=pose.atlas==='walk'&&heroWalk.complete&&heroWalk.naturalWidth>0;
    const atlas=walking?heroWalk:heroActions;
    const spriteFrame=walking||pose.atlas==='action'?pose.frame:0;
    if(atlas.complete&&atlas.naturalWidth){
      const cw=atlas.naturalWidth/4,ch=atlas.naturalHeight/2;
      // Match body scale and foot baseline across the illustrated keyframes;
      // the overhead sword occupies extra space in the nova charging cell.
      const size=walking?136:[176,176,176,176,176,216,176,194][spriteFrame];
      const footX=walking?.57:[.52,.53,.44,.53,.49,.52,.50,.45][spriteFrame];
      const footY=walking?(spriteFrame<4?.98:.96):spriteFrame<4?.94:.85;
      const sx=(spriteFrame%4)*cw,sy=Math.floor(spriteFrame/4)*ch;
      const draw=(offset=0)=>ctx.drawImage(atlas,sx,sy,cw,ch,-size*footX+offset,-size*footY,size,size);
      if(pose.trail>0){
        ctx.save();const opacity=ctx.globalAlpha;
        for(let i=2;i>=1;i--){ctx.globalAlpha=opacity*pose.trail/i;draw(-i*17);}
        ctx.restore();
      }
      draw();
    }else if(heroImage.complete&&heroImage.naturalWidth){
      const size=146;ctx.drawImage(heroImage,-size*.5,-size*.96,size,size);
    }else{
      // Native vector fallback also keeps the game usable before its art loads.
      polygon([[-12,-71],[-21,-37],[-26,0],[-3,-12],[23,0],[15,-61]],'#c2d0df','#e5e7e4');
      polygon([[-10,-35],[-12,-5],[-5,-3],[0,-32]],'#1d3048','#a89461');polygon([[3,-35],[6,-3],[13,-3],[11,-36]],'#1d3048','#a89461');
      polygon([[-13,-57],[12,-57],[10,-40],[20,-24],[-19,-24],[-10,-41]],'#22344f','#a99b70');
      ellipse(0,-70,12,14,'#eed2bd');polygon([[-13,-67],[-14,-81],[0,-87],[14,-80],[14,-59],[5,-76],[-7,-76]],'#e1e2e6');
      ellipse(-14,-55,8,6,'#354153');ellipse(14,-55,8,6,'#354153');
      ctx.strokeStyle='#a7e8ee';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(16,-42);ctx.lineTo(51,-68);ctx.stroke();ctx.lineWidth=1;
    }
    ctx.restore();
    if(mode!=='intro'){ctx.fillStyle='#cbdcdb';ctx.font='8px Manrope, Arial';ctx.textAlign='center';ctx.fillText('A E L I T H',p.x,p.y-145);}
  }
  function drawEnemy(e){
    const isBoss=e.type==='boss',isBrute=e.type==='brute',isCaster=e.type==='caster';
    const s=isBoss?2:isBrute?1.3:1,bob=Math.sin(e.phase)*2;
    ctx.save();ctx.translate(e.x,e.y);ctx.scale(s,s);ctx.globalAlpha=e.spawn>0?1-e.spawn*.8:1;
    ellipse(0,3,22,8,'#030a1299');
    const armor=e.hit>0?'#d9e7df':isBoss?'#524a4b':isBrute?'#4c5556':isCaster?'#405065':'#344b50';
    if(isCaster){glow(0,-25,43,'#ac83ce19');polygon([[-8,-52],[-21,0],[1,-5],[18,0],[9,-52]],armor,'#80969b70');}
    else{
      polygon([[-12,-24],[-16,0],[-7,2],[-2,-22]],'#24363f','#74878855');polygon([[4,-25],[5,1],[14,2],[12,-28]],'#24363f','#74878855');
      polygon([[-17,-50],[-20,-26],[0,-17],[18,-26],[15,-51]],armor,'#82939288');
      polygon([[-21,-49],[-26,-35],[-12,-36],[-10,-49]],armor,'#8a9b9366');polygon([[12,-49],[24,-44],[23,-32],[13,-36]],armor,'#8a9b9366');
    }
    polygon([[-11,-59+bob],[-7,-70+bob],[6,-72+bob],[13,-61+bob],[9,-48+bob],[-8,-47+bob]],armor,'#83958d66');
    if(isBoss){polygon([[-12,-65],[-16,-85],[-5,-74],[0,-92],[6,-75],[17,-84],[12,-62]],'#918166','#c5ac76');}
    ctx.fillStyle=isCaster?'#c4a4e6':'#e6b58c';ctx.fillRect(-7,-59+bob,5,2);ctx.fillRect(3,-59+bob,5,2);
    glow(0,-58+bob,16,isCaster?'#c898e144':'#ee996933');
    ctx.strokeStyle='#766f5b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(19,-37);ctx.lineTo(29,-5);ctx.stroke();
    if(isCaster){ctx.strokeStyle='#696c72';ctx.beginPath();ctx.moveTo(25,-5);ctx.lineTo(25,-59);ctx.stroke();glow(25,-62,17,'#ad88e580');ellipse(25,-62,4,6,'#cdb1ed');}
    else{polygon([[27,-21],[19,-57],[25,-71],[33,-23]],isBoss?'#a2aaa3':'#849492','#b8c3b266');}
    if(e.stun>.3){ctx.strokeStyle='#9bddf3';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,-76,17,5,e.phase,0,TAU);ctx.stroke();}
    if(e.hp<e.maxHp&&!isBoss){ctx.fillStyle='#091820';ctx.fillRect(-19,-84,38,3);ctx.fillStyle='#bd8f7e';ctx.fillRect(-19,-84,38*Math.max(0,e.hp/e.maxHp),3);}
    ctx.restore();
  }
  function drawEffects(dt){
    for(const e of effects){
      const t=1-e.life/e.max;ctx.save();ctx.globalAlpha=1-t;
      if(e.type==='slash'){
        ctx.translate(e.x,e.y);ctx.rotate(e.angle);ctx.scale(1,.75);
        ctx.beginPath();ctx.arc(0,0,e.reach*(.6+t*.4),-.95+t*.7,1.05+t*.6);
        ctx.strokeStyle=e.step===2?'#e1e5bb':'#b5f4f5';ctx.lineWidth=(1-t)*13;ctx.shadowBlur=22;ctx.shadowColor='#7de5f1';ctx.stroke();
        ctx.beginPath();ctx.arc(0,0,e.reach*.8,-.8+t*.6,1+t*.6);ctx.lineWidth=2;ctx.stroke();
      }else{
        const r=e.reach*Math.min(1,t*1.8);ctx.beginPath();ctx.ellipse(e.x,e.y,r,r*.65,0,0,TAU);ctx.strokeStyle=e.type==='nova'?'#9ce8ef':'#dea084';ctx.lineWidth=5*(1-t);ctx.stroke();glow(e.x,e.y,r,e.type==='nova'?'#88d5ed25':'#e19c7530');
        if(e.type==='nova')for(let i=0;i<12;i++){const a=i*TAU/12;polygon([[e.x+Math.cos(a)*r,e.y+Math.sin(a)*r*.65],[e.x+Math.cos(a+.05)*r*.7,e.y+Math.sin(a+.05)*r*.45-25],[e.x+Math.cos(a+.1)*r*.75,e.y+Math.sin(a+.1)*r*.65]],'#a1e4ef88');}
      }
      ctx.restore();if(mode==='playing')e.life-=dt;
    }
    effects=effects.filter(e=>e.life>0);
  }
  function cameraView(){
    const rect=canvas.getBoundingClientRect();
    const cover=getComputedStyle(canvas).objectFit==='cover';
    const cssScale=cover?Math.max(rect.width/W,rect.height/H):Math.min(rect.width/W,rect.height/H);
    // Keep at least 650 world units across a phone, rather than enlarging
    // characters to fill its height. HUD sizes remain independent of the world.
    const zoom=oneFinger?Math.min(1,Math.min(rect.width/650,.72)/cssScale):1;
    const visibleWidth=rect.width/cssScale,left=(W-visibleWidth)/2,right=(W+visibleWidth)/2;
    const visibleHeight=rect.height/cssScale,top=(H-visibleHeight)/2,bottom=(H+visibleHeight)/2;
    const x=WORLD.width*zoom<=visibleWidth?(W-WORLD.width*zoom)/2:clamp(W/2-player.x*zoom,right-WORLD.width*zoom,left);
    const y=WORLD.height*zoom<=visibleHeight?(H-WORLD.height*zoom)/2:clamp(H/2-player.y*zoom,bottom-WORLD.height*zoom,top);
    return {zoom,x,y,cssScale,visibleWidth,visibleHeight};
  }
  function render(dt){
    ctx.clearRect(0,0,W,H);
    if(oneFinger){ctx.fillStyle='#14282f';ctx.fillRect(0,0,W,H);}
    const view=cameraView();ctx.save();
    ctx.translate(view.x,view.y);ctx.scale(view.zoom,view.zoom);
    if(shake>0){ctx.translate(rand(-shake,shake),rand(-shake,shake));shake=Math.max(0,shake-dt*30);}
    ctx.drawImage(floor,0,0);drawLights();
    for(const e of enemies)if(e.tell>0){const r=e.slamRadius,progress=clamp(1-e.tell/e.tellDuration,0,1);ctx.beginPath();ctx.ellipse(e.slamX,e.slamY,r,r*.65,0,0,TAU);ctx.fillStyle=`rgba(205,107,78,${.2+Math.sin(ambientTime*15)*.05})`;ctx.fill();ctx.strokeStyle='#f1a38b';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.ellipse(e.slamX,e.slamY,r*progress,r*.65*progress,0,0,TAU);ctx.stroke();ctx.lineWidth=1;}
    for(const l of loot){const y=l.y+Math.sin(ambientTime*3+l.phase)*4;glow(l.x,y,25,l.type==='health'?'#b0d7a133':'#8ecee844');polygon([[l.x,y-6],[l.x+4,y],[l.x,y+6],[l.x-4,y]],l.type==='health'?'#c4e6ad':'#a3e6ec');}
    const actors=enemies.filter(e=>{const x=view.x+e.x*view.zoom,y=view.y+e.y*view.zoom;return x>-180&&x<W+180&&y>-180&&y<H+180;}).map(e=>({y:e.y,draw:()=>drawEnemy(e)}));actors.push({y:player.y,draw:drawHero});actors.sort((a,b)=>a.y-b.y);for(const a of actors)a.draw();
    for(const p of projectiles){
      glow(p.x,p.y,p.friendly?38:22,p.friendly?'#76e7ee55':'#d9917366');
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.strokeStyle=p.friendly?'#b6f6fa':'#e7b19a';ctx.lineWidth=p.friendly?5:3;ctx.beginPath();ctx.arc(-8,0,p.r,-1.1,1.1);ctx.stroke();ctx.restore();
    }
    drawEffects(dt);
    for(const p of particles){if(mode==='playing'){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.97;p.vy*=.97;}ctx.globalAlpha=Math.max(0,p.life/p.max);ellipse(p.x,p.y,p.size,p.size,p.color);}ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0);
    for(const t of texts){if(mode==='playing'){t.life-=dt;t.y-=dt*36;}ctx.globalAlpha=Math.min(1,Math.max(0,t.life*2));ctx.fillStyle=t.color;ctx.font=`600 ${t.size}px Georgia`;ctx.textAlign='center';ctx.shadowColor='#06131b';ctx.shadowBlur=5;ctx.fillText(t.text,t.x,t.y);ctx.shadowBlur=0;}ctx.globalAlpha=1;texts=texts.filter(t=>t.life>0);
    ctx.restore();
    if(player.hp<player.maxHp*.3&&mode==='playing'){const g=ctx.createRadialGradient(640,360,180,640,360,650);g.addColorStop(0,'transparent');g.addColorStop(1,`rgba(135,43,42,${.25+Math.sin(ambientTime*4)*.08})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
    drawMinimap();
  }
  function drawMinimap(){
    const sx=120/WORLD.width,sy=90/WORLD.height,v=cameraView();
    mapCtx.clearRect(0,0,120,90);mapCtx.strokeStyle='#78928f88';mapCtx.lineWidth=1;
    mapCtx.strokeRect(ARENA.minX*sx,ARENA.minY*sy,(ARENA.maxX-ARENA.minX)*sx,(ARENA.maxY-ARENA.minY)*sy);
    mapCtx.strokeStyle='#bdebf044';
    mapCtx.strokeRect(((W-v.visibleWidth)/2-v.x)/v.zoom*sx,((H-v.visibleHeight)/2-v.y)/v.zoom*sy,v.visibleWidth/v.zoom*sx,v.visibleHeight/v.zoom*sy);
    for(const e of enemies){mapCtx.fillStyle=e.type==='boss'?'#e0bc8b':'#bf8b7a';mapCtx.fillRect(e.x*sx-1,e.y*sy-1,e.type==='boss'?4:2,3);}
    mapCtx.fillStyle='#bdebf0';mapCtx.beginPath();mapCtx.arc(player.x*sx,player.y*sy,2.5,0,TAU);mapCtx.fill();
  }

  function pointerCoordinates(event){
    const r=canvas.getBoundingClientRect();
    const view=cameraView(),scale=view.cssScale;
    return {x:((event.clientX-r.left-(r.width-W*scale)/2)/scale-view.x)/view.zoom,y:((event.clientY-r.top-(r.height-H*scale)/2)/scale-view.y)/view.zoom};
  }
  canvas.addEventListener('pointermove',e=>{
    if(oneFinger){if(e.pointerId===gesture.id)moveStick(e);return;}
    Object.assign(pointer,pointerCoordinates(e));pointer.aiming=true;
  });
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||mode!=='playing')return;
    if(oneFinger){
      if(gesture.id!==null||e.isPrimary===false)return;
      gesture.id=e.pointerId;gesture.x=e.clientX;gesture.y=e.clientY;stick.active=true;
      canvas.setPointerCapture(e.pointerId);pointer.aiming=false;
      const r=$('game').getBoundingClientRect(),visual=$('touchControls');
      visual.style.left=`${e.clientX-r.left-48}px`;visual.style.top=`${e.clientY-r.top-48}px`;visual.style.bottom='auto';visual.classList.add('active');
      $('game').classList.add('steering');moveStick(e);return;
    }
    Object.assign(pointer,pointerCoordinates(e));pointer.aiming=true;pointer.held=true;canvas.setPointerCapture(e.pointerId);action('attack');
  });
  function endPointer(e){if(oneFinger){if(e.pointerId===gesture.id)releaseStick();}else pointer.held=false;}
  canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',endPointer);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
    if(key==='escape'){pause();return;}
    if(mode!=='playing')return;
    keys.add(key);if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key))pointer.aiming=false;
    if(!e.repeat){const actions={' ':'dash',q:'nova',e:'blade',j:'attack'};if(actions[key])action(actions[key]);}
  });
  document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>{keys.clear();pointer.held=false;if(mode==='playing')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
  $('startBtn').addEventListener('click',start);$('resumeBtn').addEventListener('click',pause);$('pauseBtn').addEventListener('click',pause);
  document.querySelectorAll('.restart').forEach(b=>b.addEventListener('click',start));
  document.querySelectorAll('[data-upgrade]').forEach(b=>b.addEventListener('click',()=>upgrade(b.dataset.upgrade)));
  skillButtons.forEach(b=>b.addEventListener('click',()=>{pointer.aiming=false;action(b.dataset.action);}));
  $('soundBtn').addEventListener('click',enableAudio);
  $('fullBtn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();}catch{toast('Layar penuh tidak tersedia di browser ini.');}});
  const joystick=$('joystick');
  function moveStick(e){
    const r=joystick.getBoundingClientRect();
    const dx=e.clientX-(oneFinger?gesture.x:r.left+r.width/2),dy=e.clientY-(oneFinger?gesture.y:r.top+r.height/2),len=Math.hypot(dx,dy),max=32;
    stick.x=dx/Math.max(max,len);stick.y=dy/Math.max(max,len);
    joystick.firstElementChild.style.transform=`translate(${stick.x*max}px,${stick.y*max}px)`;pointer.aiming=false;
  }
  joystick.addEventListener('pointerdown',e=>{stick.active=true;joystick.setPointerCapture(e.pointerId);moveStick(e);});
  joystick.addEventListener('pointermove',e=>{if(stick.active)moveStick(e);});
  function releaseStick(){
    const id=gesture.id;gesture.id=null;stick.active=false;stick.x=stick.y=0;
    if(id!==null&&canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);
    joystick.firstElementChild.style.transform='';
    const visual=$('touchControls');visual.classList.remove('active');visual.style.left='';visual.style.top='';visual.style.bottom='';$('game').classList.remove('steering');
  }
  joystick.addEventListener('pointerup',releaseStick);joystick.addEventListener('pointercancel',releaseStick);
  function configureControls(){
    oneFinger=Boolean(mobileQuery?.matches);releaseStick();keys.clear();pointer.held=false;pointer.aiming=false;
    $('game').classList.toggle('one-finger',oneFinger);
    for(const b of skillButtons)b.disabled=oneFinger;
    canvas.setAttribute('aria-label',oneFinger?'Arena pertarungan. Geser satu jari untuk bergerak. Serangan dan skill otomatis. Ambil orb hijau untuk memulihkan HP.':'Arena pertarungan. WASD bergerak, J menyerang, Spasi dash, Q dan E skill.');
  }
  configureControls();mobileQuery?.addEventListener('change',configureControls);
  // A narrow read-only snapshot makes smoke checks possible without altering the game.
  window.silverveil = Object.freeze({snapshot:()=>({mode,wave,score,kills,time,enemyCount:enemies.length,player:{x:player.x,y:player.y,hp:player.hp,mana:player.mana,level:player.level,potions:player.potions,action:player.animation?.type||(player.moving?'walk':'idle'),pose:heroPose().frame},heroLoaded:heroImage.complete&&heroImage.naturalWidth>0,actionsLoaded:heroActions.complete&&heroActions.naturalWidth>0,walkLoaded:heroWalk.complete&&heroWalk.naturalWidth>0})});
  let previous=performance.now();
  function frame(now){const dt=Math.min((now-previous)/1000,.04);previous=now;ambientTime+=dt;if(mode==='playing')update(dt);if(toastUntil<ambientTime)$('toast').classList.remove('show');render(dt);requestAnimationFrame(frame);}
  updateHud();requestAnimationFrame(frame);
})();
