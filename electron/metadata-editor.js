const { spawn } = require('child_process');
const path = require('path');
function runMetadataPython(request) {
    return new Promise((resolve) => {
        const script=path.join(__dirname,'metadata-editor.py'); const candidates=process.platform==='win32'?['python','py']:['python3','python']; let i=0;
        const next=()=>{ if(i>=candidates.length){resolve({success:false,error:'Python runtime not found'});return;} const cmd=candidates[i++], args=cmd==='py'?['-3',script]:[script]; let out='',err=''; let child;
            try{child=spawn(cmd,args,{windowsHide:true});}catch(e){next();return;}
            child.stdout.on('data',c=>out+=c); child.stderr.on('data',c=>err+=c); child.on('error',()=>next()); child.on('close',code=>{if(code!==0&&!out){next();return;} try{resolve(JSON.parse(out.trim()));}catch(e){resolve({success:false,error:err.trim()||'Metadata operation failed'});}}); child.stdin.end(JSON.stringify(request)); };
        next();
    });
}
function fileUrlToPath(fileUrl){if(!fileUrl)return ''; try{const u=new URL(fileUrl);let p=decodeURIComponent(u.pathname);if(process.platform==='win32'&&/^\/[A-Za-z]:/.test(p))p=p.slice(1);return p.replace(/\//g,path.sep);}catch(e){return String(fileUrl).replace(/^file:\/\//,'').replace(/\//g,path.sep);}}
const getAudioMetadata=(fileUrl)=>runMetadataPython({action:'read',path:fileUrlToPath(fileUrl)});
const saveAudioMetadata=(fileUrl,metadata,coverPath='')=>runMetadataPython({action:'save',path:fileUrlToPath(fileUrl),metadata,coverPath});
const saveAudioCover=(fileUrl,imagePath)=>runMetadataPython({action:'cover',path:fileUrlToPath(fileUrl),imagePath});
module.exports={getAudioMetadata,saveAudioMetadata,saveAudioCover};
