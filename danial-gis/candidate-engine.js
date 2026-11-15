/* Candidate screening only: bounding-box overlap + centroid proximity + area similarity.
   It does NOT perform cadastral lookup or prove parcel identity/ownership. */
(function(){
 const rad=Math.PI/180,R=6371008.8;
 function ringOf(f){const g=f&&f.geometry;if(!g)return null;if(g.type==='Polygon')return g.coordinates&&g.coordinates[0];if(g.type==='MultiPolygon')return g.coordinates&&g.coordinates[0]&&g.coordinates[0][0];return null}
 function metrics(r){if(!Array.isArray(r)||r.length<4)return null;const pts=r.slice(0,-1).filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));if(pts.length<3)return null;
  const lons=pts.map(p=>p[0]),lats=pts.map(p=>p[1]);let s=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];s+=(b[0]-a[0])*rad*(2+Math.sin(a[1]*rad)+Math.sin(b[1]*rad))}
  return {area:Math.abs(s*R*R/2),cx:pts.reduce((v,p)=>v+p[0],0)/pts.length,cy:pts.reduce((v,p)=>v+p[1],0)/pts.length,minX:Math.min(...lons),maxX:Math.max(...lons),minY:Math.min(...lats),maxY:Math.max(...lats)};
 }
 function score(a,b){const ix=Math.max(0,Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)),iy=Math.max(0,Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY));const inter=ix*iy,aa=(a.maxX-a.minX)*(a.maxY-a.minY),bb=(b.maxX-b.minX)*(b.maxY-b.minY);const overlap=inter/Math.max(1e-15,Math.min(aa,bb));const dlat=(a.cy-b.cy)*rad,dlon=(a.cx-b.cx)*rad*Math.cos((a.cy+b.cy)*rad/2),dist=Math.hypot(dlat,dlon)*R;const prox=Math.exp(-dist/250);const ratio=Math.min(a.area,b.area)/Math.max(a.area,b.area);return {score:Math.round((overlap*.45+prox*.35+ratio*.20)*100),overlap:Math.round(overlap*100),distance:Math.round(dist),areaRatio:Math.round(ratio*100)}}
 function rank(target,features){const tr=metrics(target);if(!tr)throw Error('هندسه هدف معتبر نیست یا پلیگون بسته نشده است.');return (features||[]).map((f,i)=>{const r=ringOf(f),m=metrics(r);if(!m)return null;const s=score(tr,m),p=f.properties||{};return {feature:f,index:i,score:s.score,overlap:s.overlap,distance:s.distance,areaRatio:s.areaRatio,label:String(p.parcel_no||p.parcel_id||p.name||p.title||('عارضه '+(i+1))),source:String(p.source||p.source_name||'در فایل ورودی مشخص نشده')}}).filter(Boolean).sort((a,b)=>b.score-a.score)}
 window.DanialCandidateEngine={rank};
})();