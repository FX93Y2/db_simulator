; Request administrator privileges for the installer
RequestExecutionLevel admin

!macro preInit
    ; Set default installation directory to Program Files
    SetRegView 64
    StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCT_NAME}"
!macroend

!macro customInit
    ; Ensure we have administrator privileges
    UserInfo::GetAccountType
    pop $0
    ${If} $0 != "admin" ; Require admin rights on NT4+
        MessageBox mb_iconstop "Administrator rights required!"
        SetErrorLevel 740 ; ERROR_ELEVATION_REQUIRED
        Quit
    ${EndIf}
!macroend

!macro customInstall
    ; Create shortcuts that run as administrator
    CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}" "" "$INSTDIR\${PRODUCT_FILENAME}" 0 SW_SHOWNORMAL "" "Run as Administrator"
    
    ; Set the shortcut to run as administrator using PowerShell
    ExecWait 'powershell -Command "$$WshShell = New-Object -comObject WScript.Shell; $$Shortcut = $$WshShell.CreateShortcut(\"$$env:PUBLIC\\Desktop\\${PRODUCT_NAME}.lnk\"); $$Shortcut.Save(); $$bytes = [System.IO.File]::ReadAllBytes(\"$$env:PUBLIC\\Desktop\\${PRODUCT_NAME}.lnk\"); $$bytes[21] = $$bytes[21] -bor 32; [System.IO.File]::WriteAllBytes(\"$$env:PUBLIC\\Desktop\\${PRODUCT_NAME}.lnk\", $$bytes)"'
    
    ; Create Start Menu shortcut that runs as administrator
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}" "" "$INSTDIR\${PRODUCT_FILENAME}" 0 SW_SHOWNORMAL "" "Run as Administrator"
    
    ; Set the Start Menu shortcut to run as administrator
    ExecWait 'powershell -Command "$$WshShell = New-Object -comObject WScript.Shell; $$Shortcut = $$WshShell.CreateShortcut(\"$$env:ALLUSERSPROFILE\\Microsoft\\Windows\\Start Menu\\Programs\\${PRODUCT_NAME}\\${PRODUCT_NAME}.lnk\"); $$Shortcut.Save(); $$bytes = [System.IO.File]::ReadAllBytes(\"$$env:ALLUSERSPROFILE\\Microsoft\\Windows\\Start Menu\\Programs\\${PRODUCT_NAME}\\${PRODUCT_NAME}.lnk\"); $$bytes[21] = $$bytes[21] -bor 32; [System.IO.File]::WriteAllBytes(\"$$env:ALLUSERSPROFILE\\Microsoft\\Windows\\Start Menu\\Programs\\${PRODUCT_NAME}\\${PRODUCT_NAME}.lnk\", $$bytes)"'
!macroend

!macro customUnInstall
    ; Ask user if they want to remove user data (projects, settings, etc.)
    MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to remove all user data (projects, configurations, and settings)?$\n$\nThis data is stored in: $APPDATA\${PRODUCT_NAME}$\n$\nClick 'No' to keep your data for future use." IDYES removeUserData IDNO skipRemoveUserData
    
    removeUserData:
        ; Remove user data directory
        RMDir /r "$APPDATA\${PRODUCT_NAME}"
        ; Also clean up any local app data if it exists
        RMDir /r "$LOCALAPPDATA\${PRODUCT_NAME}"
        Goto endRemoveUserData
    
    skipRemoveUserData:
        ; User chose to keep data, do nothing
    
    endRemoveUserData:
!macroend
