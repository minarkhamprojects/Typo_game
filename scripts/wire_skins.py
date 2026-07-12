#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Conecta skins.css + skins.js + el filtro de tinta en index.html."""
import io, sys, pathlib

p = pathlib.Path("/Users/minpeniche/Developer/Typo_game/index.html")
src = io.open(p, encoding="utf-8").read()
orig = src

# 1) fuentes de manga
OLD_FONTS = '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Archivo:wght@600;700;800;900&family=VT323&display=swap" rel="stylesheet" />'
NEW_FONTS = '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Archivo:wght@600;700;800;900&family=VT323&family=Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap" rel="stylesheet" />'
if OLD_FONTS in src:
    src = src.replace(OLD_FONTS, NEW_FONTS, 1)
    print("fuentes -> +Dela Gothic One, +Zen Kaku Gothic New")

# 2) skins.css despues de style.css
OLD_CSS = '<link rel="stylesheet" href="style.css?v=mp1" />'
if OLD_CSS in src and "skins.css" not in src:
    src = src.replace(OLD_CSS, OLD_CSS + '\n<link rel="stylesheet" href="skins.css?v=1" />', 1)
    print("skins.css -> enlazado")

# 3) el filtro de tinta (linea temblorosa) + skins.js, justo tras <body>
FILTER = '''<body>
  <!-- filtro de tinta: hace temblar la linea. Solo lo usa la skin manga. -->
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <filter id="typo-ink">
      <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="7" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </svg>'''
if "typo-ink" not in src:
    src = src.replace("<body>", FILTER, 1)
    print("filtro de tinta -> inyectado")

# 4) skins.js antes de game.js
OLD_JS = '<script src="game.js'
i = src.find(OLD_JS)
if i != -1 and "skins.js" not in src:
    src = src[:i] + '<script src="skins.js?v=1"></script>\n  ' + src[i:]
    print("skins.js -> enlazado")

if src != orig:
    io.open(p, "w", encoding="utf-8").write(src)
    print("index.html -> actualizado")
else:
    print("index.html -> sin cambios")
