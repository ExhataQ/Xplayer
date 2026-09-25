import json, os, sys
from mutagen import File
from mutagen.id3 import ID3, APIC, COMM, TXXX, TIT2, TPE1, TALB, TPE2, TCOM, TCON, TDRC, TRCK, TPOS, TPUB, TCOP, TENC, TPE3, TPE4, TBPM, TSRC, TPRO, TEXT, TOLY, TIT3, TMOO, TLAN, TMED, TSOC
from mutagen.flac import Picture
from mutagen.mp4 import MP4, MP4Cover
from mutagen.asf import ASF, ASFByteArrayAttribute

def vals(v):
    if v is None: return []
    if isinstance(v, (list, tuple)): raw=[str(x) for x in v if x is not None and str(x) != '']
    else: raw=[str(v)]
    out=[]
    for item in raw:
        out.extend([part for part in item.split('\x00') if part != ''])
    return out

def multi_tag_values(v):
    # Commas are NOT separators: "Earth, Wind & Fire" and "Tyler, The Creator" are single
    # names. Only NUL (handled by vals) and ';' are treated as real multi-value separators.
    values=vals(v)
    out=[]
    for item in values:
        for part in str(item).split(';'):
            part=part.strip()
            if part and part not in out: out.append(part)
    return out

def user_comment_frame(tags):
    # An ID3 file can hold many COMM frames (iTunNORM, iTunSMPB, ...). The editor's
    # "Comment" is the one with an empty description, else the first non-iTunes one.
    frames=tags.getall('COMM')
    for f in frames:
        if (f.desc or '')=='': return f
    for f in frames:
        if not (f.desc or '').lower().startswith('itun'): return f
    return None

def first(tags,key):
    a=vals(tags.get(key) if tags else None); return a[0] if a else ''

def all_values(tags,key):
    return vals(tags.get(key) if tags else None)

def ev(tags,key):
    return multi_tag_values(tags.get(key))

def split_num(v):
    a=vals(v)
    s=a[0] if a else ''
    if '/' in s: return [x.strip() for x in s.split('/',1)]
    return [s.strip(),'']

def frame_values(tags, key):
    return multi_tag_values(tags.get(key)) if tags else []

def tag_values(tags, key):
    if not tags: return []
    try: return vals(tags.get(key))
    except Exception: return []

def extract_cover(audio):
    try:
        import base64
        if isinstance(audio.tags, ID3):
            frames = audio.tags.getall('APIC')
            if not frames: return None
            frame = next((x for x in frames if getattr(x, 'type', None) == 3), frames[0])
            data = bytes(frame.data)
            if len(data) > 6 * 1024 * 1024: return None
            return {'data': base64.b64encode(data).decode('ascii'), 'mime': getattr(frame, 'mime', 'image/jpeg') or 'image/jpeg'}
        ext=os.path.splitext(getattr(audio, 'filename', '') or '')[1].lower()
        if ext == '.flac':
            pictures=getattr(audio, 'pictures', []) or []
            if pictures:
                pic=next((x for x in pictures if getattr(x, 'type', None) == 3), pictures[0])
                data=bytes(pic.data)
                if len(data) <= 6*1024*1024: return {'data':base64.b64encode(data).decode('ascii'),'mime':getattr(pic,'mime','image/jpeg') or 'image/jpeg'}
        if ext in ('.m4a','.mp4'):
            covers=(audio.tags or {}).get('covr', []) if audio.tags else []
            if covers:
                cover=covers[0]; data=bytes(cover)
                if len(data) <= 6*1024*1024:
                    mime='image/png' if getattr(cover,'imageformat',None)==MP4Cover.FORMAT_PNG else 'image/jpeg'
                    return {'data':base64.b64encode(data).decode('ascii'),'mime':mime}
        if ext in ('.ogg','.opus') and audio.tags:
            import base64 as b64
            encoded=audio.tags.get('metadata_block_picture')
            if encoded:
                from mutagen.flac import Picture
                raw=b64.b64decode(encoded[0])
                pic=Picture(raw)
                data=bytes(pic.data)
                if len(data) <= 6*1024*1024: return {'data':b64.b64encode(data).decode('ascii'),'mime':pic.mime or 'image/jpeg'}
    except Exception:
        pass
    return None

