const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
// Run the real game logic with a minimal canvas/DOM adapter. Test hooks are
// injected in memory only; the delivered browser game exposes no mutation API.
const gradient={addColorStop(){}};
const context=new Proxy({}, {get:(t,k)=>t[k]||(t[k]=k.startsWith('create')?()=>gradient:()=>{}),set:(t,k,v)=>(t[k]=v,true)});
const elements=new Map();
function element(id=''){
  if(elements.has(id))return elements.get(id);
  const classes=new Set();
  const e={id,style:{},dataset:{},textContent:'',innerHTML:'',listeners:{},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),toggle:(k,b)=>b?classes.add(k):classes.delete(k),contains:k=>classes.has(k)},getContext:()=>context,getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720}),addEventListener(k,f){this.listeners[k]=f;},setAttribute(){},replaceChildren(){},append(){},querySelector:()=>({style:{}}),setPointerCapture(){},firstElementChild:{style:{}}};
  elements.set(id,e);return e;
}
// Build skill controls from the delivered HTML, including non-action indicators.
// A missing cooldown node must behave like the browser (null), not a fake node.
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const skillNodes=[...html.matchAll(/<(button|div)\b([^>]*class="skill[^" ]*(?: [^"]*)?"[^>]*)>([\s\S]*?)<\/\1>/g)].map(([,tag,attrs,body],i)=>{
  const e=element(`skill-${i}`),action=attrs.match(/data-action="([^"]+)"/);
  if(action)e.dataset.action=action[1];
  e.querySelector=selector=>selector==='i'&&/<i[ >]/.test(body)?{style:{}}:null;
  return e;
});
const skills=skillNodes.filter(e=>e.dataset.action);
assert.equal(skills.length,4,'HTML has four combat buttons');
assert(skillNodes.some(e=>!e.dataset.action),'HTML includes a passive pickup indicator');

