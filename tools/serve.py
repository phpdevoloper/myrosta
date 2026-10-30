import http.server, socketserver, functools, pathlib

PATH = str(pathlib.Path(__file__).resolve().parent.parent)
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=PATH)
with socketserver.TCPServer(("", 4173), Handler) as httpd:
    httpd.serve_forever()
