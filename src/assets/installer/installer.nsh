; Extra steps for the Windows installer (package.json build.nsis.include). Not compiled in the test suite: build the installer to try it.

; electron-builder adds the "Xplayer" folder only when the chosen path does not contain the word anywhere (D:\Xplayer-old\music stays as it is).
; This page runs after the folder page and makes the rule exact: the folder always ends in \Xplayer, like other installers.
!macro customPageAfterChangeDir
  Page custom xpDirFixPre
  Function xpDirFixPre
    ${ifNot} ${isUpdated} ; an update goes where the app already is
      StrCpy $0 $INSTDIR 1 -1
      ${if} $0 == "\"
        StrCpy $INSTDIR $INSTDIR -1
      ${endIf}
      StrLen $1 "\${APP_FILENAME}"
      StrCpy $0 $INSTDIR "" -$1
      ${if} $0 != "\${APP_FILENAME}"
        StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
      ${endIf}
    ${endIf}
    Abort ; no page is shown
  FunctionEnd
!macroend

; The library, playlists and settings live in %APPDATA%\Xplayer. Uninstalling asks whether they go too (default: keep). Not asked on an
; update, and a silent uninstall keeps them.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Also delete your Xplayer library, playlists and settings?$\r$\n$\r$\nChoose No to keep them for a later install." /SD IDNO IDNO xpKeepData
    SetShellVarContext current
    RMDir /r "$APPDATA\${APP_FILENAME}"
    xpKeepData:
  ${endIf}
!macroend