const overlays=['intro','pauseOverlay','upgradeOverlay','endOverlay'].map(element);
const listeners={},storage={};let frame;
const document={getElementById:element,createElement:()=>element(`created-${elements.size}`),createTextNode:()=>({}),querySelectorAll:s=>s==='.skill'?skillNodes:s==='.skill[data-action]'?skills:s==='.overlay'?overlays:[],addEventListener:(k,f)=>listeners[k]=f};
const media={matches:false,addEventListener:(type,fn)=>media.change=fn};
const sandbox={document,window:{addEventListener(){},matchMedia:()=>media},localStorage:{getItem:k=>storage[k],setItem:(k,v)=>storage[k]=v},Image:class{complete=false;naturalWidth=0;},performance:{now:()=>0},requestAnimationFrame:f=>frame=f,getComputedStyle:()=>({objectFit:'contain'}),console,Math};
const hook=`window.test={WORLD,ARENA,WAVE_COUNTS,waveSpawnPoint,loot:()=>loot,start,update,action,pause,upgrade,hurtPlayer,hurtEnemy,nextWave,render,drawHero,heroPose,heroActions,heroWalk,heroDirections,heroDirectionalAttack,updateFacing,turnDelta,autoBattle,cameraView,pointerCoordinates,beginSlam,insideSlam,keys,stick,gesture,player:()=>player,enemies:()=>enemies,projectiles:()=>projectiles,setTime:n=>time=n,setWave:n=>wave=n,getPending:()=>pendingUpgrades,clearVisuals:()=>{particles=[];effects=[];texts=[];}};`;
const source=fs.readFileSync(require('node:path').join(__dirname,'../game.js'),'utf8').replace('  // A narrow read-only snapshot',hook+'\n  // A narrow read-only snapshot');
vm.runInNewContext(source,sandbox);const t=sandbox.window.test,snap=sandbox.window.silverveil.snapshot;
t.start();assert.equal(snap().mode,'playing');assert.equal(snap().enemyCount,12);
const x=t.player().x;t.keys.add('d');t.update(.1);t.keys.clear();assert(t.player().x>x,'movement');
let e=t.enemies()[0];e.x=t.player().x+55;e.y=t.player().y;const hp=e.hp;t.action('attack');assert(e.hp<hp,'sword hit');const after=e.hp;t.action('attack');assert.equal(e.hp,after,'cooldown blocks repeated attack');
t.player().mana=100;t.action('nova');assert.equal(t.player().mana,65);assert(e.stun>0,'nova stun');t.action('nova');assert.equal(t.player().mana,65,'nova cooldown');
t.player().mana=10;t.action('blade');assert.equal(t.projectiles().length,0,'insufficient mana');t.player().mana=100;t.action('blade');assert.equal(t.projectiles().length,1);assert.equal(t.player().mana,75);
t.player().invincible=0;t.action('dash');const hpBefore=t.player().hp;t.hurtPlayer(20);assert.equal(t.player().hp,hpBefore,'dash invulnerability');
t.player().invincible=0;t.hurtPlayer(40);t.action('potion');assert.equal(t.player().hp,140,'potion cannot heal');assert.equal(t.player().potions,0);
t.pause();assert.equal(snap().mode,'paused');const frozen=snap().time;frame(100);assert.equal(snap().time,frozen,'paused simulation does not tick');t.pause();assert.equal(snap().mode,'playing');
t.start();for(const enemy of t.enemies())t.hurtEnemy(enemy,10000);t.update(.016);assert.equal(snap().mode,'upgrade','level-up choice');const power=t.player().power;t.upgrade('power');assert(t.player().power>power);while(snap().mode==='upgrade')t.upgrade('power');for(let i=0;i<90;i++){if(snap().mode==='upgrade')t.upgrade('power');t.update(.04);}assert.equal(snap().wave,2,'next wave after clear');
t.start();t.setWave(4);for(const enemy of t.enemies())enemy.hp=0;t.update(.01);t.nextWave();assert.equal(snap().wave,5);const boss=t.enemies().find(e=>e.type==='boss');assert(boss&&boss.hp===1900,'boss spawned');boss.x=t.player().x+130;boss.y=t.player().y;boss.cast=0;boss.spawn=0;t.update(.02);assert(boss.tell>0,'boss telegraph');t.render(.016);
for(const enemy of t.enemies())t.hurtEnemy(enemy,10000);t.update(.016);assert.equal(snap().mode,'victory');assert(Number(storage['silverveil-best'])>2000,'best score saved');
t.start();t.player().invincible=0;t.hurtPlayer(9999);assert.equal(snap().mode,'dead');t.start();assert.equal(snap().player.hp,180);assert.equal(snap().score,0);assert.equal(snap().wave,1);
listeners.keydown({key:' ',repeat:false,preventDefault(){},target:{closest:()=>element('startBtn')}});assert(t.player().dashTime>0,'space dashes even when Start retains focus');
console.log('PASS: movement, sword/cooldown, mana, nova/stun, projectile, dash immunity, potion, pause, upgrade, wave progression, boss telegraph, victory/save, defeat/restart.');

// Exercise real rendering calls, as well as action timers: a changing effect
// alone must not pass this regression test for a motionless hero sprite.
const draws=[];context.drawImage=(...args)=>draws.push(args);
t.heroActions.complete=true;t.heroActions.naturalWidth=2048;t.heroActions.naturalHeight=1024;
function renderedCell(){draws.length=0;t.drawHero();const call=draws.findLast(args=>args[0]===t.heroActions);assert(call,'action atlas is rendered');return call[1]/512+call[2]/512*4;}
t.start();assert.equal(renderedCell(),0);
t.action('attack');assert.equal(renderedCell(),1,'sword windup');t.update(.08);assert.equal(renderedCell(),2,'sword swing');t.update(.12);assert.equal(renderedCell(),3,'follow through');t.update(.11);assert.equal(renderedCell(),0,'return to ready');
t.action('nova');assert.equal(renderedCell(),5,'raise sword for nova');const cast=t.player().animation;t.keys.add('j');t.keys.add('d');const castX=t.player().x;t.update(.24);assert.equal(renderedCell(),6,'ground slam');assert.equal(t.player().animation,cast,'held attack cannot overwrite cast');assert(t.player().x>castX,'movement during cast');t.keys.clear();
t.pause();const elapsed=cast.elapsed;frame(200);assert.equal(cast.elapsed,elapsed,'paused animation');assert.equal(renderedCell(),6);t.pause();t.update(.42);assert.equal(renderedCell(),0);
t.player().mana=100;t.action('blade');t.update(.1);assert.equal(renderedCell(),7,'blade thrust');t.action('dash');assert.equal(renderedCell(),4,'dash interrupts casting immediately');t.update(.26);assert.equal(renderedCell(),0);
t.start();t.player().mana=0;t.action('nova');assert.equal(t.player().animation,null,'failed skill does not animate');t.player().mana=100;t.action('nova');t.update(.1);const active=t.player().animation;t.action('nova');assert.equal(t.player().animation,active,'cooldown does not restart animation');assert.equal(active.elapsed,.1);t.start();assert.equal(renderedCell(),0,'restart clears pose');
console.log('PASS: rendered attack/cast/dash frames, recovery, movement during casts, held attack priority, pause, mana/cooldown rejection, animation reset.');