def other_tags(tags, known):
    result=[]
    if not tags: return result
    try:
        if isinstance(tags, ID3):
            for key, frame in tags.items():
                frame_id=str(key).split(':',1)[0]
                if frame_id in known or (frame_id == 'TXXX' and str(key) in {
                    'TXXX:SORT_TITLE','TXXX:SORT_ARTIST','TXXX:SORT_ALBUM','TXXX:GROUPING',
                    'TXXX:COMPILATION','TXXX:MusicBrainz Track Id','TXXX:MusicBrainz Album Id',
                    'TXXX:MusicBrainz Artist Id','TXXX:MusicBrainz Release Group Id',
                    'TXXX:MusicBrainz Original Album Id','TXXX:DESCRIPTION','TXXX:MOOD','TXXX:WRITER'
                }): continue
                if frame_id == 'APIC': continue
                values=[]
                if hasattr(frame,'text'): values=vals(frame.text)
                elif hasattr(frame,'url'): values=[str(frame.url)]
                elif hasattr(frame,'data') and isinstance(frame.data,(str,bytes)):
                    values=[str(frame.data)]
                if values: result.append({'key':str(key),'values':values})
        else:
            for key, value in tags.items():
                key=str(key)
                if key.lower() in known: continue
                values=vals(value)
                if values: result.append({'key':key,'values':values})
    except Exception:
        pass
    return sorted(result, key=lambda x:x['key'].lower())

