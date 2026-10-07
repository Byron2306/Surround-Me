export function variantStructure(m,x,y) {
    const fail=()=>{throw new Error('Invalid governed A-02 metadata');};
    if (m.schema!=='house-variant-runtime-v1' || m.variantId!=='house.a.02' || m.familyId!=='house.master.a' || m.physicalWidth!==2048 || m.physicalHeight!==2048 || m.logicalWidth!==512 || m.logicalHeight!==512) fail();
    if (![m.anchorPixelX,m.anchorPixelY].every(v=>Number.isFinite(v)&&v>=0&&v<=512)) fail();
    if (!/^sha256:[a-f0-9]{64}$/.test(m.pngSha256) || m.asset!==`house.a.02-${m.pngSha256.slice(7)}.png`) fail();
    const b=m.collisionBounds;
    if (!b || b.minX!==-1.5 || b.maxX!==1.5 || b.minY!==-3 || b.maxY!==0 || !m.doorApproach || ![m.doorApproach.x,m.doorApproach.y].every(Number.isFinite)) fail();
    return {x,y,w:3,h:3,type:'governedHouseA',asset:'houseA02',label:'[A-02 PILOT]',governedTest:true,governedSprite:{logicalWidth:m.logicalWidth,logicalHeight:m.logicalHeight,anchorPixelX:m.anchorPixelX,anchorPixelY:m.anchorPixelY},collisionBounds:{...b},doorApproach:{...m.doorApproach}};
}
export async function loadVariant(base='./world-art/hd-iso-v1/runtime/') {
    const response=await fetch(base+'house.a.02.json',{cache:'no-store'});
    if (!response.ok) throw new Error('A-02 metadata is not installed');
    const metadata=await response.json();variantStructure(metadata,0,0);
    if (!/^house\.a\.02-[a-f0-9]{64}\.receipt\.json$/.test(metadata.receipt)) throw new Error('Invalid A-02 receipt path');
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
