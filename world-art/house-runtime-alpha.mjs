// Compatibility repair for the opaque RGB House A test import.
// This never issues a geometry/proof receipt or alters the source file.
export function clearConnectedBackground(pixels, width, height) {
 if (!Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1 || pixels.length!==width*height*4) {
  throw new Error('RGBA dimensions mismatch');
 }
 // Traverse transparent margins too: a bad opaque matte may sit inside them.
 const count=width*height;
 const visited=new Uint8Array(count);
 const queue=new Uint32Array(count);
 let head=0,tail=0;
 const enqueue=(index)=>{
  if(visited[index])return;
  visited[index]=1;
  const offset=index*4;
  if(pixels[offset+3]>0 && (pixels[offset]>3 || pixels[offset+1]>3 || pixels[offset+2]>3))return;
  queue[tail++]=index;
 };
 for(let x=0;x<width;x++){enqueue(x);enqueue((height-1)*width+x);}
 for(let y=0;y<height;y++){enqueue(y*width);enqueue(y*width+width-1);}
 while(head<tail){
  const index=queue[head++],x=index%width,y=Math.floor(index/width);
  pixels[index*4+3]=0;
  if(x>0)enqueue(index-1);
  if(x+1<width)enqueue(index+1);
  if(y>0)enqueue(index-width);
  if(y+1<height)enqueue(index+width);
 }
 return pixels;
}

export function prepareHouseRuntime(image, document) {
 const canvas=document.createElement('canvas');
 canvas.width=image.naturalWidth || image.width;
 canvas.height=image.naturalHeight || image.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw new Error('House alpha repair requires a 2D canvas');
 ctx.drawImage(image,0,0);
 const rgba=ctx.getImageData(0,0,canvas.width,canvas.height);
 clearConnectedBackground(rgba.data,canvas.width,canvas.height);
 ctx.putImageData(rgba,0,0);
 return canvas;
}
