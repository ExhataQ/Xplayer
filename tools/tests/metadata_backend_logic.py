"""Logic tests for electron/metadata-editor.py using a stand-in for mutagen (helpers/fake_mutagen.py).
They check WHICH tags this project's code keeps, writes or deletes, and the JSON protocol.
They cannot prove real-mutagen file behaviour; test real files by hand after changing this script."""
import io, json, os, sys, tempfile, unittest, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'helpers'))
import fake_mutagen as fm
SCRIPT = os.environ.get('METADATA_SCRIPT') or os.path.join(HERE, '..', '..', 'electron', 'metadata-editor.py')
F = fm.frame_cls

def load(audio):
    fm.install(audio)
    spec = importlib.util.spec_from_file_location('metadata_editor_under_test', SCRIPT)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod

def call(mod, request):
    """Run the script's real main() with a JSON request on stdin, return the parsed JSON reply."""
    tmp = tempfile.NamedTemporaryFile(suffix='.mp3', delete=False); tmp.close()
    request = dict(request, path=tmp.name)
    old_in, old_out = sys.stdin, sys.stdout
    sys.stdin, sys.stdout = io.StringIO(json.dumps(request)), io.StringIO()
    try:
        mod.main(); return json.loads(sys.stdout.getvalue())
    finally:
        sys.stdin, sys.stdout = old_in, old_out; os.unlink(tmp.name)

def id3_file():
    t = fm.ID3()
    t.add(F['TIT2'](text=['Old title'])); t.add(F['TPE1'](text=['Earth, Wind & Fire'])); t.add(F['TALB'](text=['Jazz']))
    t.add(F['TCOP'](text=['(c) EMI'])); t.add(F['TPUB'](text=['EMI'])); t.add(F['TENC'](text=['LAME'])); t.add(F['TRCK'](text=['7/13']))
    t.add(F['TEXT'](text=['Freddie'])); t.add(F['TSOT'](text=['Old title, The']))
    t.add(F['COMM'](text=['0000 00000A 000'], desc='iTunNORM', lang='eng'))
    t.add(F['COMM'](text=['my comment'], desc='', lang='eng'))
    return fm.File_(t)

class Id3Save(unittest.TestCase):
    def test_read_reply_is_not_double_wrapped(self):
        r = call(load(id3_file()), {'action': 'read'})
        self.assertTrue(r['success']); self.assertIn('title', r['metadata']); self.assertEqual(r['metadata']['title'], 'Old title')

    def test_read_does_not_split_artist_on_commas(self):
        r = call(load(id3_file()), {'action': 'read'})
        self.assertEqual(r['metadata']['artist'], ['Earth, Wind & Fire'])

    def test_read_comment_ignores_itunes_frames(self):
        r = call(load(id3_file()), {'action': 'read'})
        self.assertEqual(r['metadata']['comment'], 'my comment')

    def test_patch_changes_only_what_was_sent(self):
        audio = id3_file(); before = set(audio.tags.keys()); mod = load(audio)
        r = call(mod, {'action': 'save', 'metadata': {'title': 'New title'}})
        self.assertTrue(r['success']); self.assertEqual(str(audio.tags.get('TIT2')), 'New title')
        self.assertEqual(before, set(audio.tags.keys()), 'no other tag may be added or deleted by a title edit')
        for key in ('TCOP', 'TPUB', 'TENC', 'TEXT', 'TSOT', 'COMM:iTunNORM:eng'): self.assertIn(key, audio.tags)
        self.assertEqual(str(audio.tags.get('TPE1')), 'Earth, Wind & Fire')

    def test_artist_list_is_written_as_is_without_splitting(self):
        audio = id3_file(); mod = load(audio)
        call(mod, {'action': 'save', 'metadata': {'artist': ['Earth, Wind & Fire']}})
        self.assertEqual(audio.tags.get('TPE1').text, ['Earth, Wind & Fire'])
        call(mod, {'action': 'save', 'metadata': {'artist': ['A', 'B']}})
        self.assertEqual(audio.tags.get('TPE1').text, ['A', 'B'])

    def test_empty_value_clears_only_that_field(self):
        audio = id3_file(); mod = load(audio)
        call(mod, {'action': 'save', 'metadata': {'label': ''}})
        self.assertNotIn('TPUB', audio.tags); self.assertIn('TCOP', audio.tags)

    def test_label_edit_is_written(self):
        audio = id3_file(); mod = load(audio)
        call(mod, {'action': 'save', 'metadata': {'label': 'Parlophone'}})
        self.assertEqual(str(audio.tags.get('TPUB')), 'Parlophone')

    def test_track_number_edit_keeps_total(self):
        audio = id3_file(); mod = load(audio)
        call(mod, {'action': 'save', 'metadata': {'track': '9'}}); self.assertEqual(str(audio.tags.get('TRCK')), '9/13')
        call(mod, {'action': 'save', 'metadata': {'trackTotal': ''}}); self.assertEqual(str(audio.tags.get('TRCK')), '9')

    def test_comment_edit_keeps_itunes_frames(self):
        audio = id3_file(); mod = load(audio)
        call(mod, {'action': 'save', 'metadata': {'comment': 'edited'}})
        self.assertEqual(str(audio.tags.get('COMM::eng')), 'edited'); self.assertIn('COMM:iTunNORM:eng', audio.tags)
        call(mod, {'action': 'save', 'metadata': {'comment': ''}})
        self.assertNotIn('COMM::eng', audio.tags); self.assertIn('COMM:iTunNORM:eng', audio.tags)

    def test_unsupported_field_is_reported_not_silently_dropped(self):
        r = call(load(id3_file()), {'action': 'save', 'metadata': {'sortComposer': 'x'}})
        self.assertTrue(r['success']); self.assertEqual(r.get('skipped'), ['sortComposer'])

class VorbisSave(unittest.TestCase):
    def make(self):
        tags = fm.VorbisTags({'title': ['T'], 'label': ['EMI'], 'copyright': ['(c)'], 'artist': ['Earth, Wind & Fire'], 'replaygain_track_gain': ['-7 dB']})
        return fm.File_(tags)

    def test_clearing_a_field_really_clears_it(self):
        audio = self.make(); call(load(audio), {'action': 'save', 'metadata': {'label': ''}})
        self.assertNotIn('label', audio.tags)

    def test_untouched_and_unknown_tags_survive(self):
        audio = self.make(); call(load(audio), {'action': 'save', 'metadata': {'title': 'New'}})
        self.assertEqual(audio.tags['title'], ['New'])
        for key in ('label', 'copyright', 'artist', 'replaygain_track_gain'): self.assertIn(key, audio.tags)

    def test_unsupported_field_is_reported(self):
        r = call(load(self.make()), {'action': 'save', 'metadata': {'mood': 'Happy'}})
        self.assertEqual(r.get('skipped'), ['mood'])

class Mp4Guard(unittest.TestCase):
    def test_text_edit_on_mp4_is_refused_not_written(self):
        audio = fm.MP4(fm.VorbisTags({}))
        with self.assertRaises(RuntimeError): call(load(audio), {'action': 'save', 'metadata': {'title': 'x'}})

if __name__ == '__main__':
    unittest.main(verbosity=2)
