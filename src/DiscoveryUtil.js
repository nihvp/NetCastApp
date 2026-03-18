import dgram from 'react-native-udp';
import { Buffer } from 'buffer';

export const discoverLGTV = (onDiscovered, onError) => {
  const socket = dgram.createSocket('udp4');
  socket.bind(0);

  socket.once('listening', () => {
    const message = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n' +
      'HOST: 239.255.255.250:1900\r\n' +
      'MAN: "ssdp:discover"\r\n' +
      'MX: 3\r\n' +
      'ST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n\r\n'
    );

    socket.send(message, 0, message.length, 1900, '239.255.255.250', (err) => {
      if (err) onError('Failed to send discovery packet: ' + err.message);
    });
  });

  socket.on('message', (msg, rinfo) => {
    const response = msg.toString();
    if (response.includes('LG') || response.includes('NetCast')) {
      onDiscovered(rinfo.address);
      try { socket.close(); } catch (e) {}
    }
  });

  setTimeout(() => {
    try { socket.close(); } catch (e) {}
    onError('No TV found. Please enter IP manually.');
  }, 5000);
};