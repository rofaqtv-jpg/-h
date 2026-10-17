"""
Local LAN discovery server for multiplayer rooms.
Uses UDP broadcast for room discovery and TCP for signaling.
"""

import socket
import json
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

DISCOVERY_PORT = 45000
SIGNALING_PORT = 45001
BROADCAST_INTERVAL = 2

rooms = {}
rooms_lock = threading.Lock()

class DiscoveryServer:
    def __init__(self):
        self.running = False
        
    def start(self):
        self.running = True
        
        # Start UDP broadcast listener
        udp_thread = threading.Thread(target=self.udp_listener, daemon=True)
        udp_thread.start()
        
        # Start TCP signaling server
        tcp_thread = threading.Thread(target=self.tcp_server, daemon=True)
        tcp_thread.start()
        
        # Start cleanup thread
        cleanup_thread = threading.Thread(target=self.cleanup_loop, daemon=True)
        cleanup_thread.start()
        
        print(f"Discovery server started on UDP:{DISCOVERY_PORT}, TCP:{SIGNALING_PORT}")
    
    def udp_listener(self):
        """Listen for room announcements via UDP broadcast"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.bind(('', DISCOVERY_PORT))
        sock.settimeout(1.0)
        
        while self.running:
            try:
                data, addr = sock.recvfrom(1024)
                message = json.loads(data.decode('utf-8'))
                
                if message.get('type') == 'room_announce':
                    with rooms_lock:
                        rooms[message['roomId']] = {
                            'id': message['roomId'],
                            'name': message.get('roomName', 'Room'),
                            'players': message.get('players', 1),
                            'maxPlayers': message.get('maxPlayers', 4),
                            'hostIp': addr[0],
                            'hostPort': message.get('port', SIGNALING_PORT),
                            'lastSeen': time.time()
                        }
                    print(f"Room announced: {message['roomId']} from {addr[0]}")
                    
            except socket.timeout:
                continue
            except Exception as e:
                print(f"UDP error: {e}")
    
    def tcp_server(self):
        """TCP signaling server for WebRTC offer/answer exchange"""
        server = HTTPServer(('0.0.0.0', SIGNALING_PORT), SignalingHandler)
        server.serve_forever()
    
    def cleanup_loop(self):
        """Remove stale rooms"""
        while self.running:
            time.sleep(10)
            now = time.time()
            with rooms_lock:
                stale = [rid for rid, r in rooms.items() if now - r['lastSeen'] > 30]
                for rid in stale:
                    del rooms[rid]
                    print(f"Removed stale room: {rid}")


class SignalingHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Get list of available rooms"""
        if self.path == '/rooms':
            with rooms_lock:
                response = json.dumps(list(rooms.values()))
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Handle signaling messages (offer/answer/ice)"""
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        try:
            message = json.loads(body.decode('utf-8'))
            
            if message.get('type') == 'announce':
                # Room announcement
                with rooms_lock:
                    rooms[message['roomId']] = {
                        'id': message['roomId'],
                        'name': message.get('roomName', 'Room'),
                        'players': message.get('players', 1),
                        'maxPlayers': message.get('maxPlayers', 4),
                        'hostIp': self.client_address[0],
                        'lastSeen': time.time()
                    }
                self.send_response(200)
                
            elif message.get('type') == 'leave':
                # Room removal
                with rooms_lock:
                    rooms.pop(message.get('roomId'), None)
                self.send_response(200)
                
            else:
                self.send_response(400)
                
        except Exception as e:
            print(f"Signaling error: {e}")
            self.send_response(500)
        
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
    
    def log_message(self, format, *args):
        pass  # Suppress default logging


if __name__ == '__main__':
    server = DiscoveryServer()
    server.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        server.running = False
        print("Server stopped")
