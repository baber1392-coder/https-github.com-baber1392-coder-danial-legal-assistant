/* KML/KMZ reader. Coordinates are interpreted as KML lon,lat[,alt] (WGS84). */
(function(){
 const text=(el,tag)=>{const n=el.getElementsByTagNameNS('*',tag)[0];return n?n.textContent.trim():''};
 function coords(s){return s.trim().split(/\\s+/).map(t=>{const v=t.split(',').map(Number);if(v.length<2||!Number.isFinite(v[0])||!Number.isFinite(v[1])||Math.abs(v[0])>180||Math.abs(v[1])>90)throw Error('مختصات KML نامعتبر است');return [v[0],v[1]]})}
 function parse(xml){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw Error('ساختار XML/KML معتبر نیست');const features=[];
  for(const pm of [...doc.getElementsByTagNameNS('*','Placemark')]){const props={name:text(pm,'name'),description:text(pm,'description'),source:'KML/KMZ import'};for(const d of [...pm.getElementsByTagNameNS('*','Data')]){const k=d.getAttribute('name');if(k)props[k]=text(d,'value')}for(const d of [...pm.getElementsByTagNameNS('*','SimpleData')]){const k=d.getAttribute('name');if(k)props[k]=d.textContent.trim()}
   const geoms=[];for(const p of [...pm.getElementsByTagNameNS('*','Point')]){const c=p.getElementsByTagNameNS('*','coordinates')[0];if(c){const a=coords(c.textContent);if(a.length)geoms.push({type:'Point',coordinates:a[0]})}}
   for(const l of [...pm.getElementsByTagNameNS('*','LineString')]){const c=l.getElementsByTagNameNS('*','coordinates')[0];if(c)geoms.push({type:'LineString',coordinates:coords(c.textContent)})}
   for(const p of [...pm.getElementsByTagNameNS('*','Polygon')]){const outer=p.getElementsByTagNameNS('*','outerBoundaryIs')[0],c=outer&&outer.getElementsByTagNameNS('*','coordinates')[0];if(c){const rings=[coords(c.textContent)];for(const inn of [...p.getElementsByTagNameNS('*','innerBoundaryIs')]){const ic=inn.getElementsByTagNameNS('*','coordinates')[0];if(ic)rings.push(coords(ic.textContent))}geoms.push({type:'Polygon',coordinates:rings})}}
   if(geoms.length===1)features.push({type:'Feature',properties:props,geometry:geoms[0]});else if(geoms.length>1)features.push({type:'Feature',properties:props,geometry:{type:'GeometryCollection',geometries:geoms}})
  }
  return {type:'FeatureCollection',features};
 }
 async function read(file){const name=file.name.toLowerCase();if(name.endsWith('.kml'))return parse(await file.text());if(!name.endsWith('.kmz'))throw Error('فقط فایل KML یا KMZ پذیرفته می‌شود');if(!window.JSZip)throw Error('کتابخانه بازکردن KMZ بارگذاری نشده است؛ اتصال اینترنت را بررسی کنید');const zip=await JSZip.loadAsync(file);const keys=Object.keys(zip.files).filter(k=>!zip.files[k].dir&&k.toLowerCase().endsWith('.kml')).sort((a,b)=>(a.toLowerCase()==='doc.kml'?-1:0)-(b.toLowerCase()==='doc.kml'?-1:0));if(!keys.length)throw Error('در فایل KMZ هیچ فایل KML پیدا نشد');return parse(await zip.files[keys[0]].async('text'))}
 window.DanialKML={read};
})();