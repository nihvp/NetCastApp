import socket
import urllib.request
import urllib.error
import json
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 3000
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')

class ProxyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_GET(self):
        if self.path == '/api/discover':
            self.discover_tv()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/tv':
            self.proxy_tv()
        else:
            self.send_error(404, "Not Found")

    def discover_tv(self):
        msg = (
            'M-SEARCH * HTTP/1.1\r\n'
            'HOST: 239.255.255.250:1900\r\n'
            'MAN: "ssdp:discover"\r\n'
            'MX: 3\r\n'
            'ST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n\r\n'
        )
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(3.0)
        
        tv_ip = None
        try:
            sock.sendto(msg.encode('utf-8'), ('239.255.255.250', 1900))
            while True:
                data, addr = sock.recvfrom(1024)
                response = data.decode('utf-8')
                if 'LG' in response or 'NetCast' in response or 'roap' in response.lower():
                    tv_ip = addr[0]
                    break
        except socket.timeout:
            pass
        finally:
            sock.close()

        if tv_ip:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ip': tv_ip}).encode('utf-8'))
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'No LG TV found on network'}).encode('utf-8'))

    def proxy_tv(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            ip = data.get('ip')
            endpoint = data.get('endpoint')
            xml_payload = data.get('xml')
            
            if not ip or not endpoint or not xml_payload:
                raise ValueError("Missing parameters")
                
            url = f"http://{ip}:8080/roap/api/{endpoint}"
            
            req = urllib.request.Request(
                url, 
                data=xml_payload.encode('utf-8'),
                headers={'Content-Type': 'application/atom+xml'},
                method='POST'
            )
            
            with urllib.request.urlopen(req, timeout=5) as response:
                result = response.read()
                
            self.send_response(200)
            self.send_header('Content-Type', 'application/xml')
            self.end_headers()
            self.wfile.write(result)
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

if __name__ == '__main__':
    print(f"NetCast Proxy Server running on http://0.0.0.0:{PORT}")
    server = HTTPServer(('0.0.0.0', PORT), ProxyHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
