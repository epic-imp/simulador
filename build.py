#!/usr/bin/env python3
"""
Gera dist/index.html: um único arquivo com CSS, JavaScript e imagens embutidos,
pronto para subir em S3, CloudFront, Amplify ou qualquer hospedagem estática.

Uso:  python3 build.py
"""

import base64
import os
import re
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(RAIZ, "dist")


def ler(*caminho):
    with open(os.path.join(RAIZ, *caminho), encoding="utf-8") as f:
        return f.read()


def data_uri(caminho):
    with open(os.path.join(RAIZ, caminho), "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()


def substituir_unico(texto, antigo, novo):
    if texto.count(antigo) != 1:
        raise ValueError("esperada exatamente uma referência: " + antigo)
    return texto.replace(antigo, novo)


def main():
    html = ler("index.html")
    css = ler("css", "styles.css")
    js = ler("js", "app.js")

    dark = data_uri("img/logo-epic.png")
    light = data_uri("img/logo-epic-branca.png")

    # imagens viram data URI dentro do JS e do favicon
    js = substituir_unico(js, '"img/logo-epic.png"', '"%s"' % dark)
    js = substituir_unico(js, '"img/logo-epic-branca.png"', '"%s"' % light)
    # o HTML recebe um pixel transparente; o app.js troca pela logo real ao carregar.
    # assim cada imagem entra uma unica vez no arquivo final.
    vazio = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAf"
             "FcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
    html = substituir_unico(html, "img/logo-epic-branca.png", vazio)
    html = substituir_unico(html, "img/logo-epic.png", vazio)

    # CSS e JS externos passam a ser embutidos
    html = substituir_unico(html,
        '<link rel="stylesheet" href="css/styles.css">',
        "<style>\n" + css.rstrip() + "\n</style>",
    )
    html = substituir_unico(html,
        '<script src="js/app.js"></script>',
        "<script>\n" + js.rstrip() + "\n</script>",
    )

    externas = [u for u in re.findall(r'(?:src|href)="(?!data:)([^"#]+)"', html)
                if "'" not in u and "+" not in u]
    if externas:
        raise ValueError("sobrou referência externa no HTML: " + ", ".join(externas))

    os.makedirs(DIST, exist_ok=True)
    saida = os.path.join(DIST, "index.html")
    with open(saida, "w", encoding="utf-8") as f:
        f.write(html)

    # cópia com nome próprio, para não confundir com o index.html da raiz
    copia = os.path.join(DIST, "epic-simulador.html")
    with open(copia, "w", encoding="utf-8") as f:
        f.write(html)

    tamanho = os.path.getsize(saida) / 1024
    print("dist/index.html         %.1f KB" % tamanho)
    print("dist/epic-simulador.html  (cópia idêntica, para abrir com dois cliques)")
    print("referências externas: %s" % (externas or "nenhuma — arquivo autossuficiente"))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as erro:
        sys.exit("erro no build: " + str(erro))