t.heroWalk.complete=true;t.heroWalk.naturalWidth=2048;t.heroWalk.naturalHeight=1024;
function renderedWalkCell(){draws.length=0;t.drawHero();const call=draws.findLast(args=>args[0]===t.heroWalk);assert(call,'walk atlas is rendered, not the static ready pose');return call[1]/512+call[2]/512*4;}
t.start();t.keys.add('d');const walkFrames=new Set();for(let i=0;i<8;i++){t.update(.08125);walkFrames.add(renderedWalkCell());}assert.equal(walkFrames.size,8,'all gait frames appear over a stride');assert.equal(t.heroPose().face,1);
t.pause();const frozenStride=t.player().stride,frozenCell=renderedWalkCell();frame(300);assert.equal(t.player().stride,frozenStride);assert.equal(renderedWalkCell(),frozenCell,'walk freezes while paused');t.pause();t.update(.02);assert.equal(renderedCell(),0,'releasing controls returns to ready');
t.keys.add('a');t.update(.1);assert.equal(t.heroPose().face,-1,'left movement mirrors gait');renderedWalkCell();t.action('attack');assert.equal(renderedCell(),1,'attack has priority over walk');t.update(.31);renderedWalkCell();t.action('nova');assert.equal(renderedCell(),5,'cast has priority over walk');t.update(.66);renderedWalkCell();t.action('dash');assert.equal(renderedCell(),4,'dash has priority over walk');t.update(.26);renderedWalkCell();
t.start();t.keys.add('d');t.update(.1);const straightStride=t.player().stride;t.start();t.keys.add('d');t.keys.add('s');t.update(.1);assert(Math.abs(t.player().stride-straightStride)<1e-10,'diagonal gait matches normalized speed');
t.start();t.stick.x=.25;t.update(.1);assert(Math.abs(t.player().stride-straightStride*.25)<1e-10,'joystick gait follows actual speed');renderedWalkCell();t.stick.x=0;t.update(.01);assert.equal(renderedCell(),0,'joystick release stops steps');t.stick.x=.05;const stillX=t.player().x;t.update(.1);assert.equal(t.player().x,stillX,'joystick deadzone');assert.equal(renderedCell(),0);
t.start();t.player().x=t.ARENA.maxX;t.keys.add('d');t.update(.1);assert.equal(t.player().moving,false,'blocked movement does not walk in place');assert.equal(renderedCell(),0);t.start();t.keys.add('d');t.update(.1);t.heroWalk.complete=false;assert.equal(renderedCell(),0,'missing walk art falls back to ready, not attack cells');t.heroWalk.complete=true;t.start();assert.equal(t.player().stride,0);assert.equal(renderedCell(),0);
console.log('PASS: eight rendered walk frames, facing, keyboard/joystick gait, release/deadzone/walls, diagonal speed, pause, action priority/resume, fallback, restart.');

