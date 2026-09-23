import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const base = "vendor/threeui/notice-effects/src/shaders";
mkdirSync("public/effects", { recursive: true });
let paper = readFileSync(
  `${base}/3d-paper/sources/3d-paper-site-of-the-year.html`,
  "utf8",
);
const art = readFileSync("assets/notice-paper-art.js", "utf8");
// Screen Y increases downward. Keep drag pitch and pointer tilt in that direction.
const authoredPitch = "dragPitch - dy*0.0045";
if (!paper.includes(authoredPitch))
  throw new Error("Paper drag pitch anchor changed");
paper = paper
  .replace(authoredPitch, "dragPitch + dy*0.0045")
  .replace("dragPitch - mouse.y*0.11", "dragPitch + mouse.y*0.11");
paper = paper.replace(
  /function drawGame\(ctx\)\{[\s\S]*?(?=function makeCertTexture)/,
  art + "\n\n",
);
paper = paper
  .replace("<h1>NOCTURNE</h1>", "<h1>POLARIS</h1>")
  .replace(
    "<title>3D Paper — Site of the Year</title>",
    "<title>Polaris notice</title>",
  );
paper = paper.replace("new T.PointLight(0xb8ff3c", "new T.PointLight(0xd99a63");
paper = paper.replace(
  "uRimCol:{value:new T.Color(0x9dff5a)}",
  "uRimCol:{value:new T.Color(0xd99a63)}",
);
paper = paper.replace(
  "</style>",
  ":root{--bg:transparent;color-scheme:light} html,body{background:transparent} #bg,#dof,#grain,#grain2,#vig{display:none} #hint{bottom:62px;color:#cdbba8;letter-spacing:.03em;text-transform:none;font-size:11px} #hint b{color:#f5ede1} @media(max-width:680px){#hint .ptr{display:none}}</style>",
);
paper = paper.replace(
  "<script>",
  `<script>window.addEventListener('error',()=>parent.postMessage({type:'polaris-paper-error'},'*'));</script><script>`,
);
paper = paper.replace(
  "renderer.render(scene,camera);\n}",
  `renderer.render(scene,camera);
  if(intro > .85 && !window.polarisReady) { window.polarisReady = true; parent.postMessage({type:'polaris-paper-ready'},'*'); }
}`,
);
const bridge = `
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();parent.postMessage({type:'polaris-paper-error'},'*');});
${readFileSync("assets/notice-paper-interaction.js", "utf8")}
let noticeSequence = 0;
function updateNoticeTexture(){const next=makeCertTexture();mat.map?.dispose();mat.map=next;mat.needsUpdate=true;parent.postMessage({type:'polaris-paper-content',pages:polarisPages,page:polarisPage},'*');}
let noticeMobile=window.innerWidth<600;
window.addEventListener('resize',()=>{const mobile=window.innerWidth<600;if(mobile!==noticeMobile){noticeMobile=mobile;updateNoticeTexture();}});
window.addEventListener('keydown',e=>{if(e.key==='Escape')parent.postMessage({type:'polaris-paper-close'},'*');});
window.addEventListener('message', async e=>{
  if(e.source !== parent) return;
  if(e.data?.type==='polaris-paper-page'){polarisPage=Math.max(0,Math.min(polarisPages-1,Number(e.data.page)||0));updateNoticeTexture();return;}
  if(e.data?.type !== 'polaris-notice') return;
  const sequence = ++noticeSequence;
  const value = e.data.notice || {};
  polarisNotice = { title:String(value.title||'Polaris notice').slice(0,120), summary:String(value.summary||'').slice(0,280), body:String(value.body||'').slice(0,12000), category:String(value.category||'Announcement').slice(0,30), date:String(value.date||'').slice(0,60), priority:value.priority };
  polarisPage=0;
  const load = src => new Promise(resolve=>{
    if(typeof src !== 'string' || src.length > 3000000 || !/^data:image\\/webp;base64,[A-Za-z0-9+/=]+$/.test(src)) return resolve(null);
    const image = new Image(); image.onload=()=>resolve(image); image.onerror=()=>resolve(null); image.src=src;
  });
  const images = await Promise.all([load(value.image), load(value.logo)]);
  if(sequence !== noticeSequence) return;
  [polarisCover,polarisLogo] = images;
  updateNoticeTexture();
});
`;
paper = paper.replace("window.__sheet =", bridge + "\nwindow.__sheet =");
writeFileSync("public/effects/notice-paper.html", paper);

const source = readFileSync(
  `${base}/brand-orbs/sources/brand-orbs-v2.html`,
  "utf8",
);
let engine = [
  ...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi),
].at(-1)[1];
// Preserve the authored sphere projection, depth paint and Figma morph timing; only the logo destinations change.
const polaris = `
  function drawPolaris(ctx,S,t,o) {
    const cx=S/2, cy=S/2, R=S/2*.86, rs=rscale(S)*(o.mini?1.6:1);
    const mark=pathDots('polaris','M16 4L18.5 14L16 12.5L13.5 14Z M16 28L18.5 18L16 19.5L13.5 18Z M28 16L18 13.5L19.5 16L18 18.5Z M4 16L14 13.5L12.5 16L14 18.5Z M18 16A2 2 0 1 1 14 16A2 2 0 1 1 18 16',o.mini?11:25,32);
    const pts=mark.concat(Array.from({length:o.mini?22:64},(_,i)=>{const a=i/(o.mini?22:64)*TAU;return [Math.cos(a)*1.13,Math.sin(a)*1.13];}));
    const N=pts.length, u=((t*.9)%7+7)%7;
    let m=u<2.8?0:u<3.7?smooth((u-2.8)/.9):u<5.6?1:u<6.5?1-smooth((u-5.6)/.9):0;
    if(reduced) m=1;
    const p=proj(t*.5,.32+.1*Math.sin(t*.35),cx,cy,R), dots=[];
    for(let i=0;i<N;i++) {
      const f=fib(i,N), [sx,sy,sz]=p(f[0],f[1],f[2]);
      const x=lerp(sx,cx+pts[i][0]*R*.79,m), y=lerp(sy,cy+pts[i][1]*R*.79,m), z=lerp(sz,0,m), dep=(z+1)/2;
      dots.push({x,y,z,r:(.8+1.4*lerp(dep,.85,m))*rs,v:lerp(.45+.48*dep,.85,m),c:i%3===0?[196,125,78]:[244,215,188]});
    }
    paint(ctx,dots,null,0,.3);
  }
`;
engine = engine.replace("const MODES =", polaris + "\n const MODES =");
if (!engine.includes("function drawPolaris"))
  throw new Error("Orb insertion anchor changed");
