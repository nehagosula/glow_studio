const $ = id => document.getElementById(id);
const canvas = $("canvas"), ctx = canvas.getContext("2d");
const dropzone = $("dropzone"), fileInput = $("fileInput"), chooseBtn = $("chooseBtn");
const emptyState = $("emptyState"), downloadBtn = $("downloadBtn"), beforeBtn = $("beforeBtn");
let img = null, original = null, showingBefore = false;

const ids = ["glow","warmth","brightness","contrast","softness","bloom","sparkle","vignette"];
const defaults = {glow:38,warmth:22,brightness:4,contrast:-8,softness:24,bloom:45,sparkle:18,vignette:8};

function values(){ const o={}; ids.forEach(id=>o[id]=+$(id).value); return o; }
function setValues(v){ ids.forEach(id=>{ if(v[id]!==undefined) $(id).value=v[id]; updateOutput(id); }); render(); }
function updateOutput(id){ $(id+"Out").textContent=$(id).value; }
ids.forEach(id=>$(id).addEventListener("input",()=>{updateOutput(id);render()}));

function loadFile(file){
  if(!file || !file.type.startsWith("image/")) return;
  const reader=new FileReader();
  reader.onload=()=>{ const im=new Image(); im.onload=()=>{img=im; original=null; canvas.width=im.naturalWidth; canvas.height=im.naturalHeight; dropzone.classList.add("has-image"); emptyState.style.display="none"; downloadBtn.disabled=false; render();}; im.src=reader.result; };
  reader.readAsDataURL(file);
}
chooseBtn.onclick=e=>{e.stopPropagation();fileInput.click()};
dropzone.onclick=()=>{if(!img)fileInput.click()};
fileInput.onchange=e=>loadFile(e.target.files[0]);
["dragenter","dragover"].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",e=>loadFile(e.dataTransfer.files[0]));

function clamp(v){return Math.max(0,Math.min(255,v))}
function pixelEffect(data,w,h,v){
  const d=data.data, warm=v.warmth*0.65, con=1+v.contrast/100;
  for(let i=0;i<d.length;i+=4){
    let r=d[i],g=d[i+1],b=d[i+2];
    const lum=.2126*r+.7152*g+.0722*b;
    r=(r-128)*con+128; g=(g-128)*con+128; b=(b-128)*con+128;
    const hi=Math.max(0,(lum-135)/120);
    r+=warm*(.75+hi*.7); g+=warm*.25; b-=warm*.55;
    const br=v.brightness*2.55;
    d[i]=clamp(r+br); d[i+1]=clamp(g+br*.85); d[i+2]=clamp(b+br*.55);
  }
}

function render(){
  if(!img || showingBefore)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const v=values();
  // Base image
  ctx.filter=`brightness(${100+v.brightness}%) contrast(${100+v.contrast/2}%)`;
  ctx.drawImage(img,0,0);
  ctx.filter="none";

  // Warm color wash
  if(v.warmth>0){
    ctx.save(); ctx.globalCompositeOperation="screen";
    ctx.fillStyle=`rgba(255,150,45,${v.warmth/220})`;
    ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore();
  }

  // Bloom: blurred copy, screen blended
  if(v.glow>0 || v.bloom>0){
    const blur=Math.max(1,v.softness/3);
    const off=document.createElement("canvas"); off.width=canvas.width; off.height=canvas.height;
    const oc=off.getContext("2d");
    oc.filter=`blur(${blur}px) brightness(${100+v.bloom/2}%)`;
    oc.drawImage(img,0,0);
    ctx.save(); ctx.globalCompositeOperation="screen"; ctx.globalAlpha=(v.glow/100)*.55+(v.bloom/100)*.3;
    ctx.drawImage(off,0,0); ctx.restore();
  }

  // Highlight bloom using a brightened blurred layer.
  if(v.bloom>0){
    const off=document.createElement("canvas"); off.width=canvas.width; off.height=canvas.height;
    const oc=off.getContext("2d");
    oc.filter=`blur(${4+v.softness/5}px) brightness(${115+v.bloom}%)`;
    oc.drawImage(img,0,0);
    ctx.save(); ctx.globalCompositeOperation="screen"; ctx.globalAlpha=v.bloom/230;
    ctx.drawImage(off,0,0); ctx.restore();
  }

  // Tiny warm sparkles concentrated randomly, deterministic from image size.
  if(v.sparkle>0){
    const count=Math.round(v.sparkle*0.7);
    const seed=canvas.width*13+canvas.height*7;
    let s=seed>>>0;
    const rand=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
    ctx.save(); ctx.globalCompositeOperation="screen";
    for(let i=0;i<count;i++){
      const x=rand()*canvas.width,y=rand()*canvas.height,r=1+rand()*2.7*(v.sparkle/35);
      const g=ctx.createRadialGradient(x,y,0,x,y,r*6);
      g.addColorStop(0,`rgba(255,238,190,${.28+v.sparkle/180})`);
      g.addColorStop(1,"rgba(255,180,70,0)");
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(255,245,210,${.35+v.sparkle/150})`;
      ctx.fillRect(x-r*.35,y-r*2,r*.7,r*4);ctx.fillRect(x-r*2,y-r*.35,r*4,r*.7);
    }
    ctx.restore();
  }

  // Vignette
  if(v.vignette>0){
    const g=ctx.createRadialGradient(canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)*.2,canvas.width/2,canvas.height/2,Math.max(canvas.width,canvas.height)*.72);
    g.addColorStop(0,"rgba(0,0,0,0)");
    g.addColorStop(1,`rgba(35,12,0,${v.vignette/150})`);
    ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
  }
}

function showBefore(on){showingBefore=on;if(on){ctx.filter="none";ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0)}else render()}
beforeBtn.addEventListener("pointerdown",()=>showBefore(true));
["pointerup","pointercancel","pointerleave"].forEach(e=>beforeBtn.addEventListener(e,()=>showBefore(false)));

document.querySelectorAll("[data-preset]").forEach(b=>b.onclick=()=>{
  const p=b.dataset.preset;
  if(p==="reset")setValues(defaults);
  if(p==="soft")setValues({glow:30,warmth:12,brightness:3,contrast:-12,softness:32,bloom:32,sparkle:8,vignette:5});
  if(p==="gold")setValues({glow:48,warmth:34,brightness:5,contrast:-10,softness:24,bloom:62,sparkle:25,vignette:10});
  if(p==="dreamy")setValues({glow:58,warmth:18,brightness:7,contrast:-18,softness:45,bloom:72,sparkle:34,vignette:4});
});

downloadBtn.onclick=()=>{
  if(!img)return;
  canvas.toBlob(blob=>{
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="glow-photo.png";a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  },"image/png");
};

setValues(defaults);
