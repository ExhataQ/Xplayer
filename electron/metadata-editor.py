import json, os, sys
from mutagen import File
from mutagen.id3 import ID3, APIC, COMM, TXXX, TIT2, TPE1, TALB, TPE2, TCOM, TCON, TDRC, TRCK, TPOS, TPUB, TCOP, TENC, TPE3, TPE4, TBPM, TSRC, TPRO, TEXT, TOLY, TIT3, TMOO, TLAN, TMED
from mutagen.flac import Picture
from mutagen.mp4 import MP4Cover
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
    values=vals(v)
    out=[]
    for item in values:
        for part in str(item).replace(';', ',').split(','):
            part=part.strip()
            if part and part not in out: out.append(part)
    return out

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
                if frame_id in known or (frame_id == 'TXXX' and str(key) in {'TXXX:SORT_TITLE','TXXX:SORT_ARTIST','TXXX:SORT_ALBUM','TXXX:GROUPING','TXXX:COMPILATION','TXXX:MusicBrainz Track Id','TXXX:MusicBrainz Album Id','TXXX:MusicBrainz Artist Id','TXXX:MusicBrainz Release Group Id','TXXX:MusicBrainz Original Album Id','TXXX:DESCRIPTION','TXXX:MOOD'}): continue
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
    r={k:[] if k in multi else '' for k in ['title','artist','album','albumArtist','composer','genre','year','track','trackTotal','discNumber','discTotal','label','copyright','comment','conductor','remixer','sortTitle','sortArtist','sortAlbum','grouping','bpm','compilation','isrc','musicBrainzTrackId','musicBrainzAlbumId','musicBrainzOriginalAlbumId','musicBrainzArtistId','publisher','encodedBy','producer','lyricist','writer','description','mood','language','mediaKind','sortComposer','musicBrainzReleaseGroupId']}
    known=set()
    if isinstance(tags, ID3):
        known.update(['TIT2','TPE1','TALB','TPE2','TCOM','TCON','TDRC','TPUB','TCOP','TPE3','TPE4','TBPM','TSRC','TENC','TRCK','TPOS','COMM','TSOT','TSOP','TSOA','APIC','TPRO','TEXT','TOLY','TIT3','TMOO','TLAN','TMED'])
        r.update(title=first(tags,'TIT2'),artist=frame_values(tags,'TPE1'),album=first(tags,'TALB'),albumArtist=frame_values(tags,'TPE2'),composer=frame_values(tags,'TCOM'),genre=frame_values(tags,'TCON'),year=first(tags,'TDRC'),label=first(tags,'TPUB'),copyright=first(tags,'TCOP'),conductor=frame_values(tags,'TPE3'),remixer=frame_values(tags,'TPE4'),bpm=first(tags,'TBPM'),isrc=first(tags,'TSRC'),sortTitle=first(tags,'TSOT') or first(tags,'TXXX:SORT_TITLE'),sortArtist=first(tags,'TSOP') or first(tags,'TXXX:SORT_ARTIST'),sortAlbum=first(tags,'TSOA') or first(tags,'TXXX:SORT_ALBUM'),grouping=first(tags,'TXXX:GROUPING'),compilation=first(tags,'TXXX:COMPILATION'),encodedBy=first(tags,'TENC'),producer=first(tags,'TPRO'),lyricist=first(tags,'TEXT') or first(tags,'TOLY'),writer=first(tags,'TEXT'),description=first(tags,'TIT3') or first(tags,'TXXX:DESCRIPTION'),mood=first(tags,'TMOO') or first(tags,'TXXX:MOOD'),language=first(tags,'TLAN'),mediaKind=first(tags,'TMED'),sortComposer=first(tags,'TSOC'),musicBrainzReleaseGroupId=first(tags,'TXXX:MusicBrainz Release Group Id'))
        r['track'],r['trackTotal']=split_num(first(tags,'TRCK')); r['discNumber'],r['discTotal']=split_num(first(tags,'TPOS'))
        cs=tags.getall('COMM'); r['comment']=str(cs[0].text[0]) if cs and cs[0].text else ''
        r['musicBrainzTrackId']=first(tags,'TXXX:MusicBrainz Track Id')
        r['musicBrainzAlbumId']=first(tags,'TXXX:MusicBrainz Album Id')
        r['musicBrainzOriginalAlbumId']=first(tags,'TXXX:MusicBrainz Original Album Id')
        r['musicBrainzArtistId']=frame_values(tags,'TXXX:MusicBrainz Artist Id')
    else:
        r.update(title=first(tags,'title'),artist=ev(tags,'artist'),album=first(tags,'album'),albumArtist=ev(tags,'albumartist') or ev(tags,'album artist'),composer=ev(tags,'composer'),genre=ev(tags,'genre'),year=first(tags,'date') or first(tags,'year'),label=first(tags,'label'),copyright=first(tags,'copyright'),comment=first(tags,'comment'),conductor=ev(tags,'conductor'),remixer=ev(tags,'remixer'),sortTitle=first(tags,'titlesort'),sortArtist=first(tags,'artistsort'),sortAlbum=first(tags,'albumsort'),grouping=first(tags,'grouping'),bpm=first(tags,'bpm'),compilation=first(tags,'compilation'),isrc=first(tags,'isrc'),musicBrainzTrackId=first(tags,'musicbrainz_trackid'),musicBrainzAlbumId=first(tags,'musicbrainz_albumid'),musicBrainzOriginalAlbumId=first(tags,'musicbrainz_originalalbumid'),musicBrainzArtistId=ev(tags,'musicbrainz_artistid'),musicBrainzReleaseGroupId=first(tags,'musicbrainz_releasegroupid'),publisher=first(tags,'publisher'),encodedBy=first(tags,'encoded-by'),producer=first(tags,'producer'),lyricist=first(tags,'lyricist'),writer=first(tags,'writer'),description=first(tags,'description'),mood=first(tags,'mood'),language=first(tags,'language'),mediaKind=first(tags,'media kind') or first(tags,'mediakind'),sortComposer=first(tags,'composer sort'))
        r['track'],r['trackTotal']=split_num(first(tags,'tracknumber')); r['discNumber'],r['discTotal']=split_num(first(tags,'discnumber'))
        known.update(['title','artist','album','albumartist','album artist','composer','genre','date','year','label','copyright','comment','conductor','remixer','titlesort','artistsort','albumsort','grouping','bpm','compilation','isrc','musicbrainz_trackid','musicbrainz_albumid','musicbrainz_artistid','musicbrainz_releasegroupid','publisher','encoded-by','producer','lyricist','writer','description','mood','language','media kind','mediakind','sortcomposer','tracknumber','discnumber'])
    r['otherTags']=other_tags(tags, known)
    r['cover']=extract_cover(audio)
    return r