// A phone requires only movement gestures; combat decisions are state-driven.
media.matches=true;media.change();assert(element('game').classList.contains('one-finger'));assert(skills.filter(b=>b.dataset.action!=='attack').every(b=>!b.disabled),'manual skills enabled on mobile');
function mobileScene(){t.start();for(const e of t.enemies()){e.x=t.ARENA.maxX;e.y=t.ARENA.maxY;e.spawn=0;e.hp=e.maxHp=1000;}}
mobileScene();let target=t.enemies()[0];target.x=t.player().x+70;target.y=t.player().y;t.autoBattle();assert(target.hp<1000,'automatic melee damage');assert.equal(t.player().animation.type,'attack');
mobileScene();target=t.enemies()[0];target.x=t.player().x-300;target.y=t.player().y;t.player().angle=0;t.autoBattle();assert.equal(t.player().animation,null,'no automatic ranged skill');skills.find(b=>b.dataset.action==='blade').listeners.click();assert.equal(t.player().animation.type,'blade');assert(t.projectiles()[0].vx<0,'ranged auto-aim targets enemy, not movement direction');assert.equal(t.player().mana,75);
mobileScene();for(const e of t.enemies().slice(0,3)){e.x=t.player().x+55;e.y=t.player().y;}t.autoBattle();assert.equal(t.player().mana,100,'crowd does not trigger automatic skill');skills.find(b=>b.dataset.action==='nova').listeners.click();assert.equal(t.player().animation.type,'nova');assert.equal(t.player().mana,65);const nova=t.player().animation;t.autoBattle();assert.equal(t.player().animation,nova,'automation does not overwrite an active cast');
mobileScene();t.player().hp=72;t.autoBattle();assert.equal(t.player().potions,0);assert.equal(t.player().hp,72,'no automatic healing');t.autoBattle();assert.equal(t.player().potions,0);mobileScene();t.autoBattle();assert.equal(t.player().mana,100,'no out-of-range skill waste');assert.equal(t.player().animation,null);
mobileScene();target=t.enemies()[0];target.x=t.player().x+70;target.y=t.player().y;t.player().mana=0;t.autoBattle();assert.equal(t.player().animation.type,'attack','melee works without mana');mobileScene();t.pause();t.player().hp=40;t.autoBattle();assert.equal(t.player().potions,0,'no auto-actions while paused');
mobileScene();target=t.enemies()[0];target.type='boss';target.tell=.2;target.slamX=t.player().x;target.slamY=t.player().y;t.autoBattle();assert.equal(t.player().animation,null,'idle player must dodge manually');t.stick.x=1;t.autoBattle();assert.equal(t.player().animation,null,'danger does not trigger auto dash');skills.find(b=>b.dataset.action==='dash').listeners.click();assert.equal(t.player().animation.type,'dash','dash requires tap');assert(t.player().invincible>0);

