!macro preInit
    ; Set default installation directory to Program Files
    SetRegView 64
    StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCT_NAME}"
!macroend