def clean(v):
    if isinstance(v, list): return ', '.join(str(x).strip() for x in v if str(x).strip())
    return str(v or '').strip()

def multi_values(v):
    return multi_tag_values(v)

def save_metadata(path, d):
    audio = File(path, easy=False)
    if audio is None: raise RuntimeError('Unsupported or unreadable audio file')
    if audio.tags is None: audio.add_tags()
    tags = audio.tags
    if isinstance(tags, ID3):
        def set_text(frame_cls, frame_id, key):
            tags.delall(frame_id); value=clean(d.get(key))
            if value: tags.add(frame_cls(encoding=3,text=[value]))
        def set_multi(frame_cls, frame_id, key):
            tags.delall(frame_id); values=multi_values(d.get(key))
            if values: tags.add(frame_cls(encoding=3,text=values))
        def set_txxx(desc,key,multi=False):
            tags.delall('TXXX:'+desc); values=multi_values(d.get(key)) if multi else ([clean(d.get(key))] if clean(d.get(key)) else [])
            if values: tags.add(TXXX(encoding=3,desc=desc,text=values))
        set_text(TIT2,'TIT2','title'); set_multi(TPE1,'TPE1','artist'); set_text(TALB,'TALB','album'); set_multi(TPE2,'TPE2','albumArtist'); set_multi(TCOM,'TCOM','composer'); set_multi(TCON,'TCON','genre'); set_text(TDRC,'TDRC','year'); set_text(TPUB,'TPUB','publisher'); set_text(TCOP,'TCOP','copyright'); set_multi(TPE3,'TPE3','conductor'); set_multi(TPE4,'TPE4','remixer'); set_text(TBPM,'TBPM','bpm'); set_text(TSRC,'TSRC','isrc'); set_text(TENC,'TENC','encodedBy'); set_text(TPRO,'TPRO','producer'); set_text(TEXT,'TEXT','writer'); set_text(TOLY,'TOLY','lyricist'); set_text(TIT3,'TIT3','description'); set_text(TMOO,'TMOO','mood'); set_text(TLAN,'TLAN','language'); set_text(TMED,'TMED','mediaKind')
        for desc,key,multi in [('SORT_TITLE','sortTitle',False),('SORT_ARTIST','sortArtist',False),('SORT_ALBUM','sortAlbum',False),('GROUPING','grouping',False),('COMPILATION','compilation',False),('MusicBrainz Track Id','musicBrainzTrackId',False),('MusicBrainz Album Id','musicBrainzAlbumId',False),('MusicBrainz Original Album Id','musicBrainzOriginalAlbumId',False),('MusicBrainz Artist Id','musicBrainzArtistId',True),('MusicBrainz Release Group Id','musicBrainzReleaseGroupId',False)]: set_txxx(desc,key,multi)
        from mutagen.id3 import Frames
        for frame_id,key in [('TSOT','sortTitle'),('TSOP','sortArtist'),('TSOA','sortAlbum')]:
            tags.delall(frame_id); value=clean(d.get(key)); cls=Frames.get(frame_id)
            if value and cls: tags.add(cls(encoding=3,text=[value]))
        tags.delall('TRCK'); track=clean(d.get('track')); total=clean(d.get('trackTotal'))
        if track: tags.add(TRCK(encoding=3,text=[track+('/'+total if total else '')]))
        tags.delall('TPOS'); disc=clean(d.get('discNumber')); total=clean(d.get('discTotal'))
        if disc: tags.add(TPOS(encoding=3,text=[disc+('/'+total if total else '')]))
        tags.delall('COMM'); comment=clean(d.get('comment'))
        if comment: tags.add(COMM(encoding=3,lang='eng',desc='',text=[comment]))
    else:
        mapping={'title':'title','album':'album','year':'date','label':'label','copyright':'copyright','comment':'comment','sortTitle':'titlesort','sortArtist':'artistsort','sortAlbum':'albumsort','grouping':'grouping','bpm':'bpm','compilation':'compilation','isrc':'isrc','musicBrainzTrackId':'musicbrainz_trackid','musicBrainzAlbumId':'musicbrainz_albumid','musicBrainzOriginalAlbumId':'musicbrainz_originalalbumid','publisher':'publisher','encodedBy':'encoded-by'}
        for source_key,tag_key in mapping.items():
            value=clean(d.get(source_key)); tags[tag_key]=[value] if value else tags.pop(tag_key,None)
        multi_mapping={'artist':'artist','albumArtist':'albumartist','composer':'composer','genre':'genre','conductor':'conductor','remixer':'remixer','musicBrainzArtistId':'musicbrainz_artistid'}
        for source_key,tag_key in multi_mapping.items():
            values=multi_values(d.get(source_key));
            if values: tags[tag_key]=values
            else: tags.pop(tag_key,None)
        track=clean(d.get('track')); total=clean(d.get('trackTotal')); tags['tracknumber']=[track+('/'+total if total else '')] if track else tags.pop('tracknumber',None)
        disc=clean(d.get('discNumber')); total=clean(d.get('discTotal')); tags['discnumber']=[disc+('/'+total if total else '')] if disc else tags.pop('discnumber',None)
    if isinstance(tags, ID3): audio.save(v2_version=4)
    else: audio.save()
    if clean(d.get('__coverPath')): save_cover(path,clean(d.get('__coverPath')))
    return read_metadata(path)

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
        r=save_metadata(p,md)
    elif action=='cover': r=save_cover(p,q.get('imagePath'))
    else: r={'success':True,'metadata':read_metadata(p)}
    if action=='cover': print(json.dumps(r,ensure_ascii=False)); return
    print(json.dumps({'success':True,'metadata':r},ensure_ascii=False))
if __name__=='__main__':
    try: main()
    except Exception as e: print(json.dumps({'success':False,'error':str(e)})); sys.exit(1)
