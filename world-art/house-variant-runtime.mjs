const variantFootprints = new Map([
    ['house.a.02',[3,3,'houseA02']], ['house.a.03',[2.6,2.75,'houseA03']], ['house.a.04',[3.5,2.6,'houseA04']],
]);
export function variantStructure(m,x,y) {
    const fail=()=>{throw new Error('Invalid governed house metadata');};
    const footprint=variantFootprints.get(m?.variantId);
    if (!footprint) fail();
    const [width,depth,asset]=footprint;
    if (m.schema!=='house-variant-runtime-v1' || m.familyId!=='house.master.a' || m.physicalWidth!==2048 || m.physicalHeight!==2048 || m.logicalWidth!==512 || m.logicalHeight!==512) fail();
    if (![m.anchorPixelX,m.anchorPixelY].every(v=>Number.isFinite(v)&&v>=0&&v<=512)) fail();
    if (!/^sha256:[a-f0-9]{64}$/.test(m.pngSha256) || m.asset!==`${m.variantId}-${m.pngSha256.slice(7)}.png`) fail();
    const b=m.collisionBounds;
    if (!b || b.minX!==-width/2 || b.maxX!==width/2 || b.minY!==-depth || b.maxY!==0 || !m.doorApproach || ![m.doorApproach.x,m.doorApproach.y].every(Number.isFinite)) fail();
    return {x,y,w:width,h:depth,type:'governedHouseA',asset,label:asset.replace('houseA','A-'),governedTest:true,governedSprite:{logicalWidth:m.logicalWidth,logicalHeight:m.logicalHeight,anchorPixelX:m.anchorPixelX,anchorPixelY:m.anchorPixelY},collisionBounds:{...b},doorApproach:{...m.doorApproach}};
}
export async function loadVariant(base='./world-art/hd-iso-v1/runtime/',variantId='house.a.02') {
    if (!variantFootprints.has(variantId)) throw new Error('Unknown house variant');
    const response=await fetch(base+variantId+'.json',{cache:'no-store'});
    if (!response.ok) throw new Error(variantId+' metadata is not installed');
    const metadata=await response.json();
    if (metadata.variantId!==variantId) throw new Error('House variant mismatch');
    variantStructure(metadata,0,0);
    if (typeof metadata.receipt!=='string' || !metadata.receipt.startsWith(variantId+'-') || !/^[a-f0-9]{64}\.receipt\.json$/.test(metadata.receipt.slice(variantId.length+1))) throw new Error('Invalid house receipt path');
    const r=await fetch(base+metadata.receipt,{cache:'no-store'});
    if (!r.ok) throw new Error('A-02 receipt is not installed');
    const receipt=await r.json();
    const {asset,receipt:receiptFile,...bound}=metadata;
    if (receipt.status!=='PASS' || receipt.variantId!==metadata.variantId || Object.keys(bound).some(k=>JSON.stringify(bound[k])!==JSON.stringify(receipt.metadata?.[k]))) throw new Error('A-02 receipt mismatch');
    const png=await fetch(base+asset,{cache:'no-store'});
    if (!png.ok) throw new Error('A-02 PNG is not installed');
    const bytes=await png.arrayBuffer();
    const hash='sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if (hash!==metadata.pngSha256 || hash!==receipt.hashes?.png) throw new Error('A-02 PNG hash mismatch');
    const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
    if (image.width!==2048 || image.height!==2048) {image.close();throw new Error('A-02 PNG dimensions mismatch');}
    return {metadata,image};
}

export function reviewLayout(hubX,hubY) {
    return {master:{x:hubX+8,y:hubY+7},variant:{x:hubX+3,y:hubY+12},player:{x:hubX+5.5,y:hubY+9.5}};
}
