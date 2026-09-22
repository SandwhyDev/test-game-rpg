// Optional offscreen visual QA. Requires @napi-rs/canvas on NODE_PATH.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
  const art=await Promise.all(['aelith.png','aelith-actions.png','aelith-walk.png','aelith-directions.png','aelith-directional-attack.png'].map(file=>loadImage(path.join(root,'assets',file))));
  // Use already-decoded native images; game assignment must not start a reload.
  for(const img of art)Object.defineProperty(img,'src',{get:()=>'',set:()=>{}});
  const nodes=new Map(),surface=createCanvas(1280,720),mini=createCanvas(120,90);
  function el(id){
    if(nodes.has(id))return nodes.get(id);
    const value=id==='canvas'?surface:id==='minimap'?mini:{};
    Object.assign(value,{style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},replaceChildren(){},append(){},firstElementChild:{style:{}},getBoundingClientRect:()=>({left:0,top:0,width:390,height:792})});
    nodes.set(id,value);return value;
  }
  const sandbox={document:{getElementById:el,createElement:tag=>tag==='canvas'?createCanvas(300,150):{},createTextNode:s=>s,querySelectorAll:()=>[],addEventListener(){}},window:{matchMedia:()=>({matches:true,addEventListener(){}}),addEventListener(){}},Image:class{constructor(){return art.shift();}},localStorage:{getItem:()=>0,setItem(){}},getComputedStyle:()=>({objectFit:'cover'}),performance:{now:()=>0},requestAnimationFrame(){},console,Math};
  let code=fs.readFileSync(path.join(root,'game.js'),'utf8');
  code=code.replace('  // A narrow read-only snapshot',`window.qa={start,render,drawHero,action,beginSlam,player:()=>player,enemies:()=>enemies};\n  // A narrow read-only snapshot`);
  vm.runInNewContext(code,sandbox);const qa=sandbox.window.qa;qa.start();
  qa.enemies().forEach((e,i)=>{e.spawn=0;e.x=1080+(i%4)*120;e.y=540+Math.floor(i/4)*170;});
  qa.beginSlam(qa.enemies()[1],88,34,.8);qa.player().x=1330;qa.render(0);
  const output=createCanvas(390,792),scale=792/720,visible=390/scale;
  output.getContext('2d').drawImage(surface,(1280-visible)/2,0,visible,720,0,0,390,792);
  const dir=path.join(root,'output');fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'portrait-camera-qa.png');fs.writeFileSync(file,output.toBuffer('image/png'));console.log(file);
  // Render the actual hero during a moving attack in all eight directions.
  const sheet=createCanvas(640,400),sc=sheet.getContext('2d'),labels=['E','SE','S','SW','W','NW','N','NE'];
  sc.fillStyle='#14282f';sc.fillRect(0,0,640,400);
  for(let row=0;row<8;row++){
    const p=qa.player();p.animation=null;p.cooldowns.attack=0;p.moving=true;p.directionRow=row;p.stride=.25;
    qa.action('attack',row*Math.PI/4);p.animation.elapsed=p.animation.duration*.3;
    const c=surface.getContext('2d');c.clearRect(0,0,1280,720);c.save();c.translate(640-p.x,400-p.y);qa.drawHero();c.restore();
    const x=(row%4)*160,y=Math.floor(row/4)*200;
    sc.drawImage(surface,560,240,160,170,x,y+20,160,170);sc.fillStyle='#dce9eb';sc.font='14px sans-serif';sc.fillText(labels[row],x+70,y+18);
  }
  fs.writeFileSync(path.join(dir,'direction-combat-qa.png'),sheet.toBuffer('image/png'));
  const phases=createCanvas(640,200),pc=phases.getContext('2d');pc.fillStyle='#14282f';pc.fillRect(0,0,640,200);
  for(let phase=0;phase<4;phase++){
    const p=qa.player();p.animation=null;p.cooldowns.attack=0;p.moving=true;p.directionRow=1;
    qa.action('attack',Math.PI/4);p.animation.elapsed=p.animation.duration*[0,.25,.55,.85][phase];
    const c=surface.getContext('2d');c.clearRect(0,0,1280,720);c.save();c.translate(640-p.x,400-p.y);qa.drawHero();c.restore();
    pc.drawImage(surface,550,225,180,190,phase*160,20,160,169);pc.fillStyle='#dce9eb';pc.font='14px sans-serif';pc.fillText(['Windup','Strike','Follow-through','Recovery'][phase],phase*160+20,17);
  }
  fs.writeFileSync(path.join(dir,'moving-attack-phases-qa.png'),phases.toBuffer('image/png'));


})().catch(e=>{console.error(e);process.exitCode=1;});
