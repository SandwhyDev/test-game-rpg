// Optional offscreen visual QA. Requires @napi-rs/canvas on NODE_PATH.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
  const art=await Promise.all(['aelith.png','aelith-actions.png','aelith-walk.png'].map(file=>loadImage(path.join(root,'assets',file))));
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
  code=code.replace('  // A narrow read-only snapshot',`window.qa={start,render,beginSlam,player:()=>player,enemies:()=>enemies};\n  // A narrow read-only snapshot`);
  vm.runInNewContext(code,sandbox);const qa=sandbox.window.qa;qa.start();
  qa.enemies().forEach((e,i)=>{e.spawn=0;e.x=1080+(i%4)*120;e.y=540+Math.floor(i/4)*170;});
  qa.beginSlam(qa.enemies()[1],88,34,.8);qa.player().x=1330;qa.render(0);
  const output=createCanvas(390,792),scale=792/720,visible=390/scale;
  output.getContext('2d').drawImage(surface,(1280-visible)/2,0,visible,720,0,0,390,792);
  const dir=path.join(root,'output');fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'portrait-camera-qa.png');fs.writeFileSync(file,output.toBuffer('image/png'));console.log(file);
})().catch(e=>{console.error(e);process.exitCode=1;});