engine = engine.replace(
  "const MODES = {",
  "const MODES = { polaris: { draw: drawPolaris, accent:null, speed:1, staticT:4.5 },",
);
const loopStart = engine.indexOf("  if (!reduced && anims.length)");
if (loopStart < 0) throw new Error("Orb lifecycle anchor changed");
engine =
  engine.slice(0, loopStart) +
  `
  if (!reduced && anims.length) {
    let raf=0, paused=false, virtual=0, last=performance.now();
    const run=()=>{raf=0;const now=performance.now();virtual+=Math.min(now-last,50)/1000;last=now;anims.forEach(a=>a.frame(virtual));if(!paused&&!document.hidden)raf=requestAnimationFrame(run);};
    const sync=()=>{cancelAnimationFrame(raf);raf=0;last=performance.now();if(!paused&&!document.hidden)raf=requestAnimationFrame(run);};
    window.addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='polaris-orb-controls'){paused=!!e.data.paused;sync();}});
    document.addEventListener('visibilitychange',sync);sync();
  }
})();`;
writeFileSync(
  "public/effects/polaris-orb.html",
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Polaris activity</title><style>:root{color-scheme:light}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent!important}body{display:grid;place-items:center}canvas{width:192px;height:192px}</style></head><body><canvas data-mode="polaris" data-size="192"></canvas><script>${engine}</script></body></html>`,
);
console.log("Built Polaris paper and orb from verified source.");