t.start();const canvasEvents=element('canvas').listeners;
const finger=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,button:0,isPrimary:true});
canvasEvents.pointerdown(finger(7,260,500));assert.equal(t.stick.x,0,'touch begins at rest');canvasEvents.pointermove(finger(7,292,500));assert.equal(t.stick.x,1);const dragX=t.player().x;t.update(.04);assert(t.player().x>dragX);renderedWalkCell();
canvasEvents.pointerdown(finger(8,50,500));canvasEvents.pointermove(finger(8,20,500));canvasEvents.pointerup(finger(8,20,500));assert.equal(t.gesture.id,7,'second finger cannot take over');assert.equal(t.stick.x,1);
canvasEvents.pointerup(finger(7,292,500));assert.equal(t.stick.x,0);const releasedX=t.player().x;t.update(.04);assert.equal(t.player().x,releasedX,'release immediately stops movement');assert.equal(renderedCell(),0);
canvasEvents.pointerdown(finger(9,200,400));canvasEvents.pointermove(finger(9,200,360));assert(t.stick.y<0);canvasEvents.pointercancel(finger(9,200,360));assert.equal(t.gesture.id,null);assert.equal(t.stick.y,0,'cancel clears input');
canvasEvents.pointerdown(finger(10,200,400));canvasEvents.pointermove(finger(10,240,400));t.pause();assert.equal(t.gesture.id,null);assert.equal(t.stick.x,0,'pause releases captured gesture');t.pause();canvasEvents.pointermove(finger(10,270,400));assert.equal(t.stick.x,0,'old gesture cannot resume after pause');
media.matches=false;media.change();assert(!element('game').classList.contains('one-finger'));assert(skills.every(b=>!b.disabled));mobileScene();target=t.enemies()[0];target.x=t.player().x+60;target.y=t.player().y;t.autoBattle();assert.equal(target.hp,1000,'desktop remains manual');
console.log('PASS: one-finger melee/skill targeting, smart mana use, potion threshold, boss dodge, pause, gesture movement/release/cancel, multi-touch isolation, desktop controls.');
// Camera proportions use the world transform, not a stretched hero texture.
media.matches=true;media.change();t.start();
const canvasElement=element('canvas'),oldBounds=canvasElement.getBoundingClientRect,oldStyle=sandbox.getComputedStyle;
sandbox.getComputedStyle=()=>({objectFit:'cover'});
for(const [width,height] of [[320,588],[360,748],[390,792],[430,880]]){
  canvasElement.getBoundingClientRect=()=>({left:0,top:0,width,height});
  for(const x of [t.ARENA.minX,t.WORLD.cx,t.ARENA.maxX])for(const y of [t.ARENA.minY,t.WORLD.cy,t.ARENA.maxY]){
    t.player().y=y;
    t.player().x=x;const view=t.cameraView(),scale=view.zoom*view.cssScale;
    assert(Math.abs(width/scale-650)<1e-8,'phone shows 650 world units horizontally');
    assert(128*.9*scale<77,'hero stays proportionate to phone width');
    const screenX=(view.x+x*view.zoom)*view.cssScale+(width-1280*view.cssScale)/2;
    const screenY=(view.y+t.player().y*view.zoom)*view.cssScale+(height-720*view.cssScale)/2;
    assert(screenX>0&&screenX<width&&screenY>0&&screenY<height,'hero remains visible at arena edges');
    const world=t.pointerCoordinates({clientX:screenX,clientY:screenY});
    assert(Math.abs(world.x-x)<1e-8&&Math.abs(world.y-t.player().y)<1e-8,'pointer inverse matches zoom');
  }
}
canvasElement.getBoundingClientRect=oldBounds;sandbox.getComputedStyle=oldStyle;media.matches=false;media.change();t.start();assert.equal(t.cameraView().zoom,1,'desktop camera remains unchanged');
// Boss must actually reach melee range; warning shape and damage agree.
target=t.enemies()[0];target.type='boss';target.r=48;target.speed=60;target.damage=30;target.spawn=0;target.cast=100;target.attack=0;target.x=t.player().x+85;target.y=t.player().y;
for(let i=0;i<15;i++)t.update(.02);assert(t.player().hp<180,'boss closes the previous dead zone and hits');
t.start();target=t.enemies()[0];target.spawn=0;target.stun=0;target.cast=100;t.beginSlam(target,72,28,.9);const lockedX=target.slamX;t.player().x+=130;assert.equal(target.slamX,lockedX);assert(!t.insideSlam(target),'moving out avoids the locked warning');
const safeHp=t.player().hp;for(let i=0;i<46;i++)t.update(.02);assert.equal(t.player().hp,safeHp,'warning misses a player who left the zone');
t.start();target=t.enemies()[0];target.spawn=0;t.beginSlam(target,72,28,.02);t.update(.03);assert.equal(t.player().hp,152,'standing in the warning takes damage');
console.log('PASS: four portrait sizes, bounded camera, pointer mapping, desktop scale, boss melee, locked ground warning and movement avoidance.');
// Every wave stays within the expanded arena, including corner starts.
assert.equal(t.WORLD.width,2560);assert.equal(t.WORLD.height,1440);
for(const [px,py] of [[t.WORLD.cx,t.WORLD.cy],[180,310],[2380,310],[180,1170],[2380,1170]]){
  for(let wave=1;wave<=5;wave++){
    t.start();t.player().x=px;t.player().y=py;t.enemies().length=0;t.setWave(wave-1);t.nextWave();
    assert.equal(t.enemies().length,t.WAVE_COUNTS[wave]+(wave===5?1:0));
    for(const enemy of t.enemies()){
      assert(enemy.x>=t.ARENA.minX&&enemy.x<=t.ARENA.maxX&&enemy.y>=t.ARENA.minY&&enemy.y<=t.ARENA.maxY,'spawn inside arena');
      assert(Math.hypot(enemy.x-px,enemy.y-py)>=360,'spawn gives the hero room to react');
    }
  }
}
console.log('PASS: expanded world, all five wave counts, safe spawning at center and four corners.');
module.exports={t,snap,media,sandbox,element};


media.matches=false;media.change();t.start();t.player().hp=100;
for(const e of t.enemies())e.spawn=100;
const orb={x:t.player().x+80,y:t.player().y,type:'health',phase:0};t.loot().push(orb);
for(let i=0;i<60;i++)t.update(1/60);
assert.equal(t.player().hp,100);assert.equal(orb.x,t.player().x+80,'health orb stays on ground');
t.player().x=orb.x;t.update(.01);assert.equal(t.player().hp,124);assert(!t.loot().includes(orb));t.update(.01);assert.equal(t.player().hp,124);
t.player().hp=175;t.loot().push({x:t.player().x,y:t.player().y,type:'health',phase:0});t.update(.01);assert.equal(t.player().hp,180);
const fullOrb={x:t.player().x,y:t.player().y,type:'health',phase:0};t.loot().push(fullOrb);t.update(.01);assert(t.loot().includes(fullOrb));
t.loot().length=0;t.player().hp=100;for(const e of t.enemies())t.hurtEnemy(e,10000);t.loot().length=0;t.update(.01);assert.equal(t.player().hp,100,'no wave healing');assert.equal(snap().mode,'upgrade');t.upgrade('vitality');assert.equal(t.player().maxHp,220);assert.equal(t.player().hp,100,'no upgrade healing');
console.log('PASS: pickup-only healing, no magnet, single use, max HP, no wave/upgrade healing.');

