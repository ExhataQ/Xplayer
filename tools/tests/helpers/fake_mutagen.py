# Minimal in-memory stand-in for the mutagen API surface used by metadata-editor.py.
# It exists ONLY to exercise this project's own logic (which keys get written/kept);
# it cannot prove real-mutagen behaviour.
import sys, types
class Frame:
    def __init__(s, encoding=3, text=None, desc='', lang='eng', **kw): s.text=list(text or []); s.desc=desc; s.lang=lang; s.encoding=encoding
    def __str__(s): return '\x00'.join(s.text)
    @property
    def HashKey(s): return type(s).__name__ if type(s).__name__ not in ('TXXX','COMM') else f"{type(s).__name__}:{s.desc}"+(f":{s.lang}" if type(s).__name__=='COMM' else '')
def mk(name): return type(name,(Frame,),{})
FRAMES="TIT2 TPE1 TALB TPE2 TCOM TCON TDRC TRCK TPOS TPUB TCOP TENC TPE3 TPE4 TBPM TSRC TPRO TEXT TOLY TIT3 TMOO TLAN TMED TSOT TSOP TSOA TSOC COMM TXXX APIC".split()
frame_cls={n:mk(n) for n in FRAMES}
class ID3(dict):
    version=(2,4,0)
    def getall(s,key): return [f for k,f in s.items() if k==key or k.startswith(key+':')]
    def get(s,key,default=None):
        if key in s: return dict.get(s,key)
        r=s.getall(key); return r[0] if r else default
    def delall(s,key):
        if key in s: del s[key]; return
        for k in [k for k in s if k.startswith(key+':')]: del s[k]
    def add(s,f): s[f.HashKey]=f
class VorbisTags(dict):
    # dict with case-insensitive-ish list values, like mutagen's Vorbis comments (pop() returns the old value)
    pass
class File_:
    def __init__(s,tags): s.tags=tags; s.filename='x.mp3'; s.saved=0
    def add_tags(s): s.tags=ID3()
    def save(s,**kw): s.saved+=1
class MP4(File_): pass
def install(audio):
    for n in ['mutagen','mutagen.id3','mutagen.flac','mutagen.mp4','mutagen.asf']: sys.modules[n]=types.ModuleType(n)
    sys.modules['mutagen'].File=lambda path,easy=False: audio
    idm=sys.modules['mutagen.id3']; idm.ID3=ID3
    for n,c in frame_cls.items(): setattr(idm,n,c)
    idm.Frames={n:frame_cls[n] for n in ('TSOT','TSOP','TSOA')}
    sys.modules['mutagen.flac'].Picture=type('Picture',(),{})
    sys.modules['mutagen.mp4'].MP4=MP4; sys.modules['mutagen.mp4'].MP4Cover=type('MP4Cover',(),{'FORMAT_PNG':1,'FORMAT_JPEG':0})
    sys.modules['mutagen.asf'].ASF=type('ASF',(File_,),{}); sys.modules['mutagen.asf'].ASFByteArrayAttribute=type('A',(),{})
