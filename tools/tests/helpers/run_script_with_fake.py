"""Runs electron/metadata-editor.py exactly as Node does (a JSON request on stdin, a JSON reply on stdout, as __main__), with the
stand-in for mutagen from fake_mutagen.py. The logic tests replace stdin and stdout with in-memory text objects, so they never
reach the real encoding of the pipes; this driver does. Usage: python run_script_with_fake.py <path to metadata-editor.py>"""
import json, os, runpy, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fake_mutagen as fm
F = fm.frame_cls
tags = fm.ID3()
tags.add(F['TIT2'](text=['Old title']))
fm.install(fm.File_(tags))
try:
    runpy.run_path(sys.argv[1], run_name='__main__')
finally:
    # What the script stored in the tag itself, as plain ASCII so no code page can change it. This is what would be written to the file.
    frame = tags.get('TIT2')
    sys.stderr.write('STORED:' + json.dumps(frame.text[0] if frame and frame.text else None, ensure_ascii=True) + '\n')