// Direction atlas rows follow screen-space movement, with no mirror for back views.
t.heroDirections.complete=true;t.heroDirections.naturalWidth=1024;t.heroDirections.naturalHeight=2048;
for(let row=0;row<8;row++){
  t.start();const angle=row*Math.PI/4;t.stick.x=Math.cos(angle);t.stick.y=Math.sin(angle);
  for(let i=0;i<30;i++)t.update(.016);
  assert.equal(t.player().directionRow,row,'all eight directions settle correctly');
  draws.length=0;t.drawHero();const call=draws.findLast(a=>a[0]===t.heroDirections);assert(call);assert.equal(call[2],row*256);
  t.stick.x=t.stick.y=0;t.update(.02);assert.equal(t.player().directionRow,row,'idle retains facing');
}
t.start();t.player().moveAngle=Math.PI-.02;t.updateFacing(-Math.PI+.02,.016);assert(Math.abs(t.player().moveAngle-Math.PI)<.04,'turn uses short path across angle wrap');
t.player().moveAngle=0;t.player().directionRow=0;t.updateFacing(Math.PI/8+.02,1);assert.equal(t.player().directionRow,0,'boundary noise does not flicker');
t.start();t.keys.add('d');const frames=new Set();for(let i=0;i<16;i++){t.update(.04);draws.length=0;t.drawHero();frames.add(draws.findLast(a=>a[0]===t.heroDirections)[1]);}assert.equal(frames.size,4,'four gait cells rendered');
t.action('attack');draws.length=0;t.drawHero();assert(draws.some(a=>a[0]===t.heroDirections),'moving attack retains directional body');
t.player().moving=false;draws.length=0;t.drawHero();assert(draws.some(a=>a[0]===t.heroActions),'stationary attack retains detailed action poses');
console.log('PASS: eight rendered directions, idle facing, shortest turn, jitter guard, gait, attack priority.');

// Mobile combat must not replace movement facing with the old two-way atlas.
media.matches=true;media.change();
for(let row=0;row<8;row++){
  t.start();const a=row*Math.PI/4;t.stick.x=Math.cos(a);t.stick.y=Math.sin(a);
  for(const enemy of t.enemies()){enemy.spawn=100;}
  for(let i=0;i<30;i++)t.update(.016);
  for(const skill of ['attack','nova','blade','dash']){
    t.player().animation=null;t.player().mana=100;t.player().cooldowns[skill]=0;t.action(skill,0);
    draws.length=0;t.drawHero();const call=draws.findLast(args=>args[0]===t.heroDirections);
    assert(call,`${skill} while moving uses direction atlas`);assert.equal(call[2],row*256);
  }
}
console.log('PASS: mobile movement keeps eight-direction sprites during attack, nova, blade and dash.');

// Real attack frames must advance independently of gait while moving in every direction.
t.heroDirectionalAttack.complete=true;t.heroDirectionalAttack.naturalWidth=1024;t.heroDirectionalAttack.naturalHeight=1024;
media.matches=false;media.change();
for(let row=0;row<8;row++)for(const skill of ['attack','blade','nova']){
  t.start();for(const e of t.enemies())e.spawn=100;
  const a=row*Math.PI/4;t.player().moveAngle=a;t.player().directionRow=row;t.stick.x=Math.cos(a);t.stick.y=Math.sin(a);t.update(.016);
  t.action(skill,a);const animation=t.player().animation;const cells=new Set();const startX=t.player().x,startY=t.player().y;
  for(const fraction of [0,.25,.55,.85]){
    animation.elapsed=animation.duration*fraction;t.update(.001);draws.length=0;t.drawHero();
    const call=draws.findLast(args=>args[0]===t.heroDirectionalAttack);assert(call,`${skill} uses moving attack poses`);
    assert.equal(call[2],[0,1,2,1,0,3,3,3][row]*256);cells.add(call[1]);assert(!draws.some(args=>args[0]===t.heroDirections),'gait does not overwrite attack');
  }
  assert.equal(cells.size,4,'windup, strike, follow-through and recovery rendered');
  assert(Math.hypot(t.player().x-startX,t.player().y-startY)>0,'movement continues during attack');
  t.pause();const elapsed=animation.elapsed;t.drawHero();assert.equal(animation.elapsed,elapsed);t.pause();
  t.update(animation.duration);draws.length=0;t.drawHero();assert(draws.some(args=>args[0]===t.heroDirections),'walk resumes after attack');
}
console.log('PASS: four moving attack phases in eight directions, movement, pause and return to gait.');