def read_metadata(path):
    audio=File(path,easy=False)
    if audio is None: raise RuntimeError('Unsupported or unreadable audio file')
    tags=audio.tags or {}
    multi=['artist','albumArtist','composer','genre','conductor','remixer','musicBrainzArtistId']
    all_fields = [
        'title','artist','album','albumArtist','composer','genre','year','track','trackTotal',
        'discNumber','discTotal','label','copyright','comment','conductor','remixer','sortTitle',
        'sortArtist','sortAlbum','grouping','bpm','compilation','isrc','musicBrainzTrackId',
        'musicBrainzAlbumId','musicBrainzOriginalAlbumId','musicBrainzArtistId','publisher',
        'encodedBy','producer','lyricist','writer','description','mood','language','mediaKind',
        'sortComposer','musicBrainzReleaseGroupId'
    ]
    r={k:[] if k in multi else '' for k in all_fields}
    known=set()
    if isinstance(tags, ID3):
        known.update([
            'TIT2','TPE1','TALB','TPE2','TCOM','TCON','TDRC','TPUB','TCOP','TPE3','TPE4','TBPM',
            'TSRC','TENC','TRCK','TPOS','COMM','TSOT','TSOP','TSOA','TSOC','APIC','TPRO','TEXT',
            'TOLY','TIT3','TMOO','TLAN','TMED'
        ])
        r.update(
            title=first(tags,'TIT2'),artist=frame_values(tags,'TPE1'),album=first(tags,'TALB'),
            albumArtist=frame_values(tags,'TPE2'),composer=frame_values(tags,'TCOM'),
            genre=frame_values(tags,'TCON'),year=first(tags,'TDRC'),label=first(tags,'TPUB'),
            copyright=first(tags,'TCOP'),conductor=frame_values(tags,'TPE3'),
            remixer=frame_values(tags,'TPE4'),bpm=first(tags,'TBPM'),isrc=first(tags,'TSRC'),
            sortTitle=first(tags,'TSOT') or first(tags,'TXXX:SORT_TITLE'),
            sortArtist=first(tags,'TSOP') or first(tags,'TXXX:SORT_ARTIST'),
            sortAlbum=first(tags,'TSOA') or first(tags,'TXXX:SORT_ALBUM'),
            grouping=first(tags,'TXXX:GROUPING'),compilation=first(tags,'TXXX:COMPILATION'),
            encodedBy=first(tags,'TENC'),producer=first(tags,'TPRO'),
            lyricist=first(tags,'TEXT') or first(tags,'TOLY'),writer=first(tags,'TXXX:WRITER'),
            description=first(tags,'TIT3') or first(tags,'TXXX:DESCRIPTION'),
            mood=first(tags,'TMOO') or first(tags,'TXXX:MOOD'),language=first(tags,'TLAN'),
            mediaKind=first(tags,'TMED'),sortComposer=first(tags,'TSOC'),
            musicBrainzReleaseGroupId=first(tags,'TXXX:MusicBrainz Release Group Id')
        )
        r['track'],r['trackTotal']=split_num(first(tags,'TRCK')); r['discNumber'],r['discTotal']=split_num(first(tags,'TPOS'))
        cf=user_comment_frame(tags); r['comment']=str(cf.text[0]) if cf is not None and cf.text else ''
        r['musicBrainzTrackId']=first(tags,'TXXX:MusicBrainz Track Id')
        r['musicBrainzAlbumId']=first(tags,'TXXX:MusicBrainz Album Id')
        r['musicBrainzOriginalAlbumId']=first(tags,'TXXX:MusicBrainz Original Album Id')
        r['musicBrainzArtistId']=frame_values(tags,'TXXX:MusicBrainz Artist Id')
    else:
        r.update(
            title=first(tags,'title'),artist=ev(tags,'artist'),album=first(tags,'album'),
            albumArtist=ev(tags,'albumartist') or ev(tags,'album artist'),composer=ev(tags,'composer'),
            genre=ev(tags,'genre'),year=first(tags,'date') or first(tags,'year'),
            label=first(tags,'label'),copyright=first(tags,'copyright'),comment=first(tags,'comment'),
            conductor=ev(tags,'conductor'),remixer=ev(tags,'remixer'),
            sortTitle=first(tags,'titlesort'),sortArtist=first(tags,'artistsort'),
            sortAlbum=first(tags,'albumsort'),grouping=first(tags,'grouping'),bpm=first(tags,'bpm'),
            compilation=first(tags,'compilation'),isrc=first(tags,'isrc'),
            musicBrainzTrackId=first(tags,'musicbrainz_trackid'),
            musicBrainzAlbumId=first(tags,'musicbrainz_albumid'),
            musicBrainzOriginalAlbumId=first(tags,'musicbrainz_originalalbumid'),
            musicBrainzArtistId=ev(tags,'musicbrainz_artistid'),
            musicBrainzReleaseGroupId=first(tags,'musicbrainz_releasegroupid'),
            publisher=first(tags,'publisher'),encodedBy=first(tags,'encoded-by'),
            producer=first(tags,'producer'),lyricist=first(tags,'lyricist'),writer=first(tags,'writer'),
            description=first(tags,'description'),mood=first(tags,'mood'),language=first(tags,'language'),
            mediaKind=first(tags,'media kind') or first(tags,'mediakind'),
            sortComposer=first(tags,'composer sort')
        )
        r['track'],r['trackTotal']=split_num(first(tags,'tracknumber')); r['discNumber'],r['discTotal']=split_num(first(tags,'discnumber'))
        known.update([
            'title','artist','album','albumartist','album artist','composer','genre','date','year',
            'label','copyright','comment','conductor','remixer','titlesort','artistsort','albumsort',
            'grouping','bpm','compilation','isrc','musicbrainz_trackid','musicbrainz_albumid',
            'musicbrainz_artistid','musicbrainz_releasegroupid','publisher','encoded-by','producer',
            'lyricist','writer','description','mood','language','media kind','mediakind','sortcomposer',
            'tracknumber','discnumber'
        ])
    r['otherTags']=other_tags(tags, known)
    r['cover']=extract_cover(audio)
    return r

