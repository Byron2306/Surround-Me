const{createCanvas,loadImage}=require('@napi-rs/canvas');const fs=require('node:fs');const path=require('node:path');
(async()=>{const root=path.resolve(__dirname,'..');const town=await import(root+'/world-art/town-expansion.mjs');
const c=createCanvas(1800,1150),ctx=c.getContext('2d');ctx.fillStyle='#111817';ctx.fillRect(0,0,c.width,c.height);
ctx.fillStyle='#e4d9bd';ctx.font='28px sans-serif';ctx.fillText('HOUSE ROOFS + MARKET STREET VARIANTS',45,49);
ctx.fillStyle='#939e94';ctx.font='17px sans-serif';ctx.fillText('Actual runtime renderer · continuous roof planes · distinct storefronts · candidate art',45,79);
const ids=['townHousePlaster','townHouseBrick','townCornerShop','townPharmacy','townHardware','townLaundrette'];
for(const[i,asset]of ids.entries()){
const image=await loadImage(path.join(root,town.townAssetPaths[asset]));const col=i%3,row=Math.floor(i/3);const x=col*600+318,y=row*480+490;
ctx.save();ctx.translate(x,y);ctx.scale(2.05,2.05);const s={asset,w:i<2?3.75:3,d:i<2?3:2};
ctx.beginPath();for(const[j,p]of [[0,0],[-s.w*32,-s.w*16],[(s.d-s.w)*32,-(s.w+s.d)*16],[s.d*32,-s.d*16]].entries())j?ctx.lineTo(...p):ctx.moveTo(...p);ctx.closePath();ctx.fillStyle='#35463d';ctx.fill();
town.drawTownBuilding(ctx,0,0,s,image,{polarity:'ordinary',intensity:0});ctx.restore();
ctx.fillStyle='#d7ceb7';ctx.font='21px sans-serif';ctx.textAlign='center';ctx.fillText(['Plaster house · continuous gable','Brick cottage · continuous gable','Corner grocer','Pharmacy · sage brick / cross','Hardware · roller shutter','Laundrette · tiled fascia / machines'][i],col*600+300,row*480+545);
}fs.writeFileSync(root+'/evidence/town/roof-shop-review.png',c.toBuffer('image/png'));})();