media.matches=true;media.change();t.start();
const controlEvents=element('canvas').listeners;
controlEvents.pointerdown(finger(51,150,450));controlEvents.pointermove(finger(51,182,450));
const novaButton=skills.find(b=>b.dataset.action==='nova');let stopped=false;
novaButton.listeners.pointerdown({pointerType:'touch',preventDefault(){},stopPropagation(){stopped=true;}});
assert(stopped);assert.equal(t.player().animation.type,'nova');assert.equal(t.gesture.id,51);assert.equal(t.stick.x,1,'skill touch preserves movement pointer');
const mana=t.player().mana;novaButton.listeners.click();assert.equal(t.player().mana,mana,'synthetic click cannot cast twice');
controlEvents.pointerup(finger(51,182,450));t.pause();t.player().cooldowns.nova=0;novaButton.listeners.click();assert.equal(t.player().mana,mana,'paused skills cannot cast');t.pause();
console.log('PASS: manual skill touch with active movement, no duplicate cast and pause guard.');

// XP choices wait until combat ends; all queued choices precede the next spawn.
media.matches=false;media.change();t.start();
for(const e of t.enemies().slice(0,5))t.hurtEnemy(e,10000);
t.update(.01);assert(t.getPending()>0);assert.equal(snap().mode,'playing','level-up does not interrupt combat');assert(t.enemies().length>0);
for(const e of t.enemies())t.hurtEnemy(e,10000);t.update(.01);
assert.equal(snap().mode,'upgrade');assert.equal(snap().wave,1);assert.equal(t.enemies().length,0);assert.equal(t.projectiles().length,0);
const count=t.getPending();assert(count>1,'several earned upgrades queued');const beforeTime=snap().time;frame(5000);assert.equal(snap().time,beforeTime,'choice freezes simulation');
t.upgrade('invalid');assert.equal(t.getPending(),count);
for(let i=count;i>0;i--){assert.equal(snap().mode,'upgrade');t.upgrade('power');assert.equal(t.getPending(),i-1);assert.equal(snap().wave,1);assert.equal(t.enemies().length,0);}
assert.equal(snap().mode,'playing');t.update(1);assert.equal(snap().wave,1,'short preparation period after choosing');for(let i=0;i<60;i++)t.update(.04);assert.equal(snap().wave,2,'next wave starts after choices and preparation');
t.start();assert.equal(t.getPending(),0,'restart clears earned choices');
console.log('PASS: uninterrupted combat, queued pre-wave upgrades, frozen choices, preparation delay and restart.');

// Killing the boss first must remove its HUD while the final soldier keeps fighting.
media.matches=false;media.change();t.start();t.enemies().length=0;t.setWave(4);t.nextWave();t.update(.01);
assert(!element('bossHud').classList.contains('hidden'),'live boss bar visible');
const finalBoss=t.enemies().find(e=>e.type==='boss'),soldier=t.enemies().find(e=>e.type!=='boss');
for(const e of t.enemies())if(e!==soldier)t.hurtEnemy(e,10000);
t.update(.01);assert.equal(snap().mode,'playing');assert.equal(snap().enemyCount,1);
assert(element('bossHud').classList.contains('hidden'),'dead boss bar hidden with soldier remaining');assert.equal(element('bossFill').style.width,'0%');
assert(element('objectiveText').textContent.includes('prajurit'),'objective explains remaining soldier');
t.hurtEnemy(soldier,10000);t.update(.01);assert.equal(snap().mode,'victory');assert(element('bossHud').classList.contains('hidden'));
t.start();t.enemies().length=0;t.setWave(4);t.nextWave();t.update(.01);assert(!element('bossHud').classList.contains('hidden'));assert.equal(element('bossFill').style.width,'100%','fresh boss HUD restored');
console.log('PASS: boss dies before soldier, hidden/reset boss HP, remaining objective, victory and new boss.');