def clean(v):
    if isinstance(v, list): return ', '.join(str(x).strip() for x in v if str(x).strip())
    return str(v or '').strip()

def multi_values(v):
    # Values to WRITE for a multi-value field. The editor already sends one entry per
    # artist/genre/etc., so we never re-split on commas (that corrupted names).
    if v is None: return []
    items = v if isinstance(v, (list, tuple)) else [v]
    out=[]
    for item in items:
        text=str(item).strip() if item is not None else ''
        if text and text not in out: out.append(text)
    return out

# Save protocol: `d` is a PATCH. A key that is absent is left untouched. A key that is
# present is written; an empty value clears it. (Previously every absent key was deleted.)
# Extension point for editor fields that cannot yet be represented as ID3 frames.
ID3_UNSUPPORTED = set()
VORBIS_TEXT = {
    'title':'title','album':'album','year':'date','label':'label','copyright':'copyright',
    'comment':'comment','sortTitle':'titlesort','sortArtist':'artistsort','sortAlbum':'albumsort',
    'grouping':'grouping','bpm':'bpm','compilation':'compilation','isrc':'isrc',
    'musicBrainzTrackId':'musicbrainz_trackid','musicBrainzAlbumId':'musicbrainz_albumid',
    'musicBrainzOriginalAlbumId':'musicbrainz_originalalbumid','publisher':'publisher',
    'encodedBy':'encoded-by'
}
VORBIS_MULTI = {
    'artist':'artist','albumArtist':'albumartist','composer':'composer','genre':'genre',
    'conductor':'conductor','remixer':'remixer','musicBrainzArtistId':'musicbrainz_artistid'
}
VORBIS_NUMBERED = {'track','trackTotal','discNumber','discTotal'}

