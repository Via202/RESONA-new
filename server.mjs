import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.gltf':'model/gltf+json','.png':'image/png','.txt':'text/plain'};
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
    const content=await readFile(file);
    const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes'};
    // Audio players request byte ranges to discover duration and seek reliably.
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      let start=match?.[1]?Number(match[1]):0;
      let end=match?.[2]?Number(match[2]):content.length-1;
      if(match && !match[1] && match[2]){start=Math.max(0,content.length-Number(match[2]));end=content.length-1;}
      end=Math.min(end,content.length-1);
      if(!match||start>end||start>=content.length){res.writeHead(416,{'Content-Range':`bytes */${content.length}`});res.end();return;}
      res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${content.length}`,'Content-Length':end-start+1});res.end(content.subarray(start,end+1));return;
    }
    res.writeHead(200,{...headers,'Content-Length':content.length});res.end(content);
  }catch{res.writeHead(404);res.end('File not found');}
}).listen(5173,'127.0.0.1',()=>console.log('RESONA: http://127.0.0.1:5173'));
