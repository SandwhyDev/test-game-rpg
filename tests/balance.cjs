const {t,snap,media,sandbox}=require('./smoke.cjs');
const assert=require('node:assert/strict');
function run(seed,move){
  let random=seed;
  sandbox.Math=Object.create(Math);
  sandbox.Math.random=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
  media.matches=true;media.change();t.start();
  for(let tick=0;tick<60*360;tick++){
    const state=snap();
    if(state.mode==='dead'||state.mode==='victory')break;
    if(state.mode==='upgrade'){t.upgrade('power');continue;}
    if(move){
      const p=t.player(),a=state.time*.47;
      let dx=t.WORLD.cx+Math.cos(a)*300-p.x,dy=t.WORLD.cy+Math.sin(a)*145-p.y;
      const health=t.loot().filter(l=>l.type==='health').sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
      if(health&&p.hp<p.maxHp-24){dx=health.x-p.x;dy=health.y-p.y;}
      const length=Math.hypot(dx,dy);t.stick.x=dx/Math.max(32,length);t.stick.y=dy/Math.max(32,length);
    }
    t.update(1/60);if(tick%30===0)t.clearVisuals();
  }
  const s=snap();return {seed,policy:move?'moving':'idle',mode:s.mode,wave:s.wave,kills:s.kills,seconds:Math.round(s.time),hp:s.player.hp};
}
const results=[1,7,42,77,123,2026].flatMap(seed=>[run(seed,false),run(seed,true)]);
console.table(results);
if(process.argv.includes('--assert')){
  const idle=results.filter(r=>r.policy==='idle'),moving=results.filter(r=>r.policy==='moving');
  assert(idle.every(r=>r.mode==='dead'),'unattended auto-combat must lose');
  assert(moving.some(r=>r.mode==='victory'),'active movement must remain winnable');
  assert(moving.reduce((n,r)=>n+r.kills,0)>idle.reduce((n,r)=>n+r.kills,0),'movement earns more kills');
  console.log('PASS: idle loses across six seeded runs; active movement remains winnable.');
}