def write_id3(tags, d):
    def set_text(frame_cls, frame_id, key):
        if key not in d: return
        tags.delall(frame_id); value=clean(d.get(key))
        if value: tags.add(frame_cls(encoding=3,text=[value]))
    def set_multi(frame_cls, frame_id, key):
        if key not in d: return
        tags.delall(frame_id); values=multi_values(d.get(key))
        if values: tags.add(frame_cls(encoding=3,text=values))
    def set_txxx(desc,key,multi=False):
        if key not in d: return
        tags.delall('TXXX:'+desc); values=multi_values(d.get(key)) if multi else ([clean(d.get(key))] if clean(d.get(key)) else [])
        if values: tags.add(TXXX(encoding=3,desc=desc,text=values))
    set_text(TIT2,'TIT2','title'); set_multi(TPE1,'TPE1','artist'); set_text(TALB,'TALB','album')
    set_multi(TPE2,'TPE2','albumArtist'); set_multi(TCOM,'TCOM','composer'); set_multi(TCON,'TCON','genre')
    set_text(TDRC,'TDRC','year'); set_text(TCOP,'TCOP','copyright'); set_multi(TPE3,'TPE3','conductor')
    set_multi(TPE4,'TPE4','remixer'); set_text(TBPM,'TBPM','bpm'); set_text(TSRC,'TSRC','isrc')
    set_text(TENC,'TENC','encodedBy'); set_text(TPRO,'TPRO','producer'); set_text(TEXT,'TEXT','lyricist')
    set_text(TIT3,'TIT3','description'); set_text(TMOO,'TMOO','mood'); set_text(TLAN,'TLAN','language')
    set_text(TMED,'TMED','mediaKind'); set_text(TSOC,'TSOC','sortComposer')
    # Label and Publisher are the same ID3 frame (TPUB). The editor reads TPUB into "label",
    # so a change to Label must be written there (it used to be ignored while a blank
    # Publisher deleted the frame on every save).
    tpub_key='label' if 'label' in d else ('publisher' if 'publisher' in d else None)
    if tpub_key: set_text(TPUB,'TPUB',tpub_key)
    txxx_fields = [
        ('SORT_TITLE','sortTitle',False),('SORT_ARTIST','sortArtist',False),
        ('SORT_ALBUM','sortAlbum',False),('GROUPING','grouping',False),
        ('COMPILATION','compilation',False),('WRITER','writer',False),
        ('MusicBrainz Track Id','musicBrainzTrackId',False),
        ('MusicBrainz Album Id','musicBrainzAlbumId',False),
        ('MusicBrainz Original Album Id','musicBrainzOriginalAlbumId',False),
        ('MusicBrainz Artist Id','musicBrainzArtistId',True),
        ('MusicBrainz Release Group Id','musicBrainzReleaseGroupId',False)
    ]
    for desc,key,multi in txxx_fields: set_txxx(desc,key,multi)
    from mutagen.id3 import Frames
    for frame_id,key in [('TSOT','sortTitle'),('TSOP','sortArtist'),('TSOA','sortAlbum')]:
        frame_cls=Frames.get(frame_id)
        if frame_cls: set_text(frame_cls,frame_id,key)
    # "n/total" frames: if only one half changed, keep the other half from the file.
    for frame_id,frame_cls,num_key,tot_key in [('TRCK',TRCK,'track','trackTotal'),('TPOS',TPOS,'discNumber','discTotal')]:
        if num_key not in d and tot_key not in d: continue
        cur_num,cur_tot=split_num(first(tags,frame_id))
        num=clean(d.get(num_key)) if num_key in d else cur_num
        tot=clean(d.get(tot_key)) if tot_key in d else cur_tot
        tags.delall(frame_id)
        if num: tags.add(frame_cls(encoding=3,text=[num+('/'+tot if tot else '')]))
    if 'comment' in d:
        # Only replace the user's comment; keep iTunNORM / iTunSMPB and other COMM frames.
        target=user_comment_frame(tags)
        desc=(target.desc or '') if target is not None else ''
        lang=(target.lang or 'eng') if target is not None else 'eng'
        if target is not None: tags.delall('COMM:'+desc)
        comment=clean(d.get('comment'))
        if comment: tags.add(COMM(encoding=3,lang=lang,desc=desc,text=[comment]))
    return sorted(k for k in d if k in ID3_UNSUPPORTED)

def write_vorbis(tags, d):
    def put(tag_key, values):
        # NB: never assign the result of pop(); pop() returns the OLD value, which used to
        # restore a field the user had just cleared.
        if values: tags[tag_key]=values
        else: tags.pop(tag_key,None)
    for source_key,tag_key in VORBIS_TEXT.items():
        if source_key in d:
            value=clean(d.get(source_key)); put(tag_key,[value] if value else [])
    for source_key,tag_key in VORBIS_MULTI.items():
        if source_key in d: put(tag_key,multi_values(d.get(source_key)))
    for frame_key,num_key,tot_key in [('tracknumber','track','trackTotal'),('discnumber','discNumber','discTotal')]:
        if num_key not in d and tot_key not in d: continue
        cur_num,cur_tot=split_num(first(tags,frame_key))
        num=clean(d.get(num_key)) if num_key in d else cur_num
        tot=clean(d.get(tot_key)) if tot_key in d else cur_tot
        put(frame_key,[num+('/'+tot if tot else '')] if num else [])
    supported=set(VORBIS_TEXT)|set(VORBIS_MULTI)|VORBIS_NUMBERED
    return sorted(k for k in d if k not in supported)

