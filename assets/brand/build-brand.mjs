// Generates the PawFall brand set (SVG sources + PNGs) in the SuperColby pixel style. Run: node assets/brand/build-brand.mjs
// PNGs need ImageMagick (`magick`); SVGs are always written.
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const P = { bg:'#0a0710', bg2:'#14101c', gold:'#ffd23a', goldD:'#b8861a', ink:'#fff6e0', leaf:'#2f9a34', leafL:'#8ad65a', leafD:'#175a1c',
  fur:'#f08a24', furD:'#a8430f', ear:'#b8561a', cream:'#fff0d0', eye:'#7bd44a', pupil:'#1f4a12', nose:'#ff8fa3', blue:'#2f6fd6', cape:'#d63a2f' };
const G = { P:['1111','1001','1111','1000','1000'], A:['0110','1001','1111','1001','1001'], W:['10001','10001','10101','11011','10001'],
  F:['1111','1000','1110','1000','1000'], L:['1000','1000','1000','1000','1111'] };
const rects = (list) => list.map(([x,y,w,h,c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('');
function word(text, s, ox, oy, fill, shadow) { // pixel text, returns rects + width
  let x = 0, out = [];
  for (const ch of text) { const g = G[ch]; g.forEach((row,r)=>[...row].forEach((v,c)=>{ if(v==='1'){
    out.push([ox+(x+c)*s+s*0.5, oy+r*s+s*0.5, s, s, shadow]); out.push([ox+(x+c)*s, oy+r*s, s, s, fill]); }})); x += g[0].length + 1; }
  return { svg: rects(out), w: (x-1)*s };
}
function cat(ox, oy, s) { // 16x16 SuperColby head with cape collar
  const r = [[3,2,2,2,P.ear],[11,2,2,2,P.ear],[3,4,10,8,P.fur],[2,6,1,4,P.fur],[13,6,1,4,P.fur],[7,4,2,1,P.furD],[5,5,1,2,P.furD],[10,5,1,2,P.furD],
    [6,9,4,3,P.cream],[5,7,2,2,P.eye],[9,7,2,2,P.eye],[6,7,1,2,P.pupil],[10,7,1,2,P.pupil],[7,9,2,1,P.nose],[3,12,10,2,P.blue],[2,12,1,3,P.cape],[13,12,1,3,P.cape],[7,12,2,2,P.gold]];
  return rects(r.map(([x,y,w,h,c])=>[ox+x*s,oy+y*s,w*s,h*s,c]));
}
function jungle(W, H, s) { // vines + ground strip with a pit
  const o = [], rnd = (i)=>((Math.sin(i*91.7)*43758.5)%1+1)%1;
  for (let x=0;x<W;x+=s*4){ const h=s*(2+Math.floor(rnd(x)*5)); o.push([x,0,s*2,h*2,P.leafD],[x,0,s*2,h,P.leaf]); }
  for (let x=0;x<W;x+=s*14){ const h=s*(5+Math.floor(rnd(x+3)*9)); for(let y=0;y<h;y+=s)o.push([x+s*5,y,s,s,P.leafL]); }
  const gy = H - s*4; for (let x=0;x<W;x+=s){ if (x>W*0.62&&x<W*0.62+s*8) continue; o.push([x,gy,s,s,P.leafL],[x,gy+s,s,s*3,'#5a3a1a']); }
  return rects(o);
}
const svgWrap = (w,h,body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${body}</svg>\n`;
// logo: wordmark + cat
{ const s=12, t=word('PAWFALL', s, 0,0, P.gold, P.goldD); const W=t.w+s*2+16*5+20, H=s*5+40;
  writeFileSync(join(here,'logo.svg'), svgWrap(W,H, `<rect width="${W}" height="${H}" fill="${P.bg}"/>`+word('PAWFALL',s,20,20,P.gold,P.goldD).svg+cat(t.w+s*2+20,0,5)));
}
// hero banner 1280x640
{ const W=1280,H=640,s=16; const t=word('PAWFALL',16,0,0,0,0); const lw=t.w, x0=Math.round((W-lw)/2/s)*s;
  const body = `<rect width="${W}" height="${H}" fill="${P.bg}"/><rect y="${H*0.45}" width="${W}" height="${H*0.55}" fill="${P.bg2}"/>`+jungle(W,H,s)
   + word('PAWFALL',s,x0,150,P.gold,P.goldD).svg
   + `<rect x="${x0}" y="${150+s*5+30}" width="${lw}" height="${s/2}" fill="${P.leafL}"/>`
   + cat(W*0.62-s*3, H-s*4-16*10, 10)
   + `<text x="${W/2}" y="${150+s*5+90}" text-anchor="middle" font-family="monospace" font-size="26" font-weight="bold" fill="${P.ink}" letter-spacing="3">SUPERCOLBY VS PERRING PARKWAY PETE</text>`;
  writeFileSync(join(here,'banner.svg'), svgWrap(W,H,body));
}
// square icon 256 (rendered to 512/192/180)
{ const w=word('PAW',8,0,0,0,0).w;
  writeFileSync(join(here,'icon.svg'), svgWrap(256,256, `<rect width="256" height="256" fill="${P.bg}"/><rect x="8" y="8" width="240" height="240" fill="none" stroke="${P.gold}" stroke-width="8"/>`+cat(40,14,11)+word('PAW',8,128-w/2,198,P.gold,P.goldD).svg));
}
// favicon: 16x16 head
writeFileSync(join(here,'favicon.svg'), svgWrap(16,16, `<rect width="16" height="16" fill="${P.bg}"/>`+cat(0,0,1)));
const png=(src,out,size)=>execFileSync('magick',['-background','none','-density','384',join(here,src),'-filter','point','-resize',`${size}x${size}`,join(here,out)]);
try {
  execFileSync('magick',['-background','none','-density','96',join(here,'banner.svg'),join(here,'banner.png')]);
  execFileSync('magick',['-background','none',join(here,'logo.svg'),join(here,'logo.png')]);
  png('icon.svg','icon-512.png',512); png('icon.svg','icon-192.png',192); png('icon.svg','apple-touch-icon.png',180);
  for (const n of [16,32,48]) png('favicon.svg',`favicon-${n}.png`,n);
  execFileSync('magick',[join(here,'favicon-16.png'),join(here,'favicon-32.png'),join(here,'favicon-48.png'),join(here,'favicon.ico')]);
} catch (e) { console.error('PNG step skipped:', e.message); }
// mirror the public subset into the Pages site (test/site.test.mjs needs every site asset inside docs/site)
import { cpSync, mkdirSync as mk } from 'node:fs';
const site = join(here, '..', '..', 'docs', 'site', 'brand'); mk(site, { recursive: true });
for (const f of ['banner.png','banner.svg','logo.png','logo.svg','icon-512.png','icon-192.png','apple-touch-icon.png','favicon.svg','favicon-16.png','favicon-32.png','favicon-48.png','favicon.ico']) { try { cpSync(join(here, f), join(site, f)); } catch {} }
console.log('brand set written to', here, 'and', site);