def save_metadata(path, d):
    """Apply a metadata PATCH. Returns (full metadata read back, keys that could not be saved)."""
    audio = File(path, easy=False)
    if audio is None: raise RuntimeError('Unsupported or unreadable audio file')
    fields=[k for k in d if not k.startswith('__')]
    skipped=[]
    if fields:
        if isinstance(audio, (MP4, ASF)):
            raise RuntimeError('Editing text tags is not supported yet for M4A/MP4/WMA files (cover art can still be changed).')
        if audio.tags is None: audio.add_tags()
        tags = audio.tags
        patch={k:d[k] for k in fields}
        if isinstance(tags, ID3):
            skipped=write_id3(tags, patch)
            audio.save(v2_version=4)
        else:
            skipped=write_vorbis(tags, patch)
            audio.save()
    if clean(d.get('__coverPath')): save_cover(path,clean(d.get('__coverPath')))
    return read_metadata(path), skipped

def image_mime(path):
    ext=os.path.splitext(path)[1].lower()
    return {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'}.get(ext,'application/octet-stream')

def save_cover(path, image_path):
    if not image_path or not os.path.isfile(image_path): raise RuntimeError('Cover image not found')
    with open(image_path,'rb') as f: data=f.read()
    mime=image_mime(image_path)
    audio=File(path, easy=False)
    if audio is None: raise RuntimeError('Unsupported or unreadable audio file')
    ext=os.path.splitext(path)[1].lower()
    if isinstance(audio.tags, ID3) or ext in ('.wav','.wave','.aiff','.aif','.mp3'):
        if audio.tags is None: audio.add_tags()
        audio.tags.delall('APIC')
        audio.tags.add(APIC(encoding=3,mime=mime,type=3,desc='Cover',data=data))
    elif ext in ('.flac',):
        audio.clear_pictures()
        pic=Picture(); pic.type=3; pic.mime=mime; pic.desc='Cover'; pic.data=data
        audio.add_picture(pic)
    elif ext in ('.ogg','.opus'):
        import base64
        from mutagen.flac import Picture
        pic=Picture(); pic.type=3; pic.mime=mime; pic.desc='Cover'; pic.data=data
        encoded=base64.b64encode(pic.write()).decode('ascii')
        audio['metadata_block_picture']=[encoded]
    elif ext in ('.m4a','.mp4'):
        audio['covr']=[MP4Cover(data, imageformat=MP4Cover.FORMAT_PNG if mime=='image/png' else MP4Cover.FORMAT_JPEG)]
    elif ext in ('.wma',):
        if not isinstance(audio, ASF): raise RuntimeError('WMA cover writing is unavailable for this file')
        picture = (3).to_bytes(4,'little') + len(data).to_bytes(4,'little') + mime.encode('utf-16le') + b'\x00\x00' + 'Cover'.encode('utf-16le') + b'\x00\x00' + data
        audio['WM/Picture']=[ASFByteArrayAttribute(picture)]
    elif ext in ('.ape','.wv'):
        if audio.tags is None: audio.add_tags()
        audio.tags['Cover Art (Front)']=b'cover.jpg\x00'+data
    else:
        raise RuntimeError(f'Cover writing is not supported for {ext or "this file"}')
    audio.save()
    return {'success':True}

def main():
    q=json.loads(sys.stdin.read()); p=q.get('path')
    if not p or not os.path.isfile(p): raise RuntimeError('Audio file not found')
    action=q.get('action')
    if action=='save':
        md=q.get('metadata') or {}
        if q.get('coverPath'): md['__coverPath']=q.get('coverPath')
        meta,skipped=save_metadata(p,md)
        out={'success':True,'metadata':meta}
        if skipped: out['skipped']=skipped
    elif action=='cover':
        out=save_cover(p,q.get('imagePath'))
    else:
        # NB: this used to be wrapped a second time ({'metadata': {'success':..,'metadata':..}}),
        # so the editor never received the real tags on read.
        out={'success':True,'metadata':read_metadata(p)}
    print(json.dumps(out,ensure_ascii=False))
if __name__=='__main__':
    try: main()
    except Exception as e: print(json.dumps({'success':False,'error':str(e)})); sys.exit(1)
